import {normalizeTrip,normalizeStop,normalizePlace,validateBackup,SCHEMA_VERSION} from './domain.js?v=excel-import-1';
export async function digestImport(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function buildExcelBatch(plan,{filename,fileDigest,title=plan.trip.title,timezone='Asia/Manila',mappings={}}){
 if(plan.statistics.errorCount||!plan.activities.length)throw Error('Resolve the workbook errors before importing.');
 if(!title.trim()||title.length>150)throw Error('Trip name must be 1–150 characters.');
 const known=['transport','travel','meal','tour','activity','prep/admin','free','hotel','other'];
 const activities=plan.activities.map(a=>({...a,kind:mappings[a.sourceType]||a.kind}));
 for(const a of activities){if(!known.includes(a.sourceType.toLowerCase())&&!mappings[a.sourceType])throw Error('Choose a TravelIt type for '+a.sourceType+'.');if(!['Travel','Meal','Activity','Hotel','Other'].includes(a.kind))throw Error('Choose a supported TravelIt type.');}
 // Independent of ZIP formatting, filename, source row numbers and generated IDs.
 const semantic=activities.map(a=>({code:a.code,title:a.title,date:a.date,time:a.time,durationMinutes:a.durationMinutes,sourceType:a.sourceType,kind:a.kind,predecessors:a.predecessors,detail:a.detail?{title:a.detail.title,area:a.detail.area,flag:a.detail.flag,notes:a.detail.notes,decision:a.detail.decision,mapUrl:a.detail.mapUrl,researchUrl:a.detail.researchUrl}:null}));
 const semanticDigest=await digestImport({profile:plan.profile,title:plan.trip.title,start:plan.trip.startDate,end:plan.trip.endDate,timezone,activities:semantic});
 const now=new Date().toISOString(),batchId=crypto.randomUUID(),tripId=crypto.randomUUID(),records=[],destinations=new Map();
 const trip=normalizeTrip({...plan.trip,id:tripId,title,timezone},now);
 for(const [sortOrder,a] of activities.entries()){
  const detail=a.detail?{title:a.detail.title,area:a.detail.area,notes:a.detail.notes,decision:a.detail.decision,mapUrl:a.detail.mapUrl,researchUrl:a.detail.researchUrl}:null;
  const source={version:1,batchId,code:a.code,sheet:plan.activitySheet||'Activity',row:a.sourceRow,originalType:a.sourceType,flag:a.detail?.flag||'',predecessors:[...a.predecessors],detail,baseline:{title:a.title,date:a.date,time:a.time,durationMinutes:a.durationMinutes,kind:a.kind,notes:detail?.notes||''}};
  let placeId=null;
  if(detail?.mapUrl){
   // A matching source URL proposes one destination within this NEW import only.
   const key=detail.mapUrl;
   if(!destinations.has(key)){
    if(detail.title.length>150||detail.area.length>500)throw Error('Place text exceeds supported limits at code '+a.code+'.');
    const place=normalizePlace({id:crypto.randomUUID(),name:detail.title||a.title,sourceUrl:detail.mapUrl,category:'Other',stage:'Planned',notes:'Imported map search link. Location is not verified. '+detail.area,importSource:source},now);
    // Preserve provisional coordinates in source links. User verification is required to pin.
    destinations.set(key,place);records.push({key:'place:'+place.id,type:'place',id:place.id,data:place});
   }
   placeId=destinations.get(key).id;
  }
  const stop=normalizeStop({id:crypto.randomUUID(),title:a.title,date:a.date,time:a.time,durationMinutes:a.durationMinutes,kind:a.kind,sortOrder,placeId,notes:detail?.notes||'',fixed:false,importSource:source},trip,now);
  records.push({key:'stop:'+stop.id,type:'stop',id:stop.id,data:stop});
 }
 const tripRow={key:'trip:'+tripId,type:'trip',id:tripId,data:trip};records.unshift(tripRow);
 trip.importReceipt={version:1,batchId,semanticDigest,fileDigest,filename,importedAt:now,createdKeys:records.map(r=>r.key),activityCount:activities.length,placeCount:destinations.size,scope:'itinerary-and-place-details'};
 tripRow.data=normalizeTrip(trip,now);
 validateBackup({format:'travelit-local-backup',schemaVersion:SCHEMA_VERSION,records,outbox:[]});
 return {trip:tripRow.data,records};
}
