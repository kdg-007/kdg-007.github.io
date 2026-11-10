import {createAppRepository,findTravelWorkspace,hashText} from './app-repository-store.mjs?v=trip-sync-1';
import {validDay} from '../liveit/thinkit/connected-w18e-c15396/calendar-contract.mjs?v=keepit-links-1';

const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const bindingKey='keepit-app-file-binding-v1:travelit';

export async function tripSpans(version){
 const payload=JSON.parse(version.payload);
 if(payload?.format!=='travelit-local-backup'||![1,2,3,4,5,6].includes(payload.schemaVersion)||!Array.isArray(payload.records))throw Error('TravelIt workspace format could not be read.');
 const spans=[],ids=new Set();
 for(const row of payload.records){
  if(row?.type!=='trip')continue;
  const trip=row.data;
  if(!trip||typeof trip.id!=='string'||!trip.id||trip.id!==row.id||ids.has(trip.id)||!validDay(trip.startDate)||!validDay(trip.endDate)||trip.startDate>trip.endDate||typeof trip.title!=='string'||!trip.title.trim()||typeof trip.timezone!=='string')throw Error('TravelIt trip dates or identity could not be verified.');
  new Intl.DateTimeFormat('en',{timeZone:trip.timezone});
  ids.add(trip.id);
  const date=new Date(trip.endDate+'T12:00:00Z');
  date.setUTCDate(date.getUTCDate()+1);
  const endDateExclusive=date.toISOString().slice(0,10);
  if(!validDay(endDateExclusive))throw Error('TravelIt trip end date is outside the calendar range.');
  let id=trip.id;
  if(!uuid.test(id)){
   const digest=await hashText('travelit-trip:'+id);
   id=digest.slice(0,8)+'-'+digest.slice(8,12)+'-5'+digest.slice(13,16)+'-8'+digest.slice(17,20)+'-'+digest.slice(20,32);
  }
  spans.push({key:'trv:'+id+':span',sourceApp:'travelit',editAuthority:'travelit',workspace:'personal',visibility:'private',
   sourceRevision:version.revision,title:trip.title.trim().slice(0,150),timezone:trip.timezone,eventType:'all_day',startDate:trip.startDate,endDateExclusive});
 }
 return spans;
}

export function mountTravelCalendar({frame,getLibrary}){
 let task=null,scope=null,lastKey=null,lastRead=0,lastBridge=null;
 async function refresh(force=false){
  const library=getLibrary(),bridge=frame()?.contentWindow?.liveItCalendarAccess;
  if(!bridge)return;
  if(!library){
   if(['signin','choose-folder'].includes(window.keepItConnectionState?.phase)){
    scope=null;lastKey=null;lastBridge=null;bridge.setTravelSpans([]);
   }
   return;
  }
  await bridge.ready();
  const isCurrent=()=>getLibrary()===library&&frame()?.contentWindow?.liveItCalendarAccess===bridge;
  if(!isCurrent())return;
  const nextScope=await hashText(JSON.stringify([library.fs.homeId,library.fs.driveId,library.root.item.id]));
  if(!isCurrent())return;
  if(scope!==nextScope){scope=nextScope;lastKey=null;lastRead=0;bridge.setTravelSpans([]);}
  let binding;try{binding=JSON.parse(localStorage.getItem(bindingKey)||'null');}catch{}
  const key=binding?.scope===scope?binding.key:null;
  if(!force&&key===lastKey&&bridge===lastBridge&&Date.now()-lastRead<15000)return;
  const repo=createAppRepository({app:'travelit',library,isCurrent});
  const result=await findTravelWorkspace(repo,key);
  if(!isCurrent())return;
  if(result.state==='review'){
   bridge.setTravelSpans([], 'Open a TravelIt workspace to show its trips.');
  }else{
   const spans=result.state==='ready'?await tripSpans(result.version):[];
   if(!isCurrent())return;
   bridge.setTravelSpans(spans);
  }
  lastKey=key;lastBridge=bridge;lastRead=Date.now();
 }
 const sync=(force=false)=>{
  if(!navigator.onLine||document.hidden)return;
  if(task)return task;
  task=refresh(force).catch(()=>{}).finally(()=>{task=null;});
  return task;
 };
 return sync;
}
