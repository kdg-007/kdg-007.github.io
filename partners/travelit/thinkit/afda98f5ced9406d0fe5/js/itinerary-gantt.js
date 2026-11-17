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
  const offsetDays=Math.floor((minute-dayMinute(day))/1440);
  const label=scope==='trip'?text.slice(5,10):
   span<=1440?(offsetDays>0?text.slice(11,16)+' +'+offsetDays+'d':text.slice(11,16)):
   text.slice(5,10)+' '+text.slice(11,16);
  ticks.push({minute,position:(minute-first)/span*100,label});
 }
 // An endpoint close to the last regular tick would overlap it. Replace
 // that penultimate tick instead of squeezing two labels into one interval.
 if(ticks.at(-1)?.position<100){
  if(ticks.length>1&&last-ticks.at(-1).minute<step*.8)ticks.pop();
  const text=iso(last),delta=Math.floor((last-dayMinute(day))/1440);
  ticks.push({minute:last,position:100,label:scope==='trip'?text.slice(5,10):
   span<=1440?(text.slice(11,16)+(delta>0?' +'+delta+'d':'')):text.slice(5,10)+' '+text.slice(11,16)});
 }
 const maxLabelLength=Math.max(...ticks.map(t=>t.label.length),5);
 // A previously fixed 600 px axis squeezed 13 two-hour ticks together.
 // Reserve at least 100 CSS px per interval and scale wider date labels.
 const timelineWidth=Math.max(900,Math.min(3600,Math.ceil(
  (ticks.length-1)*Math.max(100,maxLabelLength*8+20)
 )));
 for(const row of rows){
  row.left=row.start===null?null:Math.max(0,(row.start-first)/span*100);
  row.width=row.start===null?null:row.duration/span*100;
  row.startLabel=row.start===null?'Flexible':(scope==='trip'?row.stop.date.slice(5)+' ':'')+row.stop.time;
  row.endLabel=row.end===null?'':(scope==='trip'?iso(row.end).slice(5,10)+' ':'')+iso(row.end).slice(11,16)+(scope!=='trip'&&iso(row.end).slice(0,10)!==row.stop.date?' (+'+Math.floor((row.end-dayMinute(row.stop.date))/1440)+'d)':'');
 }
 return {first,last,span,rows,ticks,timelineWidth,scope};
}
