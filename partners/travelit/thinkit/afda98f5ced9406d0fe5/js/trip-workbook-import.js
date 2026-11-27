/** Reads a whole TravelIt workbook (Activity plus the optional Location Register,
 * Activity Links, Packing List, Cost Estimate, Hotels & Bookings, shopping and
 * Trip Summary sheets) into normalized TravelIt records. Pure: no storage. */
import {readExcelWorkbook} from './excel-reader.js';
import {excelDate} from './excel-import-plan.js';
import {normalizeTrip,normalizePlace,normalizeStop,normalizePacking,validCoords} from './domain.js';
import {normalizeExpense,EXPENSE_CATEGORIES} from './trip-costs.js';

const clean=v=>v===null||v===undefined?'':String(v).trim();
function table(sheet){
  if(!sheet?.rows?.length)return [];
  const [head,...rows]=sheet.rows;const cols=Object.entries(head.cells).map(([c,cell])=>[c,clean(cell.value)]).filter(([,h])=>h);
  return rows.map(r=>{const o={};for(const [c,h] of cols){const cell=r.cells[c];o[h]=cell?cell.value:null;o[h+'#format']=cell?.format||'';}return o;})
    .filter(o=>cols.some(([,h])=>clean(o[h])!==''));
}
const sheetLike=(wb,...names)=>wb.sheets.find(s=>names.some(n=>s.name.trim().toLowerCase()===n.toLowerCase()));
const toDate=(v,wb)=>{if(typeof v==='number')return excelDate(v,wb.date1904);const t=clean(v);return /^\d{4}-\d{2}-\d{2}/.test(t)?t.slice(0,10):'';};
const toTime=v=>{if(typeof v==='number'){const m=Math.round((v%1)*1440);return `${String(Math.floor(m/60)%24).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;}const t=clean(v).match(/^(\d{1,2}):(\d{2})/);return t?`${t[1].padStart(2,'0')}:${t[2]}`:'';};
const toMinutes=v=>{if(typeof v==='number')return Math.round(v*1440);const t=clean(v).match(/^(\d+):(\d{2})/);return t?Number(t[1])*60+Number(t[2]):0;};
const num=v=>{if(v===null||v===undefined||clean(v)==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;};
const KIND={Meal:'Meal',Transport:'Travel',Travel:'Travel',Hotel:'Hotel','Prep/Admin':'Other',Tour:'Activity',Free:'Activity'};
const COST={Meals:'Food',Food:'Food',Accommodation:'Accommodation',Activities:'Activities',Parking:'Parking',Transport:'Other transport',Seafood:'Shopping',Pasalubong:'Shopping',Shopping:'Shopping'};
const navFrom=text=>(clean(text).match(/https?:\/\/\S+/)||[''])[0].replace(/[).,;]+$/,'');
const stripNav=text=>clean(text).replace(/Navigation:\s*https?:\/\/\S+/g,'').replace(/\s*[;|]\s*$/,'').trim();

export function readTripWorkbook(bytes,{now=new Date().toISOString(),uid=()=>crypto.randomUUID()}={}){
  const wb=readExcelWorkbook(bytes);
  const acts=table(sheetLike(wb,'Activity','Activities','Itinerary'));
  if(!acts.length)throw Error('The workbook needs an Activity sheet with Code, Activity, Date and Start columns.');
  const summary=Object.fromEntries(table(sheetLike(wb,'Trip Summary')).map(r=>[clean(r.Metric),r]));
  const dates=acts.map(a=>toDate(a.Date,wb)).filter(Boolean).sort();
  const title=clean(summary.Trip?.Value)||'Imported trip';
  const trip=normalizeTrip({title,startDate:dates[0],endDate:dates.at(-1),timezone:'Asia/Manila',subtitle:clean(summary.Trip?.Notes),departFrom:clean(summary.Departure?.Notes),notes:''},now);
  const report={warnings:[],counts:{}};
  // Places: full register first, then the legacy pins sheet for anything missing.
  const placeById=new Map();
  for(const r of [...table(sheetLike(wb,'Location Register')),...table(sheetLike(wb,'Places & Maps','Places'))]){
    const code=clean(r['Place ID']);if(!code||placeById.has(code))continue;
    const lat=num(r.Latitude),lng=num(r.Longitude),ok=lat!==null&&lng!==null&&validCoords(lat,lng);
    const nav=navFrom(r['Navigation URL']),src=navFrom(r['Source URL']);
    placeById.set(code,normalizePlace({id:uid(),code,name:clean(r.Place),category:'Destination',stage:'Planned',lat:ok?lat:'',lng:ok?lng:'',sourceUrl:src,navigationUrl:nav,coordinateStatus:clean(r['Coordinate status'])||(ok?'Pinned':'Link only'),notes:clean(r['Pin note'])},now));
  }
  const links=new Map(table(sheetLike(wb,'Activity Links')).map(r=>[clean(r.Code),r]));
  const codeToStop=new Map();
  const stops=acts.map((a,i)=>{
    const code=clean(a.Code),link=links.get(code)||{},placeCode=clean(link['Place ID'])||clean(a['Place ID']);
    const place=placeById.get(placeCode);if(placeCode&&!place)report.warnings.push(`Stop ${code}: place ${placeCode} is not in the place list.`);
    const nav=navFrom(link['Navigation URL'])||navFrom(a.Notes);
    if(place&&nav&&!place.navigationUrl)place.navigationUrl=nav;
    const s=normalizeStop({id:uid(),code,title:clean(a.Activity),date:toDate(a.Date,wb),time:toTime(a.Start),durationMinutes:toMinutes(a.Duration),kind:KIND[clean(a.Type)]||'Activity',activityType:clean(a.Type),priority:clean(link.Priority),placeId:place?.id||null,sortOrder:(i+1)*1000,notes:stripNav(a.Notes)},trip,now);
    codeToStop.set(code,s);return s;
  });
  const packing=table(sheetLike(wb,'Packing List','Packing')).map(r=>{
    const q=Math.max(1,Math.min(999,Math.round(num(r.Quantity)??1)));
    return normalizePacking({id:uid(),label:clean(r.Item),group:clean(r.Category),unit:clean(r.Unit),quantity:q,owner:clean(r.Owner),packed:/^packed$/i.test(clean(r.Status)),notes:clean(r.Notes)},trip,now);
  });
  const expenses=table(sheetLike(wb,'Cost Estimate','Budget')).map(r=>{
    const group=clean(r.Category),date=toDate(r.Date,wb),stop=codeToStop.get(clean(r['Activity Code']));
    const planned=num(r['Planned PHP']),actual=num(r['Actual PHP']);
    return normalizeExpense({id:uid(),label:clean(r.Item),category:COST[group]||(EXPENSE_CATEGORIES.includes(group)?group:'Other'),group,date:date>=trip.startDate&&date<=trip.endDate?date:null,plannedPhp:planned,actualPhp:actual,amountPending:planned===null&&actual===null,stopId:stop?.id||'',notes:clean(r.Notes)},trip,now);
  });
  const bookings=table(sheetLike(wb,'Hotels & Bookings','Bookings')).map(r=>({id:uid(),name:clean(r.Property),placeId:placeById.get(clean(r['Place ID']))?.id||null,checkIn:toDate(r['Check-in'],wb),checkOut:toDate(r['Check-out'],wb),status:clean(r.Status),confirmation:clean(r.Confirmation),notes:clean(r.Notes)}));
  const shopSheet=wb.sheets.find(s=>/shopping/i.test(s.name));
  const shopping=table(shopSheet).map(r=>[r,Object.keys(r).filter(k=>!k.endsWith('#format'))]).filter(([r,keys])=>clean(r['Item ID'])&&clean(r[keys[1]])).map(([r,keys])=>{
    return {id:uid(),name:clean(r[keys[1]]),group:shopSheet.name.replace(/\s*shopping/i,'').trim(),unit:'kg',lowPhp:num(r['Low PHP/kg']),highPhp:num(r['High PHP/kg']),pricePhp:num(r['Budget PHP/kg']),plannedQty:num(r['Planned kg']),boughtQty:num(r['Actual kg']),paidPhp:num(r['Actual PHP'])};});
  const finalTrip=normalizeTrip({...trip,bookings,shopping},now);
  report.counts={stops:stops.length,places:placeById.size,packing:packing.length,expenses:expenses.length,bookings:bookings.length,shopping:shopping.length};
  return {trip:finalTrip,places:[...placeById.values()],stops,packing,expenses,report};
}
