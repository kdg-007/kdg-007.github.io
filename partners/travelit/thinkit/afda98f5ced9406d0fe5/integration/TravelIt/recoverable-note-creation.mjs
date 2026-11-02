/** TK05 two-phase note linking coordinator — integration proof ONLY.
 * The approved KeepIt host/verifier MUST be injected by a first-party runtime.
 * A production implementation MUST supply durable, atomic journal & association
 * stores; an in-memory test store does NOT provide power-loss recovery.
 * No OneDrive writer, cross-origin access, or public-app activation exists here.
 */
import {normalizeKeepItAssociation,validateKeepItReference} from './keepit-associations-v029.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FIELD=/^[A-Za-z0-9_.:-]{1,128}$/;
const REQUEST=/^[-a-z0-9_:.]{1,128}$/i;
const TYPES=new Set(['trip','place','stop']);
const snapshot=x=>structuredClone(x);
const referenceSame=(a,b)=>!!a&&!!b&&a.provider===b.provider&&a.version===b.version&&a.scope===b.scope&&a.itemId===b.itemId&&a.revision===b.revision;
const error=(code,message)=>Object.assign(new Error(message),{code});
function validIntent(intent){
 if(!intent||typeof intent!=='object'||Array.isArray(intent)||Object.keys(intent).sort().join(',')!==['associationId','createdAt','entityId','entityType','id','requestId','title','workspaceId'].sort().join(','))throw error('INVALID_INTENT','Expected exact, non-sensitive creation-intent fields.');
 if(!UUID.test(intent.id||'')||!UUID.test(intent.associationId||'')||!REQUEST.test(intent.requestId||'')||!FIELD.test(intent.workspaceId||'')||!FIELD.test(intent.entityId||'')||!TYPES.has(intent.entityType)||typeof intent.title!=='string'||!intent.title.trim()||intent.title.length>150||typeof intent.createdAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(intent.createdAt)||!Number.isFinite(Date.parse(intent.createdAt)))throw error('INVALID_INTENT','Invalid stable identity, target or note title.');
 return true;
}
function matchAssociation(intent,a){
 if(!a)return false;
 normalizeKeepItAssociation(a);
 return a.id===intent.associationId&&a.appId==='travelit'&&a.workspaceId===intent.workspaceId&&a.entityType===intent.entityType&&a.entityId===intent.entityId&&a.purpose==='rich-note';
}
function makeAssociation(intent,ref){
 validateKeepItReference(ref);
 return normalizeKeepItAssociation({id:intent.associationId,appId:'travelit',workspaceId:intent.workspaceId,
   entityType:intent.entityType,entityId:intent.entityId,purpose:'rich-note',reference:ref,
   createdAt:intent.createdAt,updatedAt:intent.createdAt});
}
const targetKey=x=>JSON.stringify([x.workspaceId,x.entityType,x.entityId,'rich-note']);
/**
 * journal: {insertIntent(intent), getIntent(id), casIntent(id, expectedVersion, patch)}
 *  - insertIntent must atomically enforce unique id AND unique targetKey
 *  - casIntent is atomic compare-and-swap; increments version
 * associationStore: {getForTarget(intent), commitIfAbsent(association)}
 *  - commitIfAbsent must use TravelIt guarded transaction, reject other associations
 * adapter: connected, authorized TravelItTK05Adapter with reserveNativeNote()
 */
export class RecoverableNoteCreation {
 constructor({journal,associationStore,adapter}){
  if(!journal||!associationStore||!adapter||['insertIntent','getIntent','casIntent'].some(k=>typeof journal[k]!=='function')||['getForTarget','commitIfAbsent'].some(k=>typeof associationStore[k]!=='function')||typeof adapter.reserveNativeNote!=='function')throw error('INVALID_PORT','Durable journal, guarded association store and authorized adapter required.');
  this.journal=journal;this.associationStore=associationStore;this.adapter=adapter;
 }
 async prepare(input){
  validIntent(input);
  const intent={...snapshot(input),status:'prepared',reference:null,version:0};
  await this.journal.insertIntent(intent);
  return {intentId:intent.id,status:'prepared',target:targetKey(intent),savedLocally:true,cloudVerified:false};
 }
 async resume(id){
  if(!UUID.test(id||''))throw error('INVALID_ID','Stable intent ID is required for retry.');
  let i=await this.journal.getIntent(id);
  if(!i)throw error('UNKNOWN_INTENT','No durable request exists; do not invent a new ID for an uncertain creation.');
  validIntent(Object.fromEntries(['id','associationId','requestId','workspaceId','entityType','entityId','title','createdAt'].map(k=>[k,i[k]])));
  if(!['prepared','reserved','linked-locally'].includes(i.status)||!Number.isSafeInteger(i.version)||i.version<0)throw error('BAD_JOURNAL','Unexpected journal state; retained for manual recovery.');
  const existing=await this.associationStore.getForTarget(i);
  if(existing){
   if(!matchAssociation(i,existing)||i.reference&&!referenceSame(i.reference,existing.reference))throw error('ASSOCIATION_CONFLICT','Different local note association exists. Nothing was overwritten.');
   if(i.status!=='linked-locally')i=await this.journal.casIntent(id,i.version,{status:'linked-locally',reference:snapshot(existing.reference)});
   return Object.freeze({intentId:id,status:'linked-locally',reference:snapshot(existing.reference),savedLocally:true,cloudVerified:false,recovered:true});
  }
  if(i.status==='linked-locally')throw error('LINK_REMOVED','The note association was deliberately removed or is unavailable. Do not recreate it automatically.');
  let reference=i.reference;
  if(!reference){
   // Replay SAME stable owner and SAME requestId across restarts or lost acknowledgments.
   const reserved=await this.adapter.reserveNativeNote({workspaceId:i.workspaceId,entityId:i.entityId,
       associationId:i.associationId,requestId:i.requestId,title:i.title});
   if(reserved.persistedInTravelIt!==false||reserved.cloudVerified!==false)throw error('INVALID_RECEIPT','Native reservation must not claim a TravelIt save or cloud verification.');
   validateKeepItReference(reserved.reference);
   reference=snapshot(reserved.reference);
   i=await this.journal.casIntent(id,i.version,{status:'reserved',reference});
  }else validateKeepItReference(reference);
  const association=makeAssociation(i,reference);
  // Must be CAS / referentially guarded by actual TravelIt IndexedDB adapter.
  const outcome=await this.associationStore.commitIfAbsent(association);
  if(outcome!=='inserted'&&outcome!=='already-present')throw error('INVALID_COMMIT','Local association commit did not confirm identity.');
  const saved=await this.associationStore.getForTarget(i);
  if(!matchAssociation(i,saved)||!referenceSame(reference,saved.reference))throw error('INVALID_COMMIT','Local note association readback mismatch.');
  await this.journal.casIntent(id,i.version,{status:'linked-locally'});
  return Object.freeze({intentId:id,status:'linked-locally',reference:snapshot(reference),savedLocally:true,cloudVerified:false,recovered:false});
 }
}
/** Synthetic stores for deterministic verification only. NOT a production storage adapter. */
export class MemoryIntentJournal {
 constructor(){this.rows=new Map();this.targets=new Map();this.failNextCas=false;}
 async insertIntent(i){
  const key=targetKey(i);
  if(this.rows.has(i.id)||this.targets.has(key))throw error('DUPLICATE_INTENT','An intent already owns this target. Resume the original stable request.');
  this.rows.set(i.id,snapshot(i));this.targets.set(key,i.id);
 }
 async getIntent(id){return snapshot(this.rows.get(id)||null);}
 async casIntent(id,version,patch){
  if(this.failNextCas){this.failNextCas=false;throw error('JOURNAL_UNAVAILABLE','Journal save interrupted; retry same ID.');}
  const old=this.rows.get(id);
  if(!old||old.version!==version)throw error('STALE_JOURNAL','Concurrent journal update; reload original intent.');
  if(Object.keys(patch).some(k=>!['status','reference'].includes(k)))throw error('IMMUTABLE_IDENTITY','Stable IDs cannot change on retry.');
  const next={...snapshot(old),...snapshot(patch),version:version+1};this.rows.set(id,next);return snapshot(next);
 }
}
export class MemoryAssociationStore {
 constructor(){this.rows=new Map();this.failNextCommit=false;this.failAckAfterCommit=false;}
 async getForTarget(i){return snapshot(this.rows.get(targetKey(i))||null);}
 async commitIfAbsent(a){
  if(this.failNextCommit){this.failNextCommit=false;throw error('LOCAL_COMMIT_FAILED','Guarded association was not saved.');}
  const key=targetKey(a),old=this.rows.get(key);
  if(old){if(!matchAssociation(a,old)||!referenceSame(a.reference,old.reference))throw error('ASSOCIATION_CONFLICT','Existing association is different.');return 'already-present';}
  this.rows.set(key,snapshot(a));
  if(this.failAckAfterCommit){this.failAckAfterCommit=false;throw error('COMMIT_ACK_LOST','Local save completed; response lost.');}
  return 'inserted';
 }
}
