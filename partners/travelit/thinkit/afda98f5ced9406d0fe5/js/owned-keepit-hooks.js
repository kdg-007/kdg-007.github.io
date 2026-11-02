import {allData,guardedSaveRecord,getWorkspaceMetadata} from './db.js';
import {IndexedDBIntentJournal,TravelItGuardedAssociationStore} from '../integration/TravelIt/indexeddb-ports.mjs';
import {RecoverableNoteCreation} from '../integration/TravelIt/recoverable-note-creation.mjs';
import {TravelItTK05Adapter} from '../integration/TravelIt/travelit-tk05-adapter.mjs';
const request=r=>new Promise((yes,no)=>{r.onsuccess=()=>yes(r.result);r.onerror=()=>no(r.error);});
const done=t=>new Promise((yes,no)=>{t.oncomplete=yes;t.onabort=()=>no(t.error);t.onerror=()=>no(t.error);});
export function ownedTravelItHooks({ready,getDB,refresh}){
 async function context(){await ready;const db=getDB();if(!db)throw Error('TravelIt storage unavailable.');const tx=db.transaction(['settings'],'readwrite'),end=done(tx),s=tx.objectStore('settings');let row=await request(s.get('keepit-runtime-workspace'));if(!row){row={key:'keepit-runtime-workspace',value:crypto.randomUUID()};s.put(row);}await end;return {db,workspaceId:row.value};}
 async function ledger(db){const tx=db.transaction(['settings'],'readonly'),end=done(tx);const rows=await request(tx.objectStore('settings').getAll());await end;return rows.filter(r=>r.key.startsWith('keepit-creation-intent:')).map(r=>r.value);}
 async function records(){const {db}=await context();return (await allData(db)).records;}
 return Object.freeze({
  async targets(){return (await records()).filter(r=>['trip','place','stop'].includes(r.type)).map(r=>({type:r.type,id:r.id,title:r.data.title||r.data.name||'Travel note'}));},
  async authorize(intent){
   const {db,workspaceId}=await context();if(intent.consumer!=='travelit')return false;if(intent.operation==='connect')return true;
   const owner=intent.owner;if(!owner||owner.appId!=='travelit'||owner.workspace!==workspaceId)return false;
   const rows=await records(),journal=new IndexedDBIntentJournal(db);const candidates=await ledger(db);
   for(const raw of candidates){let i;try{i=await journal.getIntent(raw.id);}catch{continue;}
    if(i.associationId!==owner.associationId||i.entityId!==owner.entityId||i.workspaceId!==workspaceId||!rows.some(r=>r.type===i.entityType&&r.id===i.entityId))continue;
    if(intent.operation==='create')return true;
    const a=rows.find(r=>r.type==='keepitAssociation'&&r.id===owner.associationId)?.data;
    const ref=a?.reference||i.reference;
    return !!ref&&ref.itemId===intent.reference?.itemId&&ref.scope===intent.reference?.scope;
   }return false;
  },
  async openTarget(target,session){
   const {db,workspaceId}=await context(),rows=await records();const entity=rows.find(r=>r.type===target.type&&r.id===target.id);if(!entity)throw Error('Travel record changed; no native note created.');
   const adapter=new TravelItTK05Adapter(session);await adapter.connect();const journal=new IndexedDBIntentJournal(db),store=new TravelItGuardedAssociationStore({db,guardedSaveRecord,getWorkspaceMetadata}),coordinator=new RecoverableNoteCreation({journal,associationStore:store,adapter});
   const old=(await ledger(db)).filter(i=>i.workspaceId===workspaceId&&i.entityType===target.type&&i.entityId===target.id);if(old.length>1)throw Error('Multiple retained intents need review.');
   let i=old[0];if(!i){i={id:crypto.randomUUID(),associationId:crypto.randomUUID(),requestId:crypto.randomUUID(),workspaceId,entityType:target.type,entityId:target.id,title:String(target.title).slice(0,150),createdAt:new Date().toISOString()};await coordinator.prepare(i);}
   const result=await coordinator.resume(i.id);await refresh();const association=await store.getForTarget(i);
   if(result.recovered)await adapter.open({association,requestId:crypto.randomUUID()});
   return {association,result};
  },
  async status(association,session){const adapter=new TravelItTK05Adapter(session);await adapter.connect();return adapter.status({association,requestId:crypto.randomUUID()});}
 });
}
