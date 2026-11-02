/** Integration-ready local persistence ports; DO NOT wire without an approved
 * KeepIt host, current-workspace authorization, and separate browser QA.
 * These ports never write OneDrive and never grant KeepIt access themselves.
 * KeepIt intent rows are retained in TravelIt's existing IDB v4 settings store;
 * therefore they are NOT part of TravelIt's compact JSON backup. Restore/undo
 * changes workspace generation: stale intents are blocked, not deleted.
 */
import {normalizeKeepItAssociation,logicalAssociationKey} from './keepit-associations-v029.mjs';
const P='keepit-creation-intent:';
const clone=x=>structuredClone(x);
function req(r){return new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||Error('IndexedDB request failed'));});}
function finish(tx){return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||Error('IndexedDB transaction failed'));tx.onabort=()=>reject(tx.error||Error('IndexedDB transaction aborted'));});}
const error=(code,message)=>Object.assign(new Error(message),{code});
function epoch(v){return v?.value??null;}
const targetKey=i=>JSON.stringify([i.workspaceId,i.entityType,i.entityId,'rich-note']);
export class IndexedDBIntentJournal {
 constructor(db){if(!db||typeof db.transaction!=='function')throw error('INVALID_DB','IndexedDB handle required.');this.db=db;}
 async insertIntent(i){
  const tx=this.db.transaction(['settings'],'readwrite'),end=finish(tx),s=tx.objectStore('settings');
  try{
   const [all,gen]=await Promise.all([req(s.getAll()),req(s.get('workspace-generation'))]);
   for(const row of all){if(!row?.key?.startsWith(P))continue;
    if(!row.value||typeof row.value!=='object'||!row.value.id)throw error('DAMAGED_JOURNAL','Corrupt creation ledger: do not overwrite any pending request.');
    if(row.value.id===i.id||targetKey(row.value)===targetKey(i))throw error('DUPLICATE_INTENT','A pending native-note request already exists for this identity.');
   }
   s.put({key:P+i.id,value:{...clone(i),workspaceGeneration:epoch(gen)}});
  }catch(e){try{tx.abort();}catch{}await end.catch(()=>{});throw e;}
  await end;
 }
 async getIntent(id){
  const tx=this.db.transaction(['settings'],'readonly'),end=finish(tx),s=tx.objectStore('settings');
  const [row,gen]=await Promise.all([req(s.get(P+id)),req(s.get('workspace-generation'))]);await end;
  if(!row)return null;
  if(!row.value||row.value.workspaceGeneration!==epoch(gen))throw error('STALE_WORKSPACE','A workspace restore changed the owner of this request. Preserve and review it before retrying.');
  const {workspaceGeneration,...intent}=row.value;return clone(intent);
 }
 async casIntent(id,expectedVersion,patch){
  if(Object.keys(patch).some(k=>!['status','reference'].includes(k)))throw error('IMMUTABLE_IDENTITY','Creation owner and request ID cannot change.');
  const tx=this.db.transaction(['settings'],'readwrite'),end=finish(tx),s=tx.objectStore('settings');
  let next;
  try{
   const [row,gen]=await Promise.all([req(s.get(P+id)),req(s.get('workspace-generation'))]);
   if(!row||row.value?.version!==expectedVersion)throw error('STALE_JOURNAL','Concurrent request change. Reload the saved request.');
   if(row.value.workspaceGeneration!==epoch(gen))throw error('STALE_WORKSPACE','Workspace restore invalidated this request. No note was changed.');
   next={...clone(row.value),...clone(patch),version:expectedVersion+1};s.put({key:P+id,value:next});
  }catch(e){try{tx.abort();}catch{}await end.catch(()=>{});throw e;}
  await end;
  const {workspaceGeneration,...intent}=next;return intent;
 }
}
/** Bridge to the EXISTING v0.29 guardedSaveRecord function, supplied by caller.
 * It is the sole local association writer and enforces parent + unique logical
 * link inside its own records/settings/outbox transaction. No custom DB writer.
 */
export class TravelItGuardedAssociationStore {
 constructor({db,guardedSaveRecord,getWorkspaceMetadata}){
  if(!db||typeof guardedSaveRecord!=='function'||typeof getWorkspaceMetadata!=='function')throw error('INVALID_PORT','Use TravelIt v0.29 guarded DB operations.');
  Object.assign(this,{db,guardedSaveRecord,getWorkspaceMetadata});
 }
 async getForTarget(i){
  const tx=this.db.transaction(['records'],'readonly'),end=finish(tx),r=tx.objectStore('records');
  const all=await req(r.getAll());await end;
  const matches=all.filter(row=>row.type==='keepitAssociation'&&row.data?.appId==='travelit'&&row.data.workspaceId===i.workspaceId&&row.data.entityType===i.entityType&&row.data.entityId===i.entityId&&row.data.purpose==='rich-note');
  if(matches.length>1)throw error('DUPLICATE_ASSOCIATION','Multiple note links exist for one TravelIt record; manual repair required.');
  if(!matches.length)return null;
  return normalizeKeepItAssociation(matches[0].data);
 }
 async commitIfAbsent(association){
  const a=normalizeKeepItAssociation(association),existing=await this.getForTarget(a);
  if(existing){
   if(existing.id!==a.id||JSON.stringify(existing.reference)!==JSON.stringify(a.reference))throw error('ASSOCIATION_CONFLICT','Another note is already linked; nothing was overwritten.');
   return 'already-present';
  }
  const meta=await this.getWorkspaceMetadata(this.db);
  const key=`keepitAssociation:${a.id}`;
  // requireAbsent, presence and workspace epoch are checked inside guarded mutation.
  await this.guardedSaveRecord(this.db,'keepitAssociation',a,{requireAbsent:true,expectedEpoch:meta.epoch,
   expectedPresenceByKey:{[key]:false},expectedRevisionByKey:{[key]:0}});
  return 'inserted';
 }
}
