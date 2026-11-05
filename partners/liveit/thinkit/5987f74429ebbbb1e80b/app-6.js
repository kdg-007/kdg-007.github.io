
/* LiveIt W6 TravelIt -> LiveIt local staging contract.
 * SYNTHETIC TESTS ONLY: no production transport, no authentication, no 'published' claims.
 * Uses W5E's RESERVED IndexedDB projection stores in an explicitly disposable DB.
 * The production PWA, production KeepIt library and W5E backup format are UNCHANGED.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.LiveItTravelItStaging=api;
})(typeof window!=='undefined'?window:undefined,function(){
'use strict';
const TRIP=/^trv:([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}):(span|entry:([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}))$/i;
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const UTC=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const LOCAL=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const ALLOWED=new Set(['contractVersion','projectionKey','sourceApp','sourceEntityType','sourceId','sourceRevision','eventType','title','startDate','endDateExclusive','startUTC','endUTC','timezone','originalStartLocal','originalStartOffsetMinutes','visibility','calendarScope','workspace','editAuthority','status','openInSource']);
const SENSITIVE=/token|secret|password|credential|bearer|private.?key|cookie|authorization|session|access.?key|refresh.?key|passport|ticket.?number|barcode|attachment|document|participant|passenger|email|phone/i;
const plain=x=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const copy=x=>JSON.parse(JSON.stringify(x));
const stable=x=>JSON.stringify(x,function(k,v){if(plain(v))return Object.fromEntries(Object.keys(v).sort().map(key=>[key,v[key]]));return v;});
const req=p=>new Promise((yes,no)=>{p.onsuccess=()=>yes(p.result);p.onerror=()=>no(p.error||new Error('IndexedDB request failed'));});
const done=tx=>new Promise((yes,no)=>{tx.oncomplete=yes;tx.onabort=()=>no(tx.error||new Error('Transaction aborted'));tx.onerror=()=>{};});
const isoDate=s=>typeof s==='string'&&DATE.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
function utcDate(s){return typeof s==='string'&&UTC.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().replace('.000','')===s.replace('.000','');}
function timeZone(t){try{new Intl.DateTimeFormat('en-US',{timeZone:t});return typeof t==='string'&&t.length<100;}catch{return false;}}
function localParts(utc,zone){const parts=new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(utc));const a=Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));return `${a.year}-${a.month}-${a.day}T${a.hour}:${a.minute}:${a.second}`;}
function validate(payload){
 if(!plain(payload)||JSON.stringify(payload).length>6000)throw new Error('Invalid or oversized TravelIt event');
 for(const k of Object.keys(payload))if(!ALLOWED.has(k)||SENSITIVE.test(k)||['__proto__','constructor','prototype'].includes(k))throw new Error('Unsafe or unsupported TravelIt field: '+k);
 if(payload.contractVersion!=='0.1.0')throw new Error('Unsupported TravelIt projection contract version');
 const match=TRIP.exec(payload.projectionKey||'');if(!match||payload.projectionKey!==payload.projectionKey.toLowerCase())throw new Error('Invalid or noncanonical stable projection key');
 if(payload.sourceApp!=='travelit'||payload.editAuthority!=='travelit'||payload.visibility!=='private'||payload.calendarScope!=='personal'||
   (payload.workspace!==undefined&&payload.workspace!=='personal'))throw new Error('TravelIt projections must remain private, Personal, source-owned and read-only');
 if(typeof payload.sourceRevision!=='string'||payload.sourceRevision.length>120||!payload.sourceRevision)throw new Error('Missing source revision');
 if(typeof payload.title!=='string'||!payload.title.trim()||payload.title.length>200)throw new Error('Invalid title');
 if(!['confirmed','tentative'].includes(payload.status))throw new Error('Cancellation must use a tombstone');
 if(!timeZone(payload.timezone))throw new Error('Invalid timezone');
 if(!plain(payload.openInSource)||payload.openInSource.app!=='travelit'||payload.openInSource.tripId?.toLowerCase()!==match[1].toLowerCase()||Object.keys(payload.openInSource).some(k=>!['app','tripId','entryId'].includes(k)))throw new Error('Unsafe or mismatched TravelIt navigation intent');
 if(match[2]==='span'){
   if(payload.sourceEntityType!=='trip'||payload.sourceId?.toLowerCase()!==match[1].toLowerCase()||payload.eventType!=='all_day'||
     !isoDate(payload.startDate)||!isoDate(payload.endDateExclusive)||payload.startDate>=payload.endDateExclusive||
     ['startUTC','endUTC','originalStartLocal','originalStartOffsetMinutes'].some(k=>k in payload)||'entryId' in payload.openInSource)
     throw new Error('Invalid trip-span date-only projection');
 }else{
   if(payload.sourceEntityType!=='entry'||payload.sourceId?.toLowerCase()!==match[3].toLowerCase()||payload.openInSource.entryId?.toLowerCase()!==match[3].toLowerCase()||payload.eventType!=='timed'||
     !utcDate(payload.startUTC)||!utcDate(payload.endUTC)||Date.parse(payload.startUTC)>=Date.parse(payload.endUTC)||
     typeof payload.originalStartLocal!=='string'||!LOCAL.test(payload.originalStartLocal)||!Number.isInteger(payload.originalStartOffsetMinutes)||Math.abs(payload.originalStartOffsetMinutes)>14*60||
     ['startDate','endDateExclusive'].some(k=>k in payload))throw new Error('Invalid timed itinerary event');
   if(localParts(payload.startUTC,payload.timezone)!==payload.originalStartLocal)throw new Error('Reservation wall time conflicts with venue timezone');
   const offset=(Date.parse(payload.originalStartLocal+'Z')-Date.parse(payload.startUTC))/60000;
   if(offset!==payload.originalStartOffsetMinutes)throw new Error('Reservation offset conflicts with UTC instant');
 }
 return Object.freeze({...copy(payload),workspace:'personal',key:payload.projectionKey});
}
function intentKey(v){if(typeof v!=='string'||!/^[A-Za-z0-9:_-]{1,128}$/.test(v))throw new Error('Invalid idempotency key');return 'operation:'+v;}
function revString(v){if(typeof v!=='string'||!v||v.length>120)throw new Error('Missing source revision');return v;}
function sourceKey(v){if(typeof v!=='string'||!TRIP.test(v)||v!==v.toLowerCase())throw new Error('Invalid or noncanonical projection key');return v;}
function projectedDate(p,day){if(!isoDate(day))return false;if(p.eventType==='all_day')return day>=p.startDate&&day<p.endDateExclusive;
 const first=localParts(p.startUTC,p.timezone).slice(0,10);
 const last=localParts(Date.parse(p.endUTC)-1,p.timezone).slice(0,10);
 return day>=first&&day<=last;
}
class TravelItProjectionStagingPort {
 constructor(store){
   if(!store?.db?.name?.startsWith('liveit-w6-staging-')||!store?.db?.transaction||!Number.isSafeInteger(store.revision))throw new Error('W6 port requires disposable synthetic staging database');
   this.store=store;
 }
 async getCapabilities(){return Object.freeze({contractVersion:'0.1.0',environment:'synthetic-staging',idempotentUpsert:true,tombstones:true,readChanges:true,changeProposals:false,cloudTransport:false,canPublish:false,status:'not_connected'});}
 async upsertByKey(command){
   if(!plain(command)||command.projectionKey!==command.payload?.projectionKey)throw new Error('Mismatched event key');
   const payload=validate(command.payload);revString(command.sourceRevision);
   if(command.sourceRevision!==payload.sourceRevision)throw new Error('Source revision mismatch');
   return this.#write('upsert',{key:payload.key,payload,sourceRevision:command.sourceRevision,idempotencyKey:command.idempotencyKey,expectedRemoteRevision:command.expectedRemoteRevision??null});
 }
 async tombstoneByKey(command){
   if(!plain(command))throw new Error('Invalid tombstone');sourceKey(command.projectionKey);revString(command.sourceRevision);
   return this.#write('tombstone',{key:command.projectionKey,sourceRevision:command.sourceRevision,idempotencyKey:command.idempotencyKey,expectedRemoteRevision:command.expectedRemoteRevision??null});
 }
 async #write(kind,command){
   const receiptKey=intentKey(command.idempotencyKey);
   const fingerprint=stable({kind,...command});
   const tx=this.store.db.transaction(['meta','projection_records','projection_receipts','projection_tombstones'],'readwrite');const wait=done(tx);
   try{
     const metaP=req(tx.objectStore('meta').get('state'));
     const recP=req(tx.objectStore('projection_records').get(command.key));
     const tombP=req(tx.objectStore('projection_tombstones').get(command.key));
     const receiptP=req(tx.objectStore('projection_receipts').get(receiptKey));
     const [meta,existing,tomb,receipt]=await Promise.all([metaP,recP,tombP,receiptP]);
     if(!meta||!Number.isSafeInteger(meta.revision))throw new Error('Missing staging revision');
     if(existing&&tomb)throw new Error('Corrupt projection state: event and tombstone coexist');
     const active=existing||tomb||null;
     if(receipt){
       if(receipt.fingerprint!==fingerprint)throw new Error('Idempotency key reused with different intent');
       await wait;return {remoteEventId:command.key,remoteRevision:receipt.remoteRevision,ackKey:receipt.key,replayed:true,superseded:active?.remoteRevision!==receipt.remoteRevision,requiresRefresh:meta.revision!==this.store.revision,status:'accepted_in_local_staging'};
     }
     if(meta.revision!==this.store.revision)throw new Error('Stale staging window; reload before applying a new event');
     if(active){
       if(command.expectedRemoteRevision!==active.remoteRevision)throw new Error('Projection revision conflict; refresh source');
       if(command.sourceRevision===active.sourceRevision)throw new Error('Source revision reused for a different operation');
     }else if(command.expectedRemoteRevision!==null)throw new Error('Unexpected remote revision for new projection');
     const newRevision='r'+((active?.generation||0)+1);
     if(kind==='upsert'){
       const row={...command.payload,sourceRevision:command.sourceRevision,remoteRevision:newRevision,generation:(active?.generation||0)+1};
       tx.objectStore('projection_records').put(row);
       if(tomb)tx.objectStore('projection_tombstones').delete(command.key);
     }else{
       tx.objectStore('projection_records').delete(command.key);
       tx.objectStore('projection_tombstones').put({key:command.key,sourceApp:'travelit',workspace:'personal',sourceRevision:command.sourceRevision,remoteRevision:newRevision,generation:(active?.generation||0)+1,deletedAt:new Date().toISOString()});
     }
     tx.objectStore('projection_receipts').add({key:receiptKey,fingerprint,projectionKey:command.key,remoteRevision:newRevision,sourceRevision:command.sourceRevision,kind,sequence:meta.revision+1,changed:true});
     tx.objectStore('meta').put({...meta,revision:meta.revision+1,updatedAt:new Date().toISOString()});
     await wait;
     this.store.revision=meta.revision+1;
     return {remoteEventId:command.key,remoteRevision:newRevision,ackKey:receiptKey,replayed:false,superseded:false,requiresRefresh:false,status:'accepted_in_local_staging'};
   }catch(error){try{tx.abort();}catch{};try{await wait;}catch{};throw error;}
 }
 async listForDay(day,workspace){if(!['work','personal'].includes(workspace))throw new Error('Workspace required');if(workspace==='work')return [];
   const tx=this.store.db.transaction('projection_records','readonly'),wait=done(tx);const rows=await req(tx.objectStore('projection_records').getAll());await wait;
   return rows.filter(p=>projectedDate(p,day)).map(p=>({id:p.key,source:'travelit',type:'event',workspace:'personal',body:p.title,
      date:p.eventType==='all_day'?p.startDate:localParts(p.startUTC,p.timezone).slice(0,10),
      time:p.eventType==='all_day'?'':(localParts(p.startUTC,p.timezone).slice(0,10)===day?localParts(p.startUTC,p.timezone).slice(11,16):'00:00'),
      continuesFromPreviousDay:p.eventType==='timed'&&localParts(p.startUTC,p.timezone).slice(0,10)<day,
      editAuthority:'travelit',readOnly:true,status:p.status,openInSource:copy(p.openInSource),remoteRevision:p.remoteRevision}));
 }
 async getSnapshot(){const tx=this.store.db.transaction(['projection_records','projection_tombstones','projection_receipts'],'readonly'),wait=done(tx);
    const [events,tombstones,receipts]=await Promise.all(['projection_records','projection_tombstones','projection_receipts'].map(n=>req(tx.objectStore(n).getAll())));await wait;
    return {events,tombstones,receiptCount:receipts.length};
 }
 async fetchChanges({cursor='0',limit=100}={}){
   if(!/^\d+$/.test(String(cursor))||!Number.isSafeInteger(limit)||limit<1||limit>100)throw new Error('Invalid change cursor or limit');
   const tx=this.store.db.transaction('projection_receipts','readonly'),wait=done(tx);const rows=await req(tx.objectStore('projection_receipts').getAll());await wait;
   const page=rows.filter(r=>r.changed&&r.sequence>Number(cursor)).sort((a,b)=>a.sequence-b.sequence).slice(0,limit);
   return {changes:page.map(r=>({projectionKey:r.projectionKey,remoteRevision:r.remoteRevision,sourceRevision:r.sourceRevision,operation:r.kind,sequence:r.sequence})),nextCursor:String(page.length?page.at(-1).sequence:cursor)};
 }
}
return {TravelItProjectionStagingPort,validateTravelItProjection:validate,projectedDate};
});

