/** TravelIt trips workspace. Same local records as the classic screens
 * (trip, stop, place, packing, expense); every write goes through the guarded
 * store so a stale tab can never overwrite newer data. KeepIt items are linked
 * by reference only, through the host's travelItKeepItLinks bridge. */
import {openDatabase,allData,guardedSaveRecord,guardedDeleteRecord,guardedDeleteTrip,getWorkspaceMetadata,revisionFor} from './db.js';
import {normalizeTrip,normalizeStop,normalizePlace,normalizePacking,tripDateAt,validCoords,uid} from './domain.js';
import {normalizeExpense,EXPENSE_CATEGORIES} from './trip-costs.js';
import {readTripWorkbook} from './trip-workbook-import.js';
import {ownedTravelItHooks} from './owned-keepit-hooks.js';
import {prepareOfflineShell} from './offline-shell.js';

const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const peso=n=>'₱'+Math.round(Number(n)||0).toLocaleString('en-PH');
const mins=t=>{if(!t)return null;const[h,m]=t.split(':').map(Number);return h*60+m};
const hhmm=m=>`${String(Math.floor(m/60)%24).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
const fmtDur=m=>!m?'':m>=60?`${Math.floor(m/60)} h${m%60?' '+m%60+' min':''}`:`${m} min`;
const dayName=d=>new Date(d+'T12:00').toLocaleDateString('en-PH',{weekday:'short',month:'short',day:'numeric'});
const longDay=d=>new Date(d+'T12:00').toLocaleDateString('en-PH',{weekday:'long',month:'long',day:'numeric'});
const datesBetween=(a,b)=>{const out=[];for(let d=new Date(a+'T12:00Z');d.toISOString().slice(0,10)<=b;d.setUTCDate(d.getUTCDate()+1))out.push(d.toISOString().slice(0,10));return out};
const TYPES=['Transport','Meal','Tour','Free','Prep/Admin','Hotel','Other'];
const TYPE_KIND={Transport:'Travel',Meal:'Meal',Tour:'Activity',Free:'Activity','Prep/Admin':'Other',Hotel:'Hotel',Other:'Other'};
const KIND_TYPE={Travel:'Transport',Meal:'Meal',Activity:'Tour',Hotel:'Hotel',Other:'Other'};
const TYPE_LABEL={Transport:'Drive',Meal:'Meal',Tour:'See & do',Free:'Free time','Prep/Admin':'Admin',Hotel:'Hotel',Other:'Other'};
const TYPE_COLOR={Transport:'var(--t-transport)',Meal:'var(--t-meal)',Tour:'var(--t-tour)',Free:'var(--t-free)','Prep/Admin':'var(--t-admin)',Hotel:'var(--t-hotel)',Other:'#6b7280'};
const PRIORITIES=['Planned','Optional','Weather conditional','Optional / weather','Booking','Must do'];
const DAY_COLORS=['#e2552f','#c08a1e','#0d7a6e','#2c6fb0','#7d5aa6','#5b6f8f','#b4457f'];
const TABS=[['today','Today'],['plan','Plan'],['map','Map'],['bookings','Bookings'],['packing','Packing'],['budget','Budget'],['journal','Journal']];
const typeOf=s=>s.activityType&&TYPES.includes(s.activityType)?s.activityType:KIND_TYPE[s.kind]||'Other';

const state={db:null,records:[],meta:null,ui:JSON.parse(sessionStorage.getItem('travelit-trips-ui')||'{}')};
const keepUi=()=>{try{sessionStorage.setItem('travelit-trips-ui',JSON.stringify(state.ui))}catch{}};
const of=type=>state.records.filter(r=>r.type===type).map(r=>r.data);
const rowOf=(type,id)=>state.records.find(r=>r.key===`${type}:${id}`);
const trips=()=>of('trip').sort((a,b)=>a.startDate.localeCompare(b.startDate));
const tripById=id=>of('trip').find(t=>t.id===id);
const stopsOf=t=>of('stop').filter(s=>s.tripId===t.id).sort((a,b)=>a.date.localeCompare(b.date)||(mins(a.time)??9999)-(mins(b.time)??9999)||a.sortOrder-b.sortOrder);
const placeById=id=>of('place').find(p=>p.id===id);
const hasPin=p=>p&&p.lat!==null&&p.lng!==null&&validCoords(p.lat,p.lng);
const packingOf=t=>of('packing').filter(p=>p.tripId===t.id);
const expensesOf=t=>of('expense').filter(e=>e.tripId===t.id).sort((a,b)=>(a.date||'').localeCompare(b.date||''));
const daysOf=t=>datesBetween(t.startDate,t.endDate);
const navUrl=(s,p)=>p?.navigationUrl||(hasPin(p)?`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`:p?.name?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}`:'');
const wazeUrl=p=>hasPin(p)?`https://waze.com/ul?ll=${p.lat},${p.lng}&navigate=yes`:'';

function toast(message,error=false){const t=$('#toast');t.textContent=message;t.classList.toggle('err',error);t.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('on'),error?4200:2000)}
async function load(){const data=await allData(state.db);state.records=data.records;state.meta=await getWorkspaceMetadata(state.db)}

/* ---------- Guarded writes ---------- */
async function put(type,data){
  const key=`${type}:${data.id}`,row=rowOf(type,data.id);
  await guardedSaveRecord(state.db,type,data,{expectedEpoch:state.meta.epoch,expectedWorkspaceRevision:null,expectedRevisionByKey:{[key]:revisionFor(row)},expectedPresenceByKey:{[key]:!!row}});
}
async function remove(type,id){
  const key=`${type}:${id}`,row=rowOf(type,id);if(!row)return;
  await guardedDeleteRecord(state.db,type,id,{expectedEpoch:state.meta.epoch,expectedWorkspaceRevision:null,expectedRevisionByKey:{[key]:revisionFor(row)},expectedPresenceByKey:{[key]:true}});
}
async function commit(work,message){
  try{await work();await load();render();if(message)toast(message);return true}
  catch(error){await load().catch(()=>{});render();toast(error?.message||'That change could not be saved.',true);return false}
}
const saveTrip=(t,patch)=>put('trip',normalizeTrip({...t,...patch}));
const saveStop=(t,s)=>put('stop',normalizeStop(s,t));

/* ---------- KeepIt bridge (provided by the KeepIt host when TravelIt opens inside it) ---------- */
const bridge=()=>window.travelItKeepItLinks||null;
const refOf=x=>({scope:x.scope,itemId:x.itemId,kind:x.kind,title:String(x.title||'Untitled').slice(0,256)});
const thumbDb=new Promise(ok=>{try{const r=indexedDB.open('travelit-thumbs',1);r.onupgradeneeded=()=>r.result.createObjectStore('thumbs');r.onsuccess=()=>ok(r.result);r.onerror=()=>ok(null)}catch{ok(null)}});
const thumbUrls=new Map();
async function thumbGet(id){const db=await thumbDb;if(!db)return undefined;return new Promise(ok=>{const q=db.transaction('thumbs').objectStore('thumbs').get(id);q.onsuccess=()=>ok(q.result);q.onerror=()=>ok(undefined)})}
async function thumbPut(id,v){const db=await thumbDb;if(!db)return;try{db.transaction('thumbs','readwrite').objectStore('thumbs').put(v,id)}catch{}}
/** Object URL for an attached image, from this device's cache first, then KeepIt. */
async function thumbUrl(ref){
  if(thumbUrls.has(ref.itemId))return thumbUrls.get(ref.itemId);
  let v=await thumbGet(ref.itemId);
  if(v===undefined&&bridge()?.thumbnail&&ref.kind!=='note'){try{v=await bridge().thumbnail(ref)||'none'}catch{v=undefined}if(v!==undefined)await thumbPut(ref.itemId,v)}
  const url=v instanceof Blob?URL.createObjectURL(v):null;thumbUrls.set(ref.itemId,url);return url;
}
function hydrateThumbs(root=document){
  for(const el of root.querySelectorAll('[data-thumb]:not([data-done])')){el.dataset.done='1';const ref=JSON.parse(el.dataset.thumb);
    thumbUrl(ref).then(url=>{if(!url)return;if(el.tagName==='IMG'){el.src=url;el.hidden=false}else{const img=document.createElement('img');img.className=el.className;img.alt=ref.title;img.src=url;el.replaceWith(img)}})}
}
const thumbHtml=(ref,cls='thumb')=>`<span class="${cls}" data-thumb="${esc(JSON.stringify(ref))}" title="${esc(ref.title)}">${ref.kind==='note'?'Note':esc(ref.title.split('.').pop().slice(0,5))}</span>`;
async function openRef(ref){if(!bridge())return toast('Open TravelIt from KeepIt to open linked items.',true);try{await bridge().open(ref)}catch(e){toast(e.message,true)}}

/* ---------- Routing ---------- */
function route(){const [, id, tab]=(location.hash.match(/^#trip\/([^/]+)\/?([a-z]*)/)||[]);return id?{trip:tripById(decodeURIComponent(id)),tab:TABS.some(t=>t[0]===tab)?tab:'today'}:{trip:null,tab:'trips'}}
const link=(t,tab)=>`#trip/${encodeURIComponent(t.id)}/${tab}`;
let mapDispose=null;
function render(){
  if(mapDispose){mapDispose();mapDispose=null}
  const r=route();const view=$('#view'),tabs=$('#tabs');
  if(!r.trip){tabs.hidden=true;$('#crumb').textContent='';view.innerHTML=viewTrips();drawStubRoute();hydrateThumbs();return}
  tabs.hidden=false;$('#crumb').textContent='· '+r.trip.title;
  tabs.firstElementChild.innerHTML=TABS.map(([id,l])=>`<a href="${link(r.trip,id)}" ${id===r.tab?'aria-current="page"':''}>${l}</a>`).join('')+`<a href="#" data-act="edit-trip" style="margin-left:auto">Trip details</a>`;
  view.innerHTML=({today:viewToday,plan:viewPlan,map:viewMap,bookings:viewBookings,packing:viewPacking,budget:viewBudget,journal:viewJournal})[r.tab](r.trip);
  if(r.tab==='map')mountMap(r.trip);
  hydrateThumbs();
}

/* ---------- My trips ---------- */
function moment(t){
  if(state.ui.sim?.trip===t.id)return{date:state.ui.sim.date,m:mins(state.ui.sim.time),sim:true};
  const n=new Date(),date=tripDateAt(n,t.timezone||'Asia/Manila');
  const hm=new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:t.timezone||'Asia/Manila'}).format(n);
  return{date,m:mins(hm),sim:false};
}
function countdown(t){const m=moment(t),first=stopsOf(t)[0],start=new Date(`${t.startDate}T${first?.time||'00:00'}:00+08:00`),ms=start-Date.now();
  if(m.date>t.endDate)return'Trip complete';if(m.date>=t.startDate)return'On the road';const h=Math.round(ms/36e5);return h<48?`Leaves in ${h} h`:`Leaves in ${Math.ceil(h/24)} days`}
function viewTrips(){
  const all=trips(),today=tripDateAt(new Date(),'Asia/Manila');
  const next=all.find(t=>t.endDate>=today),upcoming=all.filter(t=>t.endDate>=today&&t!==next),past=all.filter(t=>t.endDate<today).reverse();
  const actions=`<div class="row"><button class="btn teal" data-act="new-trip">New trip</button><button class="btn" data-act="import-xlsx">Import spreadsheet</button><button class="btn" data-act="offline" title="Keep TravelIt opening without signal">Save for offline</button></div>`;
  let hero='';
  if(next){const st=stopsOf(next),pk=packingOf(next),planned=expensesOf(next).reduce((s,e)=>s+(e.plannedPhp||0),0);
    hero=`<a class="stub" href="${link(next,'today')}"><div class="info"><span class="tag" style="align-self:flex-start;background:var(--coral);color:#fff">Next trip</span>
    <div><h2 style="font-size:clamp(26px,4vw,38px)">${esc(next.title)}</h2>${next.subtitle?`<p style="margin:6px 0 0;opacity:.85">${esc(next.subtitle)}</p>`:''}</div>
    <div class="count">${countdown(next)}</div><p style="margin:0;opacity:.9">${dayName(next.startDate)} – ${dayName(next.endDate)}${next.departFrom?' · from '+esc(next.departFrom):''}</p>
    <div class="stats"><div><b>${st.length}</b><span>stops</span></div><div><b>${new Set(st.map(s=>s.placeId).filter(Boolean)).size}</b><span>places</span></div><div><b>${pk.filter(p=>p.packed).length}/${pk.length}</b><span>packed</span></div><div><b>${peso(planned)}</b><span>budget</span></div></div>
    <span class="btn primary" style="align-self:flex-start">Open trip</span></div><div class="route"><div id="stub-route" data-trip="${esc(next.id)}"></div></div></a>`}
  const card=t=>`<a class="trip-card" href="${link(t,'plan')}"><b style="font-size:18px">${esc(t.title)}</b><span class="muted small">${dayName(t.startDate)} – ${dayName(t.endDate)} · ${stopsOf(t).length} stops</span></a>`;
  return `<div class="row between" style="margin-bottom:16px"><h1>My trips</h1>${actions}</div>
  ${hero||`<div class="empty"><p style="font-size:18px;margin-top:0">No trips yet.</p><p>Create a trip, or import an itinerary spreadsheet (Activity, places, packing, costs and bookings sheets are all read).</p>${actions}</div>`}
  ${upcoming.length?`<div class="section-head"><h2>Also planned</h2></div><div class="cards">${upcoming.map(card).join('')}</div>`:''}
  <div class="section-head"><h2>Ideas</h2></div>${ideasHtml()}
  ${past.length?`<div class="section-head"><h2>Past trips</h2></div><div class="cards">${past.map(card).join('')}</div>`:''}`;
}
function ideasHtml(){
  const used=new Set(of('stop').map(s=>s.placeId)),ideas=of('place').filter(p=>!used.has(p.id));
  return ideas.length?`<div class="cards">${ideas.slice(0,12).map(p=>`<button class="trip-card" style="text-align:left;cursor:pointer" data-act="edit-place" data-id="${esc(p.id)}"><b>${esc(p.name)}</b><span class="muted small">${esc(p.stage||'Idea')}${hasPin(p)?' · pinned':''}</span></button>`).join('')}</div>`
   :`<div class="empty">Places saved for someday land here. <button class="btn sm" data-act="edit-place">Save a place</button></div>`;
}
function drawStubRoute(){const el=$('#stub-route');if(!el)return;const t=tripById(el.dataset.trip);el.innerHTML=routeSvg(t,el.clientWidth||400,el.clientHeight||260)}
function routeSvg(t,w,h){
  const st=stopsOf(t),pins=[...new Map(st.map(s=>placeById(s.placeId)).filter(hasPin).map(p=>[p.id,p])).values()];
  if(pins.length<2)return `<svg viewBox="0 0 ${w} ${h}"><text x="${w/2}" y="${h/2}" fill="#ffffffa0" text-anchor="middle" font-size="14">Pins appear here once places have coordinates</text></svg>`;
  const pad=30,c=Math.cos(pins[0].lat*Math.PI/180),la=pins.map(p=>p.lat),lo=pins.map(p=>p.lng),[a0,a1,o0,o1]=[Math.min(...la),Math.max(...la),Math.min(...lo),Math.max(...lo)];
  const k=Math.min((w-2*pad)/((o1-o0)*c||1),(h-2*pad)/((a1-a0)||1)),cx=(w-(o1-o0)*c*k)/2,cy=(h-(a1-a0)*k)/2,xy=p=>[cx+(p.lng-o0)*c*k,h-cy-(p.lat-a0)*k];
  const lines=daysOf(t).map((d,i)=>{const seq=st.filter(s=>s.date===d).map(s=>placeById(s.placeId)).filter(hasPin).filter((p,j,a)=>!j||a[j-1].id!==p.id);return seq.length>1?`<polyline points="${seq.map(p=>xy(p).join(',')).join(' ')}" fill="none" stroke="${DAY_COLORS[i%7]}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".95"/>`:''}).join('');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%" role="img" aria-label="Trip route">${lines}${pins.map(p=>{const[x,y]=xy(p);return`<circle cx="${x}" cy="${y}" r="7" fill="#fff" stroke="#0a434d" stroke-width="2.5"/>`}).join('')}</svg>`;
}

/* ---------- Stop rows (shared by Today and Plan) ---------- */
function stopRow(t,s,{now=false}={}){
  const p=placeById(s.placeId),nav=navUrl(s,p),wz=wazeUrl(p),ty=typeOf(s),docs=s.keepItDocuments||[];
  return `<li class="stop${s.done?' done':''}${now?' now':''}"><div class="time">${esc(s.time||'—')}<small>${fmtDur(s.durationMinutes)}</small></div>
  <div class="what" data-act="edit-stop" data-id="${esc(s.id)}" role="button" tabindex="0" aria-label="Edit ${esc(s.title)}"><span class="title">${esc(s.title)}</span>
   <span class="meta"><span class="dot" style="background:${TYPE_COLOR[ty]}"></span>${esc(TYPE_LABEL[ty])}${p?' · '+esc(p.name):''}${s.priority?` <span class="tag ${/option|weather/i.test(s.priority)?'opt':''}">${esc(s.priority)}</span>`:''}</span>
   ${s.notes?`<span class="notes">${esc(s.notes)}</span>`:''}${docs.length?`<span class="thumbs">${docs.slice(0,4).map(d=>thumbHtml(d)).join('')}${docs.length>4?`<span class="thumb">+${docs.length-4}</span>`:''}</span>`:''}</div>
  <div class="go row"><button class="btn sm" data-act="toggle-done" data-id="${esc(s.id)}" aria-pressed="${!!s.done}">${s.done?'Done ✓':'Done'}</button>${nav?`<a class="btn sm" href="${esc(nav)}" target="_blank" rel="noopener">Maps</a>`:''}${wz?`<a class="btn sm" href="${esc(wz)}" target="_blank" rel="noopener">Waze</a>`:''}</div></li>`;
}

/* ---------- Today ---------- */
function viewToday(t){
  const mo=moment(t),days=daysOf(t);let day=mo.date,mode='during';
  if(mo.date<t.startDate){day=t.startDate;mode='before'}else if(mo.date>t.endDate){day=t.endDate;mode='after'}
  const list=stopsOf(t).filter(s=>s.date===day),dayIdx=days.indexOf(day)+1;
  let cur=null,next=null;
  if(mode==='during'){cur=list.find(s=>s.time&&mins(s.time)<=mo.m&&mo.m<mins(s.time)+(s.durationMinutes||0));next=list.find(s=>s.time&&mins(s.time)>mo.m&&!s.done)}
  else if(mode==='before')next=list[0];
  const ex=expensesOf(t),planned=ex.reduce((s,e)=>s+(e.plannedPhp||0),0),spent=spentOf(t),pk=packingOf(t),left=pk.filter(p=>!p.packed).length;
  const sim=`<div class="row" style="margin-bottom:12px"><span class="small muted">See any moment:</span><select id="sim-day" class="inline-num" style="width:auto" aria-label="Day">${days.map((d,i)=>`<option value="${d}" ${(state.ui.sim?.trip===t.id?state.ui.sim.date:day)===d?'selected':''}>Day ${i+1} · ${dayName(d)}</option>`).join('')}</select><input id="sim-time" class="inline-num" style="width:auto" type="time" value="${esc(state.ui.sim?.trip===t.id?state.ui.sim.time:'10:00')}" aria-label="Time"><button class="btn sm" data-act="sim">Show</button>${mo.sim?`<button class="btn sm teal" data-act="sim-live">Back to live</button>`:''}</div>`;
  let hero;
  if(mode==='before'&&next)hero=`<section class="now-card"><span>${countdown(t)} · Day 1, ${longDay(day)}</span><div><div class="big">${esc(next.time||'')}</div><h2 style="margin-top:8px;font-size:clamp(22px,3vw,30px)">${esc(next.title)}</h2></div>
    <div class="row"><a class="btn primary" href="${link(t,'packing')}">${left?`${left} to pack`:'All packed'}</a><a class="btn" href="${link(t,'plan')}">Full plan</a></div></section>`;
  else if(mode==='after')hero=`<section class="now-card"><span>Trip complete</span><div class="big">${peso(spent)}</div><p style="margin:0">spent of ${peso(planned)} planned</p><div class="row"><a class="btn primary" href="${link(t,'journal')}">Write the journal</a><a class="btn" href="${link(t,'budget')}">Spending</a></div></section>`;
  else{const show=next||cur,p=show&&placeById(show.placeId),nav=show&&navUrl(show,p),wz=wazeUrl(p);
    hero=`<section class="now-card"><span>Day ${dayIdx} · ${longDay(day)}${mo.sim?' · preview':''}</span>${cur?`<span class="small">Now: <b>${esc(cur.title)}</b> until ${hhmm(mins(cur.time)+(cur.durationMinutes||0))}</span>`:''}
    ${show?`<div><span style="opacity:.8">${next?'Up next':'Now'}</span><div class="big">${esc(show.time||'')}</div><h2 style="margin-top:8px;font-size:clamp(22px,3vw,30px)">${esc(show.title)}</h2>${p?`<p style="margin:6px 0 0;opacity:.85">${esc(p.name)}${hasPin(p)?'':' · no exact pin'}</p>`:''}</div>
    <div class="row">${nav?`<a class="btn primary" href="${esc(nav)}" target="_blank" rel="noopener">Directions</a>`:''}${wz?`<a class="btn" href="${esc(wz)}" target="_blank" rel="noopener">Waze</a>`:''}<button class="btn" data-act="toggle-done" data-id="${esc(show.id)}">Mark done</button><button class="btn" data-act="edit-stop" data-id="${esc(show.id)}">Edit</button></div>`:`<h2>Nothing else planned today</h2>`}</section>`}
  const before=mode==='before'?`<section class="card" style="margin-top:14px"><div class="row between"><h3>Before you go</h3><a class="small" href="${link(t,'packing')}">Packing list</a></div>
    <p class="small muted" style="margin:6px 0 0">${pk.length-left} of ${pk.length} packed${(t.bookings||[]).some(b=>!b.confirmation)?' · a booking has no confirmation reference yet':''}${ex.some(e=>e.amountPending)?' · some costs have no amount yet':''}</p></section>`:'';
  const groups=[...new Set([...ex.map(e=>e.group||e.category),'Meals','Snacks','Fuel','Parking','Shopping'])];
  const quick=`<section class="card" style="margin-top:14px"><h3>Quick add</h3><form class="row" data-form="spend" style="margin-top:10px;align-items:flex-end">
   <label class="field">Spent (₱)<input name="amt" type="number" inputmode="decimal" min="0" step="1" required style="width:8em"></label>
   <label class="field">On<select name="group">${groups.map(g=>`<option>${esc(g)}</option>`).join('')}</select></label>
   <label class="field" style="flex:1">Note<input name="note" placeholder="e.g. halo-halo, parking"></label><button class="btn teal">Add spend</button></form>
   <form class="row" data-form="journal-line" data-day="${day}" style="margin-top:12px;align-items:flex-end"><label class="field" style="flex:1">Journal · ${dayName(day)}<input name="line" placeholder="What happened?"></label><button class="btn">Add</button><button type="button" class="btn" data-act="journal-photo" data-day="${day}">Add photo</button></form></section>`;
  return `${sim}${hero}${before}${quick}<div class="section-head"><h2>Day ${dayIdx} · ${list.length} stops</h2><button class="btn sm" data-act="new-stop" data-day="${day}">Add stop</button></div><ul class="stops">${list.map(s=>stopRow(t,s,{now:s===cur})).join('')||'<li class="stop"><span></span><span class="muted">No stops on this day.</span></li>'}</ul>`;
}

/* ---------- Plan: list and timeline ---------- */
function viewPlan(t){
  const tl=state.ui.planView==='timeline',days=daysOf(t),st=stopsOf(t);
  const head=`<div class="row between" style="margin-bottom:8px"><h1>Plan</h1><div class="row"><div class="row" role="group" aria-label="View"><button class="chip" data-act="plan-view" data-v="list" aria-pressed="${!tl}">List</button><button class="chip" data-act="plan-view" data-v="timeline" aria-pressed="${tl}">Timeline</button></div><button class="btn teal" data-act="new-stop" data-day="${days[0]}">Add stop</button></div></div>
  <div class="row small muted">${TYPES.filter(x=>st.some(s=>typeOf(s)===x)).map(x=>`<span class="row" style="gap:5px"><span class="dot" style="background:${TYPE_COLOR[x]}"></span>${TYPE_LABEL[x]}</span>`).join('')}</div>`;
  if(tl)return head+timelineHtml(t);
  return head+days.map((d,i)=>{const l=st.filter(s=>s.date===d);
    return `<div class="section-head"><h2>Day ${i+1} · ${longDay(d)}</h2><span class="muted small nowrap">${l.length?`${l[0].time||''}–${l.at(-1).time?hhmm(mins(l.at(-1).time)+(l.at(-1).durationMinutes||0)):''}`:''}</span></div>
    <ul class="stops">${l.map(s=>stopRow(t,s)).join('')}<li class="add-row"><button class="btn sm" data-act="new-stop" data-day="${d}">Add stop to day ${i+1}</button></li></ul>`}).join('');
}
function timelineHtml(t){
  const st=stopsOf(t).filter(s=>s.time),days=daysOf(t);
  const t0=Math.floor(Math.min(...st.map(s=>mins(s.time)),8*60)/60)*60,t1=Math.ceil(Math.max(...st.map(s=>mins(s.time)+(s.durationMinutes||30)),18*60)/60)*60;
  const pph=state.ui.zoom||150,W=(t1-t0)/60*pph,mo=moment(t);
  const hours=[];for(let m=t0;m<=t1;m+=60)hours.push(m);
  return `<div class="row small muted" style="margin:10px 0">Tap a block to edit. Scroll sideways for the whole day.<span class="grow"></span><button class="chip" data-act="zoom" data-z="-1" aria-label="Narrower">−</button><button class="chip" data-act="zoom" data-z="1" aria-label="Wider">+</button></div>
  <div class="tl"><div class="tl-inner"><div class="tl-scale" style="width:${W}px">${hours.map(m=>`<span style="left:${(m-t0)/60*pph}px">${hhmm(m)}</span>`).join('')}</div>
  ${days.map((d,i)=>`<div class="tl-row"><div class="tl-day">Day ${i+1}<br><span class="small muted">${dayName(d).split(',')[0]}</span></div><div class="tl-track" style="width:${W}px">${hours.map(m=>`<i class="tl-hour" style="left:${(m-t0)/60*pph}px"></i>`).join('')}
   ${mo.date===d?`<i class="tl-now" style="left:${(mo.m-t0)/60*pph}px" title="Now"></i>`:''}
   ${st.filter(s=>s.date===d).map(s=>{const p=placeById(s.placeId),w=Math.max(28,(s.durationMinutes||30)/60*pph-3),img=(s.keepItDocuments||[]).find(x=>x.kind!=='note');
    return `<button class="tl-block${s.done?' done':''}" data-act="edit-stop" data-id="${esc(s.id)}" style="left:${(mins(s.time)-t0)/60*pph+1}px;width:${w}px;background:${TYPE_COLOR[typeOf(s)]}" title="${esc(`${s.time} ${s.title}${p?' · '+p.name:''}`)}">
    <span class="t">${esc(s.time)}${w>90&&s.durationMinutes?' · '+fmtDur(s.durationMinutes):''}</span><b>${esc(s.title)}</b>${w>70&&p?`<span class="t">${esc(p.name)}</span>`:''}${img&&w>60?`<img data-thumb="${esc(JSON.stringify(img))}" alt="" hidden>`:''}</button>`}).join('')}</div></div>`).join('')}</div></div>`;
}

/* ---------- Map ---------- */
function viewMap(t){
  const day=state.ui.mapDay&&daysOf(t).includes(state.ui.mapDay)?state.ui.mapDay:'all',st=stopsOf(t).filter(s=>day==='all'||s.date===day);
  const ids=[...new Set(st.map(s=>s.placeId).filter(Boolean))],places=ids.map(placeById).filter(Boolean),sel=state.ui.mapSel,picking=state.ui.pinFor;
  return `<div class="row between" style="margin-bottom:12px"><h1>Map</h1><div class="row" role="group" aria-label="Day"><button class="chip" data-act="map-day" data-d="all" aria-pressed="${day==='all'}">All days</button>${daysOf(t).map((d,i)=>`<button class="chip" data-act="map-day" data-d="${d}" aria-pressed="${day===d}">Day ${i+1}</button>`).join('')}<button class="btn sm teal" data-act="edit-place">Add place</button></div></div>
  ${picking?`<div class="notice" style="margin-bottom:10px">Tap the map where <b>${esc(placeById(picking)?.name)}</b> is. <button class="btn sm" data-act="cancel-pin">Cancel</button></div>`:''}
  <div class="grid2"><div class="map-wrap"><div id="map"></div><span class="map-status" id="map-status">Loading street map…</span></div>
  <div style="display:grid;gap:10px">${places.map((p,i)=>`<div class="place${p.id===sel?' sel':''}" data-act="map-select" data-id="${esc(p.id)}"><span class="n${hasPin(p)?'':' link'}">${hasPin(p)?i+1:'?'}</span><div><b>${esc(p.name)}</b>
   <div class="small muted">${hasPin(p)?esc(p.coordinateStatus||'Pinned'):'No pin yet'} · ${st.filter(s=>s.placeId===p.id).length} stop(s)</div>${p.notes?`<div class="small" style="margin-top:3px">${esc(p.notes)}</div>`:''}
   <div class="row" style="margin-top:8px"><a class="btn sm" href="${esc(navUrl(null,p))}" target="_blank" rel="noopener">Google Maps</a>${hasPin(p)?`<a class="btn sm" href="${esc(wazeUrl(p))}" target="_blank" rel="noopener">Waze</a>`:''}<button class="btn sm" data-act="pin-place" data-id="${esc(p.id)}">${hasPin(p)?'Move pin':'Set pin on map'}</button><button class="btn sm" data-act="edit-place" data-id="${esc(p.id)}">Edit</button></div></div></div>`).join('')||'<div class="empty">No places on this day yet. Add a place to a stop to see it here.</div>'}</div></div>`;
}
function mountMap(t){
  const L=window.L,el=$('#map'),status=$('#map-status');if(!el)return;
  if(!L){status.textContent='Street map could not start. Reload online.';return}
  const day=state.ui.mapDay&&daysOf(t).includes(state.ui.mapDay)?state.ui.mapDay:'all',st=stopsOf(t).filter(s=>day==='all'||s.date===day);
  const ids=[...new Set(st.map(s=>s.placeId).filter(Boolean))],places=ids.map(placeById).filter(Boolean);
  const map=L.map(el,{zoomControl:true,attributionControl:true});
  const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'}).addTo(map);
  let loaded=0;tiles.on('tileload',()=>{loaded++;status.textContent='Street map · OpenStreetMap'});tiles.on('load',()=>{if(!loaded)status.textContent='Street map unavailable offline. Pins and routes still show.'});
  setTimeout(()=>{if(!loaded&&status.isConnected)status.textContent='Street map unavailable offline. Pins and routes still show.'},10000);
  const pts=[];
  daysOf(t).forEach((d,i)=>{if(day!=='all'&&d!==day)return;const seq=stopsOf(t).filter(s=>s.date===d).map(s=>placeById(s.placeId)).filter(hasPin).filter((p,j,a)=>!j||a[j-1].id!==p.id);
    if(seq.length>1)L.polyline(seq.map(p=>[p.lat,p.lng]),{color:DAY_COLORS[i%7],weight:4,opacity:.9}).addTo(map)});
  places.forEach((p,i)=>{if(!hasPin(p))return;pts.push([p.lat,p.lng]);
    const m=L.marker([p.lat,p.lng],{icon:L.divIcon({className:'',html:`<div class="pin${p.id===state.ui.mapSel?' sel':''}">${i+1}</div>`,iconSize:[28,28],iconAnchor:[14,14]}),title:p.name,keyboard:true}).addTo(map);
    const tip=document.createElement('span');tip.textContent=p.name;m.bindTooltip(tip,{direction:'top',offset:[0,-14]});
    m.on('click',()=>{state.ui.mapSel=p.id;keepUi();document.querySelector(`.place[data-id="${CSS.escape(p.id)}"]`)?.scrollIntoView({block:'nearest',behavior:'smooth'});document.querySelectorAll('.place').forEach(x=>x.classList.toggle('sel',x.dataset.id===p.id))})});
  const sel=placeById(state.ui.mapSel);
  if(sel&&hasPin(sel)&&ids.includes(sel.id))map.setView([sel.lat,sel.lng],14);else if(pts.length>1)map.fitBounds(pts,{padding:[36,36],maxZoom:14});else if(pts.length)map.setView(pts[0],13);else map.setView([14.6,121.2],9);
  map.on('click',e=>{const id=state.ui.pinFor;if(!id)return;const p=placeById(id);state.ui.pinFor=null;keepUi();
    commit(()=>put('place',normalizePlace({...p,lat:+e.latlng.lat.toFixed(6),lng:+e.latlng.lng.toFixed(6),coordinateStatus:'Pinned in TravelIt'})),'Pin saved')});
  const ro=new ResizeObserver(()=>map.invalidateSize({pan:false}));ro.observe(el);
  mapDispose=()=>{ro.disconnect();map.remove()};
}

/* ---------- Bookings ---------- */
function viewBookings(t){
  const b=t.bookings||[];
  return `<div class="row between" style="margin-bottom:14px"><h1>Bookings</h1><button class="btn teal" data-act="edit-booking">Add booking</button></div>
  ${b.map(x=>{const p=placeById(x.placeId),docs=x.keepItDocuments||[];return `<section class="card" style="margin-bottom:12px;display:grid;gap:10px"><div class="row between"><div><h2>${esc(x.name)}</h2><span class="muted small">${x.checkIn?dayName(x.checkIn):''}${x.checkOut?' → '+dayName(x.checkOut):''}${x.checkIn&&x.checkOut?` · ${datesBetween(x.checkIn,x.checkOut).length-1} night(s)`:''}</span></div>${x.status?`<span class="tag">${esc(x.status)}</span>`:''}</div>
   <div class="row small"><span>Reference: <b>${esc(x.confirmation||'not entered')}</b></span>${x.amountPhp!==null&&x.amountPhp!==undefined?`<span>Amount: <b>${peso(x.amountPhp)}</b></span>`:''}</div>${x.notes?`<p class="small muted" style="margin:0">${esc(x.notes)}</p>`:''}
   ${docs.length?`<div class="thumbs">${docs.map(d=>`<button class="btn sm" data-act="open-ref" data-ref="${esc(JSON.stringify(d))}">${esc(d.title)}</button>`).join('')}</div>`:''}
   <div class="row">${p?`<a class="btn sm" href="${esc(navUrl(null,p))}" target="_blank" rel="noopener">Directions</a>`:''}<button class="btn sm" data-act="edit-booking" data-id="${esc(x.id)}">Edit</button></div></section>`}).join('')||'<div class="empty">No bookings yet. Add hotels, ferries or tickets, and attach their confirmation PDFs from KeepIt.</div>'}`;
}

/* ---------- Packing ---------- */
function viewPacking(t){
  const all=packingOf(t),f=state.ui.packOwner||'All',owners=[...new Set(all.map(p=>p.owner).filter(Boolean))],groups=[...new Set(all.map(p=>p.group||p.category))];
  const done=all.filter(p=>p.packed).length;
  const show=p=>f==='All'||(f==='Left'?!p.packed:p.owner===f);
  return `<div class="row between"><h1>Packing</h1><span class="money">${done}/${all.length}</span></div><div class="bar" style="margin:12px 0 14px"><i style="width:${all.length?done/all.length*100:0}%"></i></div>
  <div class="row" role="group" aria-label="Show">${['All',...owners,'Left'].map(o=>`<button class="chip" data-act="pack-owner" data-o="${esc(o)}" aria-pressed="${f===o}">${o==='Left'?'Still to pack':esc(o)}</button>`).join('')}<span class="grow"></span><button class="btn teal" data-act="edit-pack">Add item</button></div>
  <div class="cards" style="margin-top:14px;grid-template-columns:repeat(auto-fill,minmax(320px,1fr))">${groups.map(g=>{const items=all.filter(p=>(p.group||p.category)===g&&show(p));if(!items.length)return'';
   return `<section class="card"><div class="row between"><h3>${esc(g)}</h3><span class="small muted">${items.filter(p=>p.packed).length}/${items.length}</span></div><ul class="check" style="margin-top:6px">${items.map(p=>`<li class="${p.packed?'packed':''}"><input type="checkbox" id="pk-${esc(p.id)}" data-act="pack-toggle" data-id="${esc(p.id)}" ${p.packed?'checked':''}><label for="pk-${esc(p.id)}"><span class="lbl"><b>${p.quantity}${p.unit?' '+esc(p.unit):''}</b> · ${esc(p.label)}</span><span class="small muted">${esc(p.owner||'')}${p.notes?' · '+esc(p.notes):''}</span></label><button class="btn sm" data-act="edit-pack" data-id="${esc(p.id)}" aria-label="Edit ${esc(p.label)}">Edit</button></li>`).join('')}</ul></section>`}).join('')||'<div class="empty">Nothing here.</div>'}</div>`;
}

/* ---------- Budget ---------- */
const shopPaid=t=>(t.shopping||[]).reduce((s,x)=>s+(x.paidPhp||0),0);
const shopLine=t=>{const g=(t.shopping||[])[0]?.group;return g?expensesOf(t).find(e=>(e.group||'').toLowerCase()===g.toLowerCase()):null};
const actualOf=(t,e)=>e.actualPhp??(shopLine(t)===e&&shopPaid(t)?shopPaid(t):null);
const spentOf=t=>expensesOf(t).reduce((s,e)=>s+(actualOf(t,e)||0),0);
function viewBudget(t){
  const ex=expensesOf(t),planned=ex.reduce((s,e)=>s+(e.plannedPhp||0),0),spent=spentOf(t),groups=[...new Set(ex.map(e=>e.group||e.category))];
  const gP=g=>ex.filter(e=>(e.group||e.category)===g).reduce((s,e)=>s+(e.plannedPhp||0),0),gA=g=>ex.filter(e=>(e.group||e.category)===g).reduce((s,e)=>s+(actualOf(t,e)||0),0);
  const max=Math.max(1,...groups.map(g=>Math.max(gP(g),gA(g)))),pend=ex.filter(e=>e.amountPending&&e.plannedPhp===null&&e.actualPhp===null),shop=t.shopping||[];
  const sP=shop.reduce((s,x)=>s+(x.plannedQty||0)*(x.pricePhp||0),0);
  return `<div class="row between" style="margin-bottom:14px"><h1>Budget</h1><button class="btn teal" data-act="edit-expense">Add cost</button></div>
  <div class="grid2"><section class="card"><div class="row between" style="align-items:flex-end"><div><div class="small muted">Spent</div><div class="money">${peso(spent)}</div></div><div style="text-align:right"><div class="small muted">Planned</div><div class="money muted">${peso(planned)}</div></div></div>
   <div class="bar" style="margin:12px 0 6px"><i style="width:${Math.min(100,planned?spent/planned*100:0)}%;background:${spent>planned?'var(--coral)':'var(--teal)'}"></i></div><div class="small muted">${spent>planned?'Over by '+peso(spent-planned):peso(planned-spent)+' left'}</div>
   ${pend.length?`<div class="notice" style="margin-top:12px"><b>No amount yet:</b> ${pend.map(e=>`<button class="btn sm" style="margin:4px 4px 0 0" data-act="edit-expense" data-id="${esc(e.id)}">${esc(e.label)}</button>`).join('')}</div>`:''}</section>
  <section class="card"><h3 style="margin-bottom:12px">By category</h3><div class="cats">${groups.map(g=>`<div class="cat"><span>${esc(g)}</span><div class="bar"><i style="width:${gP(g)/max*100}%;opacity:.3"></i><b style="width:${gA(g)/max*100}%"></b></div><span class="small r">${peso(gA(g))} / ${peso(gP(g))}</span></div>`).join('')}</div><p class="small muted" style="margin:10px 0 0">Pale: planned · coral: spent</p></section></div>
  <div class="section-head"><h2>Costs</h2><span class="small muted">Type an actual amount to record spending</span></div>
  <div class="card scroll"><table class="stack"><thead><tr><th>Item</th><th>Day</th><th class="r">Planned</th><th class="r">Actual</th><th></th></tr></thead><tbody>
  ${ex.map(e=>{const a=actualOf(t,e),derived=e.actualPhp===null&&a!==null;return `<tr><td><b>${esc(e.label)}</b><div class="small muted">${esc(e.group||e.category)}${e.notes?' · '+esc(e.notes):''}</div></td><td class="small nowrap">${e.date?dayName(e.date):'—'}</td><td class="r">${e.plannedPhp!==null?peso(e.plannedPhp):'—'}</td>
   <td class="r"><input class="inline-num" type="number" inputmode="decimal" min="0" data-act="actual" data-id="${esc(e.id)}" value="${e.actualPhp??''}" placeholder="${derived?esc(a):''}" aria-label="Actual for ${esc(e.label)}">${derived?'<div class="small muted">from shopping</div>':''}</td><td><button class="btn sm" data-act="edit-expense" data-id="${esc(e.id)}">Edit</button></td></tr>`}).join('')}</tbody></table></div>
  ${shop.length?`<div class="section-head"><h2>${esc(shop[0].group||'Shopping')} list</h2><span class="small">Planned ${peso(sP)} · paid <b>${peso(shopPaid(t))}</b></span></div>
  <div class="card scroll"><table class="stack"><thead><tr><th>Item</th><th class="r">Price</th><th class="r">Plan</th><th class="r">Bought</th><th class="r">Paid ₱</th></tr></thead><tbody>
  ${shop.filter(x=>state.ui.shopAll||x.plannedQty||x.paidPhp||x.boughtQty).map(x=>`<tr><td><b>${esc(x.name)}</b></td><td class="r small">${x.lowPhp&&x.highPhp&&x.lowPhp!==x.highPhp?`${peso(x.lowPhp)}–${x.highPhp}`:peso(x.pricePhp)}/${esc(x.unit)}</td><td class="r">${x.plannedQty?`${x.plannedQty} ${esc(x.unit)}`:'—'}</td>
   <td class="r"><input class="inline-num" style="width:5.5em" type="number" inputmode="decimal" min="0" step=".1" data-act="shop" data-id="${esc(x.id)}" data-f="boughtQty" value="${x.boughtQty??''}" aria-label="${esc(x.name)} bought"></td><td class="r"><input class="inline-num" type="number" inputmode="decimal" min="0" data-act="shop" data-id="${esc(x.id)}" data-f="paidPhp" value="${x.paidPhp??''}" aria-label="${esc(x.name)} paid"></td></tr>`).join('')}</tbody></table>
  <button class="btn sm" style="margin-top:10px" data-act="shop-all">${state.ui.shopAll?'Show only my list':`Show all ${shop.length} items`}</button></div>`:''}`;
}

/* ---------- Journal ---------- */
function viewJournal(t){
  const j=new Map((t.journal||[]).map(d=>[d.date,d]));
  return `<h1>Journal</h1><p class="muted" style="margin-top:6px">One page per day. Photos and drawings are saved in KeepIt and linked here.</p>
  ${daysOf(t).map((d,i)=>{const e=j.get(d)||{},docs=e.keepItDocuments||[],done=stopsOf(t).filter(s=>s.date===d&&s.done).length;
   return `<section class="card" style="margin-top:14px"><div class="row between"><h2>Day ${i+1} · ${longDay(d)}</h2><span class="small muted">${done} stops done</span></div>
   <label class="field" style="margin-top:10px"><span class="small muted">Notes</span><textarea data-act="journal-text" data-day="${d}" placeholder="Highlights, what the family loved, what to skip next time">${esc(e.text||'')}</textarea></label>
   <div class="thumbs" style="margin-top:8px">${docs.map(x=>`<button class="btn sm" style="padding:0;border:0" data-act="open-ref" data-ref="${esc(JSON.stringify(x))}">${thumbHtml(x,'thumb lg')}</button>`).join('')}</div>
   <div class="row" style="margin-top:10px"><button class="btn sm" data-act="journal-photo" data-day="${d}">Add photo</button><button class="btn sm" data-act="journal-attach" data-day="${d}">Attach from KeepIt</button></div></section>`}).join('')}`;
}

/* ---------- Editor sheet ---------- */
const sheet=$('#sheet'),sheetForm=$('#sheet-form');
let sheetCtx=null;
function openSheet({title,body,footer,onSubmit,onAction}){
  sheetCtx={onSubmit,onAction};
  sheetForm.innerHTML=`<header><h2 id="sheet-title">${esc(title)}</h2><span class="grow"></span><button class="btn sm" value="cancel" formnovalidate>Close</button></header><div class="body">${body}</div><footer>${footer}</footer>`;
  if(!sheet.open)sheet.showModal();hydrateThumbs(sheetForm);
}
sheetForm.addEventListener('submit',async e=>{
  const v=e.submitter?.value;if(v==='cancel'||!sheetCtx)return;e.preventDefault();
  const fd=Object.fromEntries(new FormData(sheetForm));
  const ok=await sheetCtx.onSubmit?.(fd,v);if(ok!==false)sheet.close();
});
sheetForm.addEventListener('click',e=>{const b=e.target.closest('[data-sact]');if(b&&sheetCtx?.onAction){e.preventDefault();sheetCtx.onAction(b.dataset.sact,b)}});
const opt=(list,val)=>list.map(x=>{const[v,l]=Array.isArray(x)?x:[x,x];return`<option value="${esc(v)}" ${String(v)===String(val??'')?'selected':''}>${esc(l)}</option>`}).join('');
const num=v=>v===''||v===undefined||v===null?null:Number(v);

/* Attachments area shared by stop, booking and journal editors. */
function attachmentsHtml(docs){
  return `<div><div class="row between"><b>KeepIt items</b><span class="row"><button class="btn sm" data-sact="att-photo">Add photo</button><button class="btn sm" data-sact="att-pick">Attach from KeepIt</button></span></div>
  <div id="att-list" style="margin-top:6px">${docs.map((d,i)=>`<div class="att">${thumbHtml(d)}<span>${esc(d.title)}<span class="small muted"> · ${d.kind==='note'?'note':'file'}</span></span><span class="row"><button class="btn sm" data-sact="att-open" data-i="${i}">Open</button><button class="btn sm danger" data-sact="att-remove" data-i="${i}">Remove</button></span></div>`).join('')||'<p class="small muted" style="margin:6px 0 0">No photos, notes or drawings linked yet.</p>'}</div>
  <div id="att-picker"></div>${bridge()?'':'<p class="notice" style="margin:8px 0 0">Open TravelIt from your KeepIt app to attach or add items.</p>'}</div>`;
}
async function attachmentAction(act,b,docs,rerender){
  if(act==='att-remove'){docs.splice(+b.dataset.i,1);rerender();return true}
  if(act==='att-open'){openRef(docs[+b.dataset.i]);return true}
  if(!bridge()){toast('Open TravelIt from KeepIt to attach items.',true);return true}
  if(act==='att-photo'){const file=await pickPhoto();if(!file)return true;
    try{if(!bridge().addFile)throw Error('Update KeepIt to add photos from TravelIt.');b.disabled=true;b.textContent='Saving to KeepIt…';
      const ref=refOf(await bridge().addFile(file,{title:file.name}));docs.push(ref);rerender();toast('Photo saved in KeepIt and linked')}catch(e){toast(e.message,true);rerender()}return true}
  if(act==='att-pick'){const box=$('#att-picker');box.innerHTML='<p class="small muted">Loading your KeepIt library…</p>';
    try{const items=await bridge().list(),have=new Set(docs.map(d=>d.itemId));
      box.innerHTML=`<label class="field" style="margin-top:8px">Search<input id="att-q" placeholder="Name of photo, note or PDF"></label><div class="picker" id="att-items" style="margin-top:6px">${items.map(x=>`<label data-q="${esc((x.title+' '+(x.filename||'')).toLowerCase())}"><input type="checkbox" value="${esc(JSON.stringify(refOf(x)))}" ${have.has(x.itemId)?'checked disabled':''}><span>${esc(x.title)}<span class="small muted"> · ${x.kind}</span></span></label>`).join('')}</div><button class="btn sm teal" style="margin-top:8px" data-sact="att-add">Attach selected</button>`;
      $('#att-q').oninput=e=>{const q=e.target.value.toLowerCase();for(const l of $('#att-items').children)l.hidden=!l.dataset.q.includes(q)};
    }catch(e){box.innerHTML=`<p class="notice">${esc(e.message)}</p>`}return true}
  if(act==='att-add'){for(const c of document.querySelectorAll('#att-items input:checked:not([disabled])'))docs.push(JSON.parse(c.value));rerender();return true}
  return false;
}
function pickPhoto(){return new Promise(ok=>{const i=$('#pick-photo');i.value='';i.onchange=()=>ok(i.files[0]||null);i.click()})}

function stopEditor(t,s,{day}={}){
  const isNew=!s?.id;s=s||{title:'',date:day||t.startDate,time:'',durationMinutes:60,activityType:'Tour',priority:'Planned',placeId:null,notes:''};
  const docs=[...(s.keepItDocuments||[])],places=of('place').sort((a,b)=>a.name.localeCompare(b.name));
  const draw=()=>openSheet({title:isNew?'New stop':'Edit stop',
    body:`<label class="field">What<input name="title" required value="${esc(s.title)}" placeholder="e.g. Lunch at the market"></label>
    <div class="three"><label class="field">Day<select name="date">${opt(daysOf(t).map((d,i)=>[d,`Day ${i+1} · ${dayName(d)}`]),s.date)}</select></label><label class="field">Start<input name="time" type="time" value="${esc(s.time)}"></label><label class="field">Minutes<input name="durationMinutes" type="number" min="0" step="5" value="${esc(s.durationMinutes||0)}"></label></div>
    <div class="two"><label class="field">Type<select name="activityType">${opt(TYPES.map(x=>[x,TYPE_LABEL[x]]),typeOf(s))}</select></label><label class="field">Priority<select name="priority">${opt(PRIORITIES,s.priority||'Planned')}</select></label></div>
    <div class="row" style="align-items:flex-end"><label class="field" style="flex:1">Place<select name="placeId"><option value="">No place</option>${opt(places.map(p=>[p.id,p.name+(hasPin(p)?'':' (no pin)')]),s.placeId)}</select></label><button class="btn" data-sact="new-place">New place</button></div>
    <label class="field">Notes<textarea name="notes">${esc(s.notes)}</textarea></label>
    ${isNew?'':`<label class="row"><input type="checkbox" name="done" ${s.done?'checked':''} style="width:22px;height:22px"> Done</label>`}${attachmentsHtml(docs)}`,
    footer:`${isNew?'':'<button class="btn danger" value="delete" formnovalidate>Delete</button><button class="btn" value="duplicate">Duplicate</button>'}<span class="grow"></span><button class="btn teal" value="save">Save</button>`,
    onAction:async(act,b)=>{if(act==='new-place'){Object.assign(s,Object.fromEntries(new FormData(sheetForm)));placeEditor(null,{after:p=>{s.placeId=p.id;stopEditor(t,{...s,keepItDocuments:docs},{});}});return}
      Object.assign(s,Object.fromEntries(new FormData(sheetForm)));await attachmentAction(act,b,docs,draw)},
    onSubmit:async(fd,v)=>{
      if(v==='delete'){if(!confirm(`Delete “${s.title}”?`))return false;return commit(()=>remove('stop',s.id),'Stop deleted')}
      const data={...s,...fd,durationMinutes:Number(fd.durationMinutes||0),kind:TYPE_KIND[fd.activityType]||'Activity',placeId:fd.placeId||null,done:fd.done==='on',keepItDocuments:docs};
      if(v==='duplicate'){delete data.id;delete data.createdAt;delete data.importSource;data.title+=' (copy)';data.keepItDocuments=[...docs]}
      return commit(()=>saveStop(t,data),isNew||v==='duplicate'?'Stop added':'Stop saved')}});
  draw();
}
function placeEditor(p,{after}={}){
  const isNew=!p;p=p||{name:'',lat:null,lng:null,navigationUrl:'',sourceUrl:'',notes:'',stage:'Idea',category:'Destination'};
  openSheet({title:isNew?'New place':'Edit place',
    body:`<label class="field">Name<input name="name" required value="${esc(p.name)}"></label>
    <label class="field">Google Maps or Waze link<input name="navigationUrl" type="url" value="${esc(p.navigationUrl||'')}" placeholder="Paste a link; coordinates in it are used for the pin"></label>
    <div class="two"><label class="field">Latitude<input name="lat" inputmode="decimal" value="${esc(p.lat??'')}"></label><label class="field">Longitude<input name="lng" inputmode="decimal" value="${esc(p.lng??'')}"></label></div>
    <p class="small muted" style="margin:0">No coordinates? Save it, then use “Set pin on map” in the Map tab.</p>
    <label class="field">Source or website<input name="sourceUrl" type="url" value="${esc(p.sourceUrl||'')}"></label><label class="field">Notes<textarea name="notes">${esc(p.notes||'')}</textarea></label>`,
    footer:`<span class="grow"></span><button class="btn teal" value="save">Save place</button>`,
    onSubmit:async fd=>{let {lat,lng}=fd;const m=(fd.navigationUrl||'').match(/(?:@|[?&](?:q|ll|query)=)(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/);
      if((!lat||!lng)&&m){lat=m[1];lng=m[2]}
      let saved;const ok=await commit(async()=>{saved=normalizePlace({...p,...fd,lat:lat||'',lng:lng||'',coordinateStatus:lat&&lng&&!(p.lat&&p.lng)?'From link':p.coordinateStatus});await put('place',saved)},'Place saved');
      if(ok&&after){sheet.close();after(saved);return false}return ok}});
}
function packEditor(t,p){
  const isNew=!p;p=p||{label:'',quantity:1,unit:'',group:'',owner:'',notes:'',packed:false};const all=packingOf(t);
  openSheet({title:isNew?'New packing item':'Edit packing item',
    body:`<label class="field">Item<input name="label" required value="${esc(p.label)}"></label>
    <div class="three"><label class="field">Quantity<input name="quantity" type="number" min="1" max="999" value="${esc(p.quantity)}"></label><label class="field">Unit<input name="unit" value="${esc(p.unit||'')}" placeholder="pcs, sets"></label><label class="field">For<input name="owner" list="owners" value="${esc(p.owner||'')}"></label></div>
    <label class="field">List<input name="group" list="groups" value="${esc(p.group||p.category||'')}"></label><label class="field">Notes<input name="notes" value="${esc(p.notes||'')}"></label>
    <datalist id="owners">${[...new Set(all.map(x=>x.owner).filter(Boolean))].map(x=>`<option value="${esc(x)}">`).join('')}</datalist><datalist id="groups">${[...new Set(all.map(x=>x.group||x.category))].map(x=>`<option value="${esc(x)}">`).join('')}</datalist>`,
    footer:`${isNew?'':'<button class="btn danger" value="delete" formnovalidate>Delete</button>'}<span class="grow"></span><button class="btn teal" value="save">Save</button>`,
    onSubmit:async(fd,v)=>v==='delete'?commit(()=>remove('packing',p.id),'Item removed'):commit(()=>put('packing',normalizePacking({...p,...fd,quantity:Number(fd.quantity||1)},t)),'Packing saved')});
}
function expenseEditor(t,e){
  const isNew=!e;e=e||{label:'',group:'',category:'Other',date:moment(t).date>=t.startDate&&moment(t).date<=t.endDate?moment(t).date:t.startDate,plannedPhp:null,actualPhp:null,notes:'',stopId:''};
  const groups=[...new Set(expensesOf(t).map(x=>x.group||x.category))];
  openSheet({title:isNew?'New cost':'Edit cost',
    body:`<label class="field">What<input name="label" required value="${esc(e.label)}"></label>
    <div class="two"><label class="field">Category<input name="group" list="egroups" value="${esc(e.group||e.category)}"></label><label class="field">Day<select name="date"><option value="">Whole trip</option>${opt(daysOf(t).map((d,i)=>[d,`Day ${i+1} · ${dayName(d)}`]),e.date)}</select></label></div>
    <div class="two"><label class="field">Planned (₱)<input name="plannedPhp" type="number" inputmode="decimal" min="0" value="${esc(e.plannedPhp??'')}"></label><label class="field">Actual (₱)<input name="actualPhp" type="number" inputmode="decimal" min="0" value="${esc(e.actualPhp??'')}"></label></div>
    <label class="field">For stop<select name="stopId"><option value="">—</option>${opt(stopsOf(t).map(s=>[s.id,`${dayName(s.date)} ${s.time||''} · ${s.title}`]),e.stopId)}</select></label><label class="field">Notes<input name="notes" value="${esc(e.notes||'')}"></label>
    <datalist id="egroups">${groups.map(g=>`<option value="${esc(g)}">`).join('')}</datalist>`,
    footer:`${isNew?'':'<button class="btn danger" value="delete" formnovalidate>Delete</button>'}<span class="grow"></span><button class="btn teal" value="save">Save</button>`,
    onSubmit:async(fd,v)=>v==='delete'?commit(()=>remove('expense',e.id),'Cost removed'):commit(()=>put('expense',normalizeExpense({...e,...fd,date:fd.date||null,plannedPhp:num(fd.plannedPhp),actualPhp:num(fd.actualPhp),category:EXPENSE_CATEGORIES.includes(fd.group)?fd.group:e.category||'Other',amountPending:num(fd.plannedPhp)===null&&num(fd.actualPhp)===null},t)),'Cost saved')});
}
function bookingEditor(t,b){
  const isNew=!b;b=b||{id:uid(),name:'',placeId:null,checkIn:t.startDate,checkOut:t.endDate,status:'Booked',confirmation:'',amountPhp:null,notes:''};const docs=[...(b.keepItDocuments||[])];
  const draw=()=>openSheet({title:isNew?'New booking':'Edit booking',
    body:`<label class="field">Name<input name="name" required value="${esc(b.name)}"></label><div class="two"><label class="field">From<input name="checkIn" type="date" value="${esc(b.checkIn)}"></label><label class="field">To<input name="checkOut" type="date" value="${esc(b.checkOut)}"></label></div>
    <div class="three"><label class="field">Status<input name="status" value="${esc(b.status)}"></label><label class="field">Reference<input name="confirmation" value="${esc(b.confirmation)}"></label><label class="field">Amount (₱)<input name="amountPhp" type="number" min="0" value="${esc(b.amountPhp??'')}"></label></div>
    <label class="field">Place<select name="placeId"><option value="">—</option>${opt(of('place').map(p=>[p.id,p.name]),b.placeId)}</select></label><label class="field">Notes<textarea name="notes">${esc(b.notes)}</textarea></label>${attachmentsHtml(docs)}`,
    footer:`${isNew?'':'<button class="btn danger" value="delete" formnovalidate>Delete</button>'}<span class="grow"></span><button class="btn teal" value="save">Save</button>`,
    onAction:async(act,el)=>{Object.assign(b,Object.fromEntries(new FormData(sheetForm)));await attachmentAction(act,el,docs,draw)},
    onSubmit:async(fd,v)=>{const list=(t.bookings||[]).filter(x=>x.id!==b.id);if(v!=='delete')list.push({...b,...fd,amountPhp:num(fd.amountPhp),keepItDocuments:docs});
      return commit(()=>saveTrip(t,{bookings:list}),v==='delete'?'Booking removed':'Booking saved')}});
  draw();
}
function tripEditor(t){
  const isNew=!t;t=t||{title:'',startDate:tripDateAt(new Date(),'Asia/Manila'),endDate:tripDateAt(new Date(),'Asia/Manila'),subtitle:'',departFrom:''};
  openSheet({title:isNew?'New trip':'Trip details',
    body:`<label class="field">Trip name<input name="title" required value="${esc(t.title)}"></label><label class="field">Who and what<input name="subtitle" value="${esc(t.subtitle||'')}" placeholder="Family of three; beach and seafood"></label>
    <div class="three"><label class="field">Start<input name="startDate" type="date" required value="${esc(t.startDate)}"></label><label class="field">End<input name="endDate" type="date" required value="${esc(t.endDate)}"></label><label class="field">Leaving from<input name="departFrom" value="${esc(t.departFrom||'')}"></label></div>`,
    footer:`${isNew?'':'<button class="btn danger" value="delete" formnovalidate>Delete trip</button>'}<span class="grow"></span><button class="btn teal" value="save">Save</button>`,
    onSubmit:async(fd,v)=>{
      if(v==='delete'){if(!confirm(`Delete “${t.title}” with all its stops, packing and costs? This cannot be undone.`))return false;
        const row=rowOf('trip',t.id);const ok=await commit(()=>guardedDeleteTrip(state.db,t.id,{expectedEpoch:state.meta.epoch,expectedWorkspaceRevision:state.meta.revision,expectedTripRevision:revisionFor(row)}),'Trip deleted');if(ok)location.hash='#trips';return ok}
      let saved;const ok=await commit(async()=>{saved=normalizeTrip({...t,...fd});await put('trip',saved)},isNew?'Trip created':'Trip saved');
      if(ok&&isNew)location.hash=link(saved,'plan');return ok}});
}

/* ---------- Import ---------- */
async function importWorkbook(file){
  try{
    const r=readTripWorkbook(new Uint8Array(await file.arrayBuffer()));
    if(trips().some(t=>t.title===r.trip.title&&t.startDate===r.trip.startDate)&&!confirm(`“${r.trip.title}” starting ${dayName(r.trip.startDate)} already exists. Import another copy?`))return;
    const c=r.report.counts;
    if(!confirm(`Import “${r.trip.title}”, ${dayName(r.trip.startDate)} – ${dayName(r.trip.endDate)}?\n\n${c.stops} stops · ${c.places} places · ${c.packing} packing items · ${c.expenses} costs · ${c.bookings} bookings${c.shopping?` · ${c.shopping} shopping items`:''}${r.report.warnings.length?'\n\nNotes:\n'+r.report.warnings.slice(0,5).join('\n'):''}`))return;
    // Trip first, then the records that refer to it.
    await put('trip',r.trip);await load();
    for(const p of r.places){await put('place',p)}await load();
    for(const s of r.stops)await put('stop',s);
    for(const p of r.packing)await put('packing',p);
    for(const e of r.expenses)await put('expense',e);
    await load();location.hash=link(r.trip,'plan');render();toast(`Imported ${c.stops} stops`);
  }catch(e){await load().catch(()=>{});render();toast(e.message||'This workbook could not be imported.',true)}
}

/* ---------- Events ---------- */
let journalTimer;
document.addEventListener('click',async e=>{
  const el=e.target.closest('[data-act]');if(!el||el.closest('#sheet'))return;
  const a=el.dataset.act,id=el.dataset.id,t=route().trip;
  if(['INPUT','TEXTAREA','SELECT'].includes(el.tagName)&&a!=='pack-toggle')return;
  if(el.tagName==='BUTTON'||el.tagName==='A')e.preventDefault();
  if(a==='new-trip')tripEditor();
  else if(a==='edit-trip')tripEditor(t);
  else if(a==='import-xlsx'){const i=$('#pick-xlsx');i.value='';i.onchange=()=>i.files[0]&&importWorkbook(i.files[0]);i.click()}
  else if(a==='offline'){el.disabled=true;el.textContent='Saving…';
    try{const r=await prepareOfflineShell({scope:new URL('./',location.href).href});toast(r.ready?'TravelIt will open without signal on this device. Open the Map once online to keep its street map.':r.reason,!r.ready)}catch(err){toast(err.message,true)}finally{el.disabled=false;el.textContent='Save for offline'}}
  else if(a==='new-stop')stopEditor(t,null,{day:el.dataset.day});
  else if(a==='edit-stop')stopEditor(t,of('stop').find(s=>s.id===id));
  else if(a==='toggle-done'){const s=of('stop').find(x=>x.id===id);commit(()=>saveStop(t,{...s,done:!s.done}),s.done?'Marked not done':'Marked done')}
  else if(a==='plan-view'){state.ui.planView=el.dataset.v;keepUi();render()}
  else if(a==='zoom'){state.ui.zoom=Math.max(70,Math.min(320,(state.ui.zoom||150)+Number(el.dataset.z)*40));keepUi();render()}
  else if(a==='map-day'){state.ui.mapDay=el.dataset.d;state.ui.mapSel=null;keepUi();render()}
  else if(a==='map-select'&&!e.target.closest('a,button')){state.ui.mapSel=id;keepUi();render()}
  else if(a==='pin-place'){state.ui.pinFor=id;keepUi();render();toast('Tap the map to place the pin')}
  else if(a==='cancel-pin'){state.ui.pinFor=null;keepUi();render()}
  else if(a==='edit-place')placeEditor(id?placeById(id):null);
  else if(a==='edit-booking')bookingEditor(t,(t.bookings||[]).find(b=>b.id===id));
  else if(a==='edit-pack')packEditor(t,packingOf(t).find(p=>p.id===id));
  else if(a==='pack-toggle'){const p=packingOf(t).find(x=>x.id===id);commit(()=>put('packing',normalizePacking({...p,packed:el.checked},t)))}
  else if(a==='pack-owner'){state.ui.packOwner=el.dataset.o;keepUi();render()}
  else if(a==='edit-expense')expenseEditor(t,expensesOf(t).find(x=>x.id===id));
  else if(a==='shop-all'){state.ui.shopAll=!state.ui.shopAll;keepUi();render()}
  else if(a==='open-ref')openRef(JSON.parse(el.dataset.ref));
  else if(a==='sim'){state.ui.sim={trip:t.id,date:$('#sim-day').value,time:$('#sim-time').value||'10:00'};keepUi();render()}
  else if(a==='sim-live'){state.ui.sim=null;keepUi();render()}
  else if(a==='journal-photo'||a==='journal-attach'){
    const d=el.dataset.day,j=[...(t.journal||[])],entry=j.find(x=>x.date===d)||{date:d,text:''},docs=[...(entry.keepItDocuments||[])];
    if(!bridge())return toast('Open TravelIt from KeepIt to add photos.',true);
    if(a==='journal-photo'){const f=await pickPhoto();if(!f)return;try{toast('Saving photo to KeepIt…');docs.push(refOf(await bridge().addFile(f,{title:f.name})))}catch(err){return toast(err.message,true)}
      commit(()=>saveTrip(t,{journal:[...j.filter(x=>x.date!==d),{...entry,keepItDocuments:docs}]}),'Photo added to the journal')}
    else{const save=()=>commit(()=>saveTrip(t,{journal:[...j.filter(x=>x.date!==d),{...entry,keepItDocuments:docs}]}),'Journal updated');
      openSheet({title:'Attach to '+dayName(d),body:attachmentsHtml(docs),footer:'<span class="grow"></span><button class="btn teal" value="save">Done</button>',onAction:async(act,b)=>{await attachmentAction(act,b,docs,()=>{$('#att-list').outerHTML=new DOMParser().parseFromString(attachmentsHtml(docs),'text/html').querySelector('#att-list').outerHTML;hydrateThumbs(sheetForm)})},onSubmit:save});}
  }
});
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('.what[data-act]')){e.preventDefault();e.target.click()}});
document.addEventListener('change',e=>{
  const el=e.target,t=route().trip;if(!t||el.closest('#sheet'))return;
  if(el.dataset.act==='actual'){const x=expensesOf(t).find(v=>v.id===el.dataset.id);commit(()=>put('expense',normalizeExpense({...x,actualPhp:num(el.value),amountPending:x.plannedPhp===null&&num(el.value)===null},t)),'Actual saved')}
  if(el.dataset.act==='shop'){const list=(t.shopping||[]).map(x=>x.id===el.dataset.id?{...x,[el.dataset.f]:num(el.value)}:x);commit(()=>saveTrip(t,{shopping:list}))}
});
document.addEventListener('input',e=>{
  const el=e.target;if(el.dataset.act!=='journal-text')return;const t=route().trip,d=el.dataset.day;
  clearTimeout(journalTimer);journalTimer=setTimeout(async()=>{const fresh=tripById(t.id),j=[...(fresh.journal||[])],entry=j.find(x=>x.date===d)||{date:d};
    try{await saveTrip(fresh,{journal:[...j.filter(x=>x.date!==d),{...entry,text:el.value}]});await load();toast('Journal saved')}catch(err){toast(err.message,true)}},900);
});
document.addEventListener('submit',e=>{
  const f=e.target;if(f.closest('#sheet'))return;e.preventDefault();const t=route().trip,fd=Object.fromEntries(new FormData(f));
  if(f.dataset.form==='spend'){const mo=moment(t),date=mo.date>=t.startDate&&mo.date<=t.endDate?mo.date:null,cur=stopsOf(t).find(s=>s.date===mo.date&&s.time&&mins(s.time)<=mo.m&&mo.m<mins(s.time)+(s.durationMinutes||0));
    commit(()=>put('expense',normalizeExpense({label:fd.note||fd.group,group:fd.group,category:EXPENSE_CATEGORIES.includes(fd.group)?fd.group:'Other',date,actualPhp:Number(fd.amt),plannedPhp:null,stopId:cur?.id||''},t)),`${peso(fd.amt)} added`)}
  if(f.dataset.form==='journal-line'&&fd.line){const d=f.dataset.day,j=[...(t.journal||[])],entry=j.find(x=>x.date===d)||{date:d,text:''};
    commit(()=>saveTrip(t,{journal:[...j.filter(x=>x.date!==d),{...entry,text:(entry.text?entry.text+'\n':'')+fd.line}]}),'Added to the journal')}
});
addEventListener('hashchange',()=>{render();scrollTo(0,0)});
const net=()=>{$('#net').hidden=navigator.onLine!==false};addEventListener('online',net);addEventListener('offline',net);
// Another TravelIt tab (classic view) may have changed the same records.
document.addEventListener('visibilitychange',async()=>{if(document.visibilityState==='visible'&&!sheet.open){await load();render()}});

// KeepIt's notes bar asks TravelIt for its records through these hooks, as with the classic view.
let markReady;const storageReady=new Promise(ok=>markReady=ok);
window.travelItOwnedHooks=ownedTravelItHooks({ready:storageReady,getDB:()=>state.db,refresh:async()=>{await load();render()}});
(async()=>{
  try{state.db=await openDatabase(()=>location.reload());markReady();await load();net();render();document.documentElement.dataset.travelitTrips='ready'}
  catch(e){$('#view').innerHTML=`<div class="empty">TravelIt storage could not open: ${esc(e.message)}. Reload the page.</div>`}
})();
