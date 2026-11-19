
/* ThinkIt v0.9.21 — durable local-first rich note outbox.
 * No KeepIt networking or auth. No claim of cloud sync. IndexedDB holds full
 * HTML and embedded assets until a future verified KeepIt bridge acknowledges.
 * Can be used as a standalone JS module for isolated tests.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ThinkItLocalNotes=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const DB='ThinkIt_Mind_Offline_Notes_v1', VERSION=2, MAX_BYTES=8*1024*1024;
const validId=v=>typeof v==='string'&&v.length>0&&v.length<=256&&/^[a-zA-Z0-9_:\-.]+$/.test(v);
const utf8=v=>new TextEncoder().encode(v).length;
const scopeKey=p=>[p.projectId,p.pageId,p.topicId].join('\u001f');
function validate(p){
  if(!p||![p.projectId,p.pageId,p.topicId].every(validId))throw Error('Invalid project/page/topic identity');
  if(typeof p.html!=='string')throw Error('Note must be a string');
  if(utf8(p.html)>MAX_BYTES)throw Error('Offline note exceeds the 8 MiB local-storage safety limit');
  if(p.keepitNote!==undefined && p.keepitNote!==null && typeof p.keepitNote!=='object')throw Error('KeepIt note reference must be an object');
  return {...p,key:scopeKey(p)};
}
let opened=null;
function open(){
  if(opened)return opened;
  opened=new Promise((resolve,reject)=>{
    if(typeof indexedDB==='undefined'){reject(Error('IndexedDB is unavailable'));return;}
    let req;try{req=indexedDB.open(DB,VERSION);}catch(e){reject(e);return;}
    req.onupgradeneeded=()=>{const db=req.result;for(const s of ['pending','recovery','receipts'])if(!db.objectStoreNames.contains(s))db.createObjectStore(s,{keyPath:'key'});};
    req.onsuccess=()=>{const db=req.result;db.onversionchange=()=>{db.close();opened=null;};resolve(db);};
    req.onerror=()=>{opened=null;reject(req.error||Error('Cannot open local note vault'));};
    req.onblocked=()=>{opened=null;reject(Error('Another tab is blocking the note vault upgrade'));};
  });
  return opened;
}
function digest(html){
  if(typeof crypto!=='undefined'&&crypto.subtle)return crypto.subtle.digest('SHA-256',new TextEncoder().encode(html)).then(v=>[...new Uint8Array(v)].map(x=>x.toString(16).padStart(2,'0')).join(''));
  // Digest is not used to authorize writes; absent secure crypto we still stage.
  // Never substitute an insecure fingerprint for KeepIt's verified SHA-256.
  return Promise.resolve(null);
}
function read(p){const key=scopeKey(p);return open().then(db=>new Promise((resolve,reject)=>{
  const tx=db.transaction('pending','readonly'),req=tx.objectStore('pending').get(key);
  req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error||Error('Cannot read local draft'));
}));}
function list(projectId){if(!validId(projectId))return Promise.reject(Error('Invalid project ID'));
  return open().then(db=>new Promise((resolve,reject)=>{
    const out=[],tx=db.transaction('pending','readonly');let req=tx.objectStore('pending').openCursor();
    req.onsuccess=()=>{const cur=req.result;if(cur){if(cur.value.projectId===projectId)out.push(cur.value);cur.continue();}};
    tx.oncomplete=()=>resolve(out);tx.onerror=()=>reject(tx.error||Error('Cannot list local notes'));
  }));
}
function recoveries(projectId){if(!validId(projectId))return Promise.reject(Error('Invalid project ID'));
  return open().then(db=>new Promise((resolve,reject)=>{const out=[],tx=db.transaction('recovery','readonly'),req=tx.objectStore('recovery').openCursor();req.onsuccess=()=>{const c=req.result;if(c){if(c.value.projectId===projectId)out.push(c.value);c.continue();}};tx.oncomplete=()=>resolve(out);tx.onerror=()=>reject(tx.error||Error('Cannot list recovery copies'));}));}
async function stage(input,expectedRevision=null){
  const p=validate(input),sha256=await digest(p.html),stamp=Date.now(),bytes=utf8(p.html),db=await open();
  return new Promise((resolve,reject)=>{
    let state=null,tx;try{tx=db.transaction(['pending','recovery'],'readwrite');}catch(e){reject(e);return;}
    const store=tx.objectStore('pending'),lookup=store.get(p.key);
    lookup.onsuccess=()=>{
      const old=lookup.result||null,rev=old?.localRevision||0;
      if(old?.html===p.html){state={status:'unchanged',record:old};return;}
      if(expectedRevision!==null&&rev!==expectedRevision){
        // Never silently replace a draft written in another tab. Preserve the
        // attempted revision in a distinct recovery entry within the same tx.
        const key=p.key+'\u001f'+stamp+'_'+Math.random().toString(36).slice(2);
        const rec={...p,key,sourceKey:p.key,sha256,bytes,localRevision:rev,updatedAt:stamp,state:'conflict-recovery',expectedRevision};
        tx.objectStore('recovery').put(rec);state={status:'conflict',record:rec};return;
      }
      const rec={...p,sha256,bytes,localRevision:rev+1,updatedAt:stamp,state:'awaiting-keepit',keepitNote:p.keepitNote||old?.keepitNote||null,leaseToken:null,leaseUntil:0,lastError:null};
      store.put(rec);state={status:'staged',record:rec};
    };
    lookup.onerror=()=>reject(lookup.error||Error('Could not check previous local note'));
    tx.oncomplete=()=>resolve(state);tx.onerror=()=>reject(tx.error||Error('Local storage transaction failed'));
    tx.onabort=()=>reject(tx.error||Error('Local storage transaction aborted'));
  });
}
async function archive(input){
  const p=validate(input),db=await open(),stamp=Date.now();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('recovery','readwrite'),key=p.key+'\u001farchived_'+stamp+'_'+Math.random().toString(36).slice(2);
    tx.objectStore('recovery').put({...p,key,sourceKey:p.key,archivedAt:stamp,state:'archived-for-recovery'});
    tx.oncomplete=()=>resolve({key,archived:true});tx.onerror=()=>reject(tx.error||Error('Cannot archive local version'));
    tx.onabort=()=>reject(tx.error||Error('Archive transaction aborted'));
  });
}
async function exportRecovery(projectId){
  if(!validId(projectId))throw Error('Invalid project ID');
  const db=await open(),{drafts,conflicts}=await new Promise((resolve,reject)=>{
    const tx=db.transaction(['pending','recovery'],'readonly'),out={drafts:[],conflicts:[]};
    for(const [store,key] of [['pending','drafts'],['recovery','conflicts']]){const q=tx.objectStore(store).getAll();q.onsuccess=()=>{out[key]=q.result.filter(r=>r.projectId===projectId);};}
    tx.oncomplete=()=>resolve(out);tx.onerror=()=>reject(tx.error||Error('Cannot snapshot local note vault'));tx.onabort=()=>reject(tx.error||Error('Local note snapshot aborted'));
  });
  const backup={format:'THINKIT-UNSYNCED-NOTES',version:1,projectId,createdAt:new Date().toISOString(),
    warning:'Contains unsynced note bodies and image data. This is NOT a KeepIt or complete ThinkIt library backup.',drafts,conflicts};
  return new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
}
function verifyExportObject(data){if(!data||data.format!=='THINKIT-UNSYNCED-NOTES'||data.version!==1||!validId(data.projectId)||!Array.isArray(data.drafts)||!Array.isArray(data.conflicts))throw Error('Invalid local note backup');
  if(data.drafts.length+data.conflicts.length>25000)throw Error('Too many local recovery sources');
  const seen=new Set();for(const d of data.drafts){const key=validate(d).key;if(seen.has(key))throw Error('Duplicate pending local recovery identity');seen.add(key);}
  for(const d of [...data.drafts,...data.conflicts]){validate(d);if(d.projectId!==data.projectId)throw Error('Mismatched backup project identity');}
  return true;
}

// Restoring never overwrites a different pending revision. Every incoming
// record also survives verbatim in recovery, under a content-addressed key.
async function restoreRecovery(data){
  verifyExportObject(data);
  const prepared=[];
  for(const source of [...data.drafts,...data.conflicts]){
    const p=validate(source),identity=await digest(JSON.stringify(source));
    if(!identity)throw Error('Secure SHA-256 is required for local recovery restore');
    prepared.push({source,p,identity,sha256:await digest(p.html),pending:data.drafts.includes(source)});
  }
  const db=await open();return new Promise((resolve,reject)=>{
    const tx=db.transaction(['pending','recovery'],'readwrite'),pending=tx.objectStore('pending'),recovery=tx.objectStore('recovery');
    let added=0;
    for(const row of prepared){
      const {source,p,identity,sha256}=row,key=p.key+'\u001frestored_'+identity;
      recovery.put({...p,key,sourceKey:p.key,state:'restored-for-review',restoredSource:source});
      if(row.pending){const q=pending.get(p.key);q.onsuccess=()=>{if(q.result)return;
        pending.put({...p,sha256,bytes:utf8(p.html),state:'needs-attention',keepitNote:null,leaseToken:null,leaseUntil:0,attemptBinding:null,lastError:'Restored local source; compare before synchronizing.',restoredSource:source});added++;};}
    }
    tx.oncomplete=()=>resolve({added,preserved:prepared.length});tx.onerror=()=>reject(tx.error||Error('Local recovery restore failed'));tx.onabort=()=>reject(tx.error||Error('Local recovery restore aborted'));
  });
}

const hex64=v=>typeof v==='string'&&/^[a-f0-9]{64}$/i.test(v);
const bindingOK=b=>!!b&&validId(b.libraryId)&&validId(b.accountBinding)&&typeof b.noteSchema==='string'&&b.noteSchema.length>0;
const validRef=r=>!!r&&validId(r.libraryId)&&validId(r.itemId)&&Number.isSafeInteger(r.revision)&&r.revision>=1&&hex64(r.nativeDigest)&&typeof r.noteSchema==='string';
const token=()=>{if(typeof crypto!=='undefined'&&crypto.randomUUID)return crypto.randomUUID();throw Error('Secure random token unavailable; synchronization is blocked');};
/** Acquire an atomic cross-tab lease on exactly one persisted note revision.
 * A claim is NOT a cloud sync receipt. No note bytes are deleted. */
async function claim(input,binding,{leaseMs=60000}={}){
  if(!bindingOK(binding))throw Error('An explicit verified KeepIt library/account binding is required');
  const key=scopeKey(input),db=await open(),leaseToken=token(),now=Date.now();
  if(!Number.isFinite(leaseMs)||leaseMs<5000||leaseMs>300000)throw Error('Invalid lease interval');
  return new Promise((resolve,reject)=>{
    let result=null;const tx=db.transaction('pending','readwrite'),store=tx.objectStore('pending'),q=store.get(key);
    q.onsuccess=()=>{const record=q.result;if(!record){result={status:'missing'};return;}
      if(record.keepitNote&&record.keepitNote.libraryId!==binding.libraryId){result={status:'wrong-library'};return;}
      if(record.state==='synced-to-keepit'){result={status:'already-verified',record};return;}
      if(record.state==='needs-attention'){result={status:'needs-attention',record};return;}
      if(record.state==='sending-to-keepit'&&Number(record.leaseUntil)>now){result={status:'busy',record};return;}
      if(!hex64(record.sha256)){result={status:'digest-unavailable',record};return;}
      const next={...record,state:'sending-to-keepit',leaseToken,leaseUntil:now+leaseMs,attempts:(record.attempts||0)+1,attemptBinding:{...binding},lastError:null};
      store.put(next);result={status:'claimed',record:next,leaseToken};
    };q.onerror=()=>reject(q.error||Error('Cannot claim note'));
    tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error||Error('Claim transaction failed'));
    tx.onabort=()=>reject(tx.error||Error('Claim aborted'));
  });
}
/** Acknowledgement is only called AFTER a guarded KeepIt save and verified
 * readback. If a newer edit arrived meanwhile, retain it unsynced. */
async function acknowledge(scope,leaseToken,revision,sha256,ref,binding){
  if(!bindingOK(binding)||!validRef(ref)||ref.libraryId!==binding.libraryId||!hex64(sha256))throw Error('Unverified KeepIt acknowledgement');
  const key=scopeKey(scope),db=await open();
  return new Promise((resolve,reject)=>{
    let result=null;const tx=db.transaction(['pending','receipts'],'readwrite'),st=tx.objectStore('pending'),q=st.get(key);
    q.onsuccess=()=>{const old=q.result;
      if(!old){result={status:'missing'};return;}
      if(old.keepitNote&&old.keepitNote.itemId!==ref.itemId){result={status:'reference-conflict'};return;}
      if(old.keepitNote&&ref.revision<=old.keepitNote.revision){result={status:'stale-remote-revision'};return;}
      if(old.localRevision===revision&&old.sha256===sha256&&old.leaseToken===leaseToken&&old.state==='sending-to-keepit'){
        const next={...old,state:'synced-to-keepit',keepitNote:{...ref},leaseToken:null,leaseUntil:0,verifiedAt:Date.now(),lastError:null};
        st.put(next);tx.objectStore('receipts').put({key,projectId:old.projectId,pageId:old.pageId,topicId:old.topicId,sourceSha256:sha256,localRevision:revision,ref:{...ref},verifiedAt:next.verifiedAt});
        result={status:'verified',record:next};return;
      }
      // A newer edit was staged during the remote operation. Keep it pending
      // but retain the verified old base reference for its next versioned edit.
      if(old.localRevision>revision && old.state==='awaiting-keepit'&&old.keepitNote==null){
        const next={...old,keepitNote:{...ref}};st.put(next);
        tx.objectStore('receipts').put({key,projectId:old.projectId,pageId:old.pageId,topicId:old.topicId,sourceSha256:sha256,localRevision:revision,ref:{...ref},verifiedAt:Date.now()});
        result={status:'newer-local-pending',record:next};return;
      }
      result={status:'stale-claim'};
    };q.onerror=()=>reject(q.error||Error('Cannot inspect claimed revision'));
    tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error||Error('Acknowledgement failed'));
    tx.onabort=()=>reject(tx.error||Error('Acknowledgement aborted'));
  });
}
async function release(scope,leaseToken,reason,{conflict=false}={}){
  const key=scopeKey(scope),db=await open();
  return new Promise((resolve,reject)=>{
    let result=null;const tx=db.transaction('pending','readwrite'),st=tx.objectStore('pending'),q=st.get(key);
    q.onsuccess=()=>{const old=q.result;if(!old||old.leaseToken!==leaseToken||old.state!=='sending-to-keepit'){result={status:'stale-claim'};return;}
      const next={...old,state:conflict?'needs-attention':'awaiting-keepit',leaseToken:null,leaseUntil:0,lastError:String(reason||'KeepIt unavailable').slice(0,320)};
      st.put(next);result={status:next.state,record:next};
    };q.onerror=()=>reject(q.error||Error('Cannot release claim'));
    tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error||Error('Release transaction failed'));
    tx.onabort=()=>reject(tx.error||Error('Release aborted'));
  });
}
async function lastReceipt(scope){const db=await open(),key=scopeKey(scope);return new Promise((resolve,reject)=>{
  const tx=db.transaction('receipts','readonly'),q=tx.objectStore('receipts').get(key);
  q.onsuccess=()=>resolve(q.result||null);q.onerror=()=>reject(q.error||Error('Receipt read failed'));
});}
async function status(projectId){const arr=await list(projectId),counts={pending:0,claimed:0,attention:0,verified:0,total:arr.length};
 for(const n of arr){if(n.state==='synced-to-keepit')counts.verified++;else if(n.state==='sending-to-keepit')counts.claimed++;else if(n.state==='needs-attention')counts.attention++;else counts.pending++;}return counts;}

return Object.freeze({DB,VERSION,MAX_BYTES,validate,stage,read,list,recoveries,archive,exportRecovery,verifyExportObject,restoreRecovery,scopeKey,claim,acknowledge,release,lastReceipt,status});
});

