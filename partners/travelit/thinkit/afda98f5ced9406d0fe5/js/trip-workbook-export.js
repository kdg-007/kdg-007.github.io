/** Writes a trip back to an .xlsx in the same layout the workbook importer reads
 * (Activity, Location Register, Activity Links, Packing List, Cost Estimate,
 * Hotels & Bookings, a shopping sheet and Trip Summary), and builds a read-only
 * itinerary page to share. Pure: no storage, no network. */

const xml=v=>String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
const colName=i=>{let s='';for(i++;i;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s};
const serialDate=d=>(Date.UTC(+d.slice(0,4),+d.slice(5,7)-1,+d.slice(8,10))-Date.UTC(1899,11,30))/864e5;
// Cell helpers: {d:'yyyy-mm-dd'} date, {t:'hh:mm'} time, {m:minutes} duration, numbers, strings.
const STYLE={date:1,time:2,duration:3};
function cell(value,ref){
  if(value===null||value===undefined||value==='')return '';
  if(typeof value==='number'&&Number.isFinite(value))return `<c r="${ref}"><v>${value}</v></c>`;
  if(value?.d)return `<c r="${ref}" s="${STYLE.date}"><v>${serialDate(value.d)}</v></c>`;
  if(value?.t){const [h,m]=value.t.split(':').map(Number);return `<c r="${ref}" s="${STYLE.time}"><v>${(h*60+m)/1440}</v></c>`}
  if(value?.m!==undefined)return `<c r="${ref}" s="${STYLE.duration}"><v>${value.m/1440}</v></c>`;
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
}
function sheetXml(rows){
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((r,i)=>`<row r="${i+1}">${r.map((v,j)=>cell(v,colName(j)+(i+1))).join('')}</row>`).join('')}</sheetData></worksheet>`;
}
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
const crc32=b=>{let c=0xffffffff;for(const x of b)c=CRC[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0};
/** Minimal ZIP (stored, no compression), enough for Office Open XML. */
function zip(files){
  const enc=new TextEncoder(),parts=[],central=[];let offset=0;
  for(const [name,text] of files){
    const data=enc.encode(text),nameBytes=enc.encode(name),crc=crc32(data),local=new DataView(new ArrayBuffer(30));
    local.setUint32(0,0x04034b50,true);local.setUint16(4,20,true);local.setUint16(8,0,true);local.setUint32(14,crc,true);local.setUint32(18,data.length,true);local.setUint32(22,data.length,true);local.setUint16(26,nameBytes.length,true);
    parts.push(new Uint8Array(local.buffer),nameBytes,data);
    const c=new DataView(new ArrayBuffer(46));c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,nameBytes.length,true);c.setUint32(42,offset,true);
    central.push(new Uint8Array(c.buffer),nameBytes);offset+=30+nameBytes.length+data.length;
  }
  const size=central.reduce((s,p)=>s+p.length,0),end=new DataView(new ArrayBuffer(22));
  end.setUint32(0,0x06054b50,true);end.setUint16(8,files.length,true);end.setUint16(10,files.length,true);end.setUint32(12,size,true);end.setUint32(16,offset,true);
  return new Blob([...parts,...central,new Uint8Array(end.buffer)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
const addMinutes=(t,m)=>{const x=(+t.slice(0,2))*60+(+t.slice(3,5))+(m||0);return `${String(Math.floor(x/60)%24).padStart(2,'0')}:${String(x%60).padStart(2,'0')}`};
const TYPE={Travel:'Transport',Meal:'Meal',Activity:'Tour',Hotel:'Hotel',Other:'Other'};

/** Returns {blob, filename} for the trip in the importer's workbook layout. */
export function exportTripWorkbook({trip,stops,places,packing,expenses}){
  const placeCode=new Map(),codeOf=id=>{if(!id)return '';if(!placeCode.has(id))placeCode.set(id,places.find(p=>p.id===id)?.code||`PL${String(placeCode.size+1).padStart(3,'0')}`);return placeCode.get(id)};
  const used=[...new Set(stops.map(s=>s.placeId).filter(Boolean)),...(trip.bookings||[]).map(b=>b.placeId).filter(Boolean)];used.forEach(codeOf);
  const dayIndex=d=>Math.round((Date.parse(d)-Date.parse(trip.startDate))/864e5)+1,counts={};
  const codes=new Map(stops.map(s=>{const d=dayIndex(s.date);counts[d]=(counts[d]||0)+1;return [s.id,s.code||`${d}.${String(counts[d]).padStart(2,'0')}`]}));
  const activity=[['Code','Activity','Duration','Date','Start','Finish','Type','Predecessor','Place ID','Notes'],...stops.map(s=>[codes.get(s.id),s.title,{m:s.durationMinutes||0},{d:s.date},s.time?{t:s.time}:'',s.time?{t:addMinutes(s.time,s.durationMinutes)}:'',s.activityType||TYPE[s.kind]||'Tour','',codeOf(s.placeId),s.notes||''])];
  const register=[['Place ID','Place','Latitude','Longitude','Coordinate status','Source URL','Navigation URL','Pin note'],...used.map(id=>{const p=places.find(x=>x.id===id);return p?[codeOf(id),p.name,p.lat??'',p.lng??'',p.coordinateStatus||(p.lat!==null&&p.lat!==undefined?'Pinned':'Link only'),p.sourceUrl||'',p.navigationUrl||'',p.notes||'']:null}).filter(Boolean)];
  const links=[['Code','Day','Place ID','Priority','Navigation URL'],...stops.map(s=>[codes.get(s.id),dayIndex(s.date),codeOf(s.placeId),s.priority||'Planned',places.find(p=>p.id===s.placeId)?.navigationUrl||''])];
  const pack=[['Item ID','Category','Item','Quantity','Unit','Owner','Status','Notes'],...packing.map((p,i)=>[`PK${String(i+1).padStart(3,'0')}`,p.group||p.category,p.label,p.quantity,p.unit||'',p.owner||'',p.packed?'Packed':'Not packed',p.notes||''])];
  const cost=[['Expense ID','Date','Category','Item','Activity Code','Planned PHP','Actual PHP','Variance PHP','Status','Notes'],...expenses.map((e,i)=>[`EX${String(i+1).padStart(3,'0')}`,e.date?{d:e.date}:'',e.group||e.category,e.label,e.stopId?codes.get(e.stopId)||'':'',e.plannedPhp??'',e.actualPhp??'',e.plannedPhp!=null&&e.actualPhp!=null?e.actualPhp-e.plannedPhp:'',e.amountPending?'Amount unknown':e.actualPhp!=null?'Actual':'Estimate',e.notes||''])];
  const book=[['Booking ID','Property','Place ID','Check-in','Check-out','Nights','Status','Confirmation','Notes'],...(trip.bookings||[]).map((b,i)=>[`BK${String(i+1).padStart(3,'0')}`,b.name,codeOf(b.placeId),b.checkIn?{d:b.checkIn}:'',b.checkOut?{d:b.checkOut}:'',b.checkIn&&b.checkOut?dayIndex(b.checkOut)-dayIndex(b.checkIn):'',b.status||'',b.confirmation||'',b.notes||''])];
  const shopping=trip.shopping||[],shopName=`${shopping[0]?.group||'Market'} Shopping`.slice(0,31);
  const shop=[['Item ID','Item','Low PHP/kg','High PHP/kg','Planned kg','Budget PHP/kg','Planned PHP','Actual kg','Actual PHP'],...shopping.map((x,i)=>[`SH${String(i+1).padStart(3,'0')}`,x.name,x.lowPhp??'',x.highPhp??'',x.plannedQty??'',x.pricePhp??'',x.plannedQty&&x.pricePhp?x.plannedQty*x.pricePhp:'',x.boughtQty??'',x.paidPhp??''])];
  const first=stops[0];
  const summary=[['Metric','Value','Notes'],['Trip',trip.title,trip.subtitle||''],['Trip ID',trip.id,'TravelIt export'],['Departure',first?`${first.date} ${first.time||''}`.trim():trip.startDate,trip.departFrom||''],['Return',trip.endDate,''],['Exported',new Date().toISOString().slice(0,10),'From TravelIt']];
  const sheets=[['Activity',activity],['Location Register',register],['Activity Links',links],['Packing List',pack],['Cost Estimate',cost],['Hotels & Bookings',book],...(shopping.length?[[shopName,shop]]:[]),['Trip Summary',summary]];
  const files=[
    ['[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
    ['_rels/.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map(([n],i)=>`<sheet name="${xml(n)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="3"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/><numFmt numFmtId="165" formatCode="hh:mm"/><numFmt numFmtId="166" formatCode="[h]:mm"/></numFmts><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`],
    ...sheets.map(([,rows],i)=>[`xl/worksheets/sheet${i+1}.xml`,sheetXml(rows)])
  ];
  const safe=trip.title.replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'_')||'Trip';
  return {blob:zip(files),filename:`${safe}_TravelIt_${trip.startDate}.xlsx`};
}

/** A self-contained, read-only itinerary page for family: day by day, with map links. */
export function itineraryHtml({trip,stops,places}){
  const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const day=d=>new Date(d+'T12:00').toLocaleDateString('en-PH',{weekday:'long',month:'long',day:'numeric'});
  const place=id=>places.find(p=>p.id===id);
  const nav=p=>p?.navigationUrl||(p&&p.lat!=null?`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`:'');
  const dates=[...new Set(stops.map(s=>s.date))].sort();
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(trip.title)} · itinerary</title>
<style>body{margin:0;font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#18201f;background:#f5f1ea}header{background:#0d4f5a;color:#eaf6f4;padding:24px max(4vw,16px)}h1{margin:0;font-size:30px;line-height:1.1}main{max-width:820px;margin:0 auto;padding:8px max(4vw,16px) 40px}h2{font-size:20px;margin:26px 0 8px}ol{list-style:none;margin:0;padding:0;background:#fff;border:1px solid #e2dbcf;border-radius:14px;overflow:hidden}li{display:grid;grid-template-columns:62px 1fr;gap:2px 12px;padding:10px 14px;border-top:1px solid #e2dbcf}li:first-child{border-top:0}.t{font-weight:800}.p{color:#5d6a68;font-size:14px}.n{grid-column:2;font-size:14px;color:#5d6a68}a{color:#0d4f5a}footer{color:#5d6a68;font-size:13px;margin-top:24px}@media print{header{background:none;color:#000}body{background:#fff}}</style></head>
<body><header><h1>${e(trip.title)}</h1><p style="margin:6px 0 0">${e(trip.subtitle||'')}${trip.subtitle?' · ':''}${e(day(trip.startDate))} – ${e(day(trip.endDate))}</p></header><main>
${dates.map((d,i)=>`<h2>Day ${i+1} · ${e(day(d))}</h2><ol>${stops.filter(s=>s.date===d).map(s=>{const p=place(s.placeId),u=nav(p);return `<li><span class="t">${e(s.time||'')}</span><span><b>${e(s.title)}</b>${p?`<span class="p"> · ${u?`<a href="${e(u)}">${e(p.name)}</a>`:e(p.name)}</span>`:''}</span>${s.notes?`<span class="n">${e(s.notes)}</span>`:''}</li>`}).join('')}</ol>`).join('')}
<footer>Shared from TravelIt. Read-only copy made ${e(new Date().toLocaleString('en-PH'))}; times may change.</footer></main></body></html>`;
}
