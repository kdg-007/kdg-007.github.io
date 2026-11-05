import {KeepItNoteClient} from './keepit-note-client.mjs';
const req=r=>new Promise((yes,no)=>{r.onsuccess=()=>yes(r.result);r.onerror=()=>no(r.error);});
const done=t=>new Promise((yes,no)=>{t.oncomplete=yes;t.onabort=()=>no(t.error||Error('Transaction aborted'));t.onerror=()=>no(t.error);});
const clone=x=>structuredClone(x);
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const noteRef=r=>r&&r.provider==='keepit'&&r.version===1&&uuid.test(r.itemId)&&/^sha256:[a-f0-9]{64}$/.test(r.scope)&&Number.isSafeInteger(r.revision)&&r.revision>=0;
const sameNote=(a,b)=>a.itemId===b.itemId&&a.scope===b.scope;
function verifiedAssociation(a,c,t){
 if(!a||!uuid.test(a.id)||a.appId!=='liveit'||a.workspace!==c.scope||a.workspaceId!==c.scope||a.entityId!==t.id||a.entityType!==t.type||a.purpose!=='rich-note'||a.copySemantics!=='shared-reference'||a.state!=='active'||!noteRef(a.noteReference))throw Error('LiveIt native association is invalid; retain both sources for review.');
 return a;
}
let journalDB;
async function journal(){if(!journalDB)journalDB=new Promise((yes,no)=>{const r=indexedDB.open('liveit-keepit-intents-qa-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('intents',{keyPath:'key'});r.onsuccess=()=>yes(r.result);r.onerror=()=>no(r.error);});return journalDB;}
export function ownedLiveItHooks(getAccess){
 async function context(){const a=getAccess();if(!a||!await a.ready())throw Error('LiveIt local storage unavailable.');const repository=a.getRepository(),scope=a.getScope();if(!['work','personal'].includes(scope))throw Error('Select Work or Personal first.');const tx=repository.db.transaction(['meta','records','note_associations'],'readonly'),end=done(tx);const [meta,records,associations]=await Promise.all([req(tx.objectStore('meta').get('state')),req(tx.objectStore('records').getAll()),req(tx.objectStore('note_associations').getAll())]);await end;if(!meta?.initializedAt)throw Error('LiveIt library identity unavailable.');return {a,repository,scope,epoch:meta.initializedAt,revision:meta.revision,records,associations};}
 const key=(c,t)=>JSON.stringify([c.epoch,c.scope,t.type,t.id]);
 async function readIntent(k){const db=await journal(),tx=db.transaction('intents','readonly'),end=done(tx);const row=await req(tx.objectStore('intents').get(k));await end;return row;}
 async function reserve(c,t,prior=null){
  const db=await journal(),tx=db.transaction('intents','readwrite'),end=done(tx),s=tx.objectStore('intents'),k=key(c,t);let row=await req(s.get(k));
  // A restored LiveIt association can outlive the *separate* local intent journal.
  // Rehydrate its exact owner/reference, never create a second native note.
  if(!row){row={key:k,epoch:c.epoch,owner:{appId:'liveit',workspace:c.scope,entityId:t.id,associationId:prior?.id||crypto.randomUUID()},entityType:t.type,requestId:crypto.randomUUID(),operationId:crypto.randomUUID(),reference:prior?clone(prior.noteReference):null};s.add(row);}
  if(row.key!==k||row.epoch!==c.epoch||row.entityType!==t.type||row.owner?.appId!=='liveit'||row.owner.workspace!==c.scope||row.owner.entityId!==t.id||!uuid.test(row.owner.associationId)||!uuid.test(row.requestId)||!uuid.test(row.operationId)||row.reference!==null&&!noteRef(row.reference)||prior&&(row.owner.associationId!==prior.id||row.reference&&!sameNote(row.reference,prior.noteReference))){
   try{tx.abort();}catch{}await end.catch(()=>{});throw Error('LiveIt note intent conflicts with its saved association; retain both sources for review.');
  }
  await end;return row;
 }
 async function keepReference(row,reference){const db=await journal(),tx=db.transaction('intents','readwrite'),end=done(tx),s=tx.objectStore('intents');const existing=await req(s.get(row.key));if(!existing||existing.owner.associationId!==row.owner.associationId||existing.reference&&(!sameNote(existing.reference,reference)||reference.revision<existing.reference.revision)){tx.abort();await end.catch(()=>{});throw Error('Native intent identity changed; sources retained.');}s.put({...existing,reference:clone(reference)});await end;}
 function entity(c,t){return c.records.find(r=>r.id===t.id&&r.type===t.type&&r.workspace===c.scope);}
 return Object.freeze({
  async targets(){const c=await context();return c.records.filter(r=>r.workspace===c.scope).map(r=>({id:r.id,type:r.type,workspace:c.scope,title:String(r.title||r.text||r.body||r.type+' note').slice(0,150)}));},
  async authorize(intent){const c=await context();if(intent.consumer!=='liveit')return false;if(intent.operation==='connect')return true;const owner=intent.owner;if(!owner||owner.appId!=='liveit'||owner.workspace!==c.scope)return false;const record=c.records.find(r=>r.id===owner.entityId&&r.workspace===c.scope);if(!record)return false;const row=await readIntent(key(c,record));if(!row||row.owner.associationId!==owner.associationId)return false;if(intent.operation==='create')return true;const a=c.associations.find(a=>a.id===owner.associationId);if(a&&a.state!=='active')return false;const ref=a?.noteReference||row.reference;return !!ref&&ref.itemId===intent.reference?.itemId&&ref.scope===intent.reference?.scope;},
  async openTarget(t,session){
   let c=await context();
   if(t.workspace!==c.scope||!entity(c,t))throw Error('The LiveIt record or workspace changed.');
   const existing=c.associations.filter(a=>a.workspace===c.scope&&a.entityId===t.id&&a.entityType===t.type&&a.purpose==='rich-note');
   if(existing.length>1||existing.some(a=>a.state!=='active'))throw Error('This note association needs review; no replacement was created.');
   const prior=existing[0]?verifiedAssociation(existing[0],c,t):null;
   const row=await reserve(c,t,prior);
   const client=new KeepItNoteClient({consumer:'liveit',...session});await client.connect();
   // When an independent LiveIt restore retains an older creation-journal revision,
   // choose the latest verified revision for the SAME note. Never downgrade.
   let reference=prior&&(!row.reference||prior.noteReference.revision>row.reference.revision)
    ?clone(prior.noteReference):row.reference?clone(row.reference):null;
   if(prior&&!reference)throw Error('A saved native association lost its reference; retain both sources for review.');
   if(!reference){
    const result=await client.create({requestId:row.requestId,owner:clone(row.owner),title:t.title||'LiveIt note'});
    reference=clone(result.reference);
   }else{
    const result=await client.open({requestId:crypto.randomUUID(),owner:clone(row.owner),reference:clone(reference)});
    reference=clone(result.reference); // Trust validated host identity/revision, not stale journal bytes.
   }
   c=await context();
   if(t.workspace!==c.scope||c.epoch!==row.epoch||!entity(c,t))throw Error('LiveIt owner changed; native source retained.');
   // In-flight unlink, replacement, or competing association means a stale editor
   // cannot silently resurrect the old link. The KeepIt source is retained.
   const after=c.associations.filter(a=>a.workspace===c.scope&&a.entityId===t.id&&a.entityType===t.type&&a.purpose==='rich-note');
   if(prior){
    if(after.length!==1||after[0].id!==prior.id||after[0].state!=='active'||
       !verifiedAssociation(after[0],c,t)||!sameNote(after[0].noteReference,reference)||after[0].noteReference.revision>reference.revision)
      throw Error('LiveIt note association changed during Open; native source retained.');
   }else if(after.length){throw Error('Another LiveIt session linked this record; reload before opening; native source retained.');}
   // Commit only a host-verified reference. An interrupted commit will retry
   // against this original journal key and may never create a blank replacement.
   await keepReference(row,reference);
   if(!prior){
    if(c.repository.revision!==c.revision)throw Error('Another LiveIt session changed data. Reload before linking; native source retained.');
    const association={id:row.owner.associationId,appId:'liveit',workspace:c.scope,workspaceId:c.scope,entityId:t.id,entityType:t.type,purpose:'rich-note',copySemantics:'shared-reference',state:'active',noteReference:clone(reference)};
    await c.repository.setNoteAssociation(association,{operationId:row.operationId});c.a.changed();
   }
   return {owner:clone(row.owner),reference:clone(reference)};
  },
  async status(link,session){
   if(!link||!link.owner||!noteRef(link.reference))throw Error('Invalid LiveIt native note status link.');
   let c=await context(),owner=link.owner;
   if(owner.appId!=='liveit'||owner.workspace!==c.scope||!uuid.test(owner.associationId)||typeof owner.entityId!=='string'||!/^[a-z0-9_:.-]{1,128}$/i.test(owner.entityId))
    throw Error('LiveIt workspace or note owner changed; status was not published.');
   const original=c.associations.find(a=>a.id===owner.associationId);
   if(!original||original.workspace!==c.scope||original.entityId!==owner.entityId||
      !entity(c,{id:owner.entityId,type:original.entityType})||
      !verifiedAssociation(original,c,{id:owner.entityId,type:original.entityType})||
      !sameNote(original.noteReference,link.reference)||original.noteReference.revision>link.reference.revision)
    throw Error('LiveIt association does not match this native note; status was not published.');
   const row=await readIntent(key(c,{id:owner.entityId,type:original.entityType}));
   if(!row||row.owner?.associationId!==original.id||!row.reference||!sameNote(row.reference,link.reference)||
      row.reference.revision>link.reference.revision)throw Error('Native journal and association need reconciliation before status.');
   const client=new KeepItNoteClient({consumer:'liveit',...session});await client.connect();
   const result=await client.status({owner:clone(owner),reference:clone(link.reference),requestId:crypto.randomUUID()});
   const after=await context();
   const still=after.associations.find(a=>a.id===original.id);
   if(after.epoch!==c.epoch||after.scope!==c.scope||!still||still.state!=='active'||
      !verifiedAssociation(still,after,{id:owner.entityId,type:original.entityType})||!sameNote(still.noteReference,original.noteReference)||
      still.workspace!==original.workspace||still.entityId!==original.entityId||
      !entity(after,{id:owner.entityId,type:original.entityType})||still.noteReference.revision>result.reference.revision)
    throw Error('LiveIt owner or association changed during status; no save confirmation was published.');
   return result;
  }
 });
}
if(typeof window!=='undefined')window.liveItOwnedHooks=ownedLiveItHooks(()=>window.liveItOwnedAccess);
