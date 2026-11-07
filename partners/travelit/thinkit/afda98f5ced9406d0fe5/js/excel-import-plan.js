/** Pure preview planner. It cannot open storage, fetch links or save records. */
import {normalizeTrip,normalizeStop,validDate} from './domain.js';
const DAY=86400000;
const TYPE_MAP=Object.freeze({transport:'Travel',travel:'Travel',meal:'Meal',tour:'Activity',activity:'Activity','prep/admin':'Other',free:'Other',hotel:'Hotel',other:'Other'});
const labels={code:['code'],title:['activity','activity / stop'],date:['date'],start:['start'],finish:['finish','end'],type:['type'],duration:['duration'],predecessor:['predecessor','predecessors']};
const detailLabels={code:['code'],title:['activity / destination'],area:['area'],type:['type'],flag:['status'],notes:['implementation detail / verification'],mapUrl:['google maps search pin','map link'],researchUrl:['research / official source'],decision:['suggested decision']};
const norm=value=>String(value??'').trim().replace(/\s+/g,' ').toLowerCase();
const val=cell=>cell?.value??null;
const cellText=cell=>String(val(cell)??'').trim();
function issue(list,level,message,sheet,row=null,address=null,code=null){list.push({level,message,sheet,row,address,code});}
export function excelDate(value,date1904=false){
 if(typeof value==='string'){
  const match=value.trim().match(/^(\d{4}-\d{2}-\d{2})(?:T00:00:00(?:\.0+)?Z?)?$/);
  if(match&&validDate(match[1]))return match[1];throw Error('Use an Excel date or an unambiguous YYYY-MM-DD date.');
 }
 if(typeof value!=='number'||!Number.isInteger(value)||value<(date1904?0:1)||value>2958465||(!date1904&&value===60))throw Error('Invalid Excel calendar date.');
 const epoch=Date.UTC(date1904?1904:1899,date1904?0:11,date1904?1:31),offset=date1904?value:value-(value>60?1:0);
 const result=new Date(epoch+offset*DAY).toISOString().slice(0,10);if(!validDate(result))throw Error('Date is outside the supported calendar.');return result;
}
function excelMinutes(cell,date,date1904,finish=false){
 const value=val(cell);let minutes;
 if(typeof value==='number'){
  if(value<0||!Number.isFinite(value))throw Error('Time must be a local clock time.');
  if(value<=1)minutes=value*1440;
  else{const day=excelDate(Math.floor(value),date1904),offset=(Date.parse(day+'T00:00:00Z')-Date.parse(date+'T00:00:00Z'))/DAY;
   if(!finish&&offset!==0)throw Error('Start date/time disagrees with Date.');
   if(offset<0||offset>7)throw Error('Finish date/time must be within seven days of Date.');minutes=offset*1440+(value-Math.floor(value))*1440;}
  if(Math.abs(minutes-Math.round(minutes))>.001)throw Error('Use times rounded to whole minutes.');minutes=Math.round(minutes);
 }else{
  const text=String(value??'').trim(),match=text.match(/^(\d{2}):([0-5]\d)(?::00)?$/);
  if(!match||Number(match[1])>24||(Number(match[1])===24&&match[2]!=='00'))throw Error('Use 24-hour HH:mm clock times.');minutes=Number(match[1])*60+Number(match[2]);
 }
 if(minutes<0||(!finish&&minutes>=1440)||(finish&&minutes>11520))throw Error('Start must be 00:00–23:59; use an explicit next-day finish for overnight activities.');return minutes;
}
function codeValue(cell){
 if(typeof val(cell)==='number'){
  const format=cell?.format?.match(/^0\.(0{1,8})$/);if(format)return cell.value.toFixed(format[1].length);
  throw Error('Store activity codes as text, or use an explicit fixed-decimal number format.');
 }
 const code=cellText(cell);if(!code||code.length>80||/[\x00-\x1f]/.test(code))throw Error('Activity code is missing or invalid.');return code;
}
function findHeader(sheet,aliases,required){
 for(const row of sheet.rows.slice(0,100)){
  const columns={},duplicates=[];
  for(const [column,cell] of Object.entries(row.cells)){const name=norm(val(cell));for(const [key,names] of Object.entries(aliases))if(names.includes(name)){if(columns[key])duplicates.push(key);else columns[key]=column;}}
  if(required.every(key=>columns[key]))return {row:row.number,columns,duplicates};
 }return null;
}
function urlValue(cell,issues,sheet,row,code){const raw=cellText(cell);if(!raw)return '';try{const u=new URL(raw);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw Error();if(raw.length>2000)throw Error();return raw;}catch{issue(issues,'error','Link must be a valid http(s) URL without credentials.',sheet,row,cell?.address,code);return '';}}
function explicitCoords(link){try{const u=new URL(link);if(!/^(?:(?:www|maps)\.)?google\.(com|com\.ph|co\.uk)$/.test(u.hostname))return null;
 const match=(u.searchParams.get('query')||u.searchParams.get('q')||'').match(/^\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*$/);if(!match)return null;
 const lat=Number(match[1]),lng=Number(match[2]);return Math.abs(lat)<=90&&Math.abs(lng)<=180?{lat,lng,verification:'unverified-source-coordinate'}:null;}catch{return null;}}
export function planExcelImport(workbook){
 const issues=[],skipped={dayHeadings:0,footerRows:0,blankRows:0,repeatedHeaders:0},matches=[];
 for(const sheet of workbook.sheets){const header=findHeader(sheet,labels,['code','title','date','start','finish','type']);if(header)matches.push({sheet,header});}
 if(matches.length!==1)throw Error(matches.length?'More than one activity table was found. Keep one itinerary table per workbook for this preview.':'No supported itinerary table found. Required headers: Code, Activity, Date, Start, Finish, Type.');
 const {sheet,header}=matches[0];if(header.duplicates.length)throw Error('Activity table contains duplicate headers: '+header.duplicates.join(', '));
 const detailsSheet=workbook.sheets.find(s=>norm(s.name)==='places & maps'),details=new Map(),detailHeader=detailsSheet?findHeader(detailsSheet,detailLabels,['code','title']):null;
 if(detailsSheet&&!detailHeader)issue(issues,'error','Places & Maps headers could not be recognized.',detailsSheet.name);
 if(detailHeader?.duplicates.length)issue(issues,'error','Duplicate Places & Maps headers: '+detailHeader.duplicates.join(', '),detailsSheet.name,detailHeader.row);
 if(detailHeader)for(const row of detailsSheet.rows.filter(row=>row.number>detailHeader.row)){
  const c=Object.fromEntries(Object.entries(detailHeader.columns).map(([k,col])=>[k,row.cells[col]]));if(!Object.values(c).some(cell=>cellText(cell)))continue;
  let code;try{code=codeValue(c.code);}catch(error){issue(issues,'error',error.message,detailsSheet.name,row.number,c.code?.address);continue;}
  if(details.has(code)){issue(issues,'error','Duplicate detail code.',detailsSheet.name,row.number,c.code?.address,code);continue;}
  const mapUrl=urlValue(c.mapUrl,issues,detailsSheet.name,row.number,code),researchUrl=urlValue(c.researchUrl,issues,detailsSheet.name,row.number,code);
  const detail={sourceRow:row.number,title:cellText(c.title),area:cellText(c.area),flag:cellText(c.flag),notes:cellText(c.notes),decision:cellText(c.decision),mapUrl,researchUrl,coordinate:explicitCoords(mapUrl)};
  if(detail.notes.length>2000||detail.decision.length>2000)issue(issues,'error','Instructions exceed the current activity notes limit; shorten them before importing.',detailsSheet.name,row.number,c.notes?.address,code);
  details.set(code,detail);
 }
 const activities=[],codes=new Set(),dateCounts={},typeCounts={};
 for(const row of sheet.rows.filter(row=>row.number>header.row)){
  const c=Object.fromEntries(Object.entries(header.columns).map(([k,col])=>[k,row.cells[col]]));
  if(!Object.values(c).some(cell=>cellText(cell))){skipped.blankRows++;continue;}
  const rawCode=cellText(c.code),rawTitle=cellText(c.title);
  if(/^DAY\s+\d+\b/i.test(rawTitle)&&!cellText(c.start)&&!cellText(c.finish)&&!cellText(c.type)){skipped.dayHeadings++;continue;}
  if(['NOTES','STATUS'].includes(rawCode.toUpperCase())&&!cellText(c.date)&&!cellText(c.start)&&!cellText(c.finish)){skipped.footerRows++;continue;}
  if(norm(rawCode)==='code'&&norm(rawTitle)==='activity'){skipped.repeatedHeaders++;continue;}
  if(activities.length>=5000)throw Error('The preview supports up to 5,000 activities. Split the workbook into smaller trips.');
  const activity={sourceRow:row.number,code:rawCode,title:rawTitle,date:null,time:null,finish:null,durationMinutes:null,sourceType:cellText(c.type),kind:TYPE_MAP[norm(val(c.type))]||'Other',predecessors:[],detail:null};
  for(const cell of Object.values(c))if(cell?.type==='e')issue(issues,'error','Excel error result: '+cellText(cell),sheet.name,row.number,cell.address,activity.code);
  const check=(key,run)=>{try{return run();}catch(error){issue(issues,'error',error.message,sheet.name,row.number,c[key]?.address,activity.code);return null;}};
  activity.code=check('code',()=>codeValue(c.code))||rawCode;
  if(codes.has(activity.code))issue(issues,'error','Duplicate activity code.',sheet.name,row.number,c.code?.address,activity.code);codes.add(activity.code);
  if(!activity.title||activity.title.length>150)issue(issues,'error','Activity title is required and must be at most 150 characters.',sheet.name,row.number,c.title?.address,activity.code);
  if(!activity.sourceType)issue(issues,'error','Activity type is required.',sheet.name,row.number,c.type?.address,activity.code);
  else if(!TYPE_MAP[norm(activity.sourceType)])issue(issues,'warning','Unknown activity type; it will need a category mapping before saving is enabled.',sheet.name,row.number,c.type?.address,activity.code);
  activity.date=check('date',()=>excelDate(val(c.date),workbook.date1904));
  const start=activity.date?check('start',()=>excelMinutes(c.start,activity.date,workbook.date1904)):null;
  const finish=activity.date?check('finish',()=>excelMinutes(c.finish,activity.date,workbook.date1904,true)):null;
  if(start!==null)activity.time=String(Math.floor(start/60)).padStart(2,'0')+':'+String(start%60).padStart(2,'0');
  if(finish!==null)activity.finish=String(Math.floor(finish/60)%24).padStart(2,'0')+':'+String(finish%60).padStart(2,'0')+(finish>=1440?' (+'+Math.floor(finish/1440)+'d)':'');
  if(start!==null&&finish!==null){
   const duration=finish-start;
   if(duration<=0||duration>10080)issue(issues,'error','Finish must follow Start. Specify the next-day date/time explicitly for an overnight activity.',sheet.name,row.number,c.finish?.address,activity.code);
   else{activity.durationMinutes=duration;const cached=val(c.duration);
    if(cached!==null&&cached!==''){
     const durationValue=typeof cached==='number'?cached*1440:/^\d+:[0-5]\d$/.test(String(cached))?Number(String(cached).split(':')[0])*60+Number(String(cached).split(':')[1]):NaN;
     if(!Number.isFinite(durationValue)||Math.abs(durationValue-duration)>.01)issue(issues,'error','Duration disagrees with Start and Finish.',sheet.name,row.number,c.duration?.address,activity.code);
    }else if(c.duration?.formula!==null&&c.duration?.formula!==undefined)issue(issues,'warning','Duration has no saved formula result; it was derived from Start and Finish.',sheet.name,row.number,c.duration?.address,activity.code);
   }
  }
  activity.predecessors=cellText(c.predecessor).split(/[,;\n]+/).map(x=>x.trim()).filter(Boolean);
  activity.detail=details.get(activity.code)||null;
  if(activity.date)dateCounts[activity.date]=(dateCounts[activity.date]||0)+1;typeCounts[activity.sourceType]=(typeCounts[activity.sourceType]||0)+1;
  activities.push(activity);
 }
 if(!activities.length)throw Error('The recognized activity table contains no activities.');
 for(const activity of activities)for(const predecessor of activity.predecessors)if(!codes.has(predecessor)||predecessor===activity.code)issue(issues,'error','Predecessor is missing or points to this activity: '+predecessor,sheet.name,activity.sourceRow,null,activity.code);
 const pending=new Map(activities.map(a=>[a.code,new Set(a.predecessors.filter(p=>codes.has(p)))])),followers=new Map();
 for(const [code,parents] of pending)for(const parent of parents){if(!followers.has(parent))followers.set(parent,[]);followers.get(parent).push(code);}
 const ready=[...pending].filter(([,parents])=>!parents.size).map(([code])=>code);let visited=0;
 for(let at=0;at<ready.length;at++){const code=ready[at];visited++;for(const child of followers.get(code)||[]){const parents=pending.get(child);parents.delete(code);if(!parents.size)ready.push(child);}}
 if(visited<pending.size)issue(issues,'error','Predecessor links contain a cycle. Review the linked activity codes.',sheet.name);
 for(const [code,detail] of details)if(!codes.has(code))issue(issues,'warning','Detail row has no matching activity code.',detailsSheet.name,detail.sourceRow,null,code);
 const missingDetails=activities.filter(a=>!a.detail).length;if(missingDetails)issue(issues,'warning',missingDetails+' activities have no matching place-detail row.',detailsSheet?.name||sheet.name);
 const dates=Object.keys(dateCounts).sort();const first=sheet.rows.find(r=>r.number<header.row)?.cells;const title=Object.values(first||{}).map(cellText).find(Boolean)?.split('|')[0].trim()||'Excel itinerary';
 const trip={id:'excel-preview-trip',title,startDate:dates[0]||'',endDate:dates.at(-1)||'',timezone:'Asia/Manila'};
 for(const activity of activities)if(activity.date&&activity.durationMinutes){const finishDay=new Date(Date.parse(activity.date+'T00:00:00Z')+Math.floor((Number(activity.time?.slice(0,2))*60+Number(activity.time?.slice(3))+activity.durationMinutes)/1440)*DAY).toISOString().slice(0,10);if(finishDay>trip.endDate)trip.endDate=finishDay;}
 try{normalizeTrip(trip);}catch(error){issue(issues,'error',error.message,sheet.name);}
 const normalized=[];for(const [index,a] of activities.entries())if(a.date&&a.time&&a.durationMinutes&&a.title&&a.title.length<=150){try{normalized.push(normalizeStop({id:'preview-'+a.code,title:a.title,date:a.date,time:a.time,durationMinutes:a.durationMinutes,kind:a.kind,sortOrder:index,notes:a.detail?.notes||''},trip));}catch(error){issue(issues,'error',error.message,sheet.name,a.sourceRow,null,a.code);}}
 const starts=normalized.map(a=>Date.parse(a.date+'T00:00:00Z')/60000+Number(a.time.slice(0,2))*60+Number(a.time.slice(3))).sort((a,b)=>a-b),ends=normalized.map(a=>Date.parse(a.date+'T00:00:00Z')/60000+Number(a.time.slice(0,2))*60+Number(a.time.slice(3))+a.durationMinutes).sort((a,b)=>a-b);
 let overlapCount=0,ended=0;for(let i=0;i<starts.length;i++){while(ended<ends.length&&ends[ended]<=starts[i])ended++;overlapCount+=i-ended;}
 if(overlapCount)issue(issues,'warning',overlapCount+' overlapping activity interval(s); review the schedule before saving is enabled.',sheet.name);
 const coverage=workbook.sheets.map(s=>({name:s.name,status:s.name===sheet.name?'Schedule preview':s.name===detailsSheet?.name?'Matched place details':norm(s.name)==='activity types'?'Source category definitions':'Not included in this preview'}));
 return {profile:'travelit-excel-itinerary-v1',activitySheet:sheet.name,readOnly:true,trip,activities,issues,skipped,coverage,statistics:{activityCount:activities.length,dayCount:dates.length,dateCounts,typeCounts,predecessorCount:activities.reduce((sum,a)=>sum+a.predecessors.length,0),matchedDetails:activities.length-missingDetails,explicitCoordinates:activities.filter(a=>a.detail?.coordinate).length,overlapCount,errorCount:issues.filter(i=>i.level==='error').length,warningCount:issues.filter(i=>i.level==='warning').length}};
}
