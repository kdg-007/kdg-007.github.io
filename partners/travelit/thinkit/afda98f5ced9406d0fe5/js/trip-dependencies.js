export const DEPENDENCY_TYPES=Object.freeze(['FS','SS','FF','SF']);
export function normalizeStopDependencies(value=[]){
 if(!Array.isArray(value)||value.length>100)throw Error('Use at most 100 predecessors per activity.');
 const seen=new Set();
 return value.map(item=>{
  const lagMinutes=Number(item?.lagMinutes??0),id=item?.id,type=item?.type||'FS';
  if(typeof id!=='string'||!id||id.length>200||seen.has(id)||!DEPENDENCY_TYPES.includes(type)||!Number.isInteger(lagMinutes)||Math.abs(lagMinutes)>10080)throw Error('Choose distinct predecessors, a dependency type and a whole-minute lag between −10080 and 10080.');
  seen.add(id);return {id,type,lagMinutes};
 });
}
function startMinutes(stop){
 if(!stop.time)return null;
 return Date.parse(stop.date+'T00:00:00Z')/60000+Number(stop.time.slice(0,2))*60+Number(stop.time.slice(3));
}
function localDateTime(minutes){
 const iso=new Date(minutes*60000).toISOString();return {date:iso.slice(0,10),time:iso.slice(11,16)};
}
export function planTripDependencies(stops,trip){
 const byId=new Map(stops.map(stop=>[stop.id,stop])),ordered=[],counts=new Map(),children=new Map();
 for(const stop of stops){
  let count=0;
  for(const dependency of normalizeStopDependencies(stop.dependencies)){
   if(!byId.has(dependency.id))continue;
   count++;if(!children.has(dependency.id))children.set(dependency.id,[]);children.get(dependency.id).push(stop.id);
  }
  counts.set(stop.id,count);if(count===0)ordered.push(stop);
 }
 for(let i=0;i<ordered.length;i++)for(const id of children.get(ordered[i].id)||[]){
  counts.set(id,counts.get(id)-1);if(counts.get(id)===0)ordered.push(byId.get(id));
 }
 if(ordered.length!==stops.length)throw Error('The activity dependencies contain a cycle. Remove the circular link.');
 const planned=new Map(),updates=[],issues=[];
 for(const stop of ordered){
  const start=startMinutes(stop);let required=start;
  for(const dependency of normalizeStopDependencies(stop.dependencies)){
   const predecessor=byId.get(dependency.id),prior=planned.get(dependency.id);
   if(!predecessor||prior===null||prior===undefined){issues.push('Set a start time for the predecessor of “'+stop.title+'”.');continue;}
   if(start===null){issues.push('Set a start time for “'+stop.title+'” before scheduling dependencies.');continue;}
   const boundary=prior+(['FS','FF'].includes(dependency.type)?Number(predecessor.durationMinutes||0):0)+dependency.lagMinutes;
   const earliest=boundary-(['FF','SF'].includes(dependency.type)?Number(stop.durationMinutes||0):0);
   required=Math.max(required,earliest);
  }
  if(start!==null&&required>start){
   const next=localDateTime(required);
   if(stop.fixed){issues.push('“'+stop.title+'” is a fixed booking that conflicts with its predecessor.');required=start;}
   else if(next.date<trip.startDate||next.date>trip.endDate){issues.push('“'+stop.title+'” would move outside the trip dates.');required=start;}
   else updates.push({...stop,...next});
  }
  planned.set(stop.id,required);
 }
 return {updates,issues:[...new Set(issues)]};
}
