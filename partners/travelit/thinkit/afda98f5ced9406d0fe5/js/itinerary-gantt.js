// Dates are local itinerary wall-clock labels, not UTC instants for routing.
const dayMinute=date=>Date.parse(date+'T00:00:00Z')/60000;
const iso=minute=>new Date(minute*60000).toISOString();
export function itineraryGantt(entries,{scope='day',trip,day=trip.startDate}={}){
 const first=dayMinute(scope==='trip'?trip.startDate:day);
 let last=dayMinute(scope==='trip'?trip.endDate:day)+1440;
 const rows=entries.map(stop=>{
  const start=stop.time?dayMinute(stop.date)+Number(stop.time.slice(0,2))*60+Number(stop.time.slice(3)):null;
  const duration=Number(stop.durationMinutes)||0,end=start===null?null:start+duration;
  if(end!==null)last=Math.max(last,end);
  return {stop,start,end,duration};
 });
 const span=Math.max(1440,last-first),days=Math.ceil(span/1440);
 const step=scope==='trip'?Math.ceil(days/10)*1440:[60,120,180,360,720,1440].find(value=>span/value<=12)||Math.ceil(span/14400)*1440;
 const ticks=[];
 for(let minute=first;minute<=last;minute+=step){
  const text=iso(minute);
  ticks.push({position:(minute-first)/span*100,label:scope==='trip'?text.slice(5,10):span>1440||text.slice(0,10)!==day?text.slice(5,10)+' '+text.slice(11,16):text.slice(11,16)});
 }
 if(ticks.at(-1)?.position<100){const text=iso(last);ticks.push({position:100,label:scope==='trip'?text.slice(5,10):text.slice(5,10)+' '+text.slice(11,16)});}
 for(const row of rows){
  row.left=row.start===null?null:Math.max(0,(row.start-first)/span*100);
  row.width=row.start===null?null:row.duration/span*100;
  row.startLabel=row.start===null?'Flexible':(scope==='trip'?row.stop.date.slice(5)+' ':'')+row.stop.time;
  row.endLabel=row.end===null?'':(scope==='trip'?iso(row.end).slice(5,10)+' ':'')+iso(row.end).slice(11,16)+(scope!=='trip'&&iso(row.end).slice(0,10)!==row.stop.date?' (+'+Math.floor((row.end-dayMinute(row.stop.date))/1440)+'d)':'');
 }
 return {first,last,span,rows,ticks,timelineWidth:Math.max(600,Math.min(2400,days*100)),scope};
}
