
/* LiveIt W1 IndexedDB repository, intentionally no network/KeepIt/TravelIt transport.
   Local data is browser-profile scoped, not immune to browser data deletion or quota eviction.
   CommonJS + browser-compatible; no external runtime dependencies. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.LiveItLocalStore = api;
})(typeof window !== 'undefined' ? window : undefined, function () {
  'use strict';
  const DB_NAME = 'liveit_w2_local_v1';
  const DB_VERSION = 2; // W5A: additive, non-destructive note association store upgrade
  const STORES = ['meta','records','operations','audit','drafts','spaces', 'projection_records',
    'projection_receipts','projection_tombstones','outbox','integration_bindings','note_associations','note_association_ops'];
  const STORE_KEY = {
    meta:'key', records:'id', operations:'opId', audit:'id', drafts:'workspace', spaces:'workspace',
    projection_records:'key', projection_receipts:'key', projection_tombstones:'key',
    outbox:'id', integration_bindings:'id',note_associations:'id',note_association_ops:'opId'
  };
  const clone = v => JSON.parse(JSON.stringify(v));
  function parkedDraftKey(workspace,draft){
    const opId=draft?.opId;
    if(!WORKSPACES.has(workspace)||typeof opId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(opId))
      throw new Error('Cannot park a draft without a safe identity');
    return `parked:${workspace}:${opId}`;
  }
  function request(req) { return new Promise((resolve,reject) => {req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error || new Error('IndexedDB operation failed'));}); }
  function transactionDone(tx) {return new Promise((resolve,reject)=>{
    tx.oncomplete=()=>resolve();
    tx.onabort=()=>reject(tx.error || new Error('IndexedDB transaction aborted'));
    tx.onerror=()=>{};
  });}
  function upgrade(db,tx) {
    for (const name of STORES) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name,{keyPath:STORE_KEY[name]});
    const rec=tx.objectStore('records');
    if (!rec.indexNames.contains('workspace')) rec.createIndex('workspace','workspace');
    if (!rec.indexNames.contains('type')) rec.createIndex('type','type');
    if (!rec.indexNames.contains('date')) rec.createIndex('date','date');
    const audit=tx.objectStore('audit');
    if(!audit.indexNames.contains('recordId'))audit.createIndex('recordId','recordId');
    const proj=tx.objectStore('projection_records');
    if (!proj.indexNames.contains('workspace')) proj.createIndex('workspace','workspace');
    const note=tx.objectStore('note_associations');
    if(!note.indexNames.contains('workspace'))note.createIndex('workspace','workspace');
    if(!note.indexNames.contains('entityId'))note.createIndex('entityId','entityId');
  }
  function openDB(idb,name=DB_NAME){return new Promise((resolve,reject)=>{
    if (!idb || !idb.open) return reject(new Error('IndexedDB unavailable in this browser context'));
    const req=idb.open(name,DB_VERSION);
    req.onupgradeneeded=()=>upgrade(req.result,req.transaction);
    req.onsuccess=()=>{const db=req.result;db.onversionchange=()=>db.close();resolve(db);};
    req.onerror=()=>reject(req.error||new Error('Cannot open local database'));
    req.onblocked=()=>reject(new Error('Database upgrade blocked by another open LiveIt window'));
  });}
  function checked(data,core){core.assertData(data);const ids=new Set(),ops=new Set();
    for(const r of data.records){if(ids.has(r.id))throw new Error('Duplicate record ID');ids.add(r.id);
      if(typeof r.opId!=='string'||!r.opId)throw new Error('Missing record operation identity');}
    for(const opId of data.operations){if(typeof opId!=='string'||!opId||ops.has(opId))throw new Error('Invalid or duplicate operation receipt');ops.add(opId);}
    return data;
  }
  // W5A: local-only association validation. Shape does NOT grant KeepIt authorization.
  const WORKSPACES=new Set(['work','personal']);
  const ENTITY_TYPES=new Set(['note','quote','task','reminder','event','journal']);
  const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
  const REF_SCOPE=/^sha256:[a-f0-9]{64}$/;
  const FORBIDDEN=/token|secret|password|credential|bearer|private.?key|cookie|authorization|session|access.?key|refresh.?key/i;
  const PLAIN=x=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
  function validateNoteReference(ref){
    if(!PLAIN(ref)||ref.provider!=='keepit'||ref.version!==1||!REF_SCOPE.test(ref.scope)||
      !UUID.test(ref.itemId)||!Number.isSafeInteger(ref.revision)||ref.revision<0)
      throw new Error('Invalid KeepIt reference-v1; link remains local-only');
    // Extra known-safe metadata is preserved; credentials/nested bodies are not stored here.
    for(const [k,v] of Object.entries(ref)){
      if(FORBIDDEN.test(k)||['__proto__','constructor','prototype'].includes(k)||
        (typeof v!=='string'&&typeof v!=='number'&&typeof v!=='boolean')||
        (typeof v==='string'&&v.length>256))throw new Error('Unsafe KeepIt reference metadata');
    }
    if(JSON.stringify(ref).length>2048)throw new Error('Oversized KeepIt reference');
    return ref;
  }
  function validateAssociation(a,records){
    if(!PLAIN(a)||a.schemaVersion!==1||typeof a.id!=='string'||!UUID.test(a.id)||
      a.appId!=='liveit'||!WORKSPACES.has(a.workspace)||a.workspaceId!==a.workspace||
      !ENTITY_TYPES.has(a.entityType)||typeof a.entityId!=='string'||!a.entityId||a.entityId.length>128||
      typeof a.purpose!=='string'||!/^[-a-z0-9]{1,50}$/.test(a.purpose)||
      a.copySemantics!=='shared-reference'||!['active','unlinked'].includes(a.state)||
      !Number.isSafeInteger(a.localRevision)||a.localRevision<1||
      typeof a.updatedAt!=='string'||!Number.isFinite(Date.parse(a.updatedAt)))throw new Error('Invalid LiveIt note association');
    validateNoteReference(a.noteReference);
    if(!records.some(r=>r.id===a.entityId&&r.workspace===a.workspace&&r.type===a.entityType))
      throw new Error('Orphaned or cross-workspace note association');
    if(JSON.stringify(a).length>4096)throw new Error('Oversized LiveIt association');
    const allowed=new Set(['schemaVersion','id','appId','workspace','workspaceId','entityType','entityId',
      'purpose','copySemantics','state','localRevision','updatedAt','noteReference','lastOperationId']);
    if(Object.keys(a).some(k=>!allowed.has(k)))throw new Error('Unexpected note association field');
    if(typeof a.lastOperationId!=='string'||a.lastOperationId.length>128||!a.lastOperationId)
      throw new Error('Invalid note association operation');
    return a;
  }
  function validateNoteCollections(associations,ops,records){
    const ownerKeys=new Set(),ids=new Set(),opKeys=new Set();
    for(const a of associations){validateAssociation(a,records);
      if(ids.has(a.id))throw new Error('Duplicate note association ID');ids.add(a.id);
      if(a.state==='active'){
        const key=[a.workspace,a.entityType,a.entityId,a.purpose].join('\u0000');
        if(ownerKeys.has(key))throw new Error('Duplicate active note owner/purpose');ownerKeys.add(key);
      }
    }
    for(const op of ops){if(!PLAIN(op)||typeof op.opId!=='string'||!op.opId||op.opId.length>128||opKeys.has(op.opId)||
        !ids.has(op.associationId)||typeof op.fingerprint!=='string'||!op.fingerprint||
        !Number.isSafeInteger(op.localRevision)||op.localRevision<1)
        throw new Error('Invalid note association operation receipt');opKeys.add(op.opId);
    }
  }
  function canonicalBackup(snapshot){
    if(!snapshot||snapshot.format!=='liveit-w1-export'||![1,2].includes(snapshot.formatVersion)||
       !PLAIN(snapshot.stores))throw new Error('Unsupported backup format');
    const original=Object.keys(snapshot.stores);
    const v1=STORES.filter(s=>!['note_associations','note_association_ops'].includes(s));
    const expected=snapshot.formatVersion===1?v1:STORES;
    if(original.length!==expected.length||original.some(name=>!expected.includes(name)))
      throw new Error('Backup store manifest mismatch');
    const stores={...snapshot.stores};
    if(snapshot.formatVersion===1){stores.note_associations=[];stores.note_association_ops=[];}
    return stores;
  }
  function sameRestoredData(a,b){
    const normalize=(rows,name)=>rows.map(x=>name==='meta'&&x.key==='state'?(({revision,restoredAt,restoredSourceRevision,...keep})=>keep)(x):x)
      .sort((x,y)=>JSON.stringify(x).localeCompare(JSON.stringify(y)));
    const left=Object.prototype.hasOwnProperty.call(a,'note_associations')?a:{...a,note_associations:[],note_association_ops:[]};
    return STORES.every(name=>JSON.stringify(normalize(left[name],name))===JSON.stringify(normalize(b[name],name)));
  }
  function validateBackup(snapshot,core){
    const canon=canonicalBackup(snapshot);
    if(snapshot.formatVersion===2){
      const coverage=snapshot.coverage;
      if(!PLAIN(coverage)||coverage.liveitDomain!==true||coverage.noteAssociations!==true||coverage.keepitNativeNoteBodies!==false||coverage.keepitNativeAssets!==false)
        throw new Error('Incomplete or misleading W5A backup coverage manifest');
    }
    const by={};
    for(const name of STORES){
      const rows=canon[name];if(!Array.isArray(rows)||rows.length>100000)throw new Error('Invalid or oversized backup store: '+name);
      const keys=new Set();
      for(const row of rows){
        if(!row||typeof row!=='object'||Array.isArray(row))throw new Error('Invalid row in '+name);
        const key=row[STORE_KEY[name]];
        if(typeof key!=='string'||!key||keys.has(key))throw new Error('Duplicate or invalid backup key in '+name);
        keys.add(key);
      }
      by[name]=rows;
    }
    if(by.meta.length!==1||by.meta[0].key!=='state'||by.meta[0].schema!==1||!Number.isSafeInteger(by.meta[0].revision)||by.meta[0].revision<1)throw new Error('Invalid backup state revision');
    if(by.spaces.length!==2||!by.spaces.some(s=>s.workspace==='work')||!by.spaces.some(s=>s.workspace==='personal'))throw new Error('Backup must contain Work and Personal workspace definitions');
    if(by.spaces.some(s=>!Array.isArray(s.names)||s.names.some(n=>typeof n!=='string'||n.length>80)))throw new Error('Invalid Quick Space names');
    // W11: parked drafts are part of the encrypted backup and remain workspace-isolated.
    if(by.drafts.some(d=>{
      const parked=/^parked:(work|personal):([A-Za-z0-9_-]{1,100})$/.exec(d.workspace);
      const owner=parked?parked[1]:d.workspace;
      return !WORKSPACES.has(owner)||!d.content||d.content.workspace!==owner||
        typeof d.content.body!=='string'||(parked&&d.content.opId!==parked[2]);
    }))throw new Error('Invalid or cross-workspace draft');
    if(by.records.some(r=>!['work','personal'].includes(r.workspace)||typeof r.opId!=='string'||!r.opId))throw new Error('Invalid record workspace or operation identity');
    const actualDay=value=>typeof value==='string'&&/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)&&
      Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
    if(by.records.some(r=>typeof r.id!=='string'||!r.id||!actualDay(r.date)||
        (r.createdAt!==undefined&&typeof r.createdAt!=='string')||
        (r.time!==undefined&&typeof r.time!=='string')||
        !Array.isArray(r.categories)||r.categories.some(t=>typeof t!=='string')||
        (r.repeat!==undefined && !(r.repeat==='none'||(r.type==='event'&&r.repeat==='yearly')))))
      throw new Error('Invalid record field type; restore blocked');
    if(by.audit.some(a=>!['work','personal'].includes(a.workspace)||!Number.isSafeInteger(a.localRevision)||a.localRevision<1))throw new Error('Invalid audit entry');
    // W7 privacy gate: restored TravelIt records must be *fully* personal/private,
    // even when two redundant scope fields are present, and must not carry sensitive
    // itinerary/document payloads. This is restore validation, NOT source authentication.
    const travelKey=/^trv:([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}):(span|entry:([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}))$/;
    const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
    const safeTravelKeys=new Set(['key','projectionKey','contractVersion','sourceApp','sourceEntityType','sourceId',
      'editAuthority','sourceRevision','visibility','workspace','calendarScope','timezone','eventType','title',
      'startDate','endDateExclusive','startUTC','endUTC','originalStartLocal','originalStartOffsetMinutes',
      'status','openInSource','remoteRevision','generation']);
    const dateOnly=value=>typeof value==='string'&&/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)&&
      Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
    const utcInstant=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)&&Number.isFinite(Date.parse(value));
    const badTravel=by.projection_records.some(p=>{
      if(!PLAIN(p)||Object.keys(p).some(key=>!safeTravelKeys.has(key)))return true;
      const m=travelKey.exec(p.key||'');
      if(!m||p.projectionKey!==undefined&&p.projectionKey!==p.key||p.sourceApp!=='travelit'||
         p.editAuthority!=='travelit'||p.visibility!=='private'||
         (p.workspace!==undefined&&p.workspace!=='personal')||
         (p.calendarScope!==undefined&&p.calendarScope!=='personal')||
         (p.workspace===undefined&&p.calendarScope===undefined)||
         typeof p.sourceRevision!=='string'||!p.sourceRevision||p.sourceRevision.length>120||
         typeof p.title!=='string'||!p.title.trim()||p.title.length>200||
         (p.status!==undefined&&!['confirmed','tentative'].includes(p.status))||
         (p.contractVersion!==undefined&&p.contractVersion!=='0.1.0'))return true;
      if(typeof p.timezone!=='string'||!p.timezone||p.timezone.length>100)return true;
      try{new Intl.DateTimeFormat('en',{timeZone:p.timezone});}catch{return true;}
      if(p.sourceId!==undefined&&(!uuid.test(p.sourceId)||p.sourceId.toLowerCase()!==(m[3]||m[1])))return true;
      if(p.sourceEntityType!==undefined&&p.sourceEntityType!==(m[2]==='span'?'trip':'entry'))return true;
      if(p.openInSource!==undefined){
        const x=p.openInSource;
        if(!PLAIN(x)||Object.keys(x).some(k=>!['app','tripId','entryId'].includes(k))||x.app!=='travelit'||
           !uuid.test(x.tripId)||x.tripId.toLowerCase()!==m[1]||
           (m[2]==='span'&&x.entryId!==undefined)||
           (m[2]!=='span'&&(typeof x.entryId!=='string'||!uuid.test(x.entryId)||x.entryId.toLowerCase()!==m[3])))return true;
      }
      if(m[2]==='span')return p.eventType!=='all_day'||!dateOnly(p.startDate)||!dateOnly(p.endDateExclusive)||
        p.startDate>=p.endDateExclusive||['startUTC','endUTC','originalStartLocal','originalStartOffsetMinutes'].some(k=>k in p);
      if(p.eventType!=='timed'||!utcInstant(p.startUTC)||!utcInstant(p.endUTC)||
         Date.parse(p.startUTC)>=Date.parse(p.endUTC)||['startDate','endDateExclusive'].some(k=>k in p))return true;
      // New versioned TravelIt contracts must retain venue-local booking provenance.
      if(p.contractVersion==='0.1.0'||'originalStartLocal' in p||'originalStartOffsetMinutes' in p){
        if(typeof p.originalStartLocal!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(p.originalStartLocal)||
           !Number.isInteger(p.originalStartOffsetMinutes)||Math.abs(p.originalStartOffsetMinutes)>14*60)return true;
        const fields=new Intl.DateTimeFormat('en-GB',{timeZone:p.timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(p.startUTC));
        const z=Object.fromEntries(fields.filter(v=>v.type!=='literal').map(v=>[v.type,v.value]));
        if(`${z.year}-${z.month}-${z.day}T${z.hour}:${z.minute}:${z.second}`!==p.originalStartLocal||
           (Date.parse(p.originalStartLocal+'Z')-Date.parse(p.startUTC))/60000!==p.originalStartOffsetMinutes)return true;
      }
      return false;
    });
    if(badTravel)throw new Error('Malformed, cross-workspace or sensitive TravelIt projection in backup');
    validateNoteCollections(by.note_associations,by.note_association_ops,by.records);
    // Connected-app secrets and uncommitted cloud commands must NEVER be replayed on another installation.
    if(by.integration_bindings.length||by.outbox.length||by.projection_receipts.length)throw new Error('Connected-app bindings or pending sync operations require a future, account-bound recovery protocol');
    const names=Object.fromEntries(by.spaces.map(s=>[s.workspace,s.names]));
    checked({schema:1,records:by.records,operations:by.operations.map(o=>o.opId),spaces:names},core);
    return {revision:by.meta[0].revision,recordCount:by.records.length,draftCount:by.drafts.length};
  }
  function populate(tx,data){
    const records=tx.objectStore('records'); for(const r of data.records)records.put(clone(r));
    const ops=tx.objectStore('operations');for(const opId of data.operations)ops.put({opId});
    const spaces=tx.objectStore('spaces');for(const workspace of ['work','personal'])spaces.put({workspace, names:clone(data.spaces[workspace])});
  }
  class LocalStore {
    constructor(db, core){this.db=db;this.core=core;this.revision=0;}
    static async connect({indexedDB, core, name=DB_NAME, legacyRaw=null, legacyDrafts=null, seed=null}){
      if(!core || typeof core.assertData!=='function')throw new Error('Core validator required');
      const db=await openDB(indexedDB,name);const store=new LocalStore(db,core);
      let created=false, migrated=false;
      // One RW transaction protects first-time creation across simultaneous tabs.
      const tx=db.transaction(['meta','records','operations','spaces','drafts'],'readwrite');
      const done=transactionDone(tx);
      const meta=await request(tx.objectStore('meta').get('state'));
      if(!meta){
        let data=seed ? clone(seed) : core.seed();
        if(legacyRaw){try{data=checked(JSON.parse(legacyRaw),core);migrated=true;}catch{migrated=false;}}
        checked(data,core);populate(tx,data);
        // Preserve existing legacy drafts without mutating the original localStorage keys.
        if (legacyDrafts && typeof legacyDrafts === 'object') {
          for (const workspace of ['work','personal']) {
            const d=legacyDrafts[workspace];
            if(d && d.workspace===workspace && typeof d.body==='string')
              tx.objectStore('drafts').put({workspace,content:clone(d),modifiedAt:new Date().toISOString()});
          }
        }
        tx.objectStore('meta').put({key:'state',revision:1,schema:1,initializedAt:new Date().toISOString(),migratedFromLegacy:migrated});
        created=true;
      }
      await done;
      const snapshot=await store.load();
      return {store,created,migrated,data:snapshot.data,revision:snapshot.revision};
    }
    // W17G: one IndexedDB readonly transaction provides a point-in-time view
    // of records, workspaces, operation receipts, current and parked drafts.
    // This prevents the UI from combining record revision N with draft N+1
    // when another LiveIt tab writes between independent read transactions.
    async loadConsistentSnapshot(){
      const tx=this.db.transaction(['meta','records','operations','spaces','drafts'],'readonly');
      const done=transactionDone(tx);
      const [meta,records,operations,spaces,draftRows]=await Promise.all([
        request(tx.objectStore('meta').get('state')),
        request(tx.objectStore('records').getAll()),
        request(tx.objectStore('operations').getAll()),
        request(tx.objectStore('spaces').getAll()),
        request(tx.objectStore('drafts').getAll())
      ]);
      await done;
      if(!meta || !Number.isSafeInteger(meta.revision) || typeof meta.initializedAt!=='string')
        throw new Error('LiveIt consistent library metadata unavailable');
      const names={work:[],personal:[]};
      for(const s of spaces)if(s.workspace in names)names[s.workspace]=s.names;
      const data=checked({schema:1,
        records:records.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')),
        spaces:names,operations:operations.map(o=>o.opId)},this.core);
      const drafts={work:null,personal:null},parked={work:[],personal:[]};
      for(const row of draftRows){
        if(row.workspace==='work'||row.workspace==='personal'){
          drafts[row.workspace]=row.content||null;
        }else{
          const match=/^parked:(work|personal):[A-Za-z0-9_-]{1,100}$/.exec(row.workspace||'');
          if(match)parked[match[1]].push({id:row.workspace,content:clone(row.content),modifiedAt:row.modifiedAt});
        }
      }
      for(const workspace of ['work','personal'])
        parked[workspace].sort((a,b)=>(b.modifiedAt||'').localeCompare(a.modifiedAt||''));
      this.revision=meta.revision;
      return {data,drafts,parked,revision:meta.revision,dbEpoch:meta.initializedAt};
    }
    async listProjections(){
      // Read-only staging surface: no live cross-app writer or KeepIt authorization.
      const tx=this.db.transaction('projection_records','readonly'),done=transactionDone(tx);
      const values=await request(tx.objectStore('projection_records').getAll());await done;
      return values;
    }
    async load(){
      const tx=this.db.transaction(['meta','records','operations','spaces'],'readonly');const done=transactionDone(tx);
      const results=await Promise.all([
        request(tx.objectStore('meta').get('state')),
        request(tx.objectStore('records').getAll()),
        request(tx.objectStore('operations').getAll()),
        request(tx.objectStore('spaces').getAll())
      ]); await done;
      const [meta,records,operations,spaces]=results;
      if(!meta)throw new Error('LiveIt local database has no initialization metadata');
      const names={work:[],personal:[]};for(const s of spaces)if(s.workspace in names) names[s.workspace]=s.names;
      const data=checked({schema:1,records:records.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')),spaces:names,operations:operations.map(o=>o.opId)},this.core);
      this.revision=meta.revision;
      return {data, revision:meta.revision, migrated:meta.migratedFromLegacy};
    }
    async save(next,previous,{clearDraftWorkspace=null,clearDraftOpId=null,workspaceTransfer=null,calendarImport=false}={}){
      checked(next,this.core);checked(previous,this.core);
      if(clearDraftWorkspace && !['work','personal'].includes(clearDraftWorkspace))throw new Error('Invalid draft workspace');
      if(clearDraftWorkspace && clearDraftOpId!==null && (typeof clearDraftOpId!=='string'||!clearDraftOpId))throw new Error('Invalid draft identity');
      const older=new Map(previous.records.map(r=>[r.id,r]));
      const newer=new Map(next.records.map(r=>[r.id,r]));
      const moves=next.records.filter(r=>older.has(r.id)&&older.get(r.id).workspace!==r.workspace);
      if(moves.length){
        const r=moves[0],from=older.get(r.id).workspace;
        if(moves.length!==1||!workspaceTransfer||workspaceTransfer.id!==r.id||workspaceTransfer.from!==from||workspaceTransfer.to!==r.workspace||from===r.workspace||!WORKSPACES.has(from)||!WORKSPACES.has(r.workspace))
          throw new Error('Explicit workspace transfer authorization required');
      }else if(workspaceTransfer)throw new Error('Workspace transfer requested but record was not moved');
      if(previous.records.some(r=>!newer.has(r.id))) throw new Error('Hard deletion is disabled; archive records instead');
      const updates=next.records.filter(r=>JSON.stringify(older.get(r.id))!==JSON.stringify(r));
      const deletes=previous.records.filter(r=>!newer.has(r.id));
      const oldOps=new Set(previous.operations); const addedOps=next.operations.filter(op=>!oldOps.has(op));
      // W5D: operation receipts are append-only. An accidentally stale client snapshot
      // must not be able to make a committed operation disappear from the UI model.
      if(previous.operations.some(op=>!next.operations.includes(op)))
        throw new Error('Cannot remove committed operation receipts');
      const tx=this.db.transaction(['meta','records','operations','audit','spaces','drafts',...(workspaceTransfer?['note_associations']:[])],'readwrite');
      const done=transactionDone(tx);
      const current=await request(tx.objectStore('meta').get('state'));
      if(!current||current.revision!==this.revision){tx.abort();try{await done;}catch{};throw new Error('Data changed in another LiveIt window. Copy your draft, reload, then retry.');}
      if(workspaceTransfer){
        // The association check occurs in the SAME IDB transaction as the record update.
        // Never move an entity with KeepIt references, even historical/unlinked ones.
        const links=await request(tx.objectStore('note_associations').getAll());
        if(links.some(a=>a.entityId===workspaceTransfer.id)){
          tx.abort();try{await done;}catch{}
          throw new Error('This record has KeepIt note history. Workspace transfer is blocked; unlink/review the association with KeepIt first.');
        }
      }
      // W13: enforce Quick Space changes against ALL persisted drafts, not just
      // the current window's cached draft list. A rename/removal must never
      // orphan an active or parked draft in either window. This inspection is
      // in the SAME transaction as spaces and record-tag updates; concurrent
      // draft writes cannot slip between validation and commit.
      const removedSpaceTags=new Map();
      for(const workspace of ['work','personal']){
        const removed=previous.spaces[workspace].filter(tag=>!next.spaces[workspace].includes(tag));
        if(removed.length)removedSpaceTags.set(workspace,new Set(removed));
      }
      if(removedSpaceTags.size){
        const allDrafts=await request(tx.objectStore('drafts').getAll());
        const blocked=allDrafts.some(row=>{
          const owner=row.workspace==='work'||row.workspace==='personal'?row.workspace:
            /^parked:(work|personal):[A-Za-z0-9_-]{1,100}$/.exec(row.workspace||'')?.[1];
          if(!owner||!removedSpaceTags.has(owner))return false;
          const tags=row.content?.categories;
          return Array.isArray(tags)&&tags.some(tag=>removedSpaceTags.get(owner).has(tag));
        });
        if(blocked){
          tx.abort();try{await done;}catch{}
          throw new Error('Quick Space change blocked: an unfinished draft still uses this category. Recover or refile the draft first; nothing changed.');
        }
      }
      for (const r of updates){
        const old=older.get(r.id),prior=old?._calendarSync;
        if(!calendarImport&&r.type==='event'&&(old?.type!=='event'||this.core.eventSignature(old)!==this.core.eventSignature(r))){
          r._calendarSync={...(prior||{}),target:prior?.target||current.calendarTarget||null,version:prior?.version||0,pending:true,operationId:crypto.randomUUID()};delete r._calendarSync.outgoing;delete r._calendarSync.conflict;
        }else if(!calendarImport&&r.type!=='event'&&old?.type==='event'){
          r._calendarSync={...(prior||{}),target:prior?.target||current.calendarTarget||null,version:prior?.version||0,pending:true,operationId:crypto.randomUUID(),outgoing:JSON.stringify({...this.core.eventPayload(old),archived:true})};
        }
        tx.objectStore('records').put(clone(r));
      }
      for (const r of deletes)tx.objectStore('records').delete(r.id);
      for (const op of addedOps)tx.objectStore('operations').add({opId:op});
      // Immutable audit rows live in the same atomic transaction as accepted changes.
      let auditSeq=0;
      const auditLog=(kind,recordId,workspace)=>tx.objectStore('audit').add({
        id:`audit:${current.revision+1}:${++auditSeq}:${recordId}`,
        kind,recordId,workspace,localRevision:current.revision+1,createdAt:new Date().toISOString()
      });
      for(const r of updates) auditLog(older.has(r.id)?(workspaceTransfer&&r.id===workspaceTransfer.id?'workspace:move':'update'):'create',r.id,r.workspace);
      for(const workspace of ['work','personal'])if(JSON.stringify(next.spaces[workspace])!==JSON.stringify(previous.spaces[workspace]))
        auditLog('spaces:update',`spaces:${workspace}`,workspace);
      for (const workspace of ['work','personal'])if(JSON.stringify(next.spaces[workspace])!==JSON.stringify(previous.spaces[workspace]))
        tx.objectStore('spaces').put({workspace,names:clone(next.spaces[workspace])});
      if(clearDraftWorkspace){
        // W11: an unrelated unfinished draft must never be erased by saving another record.
        // Preserve it transactionally beside the new record, including its edit context.
        const draftStore=tx.objectStore('drafts');
        const previousDraft=await request(draftStore.get(clearDraftWorkspace));
        if(previousDraft && previousDraft.content?.opId!==clearDraftOpId){
          if(previousDraft.content?.body?.trim()){
            const parkedKey=parkedDraftKey(clearDraftWorkspace,previousDraft.content);
            draftStore.put({...previousDraft,workspace:parkedKey});
          }
        }
        draftStore.delete(clearDraftWorkspace);
      }
      tx.objectStore('meta').put({...current,revision:current.revision+1,updatedAt:new Date().toISOString()});
      await done;
      this.revision++;
      return {revision:this.revision,changedRecords:updates.length+deletes.length};
    }
    async bindCalendarTarget(target){
      if(typeof target!=='string'||target.length>512)throw Error('Invalid calendar library.');
      const tx=this.db.transaction(['meta','records'],'readwrite'),done=transactionDone(tx),state=await request(tx.objectStore('meta').get('state'));
      if(state.calendarTarget&&state.calendarTarget!==target){await done;return false;}
      if(state.calendarTarget===target){await done;return true;}
      if(state.revision!==this.revision){tx.abort();try{await done;}catch{};throw Error('Reload LiveIt before connecting its calendar.');}
      const rows=await request(tx.objectStore('records').getAll());
      for(const row of rows)if(row.type==='event')tx.objectStore('records').put({...row,_calendarSync:{target,version:0,pending:true,operationId:crypto.randomUUID()}});
      tx.objectStore('meta').put({...state,calendarTarget:target,revision:state.revision+1});await done;this.revision++;return true;
    }
    async calendarTarget(){const tx=this.db.transaction('meta','readonly'),done=transactionDone(tx),s=await request(tx.objectStore('meta').get('state'));await done;return s.calendarTarget||null;}
    // W5C: draft mutations and revision stamp commit in the same transaction.
    // Prevents stale backup-verification claims after edits in another window.
    async putDraft(workspace,draft){
      if(!WORKSPACES.has(workspace)||!PLAIN(draft)||draft.workspace!==workspace||typeof draft.body!=='string')
        throw new Error('Draft workspace mismatch or malformed content');
      const tx=this.db.transaction(['meta','drafts'],'readwrite'),done=transactionDone(tx);
      try{
        const meta=await request(tx.objectStore('meta').get('state'));
        if(!meta||meta.revision!==this.revision)throw new Error('Data changed in another LiveIt window; reload before saving draft');
        const draftStore=tx.objectStore('drafts');
        const prior=await request(draftStore.get(workspace));
        if(prior&&prior.content?.opId!==draft.opId&&prior.content?.body?.trim()){
          draftStore.put({...prior,workspace:parkedDraftKey(workspace,prior.content)});
        }
        draftStore.put({workspace,content:clone(draft),modifiedAt:new Date().toISOString()});
        tx.objectStore('meta').put({...meta,revision:meta.revision+1,updatedAt:new Date().toISOString()});
        await done;this.revision=meta.revision+1;
      }catch(error){try{tx.abort();}catch{};try{await done;}catch{};throw error;}
    }
    // W17H: when a second window invalidates this editor's revision, write a
    // *separate* recovery copy. Never replace the active draft or record.
    // A unique per-editor recovery operation ID prevents two editors that
    // started from the same draft operation from overwriting each other's copy.
    async parkConflictCopy(workspace,draft,expectedEpoch,recoveryOpId){
      if(!WORKSPACES.has(workspace)||!draft||draft.workspace!==workspace ||
         typeof draft.body!=='string'||!draft.body.trim())
        throw new Error('Invalid recovery draft; current editor remains open');
      const key=parkedDraftKey(workspace,{opId:recoveryOpId});
      if(typeof expectedEpoch!=='string'||!expectedEpoch)
        throw new Error('Recovery database identity unavailable');
      const tx=this.db.transaction(['meta','drafts'],'readwrite'),done=transactionDone(tx);
      try{
        const meta=await request(tx.objectStore('meta').get('state'));
        if(!meta || meta.initializedAt!==expectedEpoch){
          throw new Error('The local library was replaced. Recovery copy was NOT written to a different library. Keep the editor open and copy your text.');
        }
        // Keep the original record/edit identity but issue a NEW operation ID
        // to this recovery copy, which can later be resumed independently.
        const recovered={...clone(draft),opId:recoveryOpId,conflictSourceOpId:draft.opId};
        tx.objectStore('drafts').put({workspace:key,content:recovered,modifiedAt:new Date().toISOString(),recoveryReason:'concurrent-edit'});
        tx.objectStore('meta').put({...meta,revision:meta.revision+1,updatedAt:new Date().toISOString()});
        await done;this.revision=meta.revision+1;
        return key;
      }catch(error){try{tx.abort()}catch{};try{await done}catch{};throw error;}
    }
    async listParkedDrafts(workspace){
      if(!WORKSPACES.has(workspace))throw new Error('Invalid workspace');
      const tx=this.db.transaction('drafts','readonly'),done=transactionDone(tx);
      const rows=await request(tx.objectStore('drafts').getAll());await done;
      return rows.filter(row=>typeof row.workspace==='string'&&row.workspace.startsWith(`parked:${workspace}:`))
        .sort((a,b)=>(b.modifiedAt||'').localeCompare(a.modifiedAt||''))
        .map(row=>({id:row.workspace,content:clone(row.content),modifiedAt:row.modifiedAt}));
    }
    async activateParkedDraft(workspace,key){
      if(!WORKSPACES.has(workspace)||typeof key!=='string'||!key.startsWith(`parked:${workspace}:`))
        throw new Error('Invalid parked draft selection');
      const tx=this.db.transaction(['meta','drafts'],'readwrite'),done=transactionDone(tx);
      try{
        const meta=await request(tx.objectStore('meta').get('state'));
        if(!meta||meta.revision!==this.revision)throw new Error('Data changed in another LiveIt window; reload first');
        const drafts=tx.objectStore('drafts');
        const selected=await request(drafts.get(key));
        if(!selected||!selected.content||selected.content.workspace!==workspace)
          throw new Error('Parked draft unavailable for this workspace');
        const current=await request(drafts.get(workspace));
        if(current?.content?.body?.trim()&&current.content.opId!==selected.content.opId)
          drafts.put({...current,workspace:parkedDraftKey(workspace,current.content)});
        drafts.delete(key);
        drafts.put({workspace,content:clone(selected.content),modifiedAt:new Date().toISOString()});
        tx.objectStore('meta').put({...meta,revision:meta.revision+1,updatedAt:new Date().toISOString()});
        await done;this.revision=meta.revision+1;
        return clone(selected.content);
      }catch(err){try{tx.abort();}catch{};try{await done;}catch{};throw err;}
    }
    async getDraft(workspace){if(!WORKSPACES.has(workspace))throw new Error('Invalid workspace');
      const tx=this.db.transaction('drafts','readonly'),done=transactionDone(tx);
      const result=await request(tx.objectStore('drafts').get(workspace));await done;
      return result?.content||null;
    }
    async deleteDraft(workspace){
      if(!WORKSPACES.has(workspace))throw new Error('Invalid workspace');
      const tx=this.db.transaction(['meta','drafts'],'readwrite'),done=transactionDone(tx);
      try{
        const meta=await request(tx.objectStore('meta').get('state'));
        if(!meta||meta.revision!==this.revision)throw new Error('Data changed in another LiveIt window; reload before deleting draft');
        const draft=await request(tx.objectStore('drafts').get(workspace));
        if(draft){
          tx.objectStore('drafts').delete(workspace);
          tx.objectStore('meta').put({...meta,revision:meta.revision+1,updatedAt:new Date().toISOString()});
        }
        await done;if(draft)this.revision=meta.revision+1;
      }catch(error){try{tx.abort();}catch{};try{await done;}catch{};throw error;}
    }
    // Read-only guard; returns only the revision, never note bodies or other-workspace data.
    async getDatabaseIdentity(){
      const tx=this.db.transaction('meta','readonly'),done=transactionDone(tx);
      const meta=await request(tx.objectStore('meta').get('state'));await done;
      if(!meta||!Number.isSafeInteger(meta.revision)||typeof meta.initializedAt!=='string')
        throw new Error('Local database identity unavailable');
      return Object.freeze({revision:meta.revision,initializedAt:meta.initializedAt});
    }
    async getPersistedRevision(){return (await this.getDatabaseIdentity()).revision;}
    // Associations do not authorize native KeepIt opens, synchronization or library access.
    // W5A never issues a remote operation or asserts connected status.
    keepItCapabilities(){return Object.freeze({state:'not_connected',canOpen:false,canCreate:false,
      canLink:false,canCopy:false,canSync:false,contractVersion:null});}
    async listNoteAssociations(workspace,{entityId=null,includeUnlinked=false}={}){
      if(!WORKSPACES.has(workspace))throw new Error('Workspace required');
      const tx=this.db.transaction(['records','note_associations'],'readonly'),done=transactionDone(tx);
      const notes=await request(tx.objectStore('note_associations').getAll());
      const records=await request(tx.objectStore('records').getAll());await done;
      const valid=new Set(records.filter(r=>r.workspace===workspace).map(r=>r.id));
      return notes.filter(a=>a.workspace===workspace&&valid.has(a.entityId)&&
         (entityId===null||a.entityId===entityId)&&(includeUnlinked||a.state==='active')).map(clone);
    }
    async setNoteAssociation(input,{operationId,expectedLocalRevision=null}={}){
      if(typeof operationId!=='string'||!operationId||operationId.length>128)throw new Error('Operation ID required');
      // Fingerprint excludes derived fields; retrying the exact command is idempotent.
      const requestFields=['id','appId','workspace','workspaceId','entityType','entityId',
        'purpose','copySemantics','state','noteReference'];
      const intent={};for(const key of requestFields)intent[key]=input?.[key];
      const fingerprint=JSON.stringify(intent);
      if(fingerprint.length>4096)throw new Error('Oversized association intent');
      const tx=this.db.transaction(['meta','records','note_associations','note_association_ops'],'readwrite');
      const done=transactionDone(tx);
      try{
        const meta=await request(tx.objectStore('meta').get('state'));
        if(!meta)throw new Error('Missing local database revision');
        // W5D: a retry may arrive after an acknowledgement was lost AND another window
        // committed a later revision. Resolve an existing operation receipt first;
        // this path is read-only and must never replay a write.
        const receipt=await request(tx.objectStore('note_association_ops').get(operationId));
        if(receipt){
          if(receipt.fingerprint!==fingerprint)throw new Error('Operation ID reused for a different command');
          const saved=await request(tx.objectStore('note_associations').get(receipt.associationId));
          if(!saved||!Number.isSafeInteger(receipt.localRevision)||saved.localRevision<receipt.localRevision)
            throw new Error('Invalid or missing note receipt target');
          const superseded=saved.localRevision!==receipt.localRevision;
          const requiresRefresh=meta.revision!==this.revision;
          await done;return {association:clone(saved),replayed:true,revision:meta.revision,
            receiptLocalRevision:receipt.localRevision,superseded,requiresRefresh};
        }
        if(meta.revision!==this.revision)throw new Error('Stale local database revision; reload first');
        const records=await request(tx.objectStore('records').getAll());
        const existing=await request(tx.objectStore('note_associations').get(input.id));
        if(existing){
          if(expectedLocalRevision!==existing.localRevision)throw new Error('Stale note association revision');
          if(existing.workspace!==input.workspace||existing.entityType!==input.entityType||
             existing.entityId!==input.entityId||existing.purpose!==input.purpose)
             throw new Error('Association owner cannot be silently changed');
          if(existing.noteReference.scope!==input.noteReference.scope||
             existing.noteReference.itemId!==input.noteReference.itemId)
             throw new Error('Changing native note identity requires explicit unlink + new association');
          if(input.noteReference.revision<existing.noteReference.revision)
             throw new Error('Native note revision cannot regress');
        }else if(expectedLocalRevision!==null)throw new Error('Unexpected note association base revision');
        const newRow={...intent,schemaVersion:1,localRevision:(existing?.localRevision||0)+1,
          updatedAt:new Date().toISOString(),lastOperationId:operationId};
        validateAssociation(newRow,records);
        const others=await request(tx.objectStore('note_associations').getAll());
        validateNoteCollections(others.filter(a=>a.id!==newRow.id).concat(newRow),[],records);
        tx.objectStore('note_associations').put(clone(newRow));
        tx.objectStore('note_association_ops').add({opId:operationId,associationId:newRow.id,
          fingerprint,localRevision:newRow.localRevision});
        tx.objectStore('meta').put({...meta,revision:meta.revision+1,updatedAt:new Date().toISOString()});
        await done;this.revision=meta.revision+1;
        return {association:clone(newRow),replayed:false,revision:this.revision};
      }catch(e){try{tx.abort();}catch{};try{await done;}catch{};throw e;}
    }
    async unlinkNoteAssociation(id,{operationId,expectedLocalRevision}={}){
      if(typeof id!=='string'||!UUID.test(id)||typeof operationId!=='string'||!operationId||operationId.length>128)
        throw new Error('Valid note association and operation IDs required');
      if(!Number.isSafeInteger(expectedLocalRevision)||expectedLocalRevision<1)
        throw new Error('Expected note association revision required for unlink');
      // W5E: a retry must refer to the original command, not a newer incarnation
      // of a previously unlinked/relinked note association. Resolve its receipt
      // before reconstructing a command from current state, without writing.
      const tx=this.db.transaction(['note_associations','note_association_ops'],'readonly'),done=transactionDone(tx);
      const existingReceipt=await request(tx.objectStore('note_association_ops').get(operationId));
      const found=await request(tx.objectStore('note_associations').get(id));
      await done;
      if(existingReceipt){
        if(existingReceipt.associationId!==id)throw new Error('Operation ID reused for a different association');
        if(existingReceipt.localRevision!==expectedLocalRevision+1)
          throw new Error('Operation ID reused with a different expected revision');
        let original;
        try{original=JSON.parse(existingReceipt.fingerprint);}catch{throw new Error('Corrupted note unlink receipt');}
        if(!PLAIN(original)||original.id!==id||original.state!=='unlinked'||
           original.appId!=='liveit'||original.copySemantics!=='shared-reference')
          throw new Error('Operation ID is not an unlink receipt');
        // The existing setNoteAssociation receipt path revalidates the exact
        // fingerprint and current target, returns superseded/refresh indicators,
        // and commits NO mutation. In-flight concurrent changes are safe.
        return this.setNoteAssociation(original,{operationId,expectedLocalRevision});
      }
      if(!found)throw new Error('Association not found');
      return this.setNoteAssociation({...found,state:'unlinked'}, {operationId,expectedLocalRevision});
    }
    async reset(seed){checked(seed,this.core);
      const tx=this.db.transaction(['meta','records','operations','audit','spaces','drafts','projection_records','projection_receipts','projection_tombstones','outbox','integration_bindings','note_associations','note_association_ops'],'readwrite');const done=transactionDone(tx);
      const current=await request(tx.objectStore('meta').get('state'));
      if(!current||current.revision!==this.revision){tx.abort();try{await done;}catch{};throw new Error('Concurrent data change; reload before reset');}
      for(const name of ['records','operations','audit','spaces','drafts','projection_records','projection_receipts','projection_tombstones','outbox','integration_bindings','note_associations','note_association_ops'])tx.objectStore(name).clear();
      populate(tx,seed);tx.objectStore('meta').put({...current,revision:current.revision+1,resetAt:new Date().toISOString()});await done;this.revision++;
    }
    async exportContents(){
      const tx=this.db.transaction(STORES,'readonly'),done=transactionDone(tx);
      const requests=Object.fromEntries(STORES.map(name=>[name,request(tx.objectStore(name).getAll())]));
      const all={};for(const [key,promise] of Object.entries(requests))all[key]=await promise;await done;
      return {format:'liveit-w1-export',formatVersion:2,coverage:{liveitDomain:true,noteAssociations:true,keepitNativeNoteBodies:false,keepitNativeAssets:false},exportedAt:new Date().toISOString(),warning:'UNENCRYPTED. Contains LiveIt records and KeepIt link references only. Native KeepIt notes/assets and cloud data are NOT included.',stores:all};
    }
    async restoreContents(snapshot,{allowReplace=false}={}){
      // Restore is a full-store, one-transaction operation; never mix two workspaces or sources.
      const data=validateBackup(snapshot,this.core);
      const restoredStores=canonicalBackup(snapshot);
      const tx=this.db.transaction(STORES,'readwrite'),done=transactionDone(tx);
      let restoredRevision=null;
      try{
        const current=await request(tx.objectStore('meta').get('state'));
        if(!current||current.revision!==this.revision)throw new Error('Data changed in another window; reload before restore');
        if(!allowReplace){
          const dataStores=STORES.filter(s=>!['meta','spaces'].includes(s));
          const existing=await Promise.all(dataStores.map(name=>request(tx.objectStore(name).getAll())));
          if(existing.some(rows=>rows.length))throw new Error('Current database is not empty; explicit replacement required');
        }
        restoredRevision=Math.max(current.revision,data.revision,...restoredStores.audit.map(a=>a.localRevision))+1;
        for(const name of STORES)tx.objectStore(name).clear();
        for(const name of STORES){
          for(const value of restoredStores[name]){
            let row=clone(value);
            if(name==='meta'&&row.key==='state')row={...row,revision:restoredRevision,restoredAt:new Date().toISOString(),restoredSourceRevision:data.revision};
            tx.objectStore(name).put(row);
          }
        }
        await done;
      }catch(error){try{tx.abort();}catch{};try{await done;}catch{};throw error;}
      this.revision=restoredRevision;
      const readback=await this.exportContents();
      if(!sameRestoredData(snapshot.stores,readback.stores))throw new Error('Restore committed but readback mismatch. Do not repeat restore; preserve the original backup.');
      await this.load();
      return {revision:this.revision,records:data.recordCount,drafts:data.draftCount,verified:true};
    }
    close(){this.db.close();}
  }
  return {DB_NAME,DB_VERSION,STORES,LocalStore,validateBackup,validateNoteReference,validateAssociation,validateNoteCollections,canonicalBackup,sameRestoredData};
});
