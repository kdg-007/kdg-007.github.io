
/* LiveIt W2 domain helpers: zero network dependencies, separate from KeepIt and TravelIt.
   TravelIt event data is validated as a READ-ONLY projection; this is NOT a sync adapter. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.LiveItDailyDomain=api;})(typeof window!=='undefined'?window:undefined,function(){
'use strict';
const DATE_RE=/^\d{4}-\d{2}-\d{2}$/;
const UTC_RE=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
function validDate(s){if(typeof s!=='string'||!DATE_RE.test(s))return false;const d=new Date(s+'T12:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===s;}
function validTimeZone(zone){if(typeof zone!=='string'||!zone)return false;try{new Intl.DateTimeFormat('en',{timeZone:zone});return true;}catch{return false;}}
function formatISODate(now=new Date(),zone=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'){
 if(!validTimeZone(zone))throw new Error('Invalid display timezone');
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const p=Object.fromEntries(parts.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`;
}
function emptyData(core){if(!core||!core.defaultSpaces)throw new Error('Core required');return {schema:1,records:[],spaces:JSON.parse(JSON.stringify(core.defaultSpaces)),operations:[]};}
function sameLocalDay(utc,zone){if(typeof utc!=='string'||!UTC_RE.test(utc)||Number.isNaN(Date.parse(utc)))throw new Error('Invalid UTC instant');return formatISODate(new Date(utc),zone);}
function localClock(utc,zone){if(typeof utc!=='string'||!UTC_RE.test(utc)||Number.isNaN(Date.parse(utc)))throw new Error('Invalid UTC instant');const parts=new Intl.DateTimeFormat('en-US',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(utc));const m=Object.fromEntries(parts.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return `${m.hour}:${m.minute}`;}
const KEY_RE=/^trv:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):(span|entry:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}))$/i;
function validateProjection(p){
 if(!p||typeof p!=='object'||Array.isArray(p))throw new Error('Invalid travel projection');
 const m=KEY_RE.exec(p.key||p.projectionKey||''); if(!m)throw new Error('Invalid TravelIt projection key');
 if(p.sourceApp!=='travelit'||p.editAuthority!=='travelit')throw new Error('TravelIt ownership required');
 if((p.workspace!==undefined&&p.workspace!=='personal')||(p.calendarScope!==undefined&&p.calendarScope!=='personal')||(p.workspace===undefined&&p.calendarScope===undefined))throw new Error('Travel projections must be Personal scoped');
 if(p.visibility!=='private')throw new Error('Only private travel projections supported in W2');
 if(typeof p.sourceRevision!=='string'||!p.sourceRevision||p.sourceRevision.length>120)throw new Error('Source revision required');
 if(typeof p.title!=='string'||!p.title.trim()||p.title.length>200)throw new Error('Invalid title');
 if(!validTimeZone(p.timezone))throw new Error('Invalid event timezone');
 if(p.eventType==='all_day'){
  if(m[2]!=='span'||!validDate(p.startDate)||!validDate(p.endDateExclusive)||p.startDate>=p.endDateExclusive)throw new Error('Invalid all-day date range');
 }else if(p.eventType==='timed'){
  if(m[2]==='span'||!UTC_RE.test(p.startUTC||'')||!UTC_RE.test(p.endUTC||'')||Number.isNaN(Date.parse(p.startUTC))||Number.isNaN(Date.parse(p.endUTC))||Date.parse(p.startUTC)>=Date.parse(p.endUTC))throw new Error('Invalid timed event');
 }else throw new Error('Invalid event type');
 if(p.status==='canceled'||p.tombstone)throw new Error('Tombstoned event must not be displayed');
 return p;
}
function onDay(p,day){validateProjection(p);if(!validDate(day))return false;
 return p.eventType==='all_day' ? day>=p.startDate&&day<p.endDateExclusive : sameLocalDay(p.startUTC,p.timezone)===day;
}
function toView(p){validateProjection(p);const day=p.eventType==='all_day'?p.startDate:sameLocalDay(p.startUTC,p.timezone);
 return {id:p.key||p.projectionKey,body:p.title,type:'event',date:day,time:p.eventType==='all_day'?'':localClock(p.startUTC,p.timezone),categories:[],workspace:'personal',source:'travelit',sourceRevision:p.sourceRevision,timezone:p.timezone,allDay:p.eventType==='all_day',origin:p};
}
function listForDay(projections,day,scope){if(scope!=='personal')return [];
 return projections.flatMap(p=>{try{return onDay(p,day)?[toView(p)]:[];}catch{return [];}});
}
function safeProjections(rows){const seen=new Set();return (Array.isArray(rows)?rows:[]).flatMap(p=>{try{validateProjection(p);const key=p.key||p.projectionKey;if(seen.has(key))return [];seen.add(key);return [p];}catch{return [];}});}
return {validDate,validTimeZone,formatISODate,emptyData,sameLocalDay,localClock,validateProjection,onDay,toView,listForDay,safeProjections};
});

