
'use strict';
const $=id=>document.getElementById(id), NS='http://www.w3.org/2000/svg', W=1100,H=790, EMBEDDED=parent!==window, CHANNEL='diagramit-bubble-v06';
const uid=()=>('b'+Math.random().toString(36).slice(2,10)), html=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])), num=(x,f=0)=>Number.isFinite(+x)?+x:f, clamp=(v,a,b)=>Math.min(b,Math.max(a,v)), clone=o=>JSON.parse(JSON.stringify(o));
const BASE_ZONES={Public:{fill:'#d1e9e7',stroke:'#3b8b86'},Activity:{fill:'#f4d6bb',stroke:'#b0784d'},Private:{fill:'#dfdced',stroke:'#8177ad'},Service:{fill:'#d8e5ec',stroke:'#64849b'},Support:{fill:'#f8eccb',stroke:'#a78c43'},Outdoor:{fill:'#dceacc',stroke:'#78965b'}};
const KDG_ZONE_PROFILES={"RESIDENTIAL":{"name":"Residential","zones":{"Arrival / Entry":{"fill":"#DDD5C4","stroke":"#8D887D","cadLayer":"ZONE_RES-Arrival","code":"ZONE_RES-Arrival","group":"Public"},"Living":{"fill":"#D6E5DD","stroke":"#89938D","cadLayer":"ZONE_RES-Living","code":"ZONE_RES-Living","group":"Primary"},"Dining":{"fill":"#E5DDC9","stroke":"#938D81","cadLayer":"ZONE_RES-Dining","code":"ZONE_RES-Dining","group":"Primary"},"Kitchen":{"fill":"#EDD0AE","stroke":"#98856F","cadLayer":"ZONE_RES-Kitchen","code":"ZONE_RES-Kitchen","group":"Service"},"Sleeping":{"fill":"#CDDCEB","stroke":"#838D96","cadLayer":"ZONE_RES-Sleeping","code":"ZONE_RES-Sleeping","group":"Private"},"Bath / Sanitary":{"fill":"#BDDCE6","stroke":"#798D93","cadLayer":"ZONE_RES-Bath","code":"ZONE_RES-Bath","group":"Private"},"Household Service":{"fill":"#D5D2CC","stroke":"#888683","cadLayer":"ZONE_RES-Service","code":"ZONE_RES-Service","group":"Service"},"Laundry":{"fill":"#CFDAD6","stroke":"#848C89","cadLayer":"ZONE_RES-Laundry","code":"ZONE_RES-Laundry","group":"Service"},"Storage":{"fill":"#CAC7BF","stroke":"#817F7A","cadLayer":"ZONE_RES-Storage","code":"ZONE_RES-Storage","group":"Service"},"Circulation":{"fill":"#EEECE5","stroke":"#989793","cadLayer":"ZONE_RES-Circulation","code":"ZONE_RES-Circulation","group":"Movement"},"Vertical Core":{"fill":"#C3C7CA","stroke":"#7D7F81","cadLayer":"ZONE_RES-Core","code":"ZONE_RES-Core","group":"Movement"},"Shared Amenity":{"fill":"#D3E1C2","stroke":"#87907C","cadLayer":"ZONE_RES-Amenity","code":"ZONE_RES-Amenity","group":"Amenity"},"Outdoor / Balcony":{"fill":"#C5DCC4","stroke":"#7E8D7D","cadLayer":"ZONE_RES-Outdoor","code":"ZONE_RES-Outdoor","group":"Outdoor"},"Parking":{"fill":"#CDCDC9","stroke":"#838381","cadLayer":"ZONE_RES-Parking","code":"ZONE_RES-Parking","group":"Support"},"MEPF / Utilities":{"fill":"#BEC2C4","stroke":"#7A7C7D","cadLayer":"ZONE_RES-MEPF","code":"ZONE_RES-MEPF","group":"Support"}}},"COMMERCIAL":{"name":"Commercial","zones":{"Arrival / Lobby":{"fill":"#DDD5C4","stroke":"#8D887D","cadLayer":"ZONE_COM-Arrival","code":"ZONE_COM-Arrival","group":"Public"},"Retail / Sales":{"fill":"#E8D8B2","stroke":"#948A72","cadLayer":"ZONE_COM-Retail","code":"ZONE_COM-Retail","group":"Revenue"},"Food & Beverage":{"fill":"#EDC7B5","stroke":"#987F74","cadLayer":"ZONE_COM-FB","code":"ZONE_COM-FB","group":"Revenue"},"Tenant Area":{"fill":"#CFDBE9","stroke":"#848C95","cadLayer":"ZONE_COM-Tenant","code":"ZONE_COM-Tenant","group":"Revenue"},"Customer Service":{"fill":"#CFE5DE","stroke":"#84938E","cadLayer":"ZONE_COM-CustomerService","code":"ZONE_COM-CustomerService","group":"Public"},"Administration":{"fill":"#CFD7DF","stroke":"#848A8F","cadLayer":"ZONE_COM-Admin","code":"ZONE_COM-Admin","group":"Support"},"Amenity":{"fill":"#D3E1C2","stroke":"#87907C","cadLayer":"ZONE_COM-Amenity","code":"ZONE_COM-Amenity","group":"Amenity"},"Back-of-House":{"fill":"#CFCCC6","stroke":"#84837F","cadLayer":"ZONE_COM-BOH","code":"ZONE_COM-BOH","group":"BOH"},"Storage":{"fill":"#C6C5BE","stroke":"#7F7E7A","cadLayer":"ZONE_COM-Storage","code":"ZONE_COM-Storage","group":"BOH"},"Service":{"fill":"#C9CDCC","stroke":"#818383","cadLayer":"ZONE_COM-Service","code":"ZONE_COM-Service","group":"BOH"},"Loading / Receiving":{"fill":"#C2C7C9","stroke":"#7C7F81","cadLayer":"ZONE_COM-Loading","code":"ZONE_COM-Loading","group":"Logistics"},"Public Circulation":{"fill":"#EEECE5","stroke":"#989793","cadLayer":"ZONE_COM-Circulation","code":"ZONE_COM-Circulation","group":"Movement"},"Vertical Core":{"fill":"#C3C7CA","stroke":"#7D7F81","cadLayer":"ZONE_COM-Core","code":"ZONE_COM-Core","group":"Movement"},"Parking":{"fill":"#CDCDC9","stroke":"#838381","cadLayer":"ZONE_COM-Parking","code":"ZONE_COM-Parking","group":"Support"},"MEPF / Utilities":{"fill":"#BEC2C4","stroke":"#7A7C7D","cadLayer":"ZONE_COM-MEPF","code":"ZONE_COM-MEPF","group":"Support"},"Public Realm":{"fill":"#C6DEC7","stroke":"#7F8E7F","cadLayer":"ZONE_COM-PublicRealm","code":"ZONE_COM-PublicRealm","group":"Outdoor"}}},"INSTITUTIONAL":{"name":"Institutional","zones":{"Arrival / Reception":{"fill":"#DDD5C4","stroke":"#8D887D","cadLayer":"ZONE_INS-Arrival","code":"ZONE_INS-Arrival","group":"Public"},"Public Service":{"fill":"#D1E3DE","stroke":"#86918E","cadLayer":"ZONE_INS-PublicService","code":"ZONE_INS-PublicService","group":"Public"},"Primary Program":{"fill":"#CDDCEB","stroke":"#838D96","cadLayer":"ZONE_INS-PrimaryProgram","code":"ZONE_INS-PrimaryProgram","group":"Program"},"Shared Program":{"fill":"#DBD5EB","stroke":"#8C8896","cadLayer":"ZONE_INS-SharedProgram","code":"ZONE_INS-SharedProgram","group":"Program"},"Specialized Program":{"fill":"#E8CFDD","stroke":"#94848D","cadLayer":"ZONE_INS-Specialized","code":"ZONE_INS-Specialized","group":"Program"},"Assembly":{"fill":"#EBDABE","stroke":"#968C7A","cadLayer":"ZONE_INS-Assembly","code":"ZONE_INS-Assembly","group":"Program"},"Administration":{"fill":"#CFD7DF","stroke":"#848A8F","cadLayer":"ZONE_INS-Admin","code":"ZONE_INS-Admin","group":"Support"},"Staff":{"fill":"#D7DED3","stroke":"#8A8E87","cadLayer":"ZONE_INS-Staff","code":"ZONE_INS-Staff","group":"Support"},"Program Support":{"fill":"#D3D2CB","stroke":"#878682","cadLayer":"ZONE_INS-Support","code":"ZONE_INS-Support","group":"Support"},"Storage":{"fill":"#C6C5BE","stroke":"#7F7E7A","cadLayer":"ZONE_INS-Storage","code":"ZONE_INS-Storage","group":"BOH"},"Back-of-House":{"fill":"#CFCCC6","stroke":"#84837F","cadLayer":"ZONE_INS-BOH","code":"ZONE_INS-BOH","group":"BOH"},"Circulation":{"fill":"#EEECE5","stroke":"#989793","cadLayer":"ZONE_INS-Circulation","code":"ZONE_INS-Circulation","group":"Movement"},"Vertical Core":{"fill":"#C3C7CA","stroke":"#7D7F81","cadLayer":"ZONE_INS-Core","code":"ZONE_INS-Core","group":"Movement"},"Sanitary":{"fill":"#BDDCE6","stroke":"#798D93","cadLayer":"ZONE_INS-Sanitary","code":"ZONE_INS-Sanitary","group":"Support"},"MEPF / Utilities":{"fill":"#BEC2C4","stroke":"#7A7C7D","cadLayer":"ZONE_INS-MEPF","code":"ZONE_INS-MEPF","group":"Support"},"Restricted / Controlled":{"fill":"#E6C4C6","stroke":"#937D7F","cadLayer":"ZONE_INS-Restricted","code":"ZONE_INS-Restricted","group":"Control"},"Campus / Outdoor":{"fill":"#C6DEC7","stroke":"#7F8E7F","cadLayer":"ZONE_INS-Outdoor","code":"ZONE_INS-Outdoor","group":"Outdoor"}}},"AIRPORT-PTB":{"name":"Airport – Passenger Terminal Building","zones":{"Baggage Handling System":{"fill":"#9437FF","stroke":"#5F23A3","cadLayer":"ZONE_BOH-BHS","code":"ZONE_BOH-BHS","group":"BOH"},"Ground Handling":{"fill":"#91B2FF","stroke":"#5D72A3","cadLayer":"ZONE_BOH-GroundHandling","code":"ZONE_BOH-GroundHandling","group":"BOH"},"Maintenance and Storage":{"fill":"#C4C4C0","stroke":"#7D7D7B","cadLayer":"ZONE_BOH-MaintandStorage","code":"ZONE_BOH-MaintandStorage","group":"BOH"},"MEPF":{"fill":"#927100","stroke":"#5D480A","cadLayer":"ZONE_BOH-MEPF","code":"ZONE_BOH-MEPF","group":"BOH"},"Airline Offices":{"fill":"#FF9591","stroke":"#A35F5D","cadLayer":"ZONE_BOH-Offices-Airline","code":"ZONE_BOH-Offices-Airline","group":"BOH"},"Airport Offices":{"fill":"#00B3B5","stroke":"#0A7374","cadLayer":"ZONE_BOH-Offices-Airport","code":"ZONE_BOH-Offices-Airport","group":"BOH"},"Government Offices":{"fill":"#0068B5","stroke":"#0A4374","cadLayer":"ZONE_BOH-Offices-Govt","code":"ZONE_BOH-Offices-Govt","group":"BOH"},"Amenities":{"fill":"#FFFB00","stroke":"#A3A10A","cadLayer":"ZONE_FOH-Amenities","code":"ZONE_FOH-Amenities","group":"FOH"},"Aviation Security - Domestic":{"fill":"#C9FC91","stroke":"#81A15D","cadLayer":"ZONE_FOH-AvSecDom","code":"ZONE_FOH-AvSecDom","group":"FOH"},"Aviation Security - International":{"fill":"#8EE5FF","stroke":"#5B93A3","cadLayer":"ZONE_FOH-AvSecInt","code":"ZONE_FOH-AvSecInt","group":"FOH"},"Boarding Gate - Domestic":{"fill":"#C9FC91","stroke":"#81A15D","cadLayer":"ZONE_FOH-BGate-Domestic","code":"ZONE_FOH-BGate-Domestic","group":"FOH"},"Boarding Gate - International":{"fill":"#8EE5FF","stroke":"#5B93A3","cadLayer":"ZONE_FOH-BGate-International","code":"ZONE_FOH-BGate-International","group":"FOH"},"Bureau of Immigration":{"fill":"#8EE5FF","stroke":"#5B93A3","cadLayer":"ZONE_FOH-BoI","code":"ZONE_FOH-BoI","group":"FOH"},"Check-in":{"fill":"#FFE491","stroke":"#A3925D","cadLayer":"ZONE_FOH-Check-in","code":"ZONE_FOH-Check-in","group":"FOH"},"Concessions":{"fill":"#FF9AFF","stroke":"#A363A3","cadLayer":"ZONE_FOH-Concessions","code":"ZONE_FOH-Concessions","group":"FOH"},"Departure Lounge":{"fill":"#F9B4BB","stroke":"#9F7378","cadLayer":"ZONE_FOH-DepLounge","code":"ZONE_FOH-DepLounge","group":"FOH"},"Curbside":{"fill":"#FFFFFE","stroke":"#A3A3A3","cadLayer":"ZONE_SDP-Curbside","code":"ZONE_SDP-Curbside","group":"SDP"},"Emergency Assembly":{"fill":"#FF2F91","stroke":"#A31E5D","cadLayer":"ZONE_SDP-Emergency-Assembly","code":"ZONE_SDP-Emergency-Assembly","group":"SDP"},"Emergency Vehicles":{"fill":"#FF2F91","stroke":"#A31E5D","cadLayer":"ZONE_SDP-Emergency-Vehicles","code":"ZONE_SDP-Emergency-Vehicles","group":"SDP"},"Landscape":{"fill":"#4E9062","stroke":"#325C3F","cadLayer":"ZONE_SDP-Landscape","code":"ZONE_SDP-Landscape","group":"SDP"},"Circulation - Domestic":{"fill":"#C9FC91","stroke":"#81A15D","cadLayer":"ZONE_WAY-Circulation-Domestic","code":"ZONE_WAY-Circulation-Domestic","group":"WAY"},"Circulation - General":{"fill":"#FFFFF7","stroke":"#A3A39E","cadLayer":"ZONE_WAY-Circulation-General","code":"ZONE_WAY-Circulation-General","group":"WAY"},"Circulation - International":{"fill":"#8EE5FF","stroke":"#5B93A3","cadLayer":"ZONE_WAY-Circulation-International","code":"ZONE_WAY-Circulation-International","group":"WAY"},"Circulation - Restricted":{"fill":"#933429","stroke":"#5E211A","cadLayer":"ZONE_WAY-Circulation-Restricted","code":"ZONE_WAY-Circulation-Restricted","group":"WAY"}}},"INDUSTRIAL":{"name":"Industrial","zones":{"Production":{"fill":"#D6D7DC","stroke":"#898A8D","cadLayer":"ZONE_IND-Production","code":"ZONE_IND-Production","group":"Process"},"Process Support":{"fill":"#CBD7E0","stroke":"#828A8F","cadLayer":"ZONE_IND-ProcessSupport","code":"ZONE_IND-ProcessSupport","group":"Process"},"Raw Materials":{"fill":"#DED3BE","stroke":"#8E877A","cadLayer":"ZONE_IND-RawMaterials","code":"ZONE_IND-RawMaterials","group":"Logistics"},"Work-in-Process":{"fill":"#E5DAC0","stroke":"#938C7B","cadLayer":"ZONE_IND-WIP","code":"ZONE_IND-WIP","group":"Logistics"},"Finished Goods":{"fill":"#CDDBCD","stroke":"#838C83","cadLayer":"ZONE_IND-FinishedGoods","code":"ZONE_IND-FinishedGoods","group":"Logistics"},"QA / QC":{"fill":"#CBE1DB","stroke":"#82908C","cadLayer":"ZONE_IND-QAQC","code":"ZONE_IND-QAQC","group":"Technical"},"Maintenance":{"fill":"#CFCCC6","stroke":"#84837F","cadLayer":"ZONE_IND-Maintenance","code":"ZONE_IND-Maintenance","group":"Technical"},"Utilities / MEPF":{"fill":"#BEC2C4","stroke":"#7A7C7D","cadLayer":"ZONE_IND-Utilities","code":"ZONE_IND-Utilities","group":"Technical"},"Waste / Recovery":{"fill":"#D8C9C4","stroke":"#8A817D","cadLayer":"ZONE_IND-Waste","code":"ZONE_IND-Waste","group":"Support"},"Administration":{"fill":"#CFD7DF","stroke":"#848A8F","cadLayer":"ZONE_IND-Admin","code":"ZONE_IND-Admin","group":"Support"},"Staff Welfare":{"fill":"#D3E1C2","stroke":"#87907C","cadLayer":"ZONE_IND-StaffWelfare","code":"ZONE_IND-StaffWelfare","group":"Support"},"Loading / Shipping":{"fill":"#C2C7C9","stroke":"#7C7F81","cadLayer":"ZONE_IND-Loading","code":"ZONE_IND-Loading","group":"Logistics"},"Operational Yard":{"fill":"#CDD6CB","stroke":"#838982","cadLayer":"ZONE_IND-Yard","code":"ZONE_IND-Yard","group":"Outdoor"},"Internal Circulation":{"fill":"#EEECE5","stroke":"#989793","cadLayer":"ZONE_IND-Circulation","code":"ZONE_IND-Circulation","group":"Movement"},"Parking":{"fill":"#CDCDC9","stroke":"#838381","cadLayer":"ZONE_IND-Parking","code":"ZONE_IND-Parking","group":"Support"},"Hazard / Restricted":{"fill":"#E6BBBE","stroke":"#93787A","cadLayer":"ZONE_IND-HazardRestricted","code":"ZONE_IND-HazardRestricted","group":"Control"}}},"MIXED-USE":{"name":"Mixed-Use","zones":{"Residential":{"fill":"#CDDCEB","stroke":"#838D96","cadLayer":"ZONE_MIX-Residential","code":"ZONE_MIX-Residential","group":"Use"},"Retail":{"fill":"#E8D8B2","stroke":"#948A72","cadLayer":"ZONE_MIX-Retail","code":"ZONE_MIX-Retail","group":"Use"},"Food & Beverage":{"fill":"#EDC7B5","stroke":"#987F74","cadLayer":"ZONE_MIX-FB","code":"ZONE_MIX-FB","group":"Use"},"Office / Workplace":{"fill":"#CFDBE9","stroke":"#848C95","cadLayer":"ZONE_MIX-Office","code":"ZONE_MIX-Office","group":"Use"},"Hospitality":{"fill":"#DECFE5","stroke":"#8E8493","cadLayer":"ZONE_MIX-Hospitality","code":"ZONE_MIX-Hospitality","group":"Use"},"Shared Lobby":{"fill":"#DDD5C4","stroke":"#8D887D","cadLayer":"ZONE_MIX-SharedLobby","code":"ZONE_MIX-SharedLobby","group":"Shared"},"Shared Amenity":{"fill":"#D3E1C2","stroke":"#87907C","cadLayer":"ZONE_MIX-SharedAmenity","code":"ZONE_MIX-SharedAmenity","group":"Shared"},"Residential Core":{"fill":"#BECAD6","stroke":"#7A8189","cadLayer":"ZONE_MIX-ResidentialCore","code":"ZONE_MIX-ResidentialCore","group":"Movement"},"Commercial Core":{"fill":"#CDC7BE","stroke":"#837F7A","cadLayer":"ZONE_MIX-CommercialCore","code":"ZONE_MIX-CommercialCore","group":"Movement"},"Public Realm":{"fill":"#C6DEC7","stroke":"#7F8E7F","cadLayer":"ZONE_MIX-PublicRealm","code":"ZONE_MIX-PublicRealm","group":"Outdoor"},"Back-of-House":{"fill":"#CFCCC6","stroke":"#84837F","cadLayer":"ZONE_MIX-BOH","code":"ZONE_MIX-BOH","group":"BOH"},"Service":{"fill":"#C9CDCC","stroke":"#818383","cadLayer":"ZONE_MIX-Service","code":"ZONE_MIX-Service","group":"BOH"},"Loading / Receiving":{"fill":"#C2C7C9","stroke":"#7C7F81","cadLayer":"ZONE_MIX-Loading","code":"ZONE_MIX-Loading","group":"Logistics"},"Parking":{"fill":"#CDCDC9","stroke":"#838381","cadLayer":"ZONE_MIX-Parking","code":"ZONE_MIX-Parking","group":"Support"},"MEPF / Utilities":{"fill":"#BEC2C4","stroke":"#7A7C7D","cadLayer":"ZONE_MIX-MEPF","code":"ZONE_MIX-MEPF","group":"Support"},"Roof / Outdoor Amenity":{"fill":"#CCE0C9","stroke":"#838F81","cadLayer":"ZONE_MIX-RoofOutdoor","code":"ZONE_MIX-RoofOutdoor","group":"Outdoor"}}}};
const LINE_PRESETS={"primary":{"label":"Primary circulation","color":"#0D7475","thickness":4.6,"dash":"solid","head":"filled","direction":"forward","route":"curve","group":"Circulation"},"secondary":{"label":"Secondary circulation","color":"#407B8E","thickness":2.8,"dash":"solid","head":"open","direction":"forward","route":"curve","group":"Circulation"},"informal":{"label":"Desire line / informal movement","color":"#A47B32","thickness":2.4,"dash":"dotted","head":"open","direction":"forward","route":"curve","group":"Circulation"},"service":{"label":"Service / logistics","color":"#93685A","thickness":2.8,"dash":"dashed","head":"filled","direction":"forward","route":"elbow","group":"Circulation"},"public":{"label":"Public movement","color":"#0D7475","thickness":3.3,"dash":"solid","head":"filled","direction":"forward","route":"elbow","group":"Circulation"},"staff":{"label":"Staff movement","color":"#5E7088","thickness":2.5,"dash":"dashed","head":"filled","direction":"forward","route":"elbow","group":"Circulation"},"sight":{"label":"Direct line of sight","color":"#8267A5","thickness":2,"dash":"dashed","head":"none","direction":"forward","route":"straight","group":"Visibility"},"view":{"label":"View corridor / visual connection","color":"#8267A5","thickness":2.6,"dash":"solid","head":"open","direction":"both","route":"straight","group":"Visibility"},"focal":{"label":"Focal view direction","color":"#AE7337","thickness":2.5,"dash":"solid","head":"open","direction":"forward","route":"straight","group":"Visibility"},"restricted":{"label":"Controlled access","color":"#B1545E","thickness":2.8,"dash":"dashed","head":"chevron","direction":"forward","route":"elbow","group":"Access"},"egress":{"label":"Emergency egress","color":"#337F67","thickness":4,"dash":"dashed","head":"filled","direction":"forward","route":"elbow","group":"Access"},"dependency":{"label":"Functional dependency","color":"#7D7153","thickness":2,"dash":"short","head":"open","direction":"forward","route":"straight","group":"Relationships"},"noise":{"label":"Noise / environmental influence","color":"#B86753","thickness":2.8,"dash":"dotted","head":"open","direction":"forward","route":"curve","group":"Environment"},"custom":{"label":"Custom line","color":"#0D2F4F","thickness":2.5,"dash":"solid","head":"filled","direction":"forward","route":"elbow","group":"Custom"}};

// Independent visual language: these are graphic treatments, not semantic meanings.
const GRAPHIC_ARROW_STYLES={
  open:{label:'Open line',help:'Single stroke with an open V head'},
  broken:{label:'Broken line',help:'Dashed shaft and open V head'},
  banded:{label:'Banded / segmented',help:'Series of outlined transverse bars and broad chevron'},
  outline:{label:'Hollow block',help:'Continuous outlined shaft and wide arrowhead'},
  classic:{label:'Legacy / marker',help:'Preserve earlier DiagramIt-style marker arrows'}
};
const ARROW_STYLE_KEYS=Object.keys(GRAPHIC_ARROW_STYLES);
function arrowStyleOptions(active){return ARROW_STYLE_KEYS.map(k=>`<option value="${k}" ${k===active?'selected':''}>${GRAPHIC_ARROW_STYLES[k].label}</option>`).join('')}
function arrowThumb(k){const common='stroke="#0D7475" stroke-linecap="round" stroke-linejoin="round" fill="none"';const shaft=k==='broken'?`<path d="M9 25 H80" stroke-dasharray="12 8" ${common} stroke-width="2.3"/>`:k==='open'?`<path d="M9 25 H80" ${common} stroke-width="2.3"/>`:k==='banded'?Array.from({length:5},(_,i)=>`<rect x="${12+i*12}" y="20" width="8" height="10" ${common} stroke-width="2"/>`).join(''):k==='outline'?`<path d="M9 19 H70 V11 L91 25 L70 39 V31 H9 Z" ${common} stroke-width="2.4"/>`:`<path d="M9 25 H85" ${common} stroke-width="2.3"/>`;
const head=k==='outline'?'':k==='banded'?`<path d="M73 14 L93 25 L73 36" ${common} stroke-width="6.5"/><path d="M73 14 L93 25 L73 36" stroke="#fff" stroke-width="2" fill="none"/>`:k==='classic'?`<path d="M82 19 L94 25 L82 31 Z" fill="#0D7475"/>`:`<path d="M77 15 L94 25 L77 35" ${common} stroke-width="2.7"/>`;
return `<svg viewBox="0 0 103 50" aria-hidden="true">${shaft}${head}</svg>`}
function arrowGallery(f,includePlain=false){const plain=includePlain?`<button type="button" class="arrow-choice ${(f.graphicStyle||'plain')==='plain'?'active':''}" aria-pressed="${(f.graphicStyle||'plain')==='plain'}" data-graphic-style="plain" title="Default architectural proximity: no arrowhead; no movement direction implied"><svg viewBox="0 0 103 50" aria-hidden="true"><path d="M9 25 H94" stroke="#0D7475" stroke-width="2.5" fill="none"/></svg><span>Plain · undirected</span></button>`:'';return `<div class="arrow-gallery">${plain}${ARROW_STYLE_KEYS.filter(k=>k!=='classic').map(k=>`<button type="button" class="arrow-choice ${f.graphicStyle===k?'active':''}" aria-pressed="${f.graphicStyle===k}" data-graphic-style="${k}" title="${GRAPHIC_ARROW_STYLES[k].help}">${arrowThumb(k)}<span>${GRAPHIC_ARROW_STYLES[k].label}</span></button>`).join('')}</div>`;}
function setArrowGraphicStyle(f,k){if(!GRAPHIC_ARROW_STYLES[k])return;f.graphicStyle=k;if(k!=='classic'){f.head=k==='outline'||k==='banded'?'outline':'open';if(k==='broken')f.dash='dashed';else f.dash='solid';}}

function setRelationGraphicStyle(rel,k){if(k==='plain'){rel.graphicStyle='plain';return;}if(!GRAPHIC_ARROW_STYLES[k])return;const dir=rel.direction||'forward';setArrowGraphicStyle(rel,k);rel.direction=dir;rel.headSize??=26;rel.bodyWidth??=13;rel.bandSpacing??=22;}
function templateZones(templateId){return clone(KDG_ZONE_PROFILES[templateId]?.zones||BASE_ZONES)}
function lineStyleOptions(active){return Object.entries(LINE_PRESETS).map(([k,p])=>`<option value="${k}" ${active===k?'selected':''}>${html(p.group)} · ${html(p.label)}</option>`).join('')}
function applyPreset(f,id){const p=LINE_PRESETS[id]||LINE_PRESETS.custom;Object.assign(f,{preset:id,color:p.color,thickness:p.thickness,dash:p.dash,head:p.head,direction:p.direction,route:p.route});if(!f.graphicStyle)setArrowGraphicStyle(f,model.selectedArrowStyle||'open');f.headSize??=26;f.bodyWidth??=13;f.bandSpacing??=22;}
const RATINGS={A:{weight:5,target:12,desc:'Absolutely necessary'},E:{weight:3,target:42,desc:'Especially important'},I:{weight:1.5,target:100,desc:'Important'},O:{weight:.3,target:160,desc:'Ordinary'},U:{weight:0,target:200,desc:'Unimportant'},X:{weight:-3,target:300,desc:'Undesirable'}};
// The relationship rating is semantic data; these entries define its default presentation.
// Individual relations override only properties explicitly edited by the user.
const RATING_KEYS=['A','E','I','O','U','X'];
const LINE_VISUAL_KEYS=['graphicStyle','color','thickness','dash','route','bend','direction','head','headSize','bodyWidth','bandSpacing'];
const RATING_LINE_DEFAULTS={
 A:{visible:true,graphicStyle:'plain',color:'#0D7475',thickness:3.5,dash:'solid',route:'straight',bend:45,direction:'forward',head:'open',headSize:26,bodyWidth:13,bandSpacing:22},
 E:{visible:true,graphicStyle:'plain',color:'#729E9F',thickness:2.3,dash:'solid',route:'straight',bend:45,direction:'forward',head:'open',headSize:26,bodyWidth:13,bandSpacing:22},
 I:{visible:true,graphicStyle:'plain',color:'#9C8C63',thickness:1.5,dash:'solid',route:'straight',bend:45,direction:'forward',head:'open',headSize:26,bodyWidth:13,bandSpacing:22},
 O:{visible:false,graphicStyle:'plain',color:'#B4BFC2',thickness:1.2,dash:'dotted',route:'straight',bend:45,direction:'forward',head:'open',headSize:26,bodyWidth:13,bandSpacing:22},
 U:{visible:false,graphicStyle:'plain',color:'#D0D8D9',thickness:1,dash:'dotted',route:'straight',bend:45,direction:'forward',head:'open',headSize:26,bodyWidth:13,bandSpacing:22},
 X:{visible:false,graphicStyle:'plain',color:'#BC5060',thickness:2.2,dash:'dashed',route:'straight',bend:45,direction:'forward',head:'open',headSize:26,bodyWidth:13,bandSpacing:22}
};
function ratingDefault(r){return {...RATING_LINE_DEFAULTS[r]||RATING_LINE_DEFAULTS.U,...(model.ratingLineDefaults?.[r]||{})};}
function effectiveRelation(rel){return {...ratingDefault(rel.rating||'U'),...rel};}
function lineVisual(obj,kind){const v=kind==='relation'?effectiveRelation(obj):obj;return Object.fromEntries(LINE_VISUAL_KEYS.map(k=>[k,v[k]]).filter(([k,v])=>v!==undefined));}
function applyLineVisual(to,style){for(const k of LINE_VISUAL_KEYS)if(style[k]!==undefined)to[k]=style[k];}

function fresh(){return {format:'diagramit-bubble-template',schema:2,title:'Untitled Bubble Study',spaces:[],relations:{},flows:[],zones:clone(BASE_ZONES),zoneTemplate:'CUSTOM',matrixHeaderMode:'names',sizingMode:'area',selectedLinePreset:'primary',selectedArrowStyle:'open',ratingLineDefaults:clone(RATING_LINE_DEFAULTS),theme:'formal',sketchStrength:2,showAreas:false,notes:[],envGraphics:[],generated:false,showRelations:true,showAvoid:false,bubbleScale:1,seed:0,underlay:null,environment:{sun:{on:false,angle:105},monsoon:{on:false,angle:225}},view:{x:0,y:0,w:W,h:H}};}
// B2: untrusted DiagramIt JSON must never become an SVG image event attribute.
// The standalone importer produces raster-image base64 data URLs; external,
// SVG and quote-bearing URLs are deliberately excluded on load and export.
function safeUnderlayDataUrl(data){return typeof data==='string'&&data.length<=12582976&&/^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(data);}
function upgrade(raw){const m={...fresh(),...(raw||{})};m.underlay=m.underlay&&safeUnderlayDataUrl(m.underlay.data)?m.underlay:null;m.spaces=(raw?.spaces||[]).map(s=>({...s,id:s.id||uid(),name:s.name||'Space',area:Math.max(1,num(s.area,40)),zone:s.zone||'Public',x:num(s.x,400),y:num(s.y,350),shape:s.shape||'circle',angle:num(s.angle,0),scale:num(s.scale,1),stretchX:num(s.stretchX,1),stretchY:num(s.stretchY,1),parentId:s.parentId||'',pinned:!!s.pinned,vertices:Array.isArray(s.vertices)?s.vertices:null}));m.notes=Array.isArray(raw?.notes)?raw.notes.map(n=>({...n,id:n.id||uid(),text:String(n.text??'Note'),x:num(n.x,420),y:num(n.y,320),fontSize:clamp(num(n.fontSize,17),8,84),font:n.font||'Arial',fill:n.fill||'#ffffff',fillMode:n.fillMode==='none'?'none':'solid',lineAnchor:n.lineAnchor&&['relation','flow'].includes(n.lineAnchor.kind)?{...n.lineAnchor,t:clamp(num(n.lineAnchor.t,.5),0,1)}:null,textColor:n.textColor||'#0D2F4F',stroke:n.stroke||'#7595a4',borderWidth:num(n.borderWidth,0),opacity:num(n.opacity,1),highlight:n.highlight||'none',align:n.align||'center',angle:num(n.angle,0)})):[];m.showAreas=typeof raw?.showAreas==='boolean'?raw.showAreas:!!raw?.generated;m.relations=raw?.relations||{};m.ratingLineDefaults=Object.fromEntries(RATING_KEYS.map(r=>[r,{...RATING_LINE_DEFAULTS[r],...(raw?.ratingLineDefaults?.[r]||{})}]));m.flows=(raw?.flows||[]).map(f=>({...f,preset:f.preset||'custom',graphicStyle:GRAPHIC_ARROW_STYLES[f.graphicStyle]?f.graphicStyle:'classic',headSize:Math.min(60,Math.max(8,num(f.headSize,26))),bodyWidth:Math.min(38,Math.max(4,num(f.bodyWidth,13))),bandSpacing:Math.min(60,Math.max(10,num(f.bandSpacing,22)))}));m.zoneTemplate=raw?.zoneTemplate||'CUSTOM';m.zones=raw?.zones&&Object.keys(raw.zones).length?clone(raw.zones):templateZones(m.zoneTemplate);m.matrixHeaderMode=['names','abbrev','numbers'].includes(raw?.matrixHeaderMode)?raw.matrixHeaderMode:'names';m.sizingMode=['area','conceptual'].includes(raw?.sizingMode)?raw.sizingMode:(raw?.generated&&raw?.spaces?.length?'conceptual':'area');m.selectedLinePreset=LINE_PRESETS[raw?.selectedLinePreset]?raw.selectedLinePreset:'primary';m.selectedArrowStyle=GRAPHIC_ARROW_STYLES[raw?.selectedArrowStyle]?raw.selectedArrowStyle:'open';m.bubbleScale=clamp(num(m.bubbleScale,1),.45,2.4);m.environment=m.environment||fresh().environment;m.environment.sun||={on:false,angle:105};m.environment.monsoon||={on:false,angle:225};m.envGraphics=Array.isArray(raw?.envGraphics)?raw.envGraphics.filter(g=>g&&envKinds.includes(g.kind)).map(envNorm):[];if(!raw?.envGraphics?.length){for(const k of envKinds){if(raw?.environment?.[k]?.on){const g=envDefault(k,k==='sun'?'horizon':'ribbons');g.angle=num(raw.environment[k].angle,0);g.x=k==='sun'?W-190:W-385;g.y=165;g.scale=.68;m.envGraphics.push(g);}}}m.environment.sun.on=false;m.environment.monsoon.on=false;m.view=m.view||{x:0,y:0,w:W,h:H};m.generated=!!(raw?.generated??raw?.hasGenerated);return m;}
let model=fresh(),pane='program',selection={kind:null,id:null},history=[],redoStack=[],drag=null,tool='select',flowSource=null,paintSource=null,editing=null,editOutline=false,hostPageId=null,frameLoaded=false,view={x:0,y:0,w:W,h:H},toastTimer=null;
const space=id=>model.spaces.find(s=>s.id===id), relationKey=(a,b)=>[a,b].sort().join('|');
function notify(){if(auditOpen)queueMicrotask(renderAuditPanel);if(EMBEDDED&&hostPageId)parent.postMessage({channel:CHANNEL,type:'changed',pageId:hostPageId,model:clone(model)},location.origin);else try{localStorage.setItem('diagramit-bubble-v085-local',JSON.stringify(model));}catch(e){console.warn('Local save failed',e)}}
function checkpoint(){history.push(JSON.stringify(model));if(history.length>55)history.shift();redoStack=[];}
function commit(show=true){notify();if(show)render();}
function undo(){if(!history.length)return;auditPlanPreview=null;redoStack.push(JSON.stringify(model));model=upgrade(JSON.parse(history.pop()));selection={kind:null,id:null};render();notify();}
function redo(){if(!redoStack.length)return;auditPlanPreview=null;history.push(JSON.stringify(model));model=upgrade(JSON.parse(redoStack.pop()));selection={kind:null,id:null};render();notify();}
function showToast(s){const el=$('toast');el.textContent=s;el.classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.add('hidden'),2600)}
function tab(to){pane=to;selection={kind:null,id:null};endInline(false);render();}
function addSpace(openEditor=true){checkpoint();const id=uid();const s={id,name:'New space',area:50,zone:Object.keys(model.zones)[0]||'Public',shape:'circle',x:400+Math.random()*200,y:280+Math.random()*160,angle:0,scale:1,stretchX:1,stretchY:1,parentId:'',pinned:false,vertices:null};model.spaces.push(s);commit();if(openEditor){tab('program');setTimeout(()=>{const e=document.querySelector(`[data-name="${id}"]`);e?.focus();e?.select()},10)}return s;}
/* v0.9.9: one reversible deletion path for all four Bubble editor entry points.
   Detached notes retain their rendered coordinates, rather than becoming broken links. */
function removeSpacesCore(ids,discardAttached=false){
 const gone=new Set(ids.filter(id=>!!space(id)));if(!gone.size)return false;
 const former=new Map(model.spaces.map(s=>[s.id,s.parentId||'']));
 const flowsRemoved=new Set(model.flows.filter(f=>gone.has(f.source)||gone.has(f.target)).map(f=>f.id));
 const relationsRemoved=new Set(Object.keys(model.relations).filter(k=>k.split('|').some(id=>gone.has(id))));
 model.notes=(model.notes||[]).filter(n=>{
   const attached=n.attachedTo&&gone.has(n.attachedTo);
   const anchored=n.lineAnchor&&(n.lineAnchor.kind==='flow'?flowsRemoved.has(n.lineAnchor.id):relationsRemoved.has(n.lineAnchor.id));
   if(!attached&&!anchored)return true;
   if(discardAttached)return false;
   const p=notePosition(n);n.x=p.x;n.y=p.y;n.attachedTo='';n.lineAnchor=null;return true;
 });
 model.spaces=model.spaces.filter(s=>!gone.has(s.id));
 model.flows=model.flows.filter(f=>!flowsRemoved.has(f.id));
 for(const k of relationsRemoved)delete model.relations[k];
 for(const s of model.spaces){if(!gone.has(s.parentId))continue;
   let parent=former.get(s.parentId)||'',seen=new Set([s.id]);
   while(gone.has(parent)&&!seen.has(parent)){seen.add(parent);parent=former.get(parent)||'';}
   s.parentId=parent&&!seen.has(parent)?parent:'';
 }
 return true;
}
function removeSpacesSafely(ids){if(!ids.some(id=>!!space(id)))return;checkpoint();removeSpacesCore(ids);selection={kind:null,id:null};commit();}
function deleteSpace(id){removeSpacesSafely([id]);}
function deleteSelectionReliable(){
 const kind=selection.kind,id=selection.id;
 if(kind==='space'||kind==='multi'){removeSpacesSafely(selectionIds());return;}
 if(kind==='underlay'&&model.underlay){checkpoint();model.underlay=null;selection={kind:null,id:null};commit();return;}
 if(kind==='envGraphic'){const g=envItem(id);if(!g)return;checkpoint();model.envGraphics=model.envGraphics.filter(x=>x.id!==id);selection={kind:null,id:null};commit();return;}
 if(kind==='note'){if(!(model.notes||[]).some(n=>n.id===id))return;checkpoint();model.notes=model.notes.filter(n=>n.id!==id);selection={kind:null,id:null};commit();return;}
 if(kind==='flow'||kind==='relation'){
   const isFlow=kind==='flow';
   if(isFlow&&!model.flows.some(f=>f.id===id))return;
   if(!isFlow&&!model.relations[id])return;
   checkpoint();
   for(const n of model.notes||[])if(n.lineAnchor?.kind===kind&&n.lineAnchor.id===id){const p=notePosition(n);n.x=p.x;n.y=p.y;n.lineAnchor=null;}
   if(isFlow)model.flows=model.flows.filter(f=>f.id!==id);
   else model.relations[id]={rating:'U'};
   selection={kind:null,id:null};commit();return;
 }
 showToast('Select a diagram object before deleting.');
}
function ensureContainment(){
 // Areas and geometry are not silently altered to conceal inconsistent nested programs.
 const warnings=[];
 for(const s of model.spaces){if(!s.parentId)continue;const p=space(s.parentId);if(p&&Math.PI*Math.pow(radius(s),2)>Math.PI*Math.pow(radius(p),2)*.82)warnings.push(`${s.name} exceeds the visible capacity of ${p.name}`);}
 return warnings;
}
/* T21: refuse destructive auto-layout when an imported program has broken
   nesting references. This does not modify, unlink or silently repair topics. */
function generationNestingError(){
 const byId=new Map();
 for(const s of model.spaces){
   if(!s.id||byId.has(s.id))return 'Duplicate or missing bubble IDs. Review the space program before generating.';
   byId.set(s.id,s);
 }
 for(const s of model.spaces){
   if(s.parentId&&!byId.has(s.parentId))return 'A nested bubble has a missing parent. Review its Within / Parent space setting.';
 }
 const state=new Map(); // 1: current chain, 2: verified chain
 for(const s of model.spaces){
   let cursor=s.id;
   const chain=[];
   while(cursor&&state.get(cursor)!==2){
     if(state.get(cursor)===1)return 'Circular bubble nesting detected. Review the Within / Parent space settings.';
     state.set(cursor,1);chain.push(cursor);
     cursor=byId.get(cursor)?.parentId||'';
   }
   for(const id of chain)state.set(id,2);
 }
 return '';
}
function generate(alt=false){
 if(!model.spaces.length){tab('program');showToast('Add spaces in the program first.');return;}
 const hierarchyError=generationNestingError();
 if(hierarchyError){showToast(hierarchyError);return;}
 const nestingWarnings=ensureContainment(),spaces=model.spaces;
 const parents=spaces.filter(s=>!s.parentId||!space(s.parentId));
 const free=parents.filter(s=>!s.pinned&&!descendantsOf(s.id).some(id=>space(id)?.pinned));
 const wasGenerated=!!model.generated;
 const priorPositions=new Map(parents.map(s=>[s.id,{x:s.x,y:s.y}]));
 const initialPlacement=!wasGenerated||alt;
 // A locked bubble is never randomized. In particular, do not fall back to all parents
 // when every parent is pinned: that used to overwrite every carefully placed bubble.
 if(wasGenerated&&!free.length){
   pane='canvas';selection={kind:null,id:null};render();
   showToast('All top-level bubbles are locked or contain locked descendants. Nothing was moved.');
   return;
 }
 checkpoint();
 if(alt)model.seed+=1;
 const seed=model.seed;
 // First generation and deliberate alternate layouts place only unlocked bubbles.
 // A normal subsequent Generate refines the existing arrangement instead of erasing it.
 if(initialPlacement){
   free.forEach((s,i)=>{
     const ang=i*2.399963+seed*.83,rad=80+105*Math.sqrt(i);
     // Initial target coordinates are provisional until the solver finishes.
     // Relocate the hierarchy exactly once after physics, including notes.
     s.x=W/2+rad*Math.cos(ang);s.y=H/2+rad*Math.sin(ang);
   });
 }
 // Immutable per-run geometry/relationship metadata; the original 380-step physics stays intact.
 const parentRadii=parents.map(radius);
 const forcePairs=[];
 for(let i=0;i<parents.length;i++)for(let j=i+1;j<parents.length;j++){
   const a=parents[i],b=parents[j],rating=model.relations[relationKey(a.id,b.id)]?.rating||'U',r=RATINGS[rating]||RATINGS.U;
   forcePairs.push({a,b,min:parentRadii[i]+parentRadii[j]+19,rating,weight:r.weight,target:r.target});
 }
 const v=new Map(parents.map(s=>[s.id,{x:0,y:0}]));
 const freeBounds=new Map(free.map(s=>[s.id,{rx:Math.min(radius(s),W*.43),ry:Math.min(radius(s),H*.43)}]));
 for(let k=0;k<380;k++){
   const f=new Map(parents.map(s=>[s.id,{x:(W/2-s.x)*.0008,y:(H/2-s.y)*.0008}]));
   for(const p of forcePairs){
     const {a,b,min,rating,weight,target}=p,dx=b.x-a.x+.00001,dy=b.y-a.y+.00001;
     const d=Math.hypot(dx,dy),u=dx/d,w=dy/d;
     const force=d<min?-(min-d)*.16:weight>0?(d-(min+target))*weight*.006:rating==='X'&&d<min+target?-(min+target-d)*.04:0;
     const pa=f.get(a.id),pb=f.get(b.id);
     pa.x+=force*u;pa.y+=force*w;pb.x-=force*u;pb.y-=force*w;
   }
   for(const s of free){
     const o=v.get(s.id),g=f.get(s.id),limit=freeBounds.get(s.id);
     o.x=clamp((o.x+g.x)*.71,-10,10);o.y=clamp((o.y+g.y)*.71,-10,10);
     s.x=clamp(s.x+o.x,20+limit.rx,W-20-limit.rx);
     s.y=clamp(s.y+o.y,20+limit.ry,H-20-limit.ry);
   }
 }
 // Refinement is deliberately incremental. Don't erase a user-arranged sketch
 // with a large solver movement after one press of Refine. Repeated presses
 // can converge further; Alternate can deliberately create a new composition.
 if(wasGenerated&&!alt){
   for(const s of free){
     const before=priorPositions.get(s.id),dx=s.x-before.x,dy=s.y-before.y;
     const dist=Math.hypot(dx,dy),maxStep=90;
     if(dist>maxStep){s.x=before.x+dx/dist*maxStep;s.y=before.y+dy/dist*maxStep;}
   }
 }
 // First generation places children automatically. Every later refine/alternate
 // carries each previously arranged nested group with its root, without
 // resetting offsets, attached note coordinates or individually edited children.
 // Locked descendants prevent their root from moving, so containment survives.
 if(wasGenerated){
   for(const p of parents){
     const before=priorPositions.get(p.id);if(!before)continue;
     const nx=p.x,ny=p.y;
     if(Math.hypot(nx-before.x,ny-before.y)<1e-8)continue;
     p.x=before.x;p.y=before.y;
     moveWithChildren(p,nx,ny);
   }
 }else{
   // First Generate previously moved only parent coordinates in the solver,
   // leaving descendant groups and attached text at the pre-layout positions.
   // Apply each root's final displacement exactly once to its entire group.
   for(const p of parents){
     const before=priorPositions.get(p.id);if(!before)continue;
     const nx=p.x,ny=p.y;p.x=before.x;p.y=before.y;
     moveWithChildren(p,nx,ny);
   }
   const visit=new Set();
   function placeChildren(p){
     if(visit.has(p.id))return;visit.add(p.id);
     const ch=spaces.filter(s=>s.parentId===p.id);
     const rr=Math.max(0,radius(p)-Math.max(0,...ch.map(c=>radius(c)))-7)*.63;
     ch.forEach((s,i)=>{
       // A pinned descendant protects its ancestors' relative positions.
       if(!s.pinned&&!descendantsOf(s.id).some(id=>space(id)?.pinned)){
         const a=-Math.PI/2+i*Math.PI*2/Math.max(3,ch.length);
         moveWithChildren(s,p.x+rr*Math.cos(a),p.y+rr*Math.sin(a));
       }
       placeChildren(s);
     });
   }
   parents.forEach(placeChildren);
 }
 model.generated=true;pane='canvas';selection={kind:null,id:null};commit();
 const verb=!wasGenerated?'Concept generated':alt?'Alternate arrangement generated':'Existing arrangement refined';
 showToast(nestingWarnings.length?`${verb} · ${nestingWarnings.length} nested area warnings. Review containment.`:`${verb}. Locked positions preserved.`);
}
function radius(s){
 const area=Math.max(.001,num(s.area,50));
 const base=4.1*Math.sqrt(area)*Math.max(.01,num(model.bubbleScale,1));
 return model.sizingMode==='area'?base:base*Math.max(.05,num(s.scale,1));
}
function aspect(s){const x=Math.max(.08,Math.abs(num(s.stretchX,1))),y=Math.max(.08,Math.abs(num(s.stretchY,1)));return clamp((s.shape==='ellipse'?1.62:1)*x/y,.08,12)}
function radii(s){const r=radius(s),q=Math.sqrt(aspect(s));return {rx:r*q,ry:r/q};}
function polygonArea(points){let a=0;for(let i=0;i<points.length;i++){const p=points[i],n=points[(i+1)%points.length];a+=p.x*n.y-n.x*p.y;}return Math.abs(a)*.5;}
function smoothedArea(pts){const samples=[];for(let i=0;i<pts.length;i++){const a=pts[(i+pts.length-1)%pts.length],b=pts[i],c=pts[(i+1)%pts.length];const p0={x:(a.x+b.x)/2,y:(a.y+b.y)/2},p2={x:(b.x+c.x)/2,y:(b.y+c.y)/2};for(let k=0;k<12;k++){const t=k/12,w=1-t;samples.push({x:w*w*p0.x+2*w*t*b.x+t*t*p2.x,y:w*w*p0.y+2*w*t*b.y+t*t*p2.y})}}return polygonArea(samples);}
function normalizedOrganic(s){const pts=vertices(s),a=smoothedArea(pts);const factor=Math.sqrt(Math.PI/Math.max(.00001,a));return pts.map(p=>({x:p.x*factor,y:p.y*factor}));}
function vertices(s){if(Array.isArray(s.vertices)&&s.vertices.length>=3)return s.vertices;const n=s.shape==='organic'?10:36;return Array.from({length:n},(_,i)=>{const a=2*Math.PI*i/n;const wobble=s.shape==='organic'?1+.09*Math.cos(3*a+.45)+.06*Math.sin(5*a+1):1;return{x:Math.cos(a)*wobble,y:Math.sin(a)*wobble}})}
function coords(s){const {rx,ry}=radii(s),a=(s.angle||0)*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a);return (s.shape==='organic'?normalizedOrganic(s):vertices(s)).map(p=>({x:(p.x*rx*ca-p.y*ry*sa),y:(p.x*rx*sa+p.y*ry*ca)}));}
function outlinePath(s){const p=coords(s);if(s.shape==='circle'||s.shape==='ellipse')return `M ${radii(s).rx} 0 A ${radii(s).rx} ${radii(s).ry} 0 1 1 ${-radii(s).rx} 0 A ${radii(s).rx} ${radii(s).ry} 0 1 1 ${radii(s).rx} 0 Z`;if(s.shape==='organic'){const out=[];for(let i=0;i<p.length;i++){const prev=p[(i+p.length-1)%p.length],cur=p[i],next=p[(i+1)%p.length],post=p[(i+2)%p.length],end={x:(cur.x+next.x)/2,y:(cur.y+next.y)/2};if(i===0)out.push(`M ${((prev.x+cur.x)/2).toFixed(1)} ${((prev.y+cur.y)/2).toFixed(1)}`);out.push(`Q ${cur.x.toFixed(1)} ${cur.y.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`)}return out.join(' ')+' Z';}return 'M '+p.map(q=>`${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(' L ')+' Z'}
function bubbleFont(s){const k=s.labelFont||'auto';return k==='serif'?'Georgia, serif':k==='mono'?"'Courier New', monospace":k==='sans'?'Arial, sans-serif':model.theme==='sketch'?"'Bradley Hand','Chalkboard SE','Marker Felt','Comic Sans MS',cursive":'Arial, sans-serif';}
function bubbleTextStyle(s){return {font:bubbleFont(s),weight:s.labelBold===false?'400':'700',italic:s.labelItalic?'italic':'normal',decoration:[s.labelUnderline?'underline':'',s.labelStrike?'line-through':''].filter(Boolean).join(' ')||'none',color:s.labelColorMode==='custom'&&/^#[0-9a-f]{6}$/i.test(s.labelColor||'')?s.labelColor:selectTextColor(s.fill||getColor(s).fill,num(s.fillOpacity,.9)),align:s.labelAlign||'center'};}
function labelControlUI(s,scope='property'){
 const st=bubbleTextStyle(s),v=(k)=>scope==='multiProperty'?`data-multi-property="${k}"`:`data-property="${k}"`,option=(key,label)=>`<option value="${key}" ${(s.labelFont||'auto')===key?'selected':''}>${label}</option>`;
 return `<div class="section-label">Bubble label formatting</div><div class="split"><div class="field"><label>Font family</label><select ${v('labelFont')}>${option('auto','Theme default')}${option('sans','Sans serif')}${option('serif','Serif')}${option('mono','Monospaced')}</select></div><div class="field"><label>Font size (0 = Auto)</label><input type="number" min="0" max="72" step="1" ${v('labelFontSize')} value="${num(s.labelFontSize,0)}"></div></div>
 <div class="note-actions" role="group" aria-label="Bubble label text styles">${[['labelBold','Bold','B'],['labelItalic','Italic','I'],['labelUnderline','Underline','U'],['labelStrike','Strikethrough','S']].map(([k,title,t])=>`<button type="button" data-label-toggle="${k}" class="${(k==='labelBold'?s[k]!==false:!!s[k])?'primary':''}" title="${title}">${t}</button>`).join('')}</div>
 <div class="split"><div class="field"><label>Text color behavior</label><select ${v('labelColorMode')}><option value="auto" ${s.labelColorMode!=='custom'?'selected':''}>Auto contrast</option><option value="custom" ${s.labelColorMode==='custom'?'selected':''}>Custom color</option></select></div><div class="field"><label>Custom text color</label><input type="color" ${v('labelColor')} value="${html(s.labelColor||'#0D2F4F')}" ${s.labelColorMode==='custom'?'':'disabled'}></div></div>
 <div class="field"><label>Horizontal text alignment</label><select ${v('labelAlign')}>${['left','center','right'].map(a=>`<option value="${a}" ${(s.labelAlign||'center')===a?'selected':''}>${a[0].toUpperCase()+a.slice(1)}</option>`).join('')}</select></div><p class="small">Auto contrast follows each bubble's fill. Label formatting does not change the space name, area, or adjacency.</p>`;
}
function textSVG(s){const rr=radii(s),style=bubbleTextStyle(s),color=style.color,show=labelArea(s),shadow=color==='#ffffff'?'#203141':'#ffffff',area=show?`${html(s.area)} m²`:'';
const align=style.align==='left'?'start':style.align==='right'?'end':'middle',anchorX=style.align==='left'?-rr.rx*.68:style.align==='right'?rr.rx*.68:0,decor=style.decoration,wt=style.weight,ft=style.italic,ff=html(style.font);
if(Math.min(rr.rx,rr.ry)<34){const y=Math.max(12,rr.ry+15),cap=html(s.name)+(show?' · '+area:'');const fs=num(s.labelFontSize,0)>0?clamp(num(s.labelFontSize,12),7,72):12;return `<g pointer-events="none" text-anchor="middle" font-family="${ff}"><path d="M0 ${rr.ry} V${y-5}" stroke="#50697b" stroke-width="1"/><text y="${y+7}" font-size="${fs}" font-weight="${wt}" font-style="${ft}" text-decoration="${decor}" fill="${color}" stroke="${shadow}" stroke-width="${color==='#ffffff'?2:1}" paint-order="stroke">${cap}</text></g>`;}
const nested=model.spaces.some(child=>child.parentId===s.id),r=radius(s),size=num(s.labelFontSize,0)>0?clamp(num(s.labelFontSize,0),7,72):clamp(r*.24,10,17),maxChars=clamp(Math.floor(rr.rx*1.40/(size*.54)),5,48),lines=wrap(s.name,maxChars),top=-(lines.length-1)*size*.58;
return `<g pointer-events="none" transform="translate(0 ${nested?-r*.48:0}) ${model.theme==='sketch'&&(!s.labelFont||s.labelFont==='auto')?`rotate(${(sketchSeed(s.id)%7-3)*.33})`: ''}" text-anchor="${align}" font-family="${ff}"><text x="${anchorX}" y="${top-1}" font-weight="${wt}" font-style="${ft}" text-decoration="${decor}" font-size="${size}" fill="${color}" stroke="${shadow}" stroke-opacity=".55" stroke-width="${color==='#ffffff'?1.7:.7}" paint-order="stroke">${lines.map((line,i)=>`<tspan x="${anchorX}" dy="${i?size*1.18:0}">${html(line)}</tspan>`).join('')}</text>${show?`<text x="${anchorX}" text-anchor="${align}" y="${top+lines.length*size*1.18+2}" font-size="${Math.max(9,size*.75)}" fill="${color}" font-weight="600">${area}</text>`:''}</g>`;}

function wrap(label,max){const words=String(label).split(/\s+/),lines=[''];for(const wd of words){const k=lines.length-1;if((lines[k]+' '+wd).trim().length>max&&lines[k])lines.push(wd);else lines[k]=(lines[k]+' '+wd).trim();}return lines.slice(0,3)}
function getColor(s){return model.zones[s.zone]||BASE_ZONES.Public}
const BORDER_ROLES={Anchor:{weight:3.4,dash:'solid',label:'Anchor / major'},Primary:{weight:2.7,dash:'solid',label:'Primary'},Support:{weight:1.8,dash:'solid',label:'Support'},Secondary:{weight:1.5,dash:'dashed',label:'Secondary'},Optional:{weight:1.5,dash:'dotted',label:'Optional'}};
function styleRoles(active){return `<div class="style-chips">${Object.entries(BORDER_ROLES).map(([key,v])=>`<button type="button" class="${active===key?'active':''}" data-border-role="${key}" title="${v.label}">${key}</button>`).join('')}</div>`;}
function selectTextColor(fill,opacity=1){const hex=/^#[0-9a-f]{6}$/i.test(fill||'')?fill:'#edf2ee',v=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)),c=v.map(x=>x*opacity+247*(1-opacity)).map(x=>{x/=255;return x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4)}),lum=c[0]*.2126+c[1]*.7152+c[2]*.0722;return (1.05/(lum+.05))>=(lum+.05)/.05?'#ffffff':'#112b3e';}
function labelArea(s){return s.areaLabel==='show'||(s.areaLabel!=='hide'&&model.showAreas);}
function seededUnit(t){return Math.sin(t*12.9898+78.233)*43758.5453%1;}
// Hand-drawn SVG renderer. All perturbations are deterministic: no flicker,
// no changes to spatial data, matrix values, connection endpoints or geometry.
function sketchSeed(value){let h=2166136261;for(const ch of String(value)){h=Math.imul(h^ch.charCodeAt(0),16777619)}return (h>>>0)%9973;}
function sketchWave(t,seed){return .55*Math.sin(t*12.7+seed*.83)+.27*Math.sin(t*27.3+seed*1.47)+.18*Math.sin(t*53.1+seed*2.37);}
function sketchAmp(){return clamp(num(model.sketchStrength,2),1,3);}
function sketchOutlinePoints(s, count=100){const result=[];
 if(s.shape==='organic'){
  const p=coords(s),N=p.length,sub=Math.max(5,Math.round(count/N));
  for(let i=0;i<N;i++){const a=p[(i+N-1)%N],b=p[i],c=p[(i+1)%N],start={x:(a.x+b.x)/2,y:(a.y+b.y)/2},end={x:(b.x+c.x)/2,y:(b.y+c.y)/2};for(let j=0;j<sub;j++){const t=j/sub,u=1-t;result.push({x:u*u*start.x+2*u*t*b.x+t*t*end.x,y:u*u*start.y+2*u*t*b.y+t*t*end.y});}}
 }else{
  const r=radii(s),ang=num(s.angle,0)*Math.PI/180,co=Math.cos(ang),si=Math.sin(ang);
  for(let i=0;i<count;i++){const t=i*2*Math.PI/count,x=r.rx*Math.cos(t),y=r.ry*Math.sin(t);result.push({x:x*co-y*si,y:x*si+y*co})}
 }
 return result;
}
function sketchPath(s,seed=1){const p=sketchOutlinePoints(s),mag=sketchAmp(),scale=clamp(radius(s)*.019,1.8,3.8)*mag*.82,offset=sketchSeed(s.id||s.name||'bubble')*.001,pts=[];
 for(let i=0;i<p.length;i++){const at=p[i],before=p[(i+p.length-1)%p.length],after=p[(i+1)%p.length],vx=after.x-before.x,vy=after.y-before.y,d=Math.max(.0001,Math.hypot(vx,vy)),a=i*2*Math.PI/p.length,dev=sketchWave(a+offset,seed*1.29)*scale;
  pts.push({x:at.x-vy/d*dev,y:at.y+vx/d*dev})}
 return 'M'+pts.map(p=>`${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' L')+' Z';
}
function sketchStroke(d,color,width,seed,dash='',marker=''){
 // Sample the real SVG route so all four connector routing modes can be sketched.
 let path=document.createElementNS('http://www.w3.org/2000/svg','path'),length=0;
 try{path.setAttribute('d',d);length=path.getTotalLength()}catch(e){return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" ${marker}/>`}
 if(!Number.isFinite(length)||length<.01)return '';
 const n=Math.max(14,Math.min(175,Math.ceil(length/7))),rough=sketchAmp();
 const line=(pass)=>{let parts=[];for(let i=0;i<=n;i++){const t=i/n,at=path.getPointAtLength(t*length),pre=path.getPointAtLength(Math.max(0,(t-.003)*length)),post=path.getPointAtLength(Math.min(length,(t+.003)*length)),dx=post.x-pre.x,dy=post.y-pre.y,m=Math.max(.001,Math.hypot(dx,dy)),envelope=Math.sin(Math.PI*t)**.55,shift=(sketchWave(t*6.283,seed*.33+pass)*2.6+Math.sin(t*85+seed+pass*2)*.37)*rough*.68*envelope;
  parts.push(`${i?'L':'M'}${(at.x-dy/m*shift).toFixed(2)} ${(at.y+dx/m*shift).toFixed(2)}`)}return parts.join(' ')};
 const pat=dash?`stroke-dasharray="${dash}"`:'';
 return `<path d="${line(1)}" fill="none" stroke="${color}" stroke-width="${Math.max(.8,width*1.12)}" opacity=".88" stroke-linecap="round" stroke-linejoin="round" ${pat} ${marker}/><path d="${line(2)}" fill="none" stroke="${color}" stroke-width="${Math.max(.65,width*.68)}" opacity=".49" stroke-linecap="round" ${pat} pointer-events="none"/>`;
}
function sketchArt(art){return `<g filter="url(#sketchWaver)" class="sketch-graphic">${art}</g>`;}
// Labels remain attached to the underlying connector, not to a fixed canvas coordinate.
function lineAnchorPosition(ref){
 if(!ref||!['relation','flow'].includes(ref.kind))return null;
 let d=null;
 if(ref.kind==='flow'){
  const f=model.flows.find(f=>f.id===ref.id);if(f)d=flowPath(f);
 }else{
  const [ia,ib]=String(ref.id).split('|'),a=space(ia),b=space(ib);
  if(a&&b)d=relPath(a,b,effectiveRelation(model.relations[ref.id]||{}));
 }
 if(!d)return null;
 const p=document.createElementNS(NS,'path');p.setAttribute('d',d);
 try{const len=p.getTotalLength();if(len>0){const q=p.getPointAtLength(clamp(num(ref.t,.5),0,1)*len);return{x:q.x,y:q.y}}}catch(e){}
 return null;
}
function notePosition(n){
 if(n.lineAnchor){const a=lineAnchorPosition(n.lineAnchor);if(a)return{x:a.x+num(n.lineAnchor.dx,0),y:a.y+num(n.lineAnchor.dy,0)}}
 return {x:num(n.x,400),y:num(n.y,300)};
}
function attachNote(n,choice){
 const prev=notePosition(n);n.x=prev.x;n.y=prev.y;n.attachedTo='';n.lineAnchor=null;
 if(choice.startsWith('bubble:')){n.attachedTo=choice.slice(7);return}
 if(choice.startsWith('flow:')||choice.startsWith('relation:')){
  const at=choice.indexOf(':'),kind=choice.slice(0,at),id=choice.slice(at+1);
  const anchor={kind,id,t:.5,dx:0,dy:-29},p=lineAnchorPosition(anchor);
  if(p){n.lineAnchor=anchor;n.x=p.x;n.y=p.y-29;}
 }
}
function noteAttachmentOptions(n){
 const active=n.lineAnchor?`${n.lineAnchor.kind}:${n.lineAnchor.id}`:n.attachedTo?`bubble:${n.attachedTo}`:'';
 const entries=[['','Independent / free text'],...model.spaces.map(s=>[`bubble:${s.id}`,`Bubble · ${s.name}`]),
 ...model.flows.map((f,i)=>[`flow:${f.id}`,`Line · ${f.label||LINE_PRESETS[f.preset]?.label||`Movement ${i+1}`}`]),
 ...Object.entries(model.relations).filter(([k,v])=>v.rating&&v.rating!=='U').map(([key,r])=>{
 const [a,b]=key.split('|');return [`relation:${key}`,`Adjacency ${r.rating} · ${space(a)?.name||a} ↔ ${space(b)?.name||b}`];
 })];
 return entries.map(([value,label])=>`<option value="${html(value)}" ${active===value?'selected':''}>${html(label)}</option>`).join('');
}
function addNoteOnSelectedLine(){
 if(selection.kind!=='flow'&&selection.kind!=='relation')return;
 const ref={kind:selection.kind,id:selection.id,t:.5,dx:0,dy:-29},p=lineAnchorPosition(ref);
 checkpoint();const n={id:uid(),text:'Line note',x:p?.x||view.x+view.w/2,y:(p?.y||view.y+view.h/2)-29,w:175,h:54,font:'Arial, sans-serif',fontSize:15,bold:false,italic:false,underline:false,strike:false,textColor:'#0D2F4F',highlight:'none',align:'center',fill:'#ffffff',fillMode:'none',stroke:'#7595a4',borderWidth:0,dash:'solid',opacity:1,angle:0,attachedTo:'',lineAnchor:ref};
 model.notes.push(n);selection={kind:'note',id:n.id};tool='select';commit();startNoteInline(n);
}
function noteRender(n,exporting=false){const sketch=model.theme==='sketch';const noteFont=sketch&&(!n.font||n.font==='Arial, sans-serif')?"'Bradley Hand','Chalkboard SE','Marker Felt','Comic Sans MS',cursive":(n.font||'Arial, sans-serif');const lines=String(n.text||'').split('\n').slice(0,14),sz=clamp(num(n.fontSize,17),8,84),w=Math.max(80,num(n.w,220)),h=Math.max(42,num(n.h,lines.length*sz*1.4+25)),align=n.align||'center';const tx=align==='left'?-w/2+10:align==='right'?w/2-10:0,anc=align==='left'?'start':align==='right'?'end':'middle';const dec=[n.underline?'underline':'',n.strike?'line-through':''].filter(Boolean).join(' ');const title=html(n.text||'Text note'),pos=notePosition(n),transparent=n.fillMode==='none'||n.fill==='none';return `<g class="note-display ${!exporting&&selection.kind==='note'&&selection.id===n.id?'selected':''}" data-note="${html(n.id)}" transform="translate(${pos.x},${pos.y}) rotate(${num(n.angle,0)})"><title>${title}</title><rect class="note-back" x="${-w/2}" y="${-h/2}" width="${w}" height="${h}" rx="4" fill="${transparent?'transparent':html(n.fill||'#fff')}" pointer-events="all" fill-opacity="${transparent?0:num(n.opacity,1)}" stroke="${sketch?'none':html(n.stroke||'#0D2F4F')}" stroke-width="${num(n.borderWidth,0)}" stroke-dasharray="${n.dash==='dashed'?'8 5':n.dash==='dotted'?'2 4':''}"/>${sketch&&num(n.borderWidth,0)>0?`<g pointer-events="none">${sketchStroke(`M${-w/2},${-h/2} H${w/2} V${h/2} H${-w/2} Z`,html(n.stroke||'#0D2F4F'),num(n.borderWidth,1.5),sketchSeed(n.id),n.dash==='dashed'?'8 5':n.dash==='dotted'?'2 4':'')}</g>`:''}<g pointer-events="none" font-family="${html(noteFont)}" font-size="${sz}" font-weight="${n.bold?'700':'400'}" font-style="${n.italic?'italic':'normal'}" text-decoration="${dec}" text-anchor="${anc}" fill="${html(n.textColor||'#0D2F4F')}">${lines.map((line,i)=>`<g transform="translate(${tx},${-h/2+18+i*sz*1.25})">${n.highlight&&n.highlight!=='none'?`<rect x="${align==='center'?-Math.min(w-15,line.length*sz*.54)/2:align==='right'?-Math.min(w-15,line.length*sz*.54):0}" y="${-sz*.88}" width="${Math.min(w-15,line.length*sz*.54)}" height="${sz*1.15}" rx="2" fill="${html(n.highlight)}"/>`:''}<text>${html(line)}</text></g>`).join('')}</g></g>`;}

function flowEndpoints(f){if(f.start&&f.end)return {p:f.start,q:f.end,free:true};const a=space(f.source),b=space(f.target);if(!a||!b)return null;const dx=b.x-a.x,dy=b.y-a.y,d=Math.max(.0001,Math.hypot(dx,dy)),u=dx/d,v=dy/d;return {p:{x:a.x+u*radius(a),y:a.y+v*radius(a)},q:{x:b.x-u*radius(b),y:b.y-v*radius(b)},free:false};}
function flowPath(f){const points=flowEndpoints(f);if(!points)return null;const {p,q}=points,dx=q.x-p.x,dy=q.y-p.y,d=Math.max(.0001,Math.hypot(dx,dy)),type=f.route||'curve';if(type==='straight')return `M${p.x} ${p.y} L${q.x} ${q.y}`;if(type==='elbow')return `M${p.x} ${p.y} L${(p.x+q.x)/2} ${p.y} L${(p.x+q.x)/2} ${q.y} L${q.x} ${q.y}`;if(type==='spline'){const bend=num(f.bend,60);return `M${p.x} ${p.y} C ${p.x+dx*.36-dy/d*bend} ${p.y+dy*.36+dx/d*bend} ${p.x+dx*.68-dy/d*bend} ${p.y+dy*.68+dx/d*bend} ${q.x} ${q.y}`;}return `M${p.x} ${p.y} Q${(p.x+q.x)/2-dy/d*45} ${(p.y+q.y)/2+dx/d*45} ${q.x} ${q.y}`;}
function marker(id){const defs={filled:'<path d="M0,0 L10,4.5 L0,9 Z" fill="context-stroke" />',open:'<path d="M0,0 L10,4.5 L0,9" fill="none" stroke="context-stroke" stroke-width="1.6"/>',chevron:'<path d="M0,0 L7,4.5 L0,9 L3,4.5 Z" fill="context-stroke"/>',double:'<path d="M0,0 L7,4.5 L0,9 L3,4.5 Z M5,0 L12,4.5 L5,9 L8,4.5 Z" fill="context-stroke"/>'};return `<marker id="${id}" markerWidth="12" markerHeight="12" refX="9" refY="4.5" orient="auto-start-reverse" markerUnits="userSpaceOnUse">${defs[id]}</marker>`}

// Evaluate a route into a polyline, using fixed subdivision for deterministic SVG export.
function graphicArrowPoints(f){const e=flowEndpoints(f);if(!e)return [];const {p,q}=e,dx=q.x-p.x,dy=q.y-p.y,d=Math.max(.001,Math.hypot(dx,dy)),kind=f.route||'straight';
if(kind==='straight')return [p,q];
if(kind==='elbow')return [p,{x:(p.x+q.x)/2,y:p.y},{x:(p.x+q.x)/2,y:q.y},q];
const a=[];for(let i=0;i<=64;i++){let t=i/64,x,y;if(kind==='spline'){const b=num(f.bend,60),c1={x:p.x+dx*.36-dy/d*b,y:p.y+dy*.36+dx/d*b},c2={x:p.x+dx*.68-dy/d*b,y:p.y+dy*.68+dx/d*b};x=(1-t)**3*p.x+3*(1-t)**2*t*c1.x+3*(1-t)*t*t*c2.x+t**3*q.x;y=(1-t)**3*p.y+3*(1-t)**2*t*c1.y+3*(1-t)*t*t*c2.y+t**3*q.y;}else{const c={x:(p.x+q.x)/2-dy/d*45,y:(p.y+q.y)/2+dx/d*45};x=(1-t)**2*p.x+2*(1-t)*t*c.x+t*t*q.x;y=(1-t)**2*p.y+2*(1-t)*t*c.y+t*t*q.y;}a.push({x,y})}return a;}
function arrowMetric(pts){const items=[{len:0,p:pts[0]}];let total=0;for(let i=1;i<pts.length;i++){const dd=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y);if(dd>1e-5){total+=dd;items.push({len:total,p:pts[i]})}}return {items,total};}
function sampleArrow(m,t){t=Math.min(m.total,Math.max(0,t));const a=m.items;for(let i=1;i<a.length;i++)if(a[i].len>=t){const prev=a[i-1],next=a[i],d=next.len-prev.len,z=(t-prev.len)/(d||1),u=(next.p.x-prev.p.x)/(d||1),v=(next.p.y-prev.p.y)/(d||1);return {x:prev.p.x+(next.p.x-prev.p.x)*z,y:prev.p.y+(next.p.y-prev.p.y)*z,u,v};}const p=a.at(-1),prev=a.at(-2)||p,d=Math.max(.001,p.len-prev.len);return {x:p.p.x,y:p.p.y,u:(p.p.x-prev.p.x)/d||1,v:(p.p.y-prev.p.y)/d||0};}
const xy=p=>`${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
function arrowPathBetween(m,from,to){from=Math.max(0,from);to=Math.min(m.total,to);if(to<=from)return '';let d=`M${xy(sampleArrow(m,from))}`;for(const a of m.items)if(a.len>from&&a.len<to)d+=` L${xy(a.p)}`;return d+` L${xy(sampleArrow(m,to))}`;}
function arrowV(m,at,reverse,size,wide,color,weight,typ){const q=sampleArrow(m,at),u=reverse?-q.u:q.u,v=reverse?-q.v:q.v;const left={x:q.x-u*size-v*wide,y:q.y-v*size+u*wide},right={x:q.x-u*size+v*wide,y:q.y-v*size-u*wide};const tip={x:q.x,y:q.y};if(typ==='filled')return `<path d="M${xy(left)} L${xy(tip)} L${xy(right)} Z" fill="${color}" stroke="${color}" stroke-width="${Math.max(1,weight*.7)}"/>`;
if(typ==='chevron')return `<path d="M${xy(left)} L${xy(tip)} L${xy(right)}" fill="none" stroke="${color}" stroke-width="${weight*1.55}" stroke-linejoin="round" stroke-linecap="round"/>`;
return `<path d="M${xy(left)} L${xy(tip)} L${xy(right)}" fill="none" stroke="${color}" stroke-width="${weight}" stroke-linejoin="round" stroke-linecap="round"/>`;}
// Arrowhead placement is a VISUAL property. It never reverses a semantic relationship.
// Left/right use the screen horizontal axis; near-vertical arrows use top/bottom.
// Legacy forward/reverse JSON values retain their original path-relative meaning.
function arrowHeadEnds(f,pts){const dir=f.direction||'forward';if(dir==='none'||f.head==='none')return {start:false,end:false};if(dir==='both')return {start:true,end:true};if(dir==='forward')return {start:false,end:true};if(dir==='reverse')return {start:true,end:false};const p=pts[0],q=pts[pts.length-1],dx=q.x-p.x,dy=q.y-p.y,startAtLeft=Math.abs(dx)>=Math.abs(dy)?dx>=0:dy>=0;return dir==='left'?{start:startAtLeft,end:!startAtLeft}:{start:!startAtLeft,end:startAtLeft};}
function displayedArrowDirection(f,pts){const dir=f.direction||'forward';if(dir==='left'||dir==='right'||dir==='none'||dir==='both')return dir;const p=pts?.[0],q=pts?.[pts.length-1];if(!p||!q)return dir==='reverse'?'left':'right';const dx=q.x-p.x,dy=q.y-p.y,startAtLeft=Math.abs(dx)>=Math.abs(dy)?dx>=0:dy>=0;return (dir==='forward')===(startAtLeft)?'right':'left';}
function arrowDirectionOptions(current){return [['left','← Left / up'],['right','Right / down →'],['both','↔ Both ends'],['none','— No arrowheads']].map(([value,label])=>`<option value="${value}" ${current===value?'selected':''}>${label}</option>`).join('');}
// Build a single continuous hollow silhouette, including an optional outlined head at either end.
function hollowArrowSVG(m,headStart,headEnd,width,headSize,color,line){const size=(headStart||headEnd)?Math.min(headSize,m.total*.27):0,start=headStart?size:0,end=m.total-(headEnd?size:0);if(end<=start+1)return `<path d="${arrowPathBetween(m,0,m.total)}" fill="none" stroke="${color}" stroke-width="${Math.max(1.5,line)}"/>`;
 const step=Math.max(2,Math.ceil((end-start)/7)),samples=[];for(let i=0;i<=step;i++)samples.push(sampleArrow(m,start+(end-start)*i/step));
 const L=p=>({x:p.x-p.v*width/2,y:p.y+p.u*width/2}),R=p=>({x:p.x+p.v*width/2,y:p.y-p.u*width/2}),H=Math.max(width*1.35,size*.65),a=samples[0],b=samples.at(-1);
 let d='M'+xy(L(a))+samples.slice(1).map(p=>' L'+xy(L(p))).join('');
 if(headEnd)d+=' L'+xy({x:b.x-b.v*H,y:b.y+b.u*H})+' L'+xy(sampleArrow(m,m.total))+' L'+xy({x:b.x+b.v*H,y:b.y-b.u*H});
 d+=samples.slice().reverse().map(p=>' L'+xy(R(p))).join('');
 if(headStart)d+=' L'+xy({x:a.x+a.v*H,y:a.y-a.u*H})+' L'+xy(sampleArrow(m,0))+' L'+xy({x:a.x-a.v*H,y:a.y+a.u*H});
 return `<path d="${d} Z" fill="none" stroke="${color}" stroke-width="${Math.max(1.6,line*.65)}" stroke-linecap="round" stroke-linejoin="round"/>`;}
function arrowSilhouette(m,from,to,width,headSize,headHalfWidth,tipEnd,backwards=false){const a=[];const steps=Math.max(2,Math.ceil((to-from)/7));for(let i=0;i<=steps;i++)a.push(sampleArrow(m,from+(to-from)*i/steps));const left=a.map(p=>({x:p.x-p.v*width/2,y:p.y+p.u*width/2})),right=a.map(p=>({x:p.x+p.v*width/2,y:p.y-p.u*width/2}));const tip=sampleArrow(m,tipEnd),q=a.at(-1),shoulderL={x:q.x-q.v*headHalfWidth,y:q.y+q.u*headHalfWidth},shoulderR={x:q.x+q.v*headHalfWidth,y:q.y-q.u*headHalfWidth};return `M${xy(left[0])} `+left.slice(1).map(p=>`L${xy(p)} `).join('')+`L${xy(shoulderL)} L${xy(tip)} L${xy(shoulderR)} `+right.reverse().map(p=>`L${xy(p)} `).join('')+'Z';}
function graphicArrowSVG(f){const pts=graphicArrowPoints(f);if(pts.length<2)return '';const m=arrowMetric(pts);if(m.total<2)return '';const style=f.graphicStyle||'classic',color=html(f.color||'#0d2f4f'),line=Math.max(1,Math.min(16,num(f.thickness,2.5))),width=Math.max(4,Math.min(38,num(f.bodyWidth,13))),headSize=Math.max(8,Math.min(60,num(f.headSize,26))),spacing=Math.max(10,Math.min(60,num(f.bandSpacing,22))),both=f.direction==='both',withHead=f.head!=='none',headType=f.head==='filled'?'filled':f.head==='chevron'?'chevron':'open';
const ends=arrowHeadEnds(f,pts),headStart=ends.start,headEnd=ends.end;const tipCut=withHead?Math.min(m.total*.3,headSize*.7):0,start=headStart?tipCut:0,end=m.total-(headEnd?tipCut:0);
if(style==='outline')return hollowArrowSVG(m,headStart,headEnd,width,headSize,color,line);
if(style==='banded'){
  const hs=withHead?Math.min(headSize,m.total*.28):0,first=headStart?hs:10,last=m.total-(headEnd?hs:0)-5;let pieces='';const barLength=Math.max(6,Math.min(15,spacing*.42));
  for(let at=first+barLength/2;at<last;at+=spacing){const p=sampleArrow(m,at),deg=Math.atan2(p.v,p.u)*180/Math.PI;pieces+=`<rect x="${(-barLength/2).toFixed(2)}" y="${(-width/2).toFixed(2)}" width="${barLength}" height="${width}" transform="translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${deg.toFixed(2)})" rx="1" fill="none" stroke="${color}" stroke-width="${Math.max(1.5,line*.75)}"/>`;}
  if(headEnd)pieces+=arrowV(m,m.total,false,hs,Math.max(width*.85,hs*.65),color,Math.max(2.5,line*1.35),headType);if(headStart)pieces+=arrowV(m,0,true,hs,Math.max(width*.85,hs*.65),color,Math.max(2.5,line*1.35),headType);
  return pieces;
}
let shaft=arrowPathBetween(m,start,end);const dash=style==='broken'||f.dash==='dashed'?`stroke-dasharray="${Math.max(9,spacing*.65)} ${Math.max(6,spacing*.37)}"`:f.dash==='dotted'?'stroke-dasharray="2 7"':f.dash==='short'?'stroke-dasharray="6 4"':'';
let result=`<path d="${shaft}" fill="none" stroke="${color}" stroke-width="${line}" ${dash} stroke-linecap="${style==='broken'?'butt':'round'}" stroke-linejoin="round"/>`;
if(headEnd)result+=arrowV(m,m.total,false,Math.min(headSize,m.total*.35),Math.max(7,headSize*.43),color,Math.max(2,line),headType);if(headStart)result+=arrowV(m,0,true,Math.min(headSize,m.total*.35),Math.max(7,headSize*.43),color,Math.max(2,line),headType);
return result;}

function relColor(rating){return rating==='X'?'#bc5060':rating==='A'?'#0d7475':rating==='E'?'#729e9f':'#9c8c63'}
function relPath(a,b,rel){const p={x:a.x,y:a.y},q={x:b.x,y:b.y};if(rel.route==='elbow')return `M${p.x},${p.y} H${(p.x+q.x)/2} V${q.y} H${q.x}`;if(rel.route==='curve'){const dx=q.x-p.x,dy=q.y-p.y,d=Math.max(1,Math.hypot(dx,dy)),bend=num(rel.bend,45);return `M${p.x},${p.y} Q${(p.x+q.x)/2-dy/d*bend},${(p.y+q.y)/2+dx/d*bend} ${q.x},${q.y}`;}return `M${p.x},${p.y} L${q.x},${q.y}`;}
// Anchor graphic arrows at the visible boundary of each circle/ellipse, not its center.
// Adjacency data remain symmetric and independent of visual arrow direction.
function relationAttachment(s,t){const dx=t.x-s.x,dy=t.y-s.y,d=Math.hypot(dx,dy);if(d<.001)return{x:s.x,y:s.y};const {rx,ry}=radii(s),rad=num(s.angle,0)*Math.PI/180,c=Math.cos(rad),sn=Math.sin(rad);const ux=dx/d,uy=dy/d,localX=ux*c+uy*sn,localY=-ux*sn+uy*c;const k=1/Math.sqrt(localX*localX/(rx*rx)+localY*localY/(ry*ry));const gap=2;return{x:s.x+ux*(k+gap),y:s.y+uy*(k+gap)};}
function relationArrowGraphic(a,b,rel){const direction=rel.direction||'forward';const f={start:relationAttachment(a,b),end:relationAttachment(b,a),route:rel.route||'straight',bend:num(rel.bend,45),graphicStyle:rel.graphicStyle||'open',color:rel.color||relColor(rel.rating||'A'),thickness:num(rel.thickness,rel.rating==='A'?3.5:rel.rating==='E'?2.3:1.5),head:rel.head||'open',headSize:num(rel.headSize,26),bodyWidth:num(rel.bodyWidth,13),bandSpacing:num(rel.bandSpacing,22),direction:direction,dash:rel.dash||'solid'};return graphicArrowSVG(f);}

/* DiagramIt v0.9.2: independent environmental graphics; never solar or meteorological calculations. */
const ENV_LIBRARY={
 sun:[['horizon','Horizon arc'],['seasons','Seasonal paths'],['dotted','Dotted trajectory'],['ribbon','Sunshine ribbon'],['halo','Radiant sweep'],['sketch','Hand-sketched arc']],
 wind:[['ribbons','Flowing ribbons'],['streams','Three streams'],['gust','Broken gust'],['wave','Wave currents'],['split','Branching breeze'],['band','Broad airflow']]
};
const envKinds=['sun','wind'];
function envItem(id){return (model.envGraphics||[]).find(g=>g.id===id);}
function envDefault(kind,style){const view0=model.view||{x:0,y:0,w:W,h:H};return {id:uid(),kind,style:style||ENV_LIBRARY[kind][0][0],x:view0.x+view0.w*(kind==='sun'?.30:.74),y:view0.y+view0.h*.28,scale:.85,angle:0,opacity:.95,color:kind==='sun'?'#E3A32E':'#468BAD',accent:kind==='sun'?'#FFC85A':'#93C6DC',curve:64,spacing:29,thickness:7,showLabel:false,layer:'front',strandOffsets:{}};}
function envNorm(g){const kind=g.kind==='wind'?'wind':'sun',styles=ENV_LIBRARY[kind].map(x=>x[0]);return {...envDefault(kind),...g,kind,style:styles.includes(g.style)?g.style:styles[0],x:num(g.x,560),y:num(g.y,250),scale:clamp(num(g.scale,1),.25,4),angle:num(g.angle,0),opacity:clamp(num(g.opacity,.95),.1,1),curve:clamp(num(g.curve,64),10,130),spacing:clamp(num(g.spacing,29),8,72),strandOffsets:Object.fromEntries(Object.entries(g.strandOffsets||{}).filter(([k,v])=>/^\d+$/.test(k)&&Number.isFinite(Number(v))).map(([k,v])=>[k,clamp(Number(v),-105,105)])),thickness:clamp(num(g.thickness,7),1,25),color:/^#[0-9a-f]{6}$/i.test(g.color||'')?g.color:kind==='sun'?'#E3A32E':'#468BAD',accent:/^#[0-9a-f]{6}$/i.test(g.accent||'')?g.accent:kind==='sun'?'#FFC85A':'#93C6DC',layer:g.layer==='back'?'back':'front',showLabel:!!g.showLabel};}
function envArrow(x,y,angle,color,size=11){return `<path d="M0 -${size} L${size*.68} ${size*.45} L0 ${size*.08} L-${size*.68} ${size*.45} Z" fill="${color}" transform="translate(${x} ${y}) rotate(${angle})"/>`;}
function envSunIcon(x,y,r,color){let marks='';for(let i=0;i<8;i++){let a=i*Math.PI/4;marks+=`<line x1="${(x+Math.cos(a)*(r+4)).toFixed(2)}" y1="${(y+Math.sin(a)*(r+4)).toFixed(2)}" x2="${(x+Math.cos(a)*(r+12)).toFixed(2)}" y2="${(y+Math.sin(a)*(r+12)).toFixed(2)}" stroke="${color}" stroke-width="2.1" stroke-linecap="round"/>`;}return `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" fill-opacity=".9"/>${marks}`;}
function envBaseArt(g,sketch=false){const c=html(g.color),a=html(g.accent),t=num(g.thickness,7),v=num(g.curve,64),sp=num(g.spacing,29);let out='';const strand=(i,base)=>base+num(g.strandOffsets?.[i],0);
  if(g.kind==='sun'){
    const arc=(dy=0,sw=t,dash='',color=c)=>`<path d="M-146 ${-9+dy} Q0 ${v+dy+34} 146 ${-9+dy}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" ${dash?`stroke-dasharray="${dash}"`:''}/>`;
    const sunY=v/2+12;
    switch(g.style){
      case 'seasons':out=arc(strand(0,-sp),3,'',a)+arc(strand(1,0),t,'',c)+arc(strand(2,sp),3,'',a)+envSunIcon(0,sunY,11,a)+`<circle cx="-146" cy="-9" r="6" fill="${a}"/><circle cx="146" cy="-9" r="6" fill="${a}"/>`;break;
      case 'dotted':out=arc(strand(0,0),t,`${t*2} ${t*1.7}`)+arc(strand(1,-sp),2,'3 12',a)+envSunIcon(0,sunY,10,a);break;
      case 'ribbon':out=`<path d="M-149 -13 Q0 ${v+36} 149 -13" fill="none" stroke="${a}" stroke-width="${t*2.8}" stroke-opacity=".35" stroke-linecap="round"/>`+arc(strand(0,0),t*1.6)+envArrow(143,-12,47,c,10)+envSunIcon(0,sunY,9,a);break;
      case 'halo':out=arc(strand(0,-sp/2),3,'',a)+arc(strand(1,sp/2),3,'',c)+arc(strand(2,0),t*.9)+`<path d="M-120 7 Q0 ${v+74} 120 7" fill="none" stroke="${a}" stroke-width="28" stroke-opacity=".18"/>`+envSunIcon(0,sunY,12,a);break;
      case 'sketch':out=arc(strand(0,0),t*.75)+`<path d="M-142 -11 Q-6 ${v+42} 147 -7" fill="none" stroke="${c}" stroke-width="1.5" opacity=".65"/>`+arc(-6,2,`7 5`,a)+envSunIcon(0,sunY,12,a);break;
      default:out=arc(strand(0,0),t*1.25)+envSunIcon(0,sunY,12,a)+`<circle cx="-146" cy="-9" r="7" fill="${a}"/><circle cx="146" cy="-9" r="7" fill="${a}"/>`+envArrow(143,-9,47,c,9);
    }
    if(g.showLabel)out+=`<text x="-148" y="-27" fill="${c}" font-size="12" font-weight="700">E</text><text x="142" y="-27" fill="${c}" font-size="12" font-weight="700">W</text>`;
  }else{
    const lift=(v-64)*.52;const flow=(offset=0,weight=t,dash='',color=c)=>`<path d="M-146 ${offset+44} C-85 ${offset+20+lift*.35} -99 ${offset-42-lift*.7} -30 ${offset-37-lift} S65 ${offset+20+lift*.25} 129 ${offset-22}" stroke="${color}" fill="none" stroke-width="${weight}" stroke-linecap="round" ${dash?`stroke-dasharray="${dash}"`:''}/>`;
    const arrow=(offset=0,color=c)=>envArrow(130,offset-22,43,color,11);
    switch(g.style){
      case 'streams':out=flow(strand(0,-sp),4,'',a)+flow(strand(1,0),t,'',c)+flow(strand(2,sp),4,'',a)+arrow(strand(0,-sp),a)+arrow(strand(1,0),c)+arrow(strand(2,sp),a);break;
      case 'gust':out=flow(strand(0,-sp*.6),t,`${t*3} ${t*1.5}`)+flow(strand(1,sp*.6),t*.75,`${t*1.5} ${t*2}`,a)+arrow(strand(0,-sp*.6))+arrow(strand(1,sp*.6),a);break;
      case 'wave':out=flow(strand(0,-sp),2.5,'',a)+flow(strand(1,0),t*.7)+flow(strand(2,sp),2.5,'',a)+arrow(strand(1,0));break;
      case 'split':out=flow(strand(0,0),t)+`<path d="M-30 7 C3 -45 74 -60 130 -67" fill="none" stroke="${a}" stroke-width="${t*.73}" stroke-linecap="round"/>`+arrow(0)+envArrow(130,-67,50,a,11);break;
      case 'band':out=flow(strand(0,0),t*3.8,'',a)+flow(strand(0,0),t*2,'',c)+flow(strand(1,sp),2,'',c)+arrow(strand(0,0));break;
      default:out=flow(strand(0,-sp),t*.8,'',a)+flow(strand(1,0),t*1.25,'',c)+flow(strand(2,sp),t*.8,'',a)+arrow(strand(0,-sp),a)+arrow(strand(1,0),c)+arrow(strand(2,sp),a);
    }
    if(g.showLabel)out+=`<text x="-146" y="-67" fill="${c}" font-size="12" font-weight="700">WIND FLOW</text>`;
  }
  // Sketch treatment perturbs only the visual strokes, never the object's transform/data.
  return sketch?`<g filter="url(#sketchWaver)">${out}</g><g opacity=".15" transform="translate(1.7 -1.3)">${out}</g>`:out;
}
/* Direct geometry editing uses the inverse SVG transform, so handles behave
   correctly after rotation and scaling. Strand offsets are graphic only. */
function envLocalPoint(g,p){const a=num(g.angle,0)*Math.PI/180,dx=p.x-g.x,dy=p.y-g.y,sc=Math.max(.1,num(g.scale,1));return {x:(dx*Math.cos(a)+dy*Math.sin(a))/sc,y:(-dx*Math.sin(a)+dy*Math.cos(a))/sc};}
function envBaseOffsets(g){const sp=num(g.spacing,29);
  if(g.kind==='sun')return ({seasons:[-sp,0,sp],dotted:[0,-sp],ribbon:[0],halo:[-sp/2,sp/2,0],sketch:[0],horizon:[0]})[g.style]||[0];
  return ({streams:[-sp,0,sp],gust:[-sp*.6,sp*.6],wave:[-sp,0,sp],split:[0],band:[0,sp],ribbons:[-sp,0,sp]})[g.style]||[-sp,0,sp];}
function envEditHandles(g){const offsets=envBaseOffsets(g),curve=num(g.curve,64),lift=(curve-64)*.52;
  let h=`<g class="env-control-handles">`;
  const control=(kind,x,y,label,fill='#ffffff')=>`<g data-env-handle="${kind}" style="cursor:move" aria-label="${label}"><circle cx="${x}" cy="${y}" r="11" fill="${fill}" stroke="#0D7475" stroke-width="2.2"/><circle cx="${x}" cy="${y}" r="3.2" fill="#0D7475"/><title>${label}</title></g>`;
  const yCurve=g.kind==='sun'?curve/2+12.5:-37-lift;
  h+=`<path d="M0 ${g.kind==='sun'?yCurve-24:yCurve-28} L0 ${yCurve-12}" stroke="#0D7475" stroke-width="1.8" stroke-dasharray="3 3" pointer-events="none"/>`;
  h+=control('curve',0,yCurve,g.kind==='sun'?'Drag to change sun arc depth':'Drag to change wind flow curvature','#d9ece9');
  offsets.forEach((base,i)=>{const offset=base+num(g.strandOffsets?.[i],0);const x=g.kind==='sun'?-73:-37;
    const y=g.kind==='sun'?( .75*(-9+offset)+.25*(curve+34+offset)):(-37-lift+offset);
    h+=control('strand:'+i,x,y,`Drag to reposition ${g.kind==='sun'?'arc':'stream'} ${i+1}`);});
  return h+'</g>';}
function environmentGraphicSVG(g,exporting=false){const sk=model.theme==='sketch',sel=selection.kind==='envGraphic'&&selection.id===g.id,sc=num(g.scale,1);let result=`<g data-env-graphic="${html(g.id)}" transform="translate(${g.x} ${g.y}) rotate(${g.angle}) scale(${sc})" style="cursor:grab" opacity="${g.opacity}">`;
  result+=g.kind==='sun'?`<path d="M-146 -9 Q0 ${g.curve+34} 146 -9" fill="none" stroke="transparent" stroke-width="34" pointer-events="stroke"/>`:`<path d="M-146 44 C-85 20 -99 -42 -30 -37 S65 20 129 -22" fill="none" stroke="transparent" stroke-width="65" pointer-events="stroke"/>`;
  result+=`<g pointer-events="none">${envBaseArt(g,sk)}</g>`;
  if(sel&&!exporting){result+=`<rect x="-163" y="-108" width="326" height="216" rx="8" fill="none" stroke="#0D7475" stroke-width="1.6" stroke-dasharray="5 4" pointer-events="none"/><circle data-env-handle="resize" cx="163" cy="108" r="9" fill="white" stroke="#0D7475" stroke-width="2.4" style="cursor:nwse-resize"/><line x1="0" y1="-108" x2="0" y2="-135" stroke="#0D7475" stroke-width="2" pointer-events="none"/><circle data-env-handle="rotate" cx="0" cy="-139" r="9" fill="white" stroke="#0D7475" stroke-width="2.4" style="cursor:crosshair"/>${envEditHandles(g)}`;}
  result+='</g>';return result;
}
function insertEnvGraphic(kind,style){if(!envKinds.includes(kind))return;const g=envDefault(kind,style);checkpoint();model.envGraphics||=[];model.envGraphics.push(g);selection={kind:'envGraphic',id:g.id};pane='canvas';model.generated=true;commit();showToast((kind==='sun'?'Sun path':'Wind flow')+' placed. Drag, rotate, or resize.');}
function envGallery(kind){if(!envKinds.includes(kind))return;let layer=document.createElement('div');layer.className='env-gallery-mask';layer.innerHTML=`<section class="env-gallery-dialog" role="dialog" aria-modal="true" aria-label="${kind==='sun'?'Sun path':'Wind flow'} styles"><div class="env-gallery-heading"><div><h2>${kind==='sun'?'Sun Path':'Wind Flow'} Graphics</h2><p>Purely conceptual · choose a symbol, then place and edit on the diagram</p></div><button type="button" id="envClose">✕</button></div><div class="env-gallery-grid">${ENV_LIBRARY[kind].map(([style,label])=>{const g={...envDefault(kind,style),id:'preview',x:0,y:0,scale:.63};return `<button type="button" data-env-insert="${kind}:${style}" class="env-choice"><svg viewBox="-168 -109 336 218" aria-hidden="true">${envBaseArt(g,false)}</svg><span>${label}</span></button>`}).join('')}</div></section>`;
 document.body.append(layer);layer.querySelector('#envClose').onclick=()=>layer.remove();layer.onclick=e=>{const b=e.target.closest('[data-env-insert]');if(b){const [k,s]=b.dataset.envInsert.split(':');layer.remove();insertEnvGraphic(k,s);}else if(e.target===layer)layer.remove();};layer.onkeydown=e=>{if(e.key==='Escape'){e.stopPropagation();layer.remove();}};layer.querySelector('#envClose').focus();}
function envInspector(){const g=envItem(selection.id);if(!g)return '';return `<div class="section-label">Graphic component</div><p class="note">Conceptual presentation only—no location, climate or solar calculations. Move on canvas. Drag the teal curve control to reshape the arc/flow, the white strand handles to reposition individual curves, the round upper handle to rotate, and the corner to scale.</p><div class="field"><label>Design</label><select data-env-prop="style">${ENV_LIBRARY[g.kind].map(([id,label])=>`<option value="${id}" ${g.style===id?'selected':''}>${label}</option>`).join('')}</select></div><div class="split"><div class="field"><label>X position</label><input data-env-prop="x" type="number" value="${Math.round(g.x)}"></div><div class="field"><label>Y position</label><input data-env-prop="y" type="number" value="${Math.round(g.y)}"></div></div><div class="split"><div class="field"><label>Scale</label><input data-env-prop="scale" type="number" min=".25" max="4" step=".05" value="${g.scale.toFixed(2)}"></div><div class="field"><label>Rotation (°)</label><input data-env-prop="angle" type="number" step="5" value="${Math.round(g.angle)}"></div></div><div class="split"><div class="field"><label>Main color</label><input data-env-prop="color" type="color" value="${g.color}"></div><div class="field"><label>Accent color</label><input data-env-prop="accent" type="color" value="${g.accent}"></div></div><div class="split"><div class="field"><label>Arc / flow curvature</label><input data-env-prop="curve" type="number" min="10" max="130" step="5" value="${g.curve}"></div><div class="field"><label>Strand spacing</label><input data-env-prop="spacing" type="number" min="8" max="72" step="2" value="${g.spacing}"></div></div><div class="split"><div class="field"><label>Stroke / ribbon weight</label><input data-env-prop="thickness" type="number" min="1" max="25" step="1" value="${g.thickness}"></div><div class="field"><label>Opacity</label><input data-env-prop="opacity" type="number" min=".1" max="1" step=".05" value="${g.opacity}"></div></div><div class="field row-inline"><input id="envShowLabels" data-env-prop="showLabel" type="checkbox" ${g.showLabel?'checked':''}><label for="envShowLabels">Show conceptual labels</label></div><div class="field"><label>Layer</label><select data-env-prop="layer"><option value="front" ${g.layer==='front'?'selected':''}>In front of bubbles</option><option value="back" ${g.layer==='back'?'selected':''}>Behind bubbles</option></select></div><div class="row"><button data-action="envResetStrands">Reset strand positions</button><button data-action="copyStyle">Format painter</button><button data-action="envDuplicate">Duplicate</button><button data-action="envDelete" class="close-edit">Delete</button></div>`;}

function svgMarkup(exporting=false){const sketch=model.theme==='sketch',bg=sketch?'#fbfaf5':'#f7f7f3';let out=`<defs><pattern id="dotgrid" width="23" height="23" patternUnits="userSpaceOnUse"><circle cx="12" cy="12" r=".95" fill="#cdd9da"/></pattern>${['filled','open','chevron','double'].map(marker).join('')}<filter id="sketchWaver" x="-12%" y="-30%" width="124%" height="160%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.027 0.041" numOctaves="2" seed="17" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="${sketch?2.4*sketchAmp():4.8}" xChannelSelector="R" yChannelSelector="G"/></filter></defs><rect width="${W}" height="${H}" fill="${bg}"/>`;
if(!exporting)out+=`<rect width="${W}" height="${H}" fill="url(#dotgrid)" opacity="${sketch?.32:1}" />`;
const u=model.underlay;if(u?.data&&safeUnderlayDataUrl(u.data)){const x=num(u.x,0),y=num(u.y,0),w=num(u.w,800),h=num(u.h,570);out+=`<image data-underlay="1" href="${u.data}" x="${x}" y="${y}" width="${w}" height="${h}" opacity="${num(u.opacity,.36)}" preserveAspectRatio="none" transform="rotate(${num(u.angle,0)} ${x+w/2} ${y+h/2})" />`}
for(const g of model.envGraphics||[])if(g.layer==='back')out+=environmentGraphicSVG(g,exporting);
if(model.showRelations){for(let i=0;i<model.spaces.length;i++)for(let j=i+1;j<model.spaces.length;j++){const a=model.spaces[i],b=model.spaces[j],key=relationKey(a.id,b.id),stored=model.relations[key]||{},rating=stored.rating||'U',rel=effectiveRelation(stored);if(!(rel.visible||(rating==='X'&&model.showAvoid)))continue;const selected=!exporting&&selection.kind==='relation'&&selection.id===key,stroke=rel.color||relColor(rating),w=num(rel.thickness,1.5),d=relPath(a,b,rel),dash=rel.dash||'solid',pat=dash==='dashed'?'8 6':dash==='dotted'?'2 6':'';out+=`<g data-relation="${html(key)}" style="cursor:pointer"><path d="${d}" fill="none" stroke="transparent" stroke-width="${Math.max(22,num(rel.bodyWidth,13)+16)}"/>${selected?`<path d="${d}" fill="none" stroke="#0D7475" stroke-width="${w+11}" opacity=".16" pointer-events="none"/>`:''}${rel.graphicStyle&&rel.graphicStyle!=='plain'?`<g pointer-events="none" opacity="${selected?1:.88}">${sketch?sketchArt(relationArrowGraphic(a,b,{...rel,rating})):relationArrowGraphic(a,b,{...rel,rating})}</g>`:sketch?`<g pointer-events="none">${sketchStroke(d,html(stroke),w,sketchSeed(key),pat)}</g>`:`<path d="${d}" fill="none" stroke="${html(stroke)}" stroke-width="${w}" stroke-dasharray="${pat}" stroke-linecap="round" opacity="${selected?1:.67}" pointer-events="none"/>`}</g>`;}}

for(const f of model.flows){const d=flowPath(f);if(!d)continue;const rawArt=(f.graphicStyle&&f.graphicStyle!=='classic')?graphicArrowSVG(f):null;const art=rawArt&&sketch?sketchArt(rawArt):rawArt;const isSelected=!exporting&&selection.kind==='flow'&&selection.id===f.id;const dash=f.dash==='dashed'?'12 7':f.dash==='dotted'?'2 6':f.dash==='short'?'5 3':'';out+=`<g data-flow="${html(f.id)}" style="cursor:pointer"><path d="${d}" fill="none" stroke="transparent" stroke-width="${Math.max(15,num(f.bodyWidth,13)+15)}"/>${isSelected?`<path d="${d}" fill="none" stroke="#0D7475" stroke-dasharray="5 4" opacity=".8" stroke-width="${Math.max(10,num(f.thickness,2.5)+7)}" pointer-events="none"/>`: ''}${art||(sketch?`<g pointer-events="none">${sketchStroke(d,html(f.color||'#0d2f4f'),num(f.thickness,2.5),sketchSeed(f.id),dash,(()=>{const heads=arrowHeadEnds(f,graphicArrowPoints(f));return f.head==='none'?'':`${heads.end?`marker-end="url(#${f.head})"`:''} ${heads.start?`marker-start="url(#${f.head})"`:''}`;})())}</g>`:`<path d="${d}" fill="none" stroke="${html(f.color||'#0d2f4f')}" stroke-width="${num(f.thickness,2.5)}" ${dash?`stroke-dasharray="${dash}"`:''} stroke-linecap="round" ${(()=>{const heads=arrowHeadEnds(f,graphicArrowPoints(f));return f.head==='none'?'':`${heads.end?`marker-end="url(#${f.head})"`:''} ${heads.start?`marker-start="url(#${f.head})"`:''}`;})()}/>`)}${f.label?`<rect x="${(flowEndpoints(f).p.x+flowEndpoints(f).q.x)/2-55}" y="${(flowEndpoints(f).p.y+flowEndpoints(f).q.y)/2-19}" width="110" height="23" rx="6" fill="#fff" opacity=".90"/><text x="${(flowEndpoints(f).p.x+flowEndpoints(f).q.x)/2}" y="${(flowEndpoints(f).p.y+flowEndpoints(f).q.y)/2-3}" text-anchor="middle" font-size="${sketch?15:12}" font-family="${sketch?"'Bradley Hand','Chalkboard SE',cursive":'Arial, sans-serif'}" font-weight="600" fill="${html(f.color||'#0d2f4f')}">${html(f.label)}</text>`:''}${!exporting&&selection.kind==='flow'&&selection.id===f.id&&f.start&&f.end?`<circle data-flow-handle="start" cx="${f.start.x}" cy="${f.start.y}" r="9" fill="#fff" stroke="#0D7475" stroke-width="2.5"/><circle data-flow-handle="end" cx="${f.end.x}" cy="${f.end.y}" r="9" fill="#fff" stroke="#0D7475" stroke-width="2.5"/>`:''}</g>`}
const ordered=[...model.spaces].sort((a,b)=>{const depth=s=>{let n=s,i=0;const seen=new Set();while(n?.parentId&&i<20&&!seen.has(n.parentId)){seen.add(n.parentId);n=space(n.parentId);i++}return i};return depth(a)-depth(b)});
for(const s of ordered){const z=getColor(s),active=(selection.kind==='space'&&selection.id===s.id)||(selection.kind==='multi'&&(selection.ids||[]).includes(s.id)),role=s.borderRole||'Support';out+=`<g data-space="${html(s.id)}" transform="translate(${s.x},${s.y})" style="cursor:grab">`;const p=outlinePath(s),fill=html(s.fill||z.fill),ink=html(s.stroke||z.stroke),w=num(s.strokeWidth,BORDER_ROLES[role]?.weight||2.2),dash=(s.strokeStyle||BORDER_ROLES[role]?.dash)==='dashed'?'9 5':(s.strokeStyle||BORDER_ROLES[role]?.dash)==='dotted'?'2 5':'';
if(sketch){const a=sketchPath(s,1),b=sketchPath(s,2),c=sketchPath(s,3);out+=`<path d="${a}" fill="${fill}" fill-opacity="${Math.min(.88,num(s.fillOpacity,.90)*.91)}" stroke="none"/><path d="${c}" fill="${fill}" fill-opacity=".12" stroke="none"/>${role==='Anchor'?`<path d="${b}" transform="scale(1.075)" fill="none" stroke="${ink}" stroke-width="1.2" opacity=".52"/>`:''}<path d="${a}" fill="none" stroke="${ink}" stroke-width="${Math.max(1.75,w*1.05)}" ${dash?`stroke-dasharray="${dash}"`:''} opacity=".91" stroke-linejoin="round" stroke-linecap="round"/><path d="${b}" fill="none" stroke="${ink}" stroke-width="${Math.max(.8,w*.47)}" ${dash?`stroke-dasharray="${dash}"`:''} opacity=".58" stroke-linecap="round"/><path d="${c}" fill="none" stroke="${ink}" stroke-width=".7" opacity=".24" stroke-linecap="round"/>${textSVG(s)}`;}
else{out+=`<path d="${p}" transform="${s.shape==='ellipse'?`rotate(${num(s.angle,0)})`:''}" fill="${fill}" fill-opacity="${num(s.fillOpacity,.90)}" stroke="${ink}" stroke-width="${w}" stroke-dasharray="${dash}"/>${role==='Anchor'?`<path d="${p}" transform="scale(1.07) ${s.shape==='ellipse'?`rotate(${num(s.angle,0)})`:''}" fill="none" stroke="${ink}" stroke-width="1.2" opacity=".85"/>`:''}${textSVG(s)}`;}if(active&&!exporting){const r=radius(s),{rx,ry}=radii(s);out+=`<circle r="${r*1.06}" fill="none" stroke="#0d7475" stroke-dasharray="5 4" stroke-width="1.6" pointer-events="none"/>${[[-1,-1],[1,-1],[-1,1],[1,1]].map(([xx,yy])=>`<rect class="bubble-resize handle" data-handle="resize" cx="${xx*rx*.78}" cy="${yy*ry*.78}" x="${xx*rx*.78-5}" y="${yy*ry*.78-5}" width="10" height="10"/>`).join('')}<circle class="bubble-rotate handle" data-handle="rotate" cx="0" cy="${-r-23}" r="7"/><path d="M0 ${-r} V${-r-17}" stroke="#0d7475" stroke-width="1.5" pointer-events="none"/>`;if(editOutline&&s.shape==='organic'){const pts=coords(s);pts.forEach((p,i)=>out+=`<circle class="handle vertex" data-handle="vertex" data-index="${i}" cx="${p.x}" cy="${p.y}" r="5.5"/>`)}}
out+='</g>'}
for(const n of model.notes||[])out+=noteRender(n,exporting);
for(const g of model.envGraphics||[])if(g.layer!=='back')out+=environmentGraphicSVG(g,exporting);

if(!exporting)out+=auditHighlights()+auditPlanGhosts();
return out;}

/* v0.9.5 — non-destructive Program ↔ Matrix ↔ Diagram reconciliation.
   Review bands are heuristics in the schematic drawing coordinate system.
   They cannot certify physical fit, building regulation, or actual adjacency. */
let auditOpen=false,auditFocus=null,auditPreview=null,auditFeedback="";
// Optional conflict analysis, never persisted to project JSON.
let auditPlanPreview=null,auditPlanMessage='';
function auditPlanOptions(){return {radius:s=>radius(s),width:W,height:H,maxPlanMoves:3,maxMove:65,collisionGap:-10,allowedWorsening:1.5,requiredImprovement:1.5,bands:{A:{max:45,weight:5},E:{max:105,weight:3},I:{max:190,weight:1.5},X:{min:95,weight:5}}};}
function exploreAuditPlan(){
 auditPlanPreview=null;auditPreview=null;auditPlanMessage='';
 if(!model.generated){auditPlanMessage='Generate a Bubble Diagram before requesting geometry-based alternatives.';renderAuditPanel();return;}
 if(model.spaces.length>160){auditPlanMessage='This optional three-move analysis is limited to 160 spaces per run. Existing review and manual refinement remain available for larger projects.';renderAuditPanel();return;}
 const opts=auditPlanOptions();
 try{
  const plan=ThinkItConstraints.proposePlan(model,opts);
  if(plan.initial.summary.errors){auditPlanMessage='Correct Space Program, hierarchy or relationship integrity errors before proposing moves.';}
  else if(!plan.steps.length){auditPlanMessage='No safe bounded alternative was found. Locked spaces, collisions or competing requirements may prevent improvements.';}
  else if(!(plan.final.summary.weightedPenalty < plan.initial.summary.weightedPenalty - .01)){auditPlanMessage='The analyzed alternative did not improve the overall schematic conflict score; nothing was proposed.';}
  else {auditPlanPreview={plan,fingerprint:ThinkItConstraints.signatureOf(model,opts),sourceState:JSON.stringify(model),options:opts};pane='canvas';auditFocus=null;auditPlanMessage='';}
 }catch(err){console.error('Constraint analysis rejected',err);auditPlanMessage='Could not analyze this project safely. Original diagram was not changed.';}
 render();renderAuditPanel();
}
function cancelAuditPlan(){auditPlanPreview=null;auditPlanMessage='Alternative canceled; your layout is unchanged.';renderCanvas();renderAuditPanel();}
function applyAuditPlan(){
 const preview=auditPlanPreview;if(!preview)return;
 const {plan,options,fingerprint}=preview;
 if(JSON.stringify(model)!==preview.sourceState||ThinkItConstraints.signatureOf(model,options)!==fingerprint){auditPlanPreview=null;auditPlanMessage='The diagram changed since preview. Explore alternatives again.';render();return;}
 if(!model.generated||plan.steps.length<1||plan.steps.length>3){auditPlanPreview=null;auditPlanMessage='Invalid or outdated alternative. No change made.';renderAuditPanel();return;}
 // Preflight ALL steps against the approved model. One checkpoint is created only
 // after every root, lock and target has passed validation.
 const used=new Set();let allowed=true;
 for(const step of plan.steps){const id=step.candidate?.root,s=space(id),delta=step.candidate?.delta;
  if(!s||used.has(id)||!reviewMovable(s)||!delta||!Number.isFinite(delta.x)||!Number.isFinite(delta.y)||Math.hypot(delta.x,delta.y)>65.001||!reviewCanShift(s,s.x+delta.x,s.y+delta.y)){allowed=false;break;}
  used.add(id);
 }
 // Current project must still match all predicted final space coordinates.
 if(allowed){const expected=ThinkItConstraints.locateBubbleData(plan.previewDocument).bubble;
  for(const s of model.spaces){const q=expected.spaces.find(v=>v.id===s.id);if(!q||!Number.isFinite(q.x)||!Number.isFinite(q.y)){allowed=false;break;}}
 }
 if(!allowed){auditPlanPreview=null;auditPlanMessage='A lock, boundary or geometry safeguard rejected the proposal. No changes were applied.';renderAuditPanel();return;}
 checkpoint();
 for(const step of plan.steps){const s=space(step.candidate.root),d=step.candidate.delta;moveWithChildren(s,s.x+d.x,s.y+d.y);}
 auditPlanPreview=null;auditPlanMessage=`Applied ${plan.steps.length} proposed movements in one undoable step. Review the arrangement or use Edit → Undo.`;
 commit();renderAuditPanel();
}
function auditPlanGhosts(){
 if(!auditOpen||pane!=='canvas'||!auditPlanPreview)return '';
 const expected=ThinkItConstraints.locateBubbleData(auditPlanPreview.plan.previewDocument).bubble;
 const original=new Map(model.spaces.map(s=>[s.id,s]));
 let out='<g data-review-plan-preview="true" pointer-events="none">';
 for(const s of expected.spaces){const p=original.get(s.id);if(!p||Math.hypot(p.x-s.x,p.y-s.y)<.1)continue;
  const r=radius(p);out+=`<path d="M${p.x} ${p.y} L${s.x} ${s.y}" fill="none" stroke="#0d7475" stroke-width="2.5" stroke-dasharray="7 5" opacity=".9"/><circle data-review-plan-ghost="${html(s.id)}" cx="${s.x}" cy="${s.y}" r="${r}" fill="#0d7475" fill-opacity=".06" stroke="#0d7475" stroke-width="2.3" stroke-dasharray="8 6"/>`;
 }
 return out+'</g>';
}

// Review filters live only in the editor UI, never in project JSON.
let auditFilter='all',auditQuery='',auditPage=0;
const AUDIT_PAGE_SIZE=25;
function auditPriority(x){
  if(x.category==='Program'||x.category==='Matrix')return 100000;
  if(x.category==='Diagram')return 4000+Math.min(1500,Math.max(0,-num(x.gap,0))*14);
  const weight={A:5,X:5,E:3,I:1.5}[x.rating]||1;
  const norm=(x.rating==='X'?95:x.rating==='A'?45:x.rating==='E'?105:190);
  return weight*1000*(1+Math.min(4,reviewError(x.rating,num(x.gap,0))/norm));
}
function auditType(x){return x.category==='Diagram'?'overlap':x.category==='Program'?'program':x.category==='Matrix'?'matrix':String(x.rating||'').toLowerCase();}
function auditRankedItems(r){
  const q=auditQuery.trim().toLocaleLowerCase();
  return [...r.problems,...r.unsatisfied].filter(x=>(auditFilter==='all'||auditType(x)===auditFilter)&&(!q||[x.message,x.detail,x.rating,...(x.ids||[])].join(' ').toLocaleLowerCase().includes(q)))
    .sort((a,b)=>auditPriority(b)-auditPriority(a)||String(a.message).localeCompare(String(b.message)));
}

const REVIEW_BANDS={A:{max:45},E:{max:105},I:{max:190},X:{min:95}};
function reviewRoot(id){let s=space(id),seen=new Set();while(s?.parentId&&space(s.parentId)&&!seen.has(s.id)){seen.add(s.id);s=space(s.parentId);}return s?.id||id;}
function reviewAncestor(a,b){let p=space(a)?.parentId,seen=new Set();while(p&&!seen.has(p)){if(p===b)return true;seen.add(p);p=space(p)?.parentId;}return false;}
function reviewGap(a,b){return Math.hypot(num(a.x)-num(b.x),num(a.y)-num(b.y))-(radius(a)+radius(b));}
function reviewAnalyze(){
  const problems=[],results=[],m=model,byId=new Map(m.spaces.map(s=>[s.id,s])),seen=new Set();
  const areasByParent=new Map(),childrenByParent=new Map();
  const radiusById=new Map(m.spaces.map(s=>[s.id,radius(s)]));
  const gapOf=(a,b)=>Math.hypot(num(a.x)-num(b.x),num(a.y)-num(b.y))-(radiusById.get(a.id)+radiusById.get(b.id));
  const indexById=new Map(m.spaces.map((s,i)=>[s.id,i]));
  for(const s of m.spaces){
    if(seen.has(s.id))problems.push({severity:'attention',category:'Program',message:`Duplicate space ID ${s.id}`,detail:'Multiple spaces share an identity; links may become ambiguous.',ids:[s.id]});
    seen.add(s.id);
    if(s.parentId&&!byId.has(s.parentId))problems.push({severity:'attention',category:'Program',message:`${s.name}: missing parent`,detail:'The parent reference no longer exists.',ids:[s.id]});
    if(!m.zones[s.zone])problems.push({severity:'attention',category:'Program',message:`${s.name}: unknown zone`,detail:`The zone “${s.zone}” is not in the current category library.`,ids:[s.id]});
    if(!Number.isFinite(+s.area)||+s.area<=0)problems.push({severity:'attention',category:'Program',message:`${s.name}: invalid area`,detail:'Target area must be positive.',ids:[s.id]});
    if(s.parentId&&reviewAncestor(s.parentId,s.id))problems.push({severity:'attention',category:'Program',message:`${s.name}: parent cycle`,detail:'Circular nesting is not valid.',ids:[s.id]});
    if(s.parentId){areasByParent.set(s.parentId,(areasByParent.get(s.parentId)||0)+num(s.area));childrenByParent.set(s.parentId,(childrenByParent.get(s.parentId)||0)+1);}
  }
  for(const parent of m.spaces)if(childrenByParent.has(parent.id)){
    const total=areasByParent.get(parent.id)||0;
    if(total>num(parent.area)*1.01)problems.push({severity:'attention',category:'Program',message:`${parent.name}: child areas exceed parent`,detail:`Direct children total ${total.toFixed(1)} m², compared with the parent’s ${num(parent.area).toFixed(1)} m². Verify whether spaces overlap or areas are gross/net.`,ids:[parent.id]});
  }
  // AEIOUX requirements are explicit matrix entries. Unassigned pairs remain U and
  // need not be enumerated to produce exactly the same findings.
  for(const [key,stored] of Object.entries(m.relations||{})){
    const ids=key.split('|'),a=byId.get(ids[0]),b=byId.get(ids[1]),rating=stored?.rating||'U';
    if(ids.length!==2||!a||!b||a.id===b.id){problems.push({severity:'attention',category:'Matrix',message:'Orphan / invalid adjacency reference',detail:`Relationship “${key}” points to missing or repeated spaces.`,ids:ids.filter(x=>byId.has(x))});continue;}
    if(!RATINGS[rating]){problems.push({severity:'attention',category:'Matrix',message:`Invalid rating for ${a.name} ↔ ${b.name}`,detail:`Rating “${rating}” is not an AEIOUX value.`,ids:[a.id,b.id],key});continue;}
    if(!REVIEW_BANDS[rating])continue;
    // Keep pair ordering compatible with the original full-matrix review.
    const first=(indexById.get(a.id)||0)<=(indexById.get(b.id)||0)?a:b,second=first===a?b:a;
    if(!m.generated){results.push({key,ids:[first.id,second.id],rating,severity:'info',category:'Relationship',message:`${first.name} ↔ ${second.name}`,detail:'The diagram has not yet been generated. Positions cannot be evaluated.',gap:null});continue;}
    if(reviewAncestor(first.id,second.id)||reviewAncestor(second.id,first.id)){
      results.push({key,ids:[first.id,second.id],rating,severity:'info',category:'Relationship',message:`${first.name} ↔ ${second.name}`,detail:'Parent/child containment relationship; proximity comparison not applicable.',gap:null});continue;
    }
    const gap=gapOf(first,second),band=REVIEW_BANDS[rating],attention=band.max!==undefined?gap>band.max:gap<band.min;
    results.push({key,ids:[first.id,second.id],rating,gap,severity:attention?'attention':'ok',category:'Relationship',message:`${first.name} ↔ ${second.name}`,detail:`Approximate edge gap ${Math.round(gap)} diagram units. ${rating==='X'?'Desirable separation':'Desired proximity'}; review band ${band.max!==undefined?'≤ '+band.max:'≥ '+band.min} units.${first.parentId!==second.parentId?' Different nesting groups: verify visually.':''}`,attention});
  }
  // Sweep nearby x-extents only. A far-away pair cannot physically overlap.
  // Group candidates by their direct parent to preserve the original sibling rule.
  if(m.generated){
    const groups=new Map();
    for(const s of m.spaces){const k=s.parentId||'';if(!groups.has(k))groups.set(k,[]);groups.get(k).push(s);}
    for(const group of groups.values()){
      const sorted=group.slice().sort((a,b)=>(num(a.x)-radiusById.get(a.id))-(num(b.x)-radiusById.get(b.id)));
      for(let i=0;i<sorted.length;i++){
        const a=sorted[i],ar=radiusById.get(a.id),right=num(a.x)+ar+10;
        for(let j=i+1;j<sorted.length;j++){
          const b=sorted[j],br=radiusById.get(b.id);
          if(num(b.x)-br>right)break;
          if(reviewAncestor(a.id,b.id)||reviewAncestor(b.id,a.id))continue;
          const gap=gapOf(a,b);if(gap < -10){
            const first=(indexById.get(a.id)||0)<(indexById.get(b.id)||0)?a:b,second=first===a?b:a;
            problems.push({severity:'attention',category:'Diagram',message:`Possible overlap: ${first.name} ↔ ${second.name}`,detail:`Approximate overlap ${Math.round(-gap)} units based on area-equivalent bubble radii. Irregular outlines may differ.`,ids:[first.id,second.id],key:relationKey(first.id,second.id),gap});
          }
        }
      }
    }
  }
  const unsatisfied=results.filter(r=>r.severity==='attention');
  return {problems,results,unsatisfied,summary:{spaces:m.spaces.length,requirements:results.length,attention:problems.length+unsatisfied.length,likely:results.filter(r=>r.severity==='ok').length,notEvaluated:results.filter(r=>r.severity==='info').length}};
}
function openAudit(){auditOpen=true;auditFocus=null;auditPreview=null;auditFeedback="";renderAuditPanel();}
function closeAudit(){auditOpen=false;auditFocus=null;auditPreview=null;auditPlanPreview=null;auditPlanMessage='';auditFeedback='';$('auditPanel').classList.add('hidden');if(pane==='canvas')renderCanvas();}
function locateAudit(ids){auditPlanPreview=null;if(!ids?.length)return;auditPreview=null;auditFocus=ids.filter(id=>!!space(id)).slice(0,2);pane='canvas';render();renderAuditPanel();}
function matrixAudit(key){auditPlanPreview=null;auditPreview=null;const ids=String(key).split('|'),a=model.spaces.findIndex(s=>s.id===ids[0]),bb=model.spaces.findIndex(s=>s.id===ids[1]);if(a>=0&&bb>=0)matrixPageToRow(Math.min(a,bb));pane='matrix';render();const t=[...document.querySelectorAll('[data-pair]')].find(e=>e.dataset.pair===key);if(t){t.scrollIntoView({block:'center',inline:'center'});t.style.outline='3px solid #d39732';t.style.outlineOffset='-2px';t.focus();}}

/* v0.9.9 Controlled issue repair: read-only previews, one bounded movement, one undo step.
   This only suggests movements for top-level spaces (never a locked descendant),
   and rejects suggestions worsening other visible relationships or adding overlaps.
   There is no general claim of code compliance or accurate spatial optimization. */
function reviewError(rating,gap){const band=REVIEW_BANDS[rating];if(!band)return 0;return band.max!==undefined?Math.max(0,gap-band.max):Math.max(0,band.min-gap);}
function reviewMovable(s){return !!s&&!s.pinned&&!s.parentId&&!descendantsOf(s.id).some(id=>space(id)?.pinned);}
function reviewCanShift(s,x,y){const dx=x-s.x,dy=y-s.y,group=[s,...descendantsOf(s.id).map(space).filter(Boolean)];return group.every(q=>{
   const nx=q.x+dx,ny=q.y+dy,r=radius(q);
   return Number.isFinite(nx)&&Number.isFinite(ny)&&nx-r>=12&&nx+r<=W-12&&ny-r>=12&&ny+r<=H-12;
 });}
function reviewProjectedGap(a,b,who,x,y){const ax=a.id===who.id?x:a.x,ay=a.id===who.id?y:a.y,bx=b.id===who.id?x:b.x,by=b.id===who.id?y:b.y;return Math.hypot(ax-bx,ay-by)-(radius(a)+radius(b));}
function reviewFindSuggestion(key,type){
  if(!model.generated)return {reason:'Generate the diagram before requesting a spatial adjustment.'};
  const ids=String(key||'').split('|'),a=space(ids[0]),b=space(ids[1]);
  if(!a||!b||a.id===b.id)return {reason:'The referenced pair is no longer valid.'};
  if(a.parentId||b.parentId||reviewAncestor(a.id,b.id)||reviewAncestor(b.id,a.id))return {reason:'Nested pairs need manual editing. The assistant will not move children out of containment.'};
  const rating=model.relations[relationKey(a.id,b.id)]?.rating||'U',beforeGap=reviewGap(a,b);
  const overlap=type==='overlap',oldError=overlap?Math.max(0,-10-beforeGap):reviewError(rating,beforeGap);
  if(oldError<2)return {reason:'The selected finding is no longer an active positioning issue.'};
  if(!overlap&&!REVIEW_BANDS[rating])return {reason:'Only A, E, I and X-rated pairs have positional review bands.'};
  const away=overlap||rating==='X';const top=model.spaces.filter(s=>!s.parentId);let best=null;
  // Sample modest lateral approaches in addition to the straight line.
  // This helps when a third bubble blocks a direct A/E or X adjustment.
  // All candidates are subject to the same strict conflict/overlap screening.
  const angularOffsets=[0,-15,15,-30,30,-45,45,-60,60,-75,75];
  for(const [who,other] of [[a,b],[b,a]]){
    if(!reviewMovable(who))continue;
    let ux=other.x-who.x,uy=other.y-who.y,len=Math.hypot(ux,uy);
    if(len<.001){ux=who.id===a.id?1:-1;uy=0;len=1;}
    ux/=len;uy/=len;if(away){ux=-ux;uy=-uy;}
    const targetStep=Math.min(65,Math.max(14,oldError));
    for(const angleDeg of angularOffsets){
      const th=angleDeg*Math.PI/180,c=Math.cos(th),sin=Math.sin(th);
      const vx=ux*c-uy*sin,vy=ux*sin+uy*c;
      for(const factor of [1,.75,.5,.25]){
        const dist=targetStep*factor,x=who.x+vx*dist,y=who.y+vy*dist;
        if(!reviewCanShift(who,x,y))continue;
        const newGap=reviewProjectedGap(a,b,who,x,y),newErr=overlap?Math.max(0,-10-newGap):reviewError(rating,newGap);
        if(newErr>=oldError-1.5)continue;
        // Fixing overlap must not create a new rated conflict for this same pair.
        if(overlap&&reviewError(rating,newGap)>reviewError(rating,beforeGap)+5)continue;
        let harm=0,valid=true;
        for(const otherTop of top){if(otherTop.id===who.id||otherTop.id===other.id)continue;
          const prev=reviewGap(who,otherTop),next=reviewProjectedGap(who,otherTop,who,x,y);
          if((prev>=-10&&next < -11)||(prev < -10&&next < prev-1.5)){valid=false;break;}
          const r=model.relations[relationKey(who.id,otherTop.id)]?.rating||'U';
          const e0=reviewError(r,prev),e1=reviewError(r,next);
          if((e0<1&&e1>7)||(e0>=1&&e1>e0+5)){valid=false;break;}
          harm+=Math.max(0,e1-e0);
        }
        if(!valid)continue;
        const improvement=oldError-newErr;
        // Prefer substantial progress and non-disruptive shorter/straighter moves.
        const score=improvement-harm*.85-dist*.015-Math.abs(angleDeg)*.001;
        if(score>0&&(!best||score>best.score))best={key:relationKey(a.id,b.id),type,whoId:who.id,from:{x:who.x,y:who.y},to:{x,y},score,oldError,newErr,beforeGap,newGap,rating,ids:[a.id,b.id],step:dist,angleDeg};
      }
    }
  }
  return best||{reason:'No safe automatic shift found. One or both bubbles may be locked, nested, near the canvas boundary, or constrained by other spaces. Use Locate to adjust manually.'};
}
function previewAudit(key,type){auditPlanPreview=null;
  auditFeedback='';const suggestion=reviewFindSuggestion(key,type);
  auditPreview=suggestion.whoId?suggestion:null;
  auditFocus=String(key).split('|').filter(id=>space(id)).slice(0,2);
  pane='canvas';render();
  if(!auditPreview){auditFeedback=suggestion.reason||'No proposed change.';renderAuditPanel();}
}
function cancelAuditPreview(){auditPreview=null;auditFeedback='Preview canceled; nothing was changed.';if(pane==='canvas')renderCanvas();renderAuditPanel();}
function applyAuditPreview(){
  const p=auditPreview;if(!p)return;
  const next=reviewFindSuggestion(p.key,p.type),s=space(p.whoId);
  // If the project has changed since preview, never apply a stale suggestion.
  if(!s||!reviewMovable(s)||Math.hypot(s.x-p.from.x,s.y-p.from.y)>.01 ||
     !reviewCanShift(s,p.to.x,p.to.y) ||
     reviewProjectedGap(space(p.ids[0]),space(p.ids[1]),s,p.to.x,p.to.y)>=p.beforeGap-.01 && p.rating!=='X'&&p.type!=='overlap'){
     auditPreview=null;auditFeedback='The diagram changed since preview. Choose Preview again.';render();return;
  }
  // Also invalidate if constraints have changed in the meantime.
  if(!next.whoId||next.whoId!==p.whoId||Math.hypot(next.to.x-p.to.x,next.to.y-p.to.y)>1){
    auditPreview=null;auditFeedback='Constraints changed; the suggestion was not applied. Preview again.';render();return;
  }
  checkpoint();moveWithChildren(s,p.to.x,p.to.y);auditPreview=null;
  auditFeedback=`Moved ${s.name} approximately ${Math.round(p.step)} diagram units. Review the remaining findings or use Edit → Undo to revert.`;
  commit();
}
function renderAuditPanel(){if(!auditOpen)return;const panel=$('auditPanel');if(!panel)return;
  const oldScroll=panel.querySelector('.review-body')?.scrollTop||0,r=reviewAnalyze();panel.classList.remove('hidden');
  const item=x=>`<div class="review-issue"><span class="review-severity ${x.severity==='ok'?'ok':x.severity==='info'?'info':''}">${x.severity==='ok'?'Likely aligned':x.severity==='info'?'Not evaluated':'Review'}</span><strong>${html(x.message)}</strong>${x.rating?` <span class="review-badge">${html(x.rating)}</span>`:''}<p>${html(x.detail)}</p><div class="review-actions">${x.ids?.length?`<button data-audit-locate="${html(x.ids.join('|'))}">Locate spaces</button>`:''}${x.key?`<button data-audit-matrix="${html(x.key)}">Open matrix rating</button>`:''}${x.key&&x.severity==='attention'&&(x.rating&&REVIEW_BANDS[x.rating]||x.category==='Diagram')?`<button class="review-preview-btn" data-audit-preview="${html(x.key)}" data-audit-type="${x.category==='Diagram'?'overlap':'relation'}">Preview adjustment</button>`:''}</div></div>`;
  const issues=auditRankedItems(r),fullCount=r.problems.length+r.unsatisfied.length,filtered=issues.length,pages=Math.max(1,Math.ceil(filtered/AUDIT_PAGE_SIZE));
  auditPage=clamp(auditPage,0,pages-1);
  const first=auditPage*AUDIT_PAGE_SIZE,last=Math.min(first+AUDIT_PAGE_SIZE,filtered);
  const groups=[['all','All findings'],['program','Program'],['matrix','Matrix'],['a','A priority'],['e','E proximity'],['i','I proximity'],['x','X separation'],['overlap','Overlaps']];
  const filterOptions=groups.map(([value,label])=>`<option value="${value}" ${auditFilter===value?'selected':''}>${label}</option>`).join('');
  const hotspots=new Map();
  for(const x of [...r.problems,...r.unsatisfied])if(x.severity==='attention'&&x.ids?.length){const weight=x.category==='Program'||x.category==='Matrix'?3:x.rating==='A'||x.rating==='X'?2:1;
    for(const id of new Set(x.ids)){if(!space(id))continue;const h=hotspots.get(id)||{id,count:0,score:0};h.count++;h.score+=weight;hotspots.set(id,h);}}
  const topHotspots=[...hotspots.values()].sort((a,b)=>b.score-a.score||b.count-a.count||a.id.localeCompare(b.id)).slice(0,5);
  panel.innerHTML=`<div class="review-panel-header"><div class="row" style="justify-content:space-between;align-items:center"><h2>Layout reconciliation</h2><button id="auditClose" aria-label="Close layout review" style="padding:3px 7px">✕</button></div><p>Space Program ↔ AEIOUX Matrix ↔ Bubble Diagram</p></div><div class="review-body">${auditPreview?`<div class="review-preview"><strong>Proposed adjustment · ${html(space(auditPreview.whoId)?.name||'Space')}</strong><p>Move ${Math.round(auditPreview.step)} drawing units${Math.abs(auditPreview.angleDeg||0)>1?` (angled ${Math.abs(auditPreview.angleDeg)}° around an obstruction)`:``}, from an estimated edge gap of ${Math.round(auditPreview.beforeGap)} to ${Math.round(auditPreview.newGap)}. The dashed preview shows the original and proposed position. No data has changed yet.</p><div class="row"><button class="primary" id="auditApply">Apply move</button><button id="auditCancel">Cancel</button></div></div>`:auditFeedback?`<div class="review-hint" role="status">${html(auditFeedback)}</div>`:''}<div class="review-kpis"><div class="review-kpi"><strong>${r.summary.spaces}</strong><small>Spaces</small></div><div class="review-kpi"><strong>${r.summary.requirements}</strong><small>A / E / I / X pairs</small></div><div class="review-kpi"><strong>${r.summary.attention}</strong><small>To review</small></div></div><div class="review-note">${!model.generated?'<strong>No diagram generated:</strong> positions are not evaluated yet. Create a diagram first.<br>':''}<strong>Visual screening, not spatial certification.</strong> Distances use area-equivalent bubble radii. Review bands are heuristic (A ≤45, E ≤105, I ≤190, X ≥95 drawing units). Priority ranking is only for review order; it does not establish compliance. No objects move unless you preview and apply.</div>${topHotspots.length?`<div class="review-hotspots"><strong>Most flagged spaces</strong><div class="review-hotspot-list">${topHotspots.map(h=>`<button data-audit-locate="${html(h.id)}" title="${html(h.count)} findings">${html(space(h.id)?.name||h.id)} · ${h.count}</button>`).join('')}</div></div>`:''}${auditPlanPreview?`<div class="review-preview" data-review-plan-card="true"><strong>Optional three-move alternative</strong><p>${auditPlanPreview.plan.steps.length} independently screened movements · weighted conceptual conflict score ${Math.round(auditPlanPreview.plan.initial.summary.weightedPenalty).toLocaleString()} → ${Math.round(auditPlanPreview.plan.final.summary.weightedPenalty).toLocaleString()}. Dashed teal ghosts show predicted positions. This is not proof of architectural feasibility.</p><div class="review-plan-steps">${auditPlanPreview.plan.steps.map((s,i)=>{const sp=space(s.candidate.root);return `<div class="review-plan-step"><strong>${i+1}. ${html(sp?.name||s.candidate.root)}</strong><span>${html(s.candidate.rating||s.candidate.issueType||'')}: ${Math.round(s.candidate.distance)} units${Math.abs(s.candidate.angle||0)>1?`, angled ${Math.abs(s.candidate.angle)}°`:''}</span></div>`}).join('')}</div><div class="row"><button class="primary" id="auditPlanApply" type="button">Apply proposed movements</button><button id="auditPlanCancel" type="button">Cancel</button></div></div>`:auditPlanMessage?`<div class="review-hint" role="status">${html(auditPlanMessage)}</div>`:''}<h3 class="review-section">Findings (${fullCount})</h3><div class="review-filter-controls"><label>Show <select id="auditFilter" aria-label="Filter review findings">${filterOptions}</select></label><label>Find <input id="auditQuery" aria-label="Search review findings" value="${html(auditQuery)}" placeholder="Space, rating, issue…"/></label></div><div class="review-filter-status" aria-live="polite">${filtered?`Showing ${first+1}–${last} of ${filtered} matching findings`:`No matching findings`} · highest review priority first</div>${filtered?issues.slice(first,last).map(item).join(''):'<div class="review-empty">No issues match this filter. Try All findings.</div>'}<div class="review-pages"><button id="auditPrev" ${auditPage===0?'disabled':''}>← Previous</button><span>Page ${auditPage+1} of ${pages}</span><button id="auditNext" ${auditPage>=pages-1?'disabled':''}>Next →</button></div>${auditFilter==='all'&&!auditQuery.trim()?`<h3 class="review-section">Indicative aligned pairs (${r.summary.likely})</h3>${r.results.filter(x=>x.severity==='ok').slice(0,10).map(item).join('')||'<p class="review-note">No A/E/I/X pairs fall inside their indicative review bands yet.</p>'}`:''}${r.summary.notEvaluated?`<p class="review-note">${r.summary.notEvaluated} relations are not spatially evaluated.</p>`:''}</div><div class="review-footer"><button id="auditExplorePlan" type="button" title="Explore up to three small, non-destructive alternative moves">Explore alternatives</button><button id="auditRefresh">Refresh</button><button id="auditCSV">Export CSV</button><button id="auditDone" class="primary">Done</button></div>`;
  panel.querySelector('#auditClose').onclick=closeAudit;panel.querySelector('#auditDone').onclick=closeAudit;panel.querySelector('#auditRefresh').onclick=renderAuditPanel;
  if(panel.querySelector('.review-body'))panel.querySelector('.review-body').scrollTop=oldScroll;
  panel.querySelector('#auditCSV').onclick=exportAuditCSV;
  panel.querySelector('#auditExplorePlan').onclick=exploreAuditPlan;
  if(panel.querySelector('#auditPlanApply'))panel.querySelector('#auditPlanApply').onclick=applyAuditPlan;
  if(panel.querySelector('#auditPlanCancel'))panel.querySelector('#auditPlanCancel').onclick=cancelAuditPlan;
  if(panel.querySelector('#auditApply'))panel.querySelector('#auditApply').onclick=applyAuditPreview;
  if(panel.querySelector('#auditCancel'))panel.querySelector('#auditCancel').onclick=cancelAuditPreview;
  panel.querySelector('#auditFilter').onchange=e=>{auditFilter=e.target.value;auditPage=0;renderAuditPanel();};
  panel.querySelector('#auditQuery').oninput=e=>{auditQuery=e.target.value;const caret=e.target.selectionStart;auditPage=0;renderAuditPanel();const target=panel.querySelector('#auditQuery');target.focus();target.setSelectionRange(caret,caret);};
  panel.querySelector('#auditPrev').onclick=()=>{auditPage=Math.max(0,auditPage-1);renderAuditPanel();panel.querySelector('.review-body').scrollTop=0;};
  panel.querySelector('#auditNext').onclick=()=>{auditPage=Math.min(pages-1,auditPage+1);renderAuditPanel();panel.querySelector('.review-body').scrollTop=0;};
  panel.querySelectorAll('[data-audit-preview]').forEach(btn=>btn.onclick=()=>previewAudit(btn.dataset.auditPreview,btn.dataset.auditType));
  panel.querySelectorAll('[data-audit-locate]').forEach(btn=>btn.onclick=()=>locateAudit(btn.dataset.auditLocate.split('|')));
  panel.querySelectorAll('[data-audit-matrix]').forEach(btn=>btn.onclick=()=>matrixAudit(btn.dataset.auditMatrix));
}
function exportAuditCSV(){const r=reviewAnalyze(),lines=[['category','severity','rating','space_or_pair','approx_edge_gap','detail'],...r.problems.map(x=>[x.category,x.severity,'',x.message,'',x.detail]),...r.results.map(x=>[x.category,x.severity,x.rating,x.message,x.gap===null?'':Math.round(x.gap),x.detail])];const csv=lines.map(row=>row.map(x=>'"'+String(x??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');download('ThinkIt_Bubble_Layout_Review.csv',csv,'text/csv;charset=utf-8');}
function auditHighlights(){if(!auditOpen||!auditFocus?.length||pane!=='canvas')return '';const a=space(auditFocus[0]),b=space(auditFocus[1]);if(!a)return '';let out=`<g pointer-events="none"><circle cx="${a.x}" cy="${a.y}" r="${radius(a)+12}" fill="none" stroke="#d18627" stroke-width="5" stroke-dasharray="11 6"/>`;if(b){out+=`<circle cx="${b.x}" cy="${b.y}" r="${radius(b)+12}" fill="none" stroke="#d18627" stroke-width="5" stroke-dasharray="11 6"/><path d="M${a.x} ${a.y} L${b.x} ${b.y}" stroke="#c86d39" stroke-width="3" stroke-dasharray="12 7"/>`;}
 if(auditPreview){const p=auditPreview,s=space(p.whoId);if(s){const r=radius(s);out+=`<path data-review-preview-line="true" d="M${p.from.x} ${p.from.y} L${p.to.x} ${p.to.y}" fill="none" stroke="#0d7475" stroke-width="3" stroke-dasharray="6 5"/><circle data-review-preview-ghost="true" cx="${p.to.x}" cy="${p.to.y}" r="${r}" fill="#0d7475" fill-opacity=".08" stroke="#0d7475" stroke-width="3" stroke-dasharray="9 5"/><circle cx="${p.to.x}" cy="${p.to.y}" r="5" fill="#0d7475"/>`;}}
 return out+'</g>';}

function renderCanvas(){const svg=$('diagram');view=model.view||{x:0,y:0,w:W,h:H};svg.setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);svg.innerHTML=svgMarkup(false);$('themeSelect').value=model.theme;$('sketchIntensityWrap').classList.toggle('hidden',model.theme!=='sketch');$('sketchIntensity').value=String(clamp(num(model.sketchStrength,2),1,3));svg.classList.toggle('sketch-mode',model.theme==='sketch');$('showAreasToggle').checked=!!model.showAreas;$('bubbleScaleRange').value=model.bubbleScale;$('sizingMode').value=model.sizingMode||'area';$('semanticArrowPreset').value=model.selectedLinePreset||'primary';$('graphicArrowStyle').value=model.selectedArrowStyle||'open';$('statusSummary').textContent=`${model.spaces.length} spaces · ${model.flows.length} movement arrows · ${model.spaces.reduce((t,s)=>t+s.area,0).toLocaleString()} m² programmed`;$('arrowToolBtn').classList.toggle('primary',tool==='arrow');$('selectToolBtn').classList.toggle('primary',tool==='select');$('paintBtn').classList.toggle('primary',!!paintSource);svg.classList.toggle('paint-mode',!!paintSource);}
function renderProgram(){const p=KDG_ZONE_PROFILES[model.zoneTemplate];$('zoneTemplateNotice').innerHTML=p?`<strong>${html(p.name)}</strong> · ${Object.keys(model.zones).length} KDG zones loaded (no rooms preloaded)`:`<strong>Custom categories</strong> · ${Object.keys(model.zones).length} available`;const rows=$('programRows');rows.innerHTML=model.spaces.map((s,i)=>`<tr><td><strong>${i+1}</strong></td><td class="program-name"><input aria-label="Space name" data-name="${s.id}" value="${html(s.name)}" /></td><td><input type="number" min="1" step="0.1" aria-label="Area" data-area="${s.id}" value="${s.area}" /></td><td><select data-zone="${s.id}">${Object.keys(model.zones).map(z=>`<option ${s.zone===z?'selected':''}>${html(z)}</option>`).join('')}</select></td><td><select data-parent="${s.id}"><option value="">— Separate space —</option>${model.spaces.filter(p=>p.id!==s.id&&safeParent(s.id,p.id)).map(p=>`<option value="${p.id}" ${s.parentId===p.id?'selected':''}>${html(p.name)}</option>`).join('')}</select></td><td><select data-shape="${s.id}">${['circle','ellipse','organic'].map(z=>`<option value="${z}" ${s.shape===z?'selected':''}>${z==='organic'?'Organic blob':z[0].toUpperCase()+z.slice(1)}</option>`).join('')}</select></td><td><button data-remove="${s.id}" class="close-edit">Delete</button></td></tr>`).join('');$('programEmpty').classList.toggle('hidden',!!model.spaces.length);$('programTableFrame').classList.toggle('hidden',!model.spaces.length);}
/* ThinkIt v0.9.15: window only matrix rows for larger space programs.
   ALL column cells and ALL pair ratings remain in memory and JSON; paging is UI-only.
   The lower-triangle cells remain read-only mirrors of the upper-triangle selects. */
const MATRIX_ROW_LIMIT=16;
const MATRIX_WINDOW_THRESHOLD=64;
let matrixRowStart=0;
function matrixPageToRow(index){const n=model.spaces.length;if(n<=MATRIX_WINDOW_THRESHOLD){matrixRowStart=0;return;}const row=clamp(Math.floor(num(index,0)),0,Math.max(0,n-1));matrixRowStart=Math.floor(row/MATRIX_ROW_LIMIT)*MATRIX_ROW_LIMIT;}
function renderMatrix(){
 $('generateMatrixBtn').textContent=model.generated?'Refine existing arrangement →':'Generate bubble diagram →';
 const n=model.spaces.length, windowed=n>MATRIX_WINDOW_THRESHOLD;
 if(!windowed)matrixRowStart=0;else if(matrixRowStart>=n)matrixRowStart=Math.max(0,Math.floor((n-1)/MATRIX_ROW_LIMIT)*MATRIX_ROW_LIMIT);
 const first=windowed?matrixRowStart:0, last=windowed?Math.min(first+MATRIX_ROW_LIMIT,n):n;
 $('matrixEmpty').classList.toggle('hidden',!!n);$('matrixTableFrame').classList.toggle('hidden',!n);
 $('matrixNavigator').classList.toggle('hidden',!windowed);
 if(windowed){$('matrixRangeText').textContent=`Showing rows ${first+1}–${last} of ${n}`;
   $('matrixPrevRows').disabled=first===0;$('matrixNextRows').disabled=last>=n;
   $('matrixJumpRow').max=String(n);$('matrixJumpRow').value=String(first+1);
 }
 const head=$('matrixHead'),body=$('matrixBody');const mode=model.matrixHeaderMode||'names';
 $('matrixHeaderMode').value=mode;$('matrixTableFrame').querySelector('table').className='matrix-table header-'+mode;
 head.innerHTML=`<tr><th class="matrix-space">Space / Activity</th>${model.spaces.map((s,i)=>`<th class="matrix-col" title="${html(s.name)}">${mode==='numbers'?i+1:mode==='abbrev'?html(s.name.length>17?s.name.slice(0,16)+'…':s.name):html(s.name)}${mode==='numbers'?'':`<span class="matrix-header-hint">${i+1}</span>`}</th>`).join('')}</tr>`;
 const pairs=model.relations;
 body.innerHTML=model.spaces.slice(first,last).map((s,offset)=>{
   const i=first+offset;
   return `<tr><td class="matrix-space" title="${html(s.name)}"><strong>${i+1}.</strong> ${html(s.name)}</td>${model.spaces.map((t,j)=>{
     if(i===j)return '<td class="rating-cell rate-na">—</td>';
     const key=relationKey(s.id,t.id),r=pairs[key]?.rating||'U';
     return i>j?`<td class="rating-cell rate-${r}" data-mirror-pair="${html(key)}" data-mirror-from="${html(s.id)}" data-mirror-to="${html(t.id)}" aria-label="${html(s.name)} versus ${html(t.name)}: ${r} (read-only mirror)" title="${html(t.name)}: ${r}">${r}</td>`:`<td class="rating-cell"><select aria-label="${html(s.name)} versus ${html(t.name)}" class="rate-${r}" data-pair="${html(key)}">${Object.keys(RATINGS).map(v=>`<option value="${v}" ${r===v?'selected':''}>${v}</option>`).join('')}</select></td>`;
   }).join('')}</tr>`;
 }).join('');
}
function safeParent(targetId,pid){if(!pid)return true;if(pid===targetId)return false;let cur=space(pid),seen=new Set();while(cur?.parentId&&!seen.has(cur.id)){if(cur.parentId===targetId)return false;seen.add(cur.id);cur=space(cur.parentId)}return true}
function optionsZones(active){return Object.keys(model.zones).map(z=>`<option value="${html(z)}" ${active===z?'selected':''}>${html(z)}</option>`).join('')}
function chooseParent(s){return `<option value="">Independent / no parent</option>`+model.spaces.filter(t=>t.id!==s.id&&safeParent(s.id,t.id)).map(t=>`<option value="${t.id}" ${s.parentId===t.id?'selected':''}>${html(t.name)}</option>`).join('')}
function renderInspector(){const el=$('inspectorBody'),h=$('inspectorHeading');const s=selection.kind==='space'?space(selection.id):null,f=selection.kind==='flow'?model.flows.find(f=>f.id===selection.id):null;
 if(selection.kind==='envGraphic'){const g=envItem(selection.id);if(g){h.textContent=g.kind==='sun'?'Sun path illustration':'Wind flow illustration';el.innerHTML=envInspector();return;}}
 if(selection.kind==='relation'){const rel=effectiveRelation(model.relations[selection.id]||{}),[idA,idB]=selection.id.split('|'),a=space(idA),b=space(idB),styled=!!(rel.graphicStyle&&rel.graphicStyle!=='plain');h.textContent='Selected connector';el.innerHTML=`<p class="note"><strong>${html(a?.name||idA)} ↔ ${html(b?.name||idB)}</strong><br>This link is an adjacency-matrix relationship. Choosing a graphic arrow changes its appearance only—it does not turn proximity into circulation.</p><div class="field"><label>Closeness rating (updates matrix)</label><select data-relation-property="rating">${Object.entries(RATINGS).map(([k,v])=>`<option value="${k}" ${k===(rel.rating||'U')?'selected':''}>${k} · ${v.desc}</option>`).join('')}</select></div><button data-action="addLineNote" class="full">＋ Attach text note to this line</button><div class="section-label">Arrow appearance · select a visual style</div>${arrowGallery(rel,true)}<div class="field"><label>Graphic arrow style</label><select data-relation-property="graphicStyle"><option value="plain" ${!styled?'selected':''}>Plain / undirected (default)</option>${ARROW_STYLE_KEYS.filter(k=>k!=='classic').map(k=>`<option value="${k}" ${rel.graphicStyle===k?'selected':''}>${GRAPHIC_ARROW_STYLES[k].label}</option>`).join('')}</select></div>${styled?`<div class="split"><div class="field"><label>Arrowhead points toward</label><select data-relation-property="direction">${arrowDirectionOptions(displayedArrowDirection(rel,[a||{x:0,y:0},b||{x:100,y:0}]))}</select></div><div class="field"><label>Arrowhead</label><select data-relation-property="head">${['open','filled','chevron','none'].map(v=>`<option ${v===(rel.head||'open')?'selected':''}>${v}</option>`).join('')}</select></div></div><div class="split"><p class="small">Left / right refers to screen position; for steep connectors it means upper / lower. Moving bubbles updates the visual side automatically.</p><div class="field"><label>Head length</label><input type="number" min="8" max="60" data-relation-property="headSize" value="${num(rel.headSize,26)}"></div><div class="field"><label>Shaft / band width</label><input type="number" min="4" max="38" data-relation-property="bodyWidth" value="${num(rel.bodyWidth,13)}"></div></div><div class="field"><label>Dash / band spacing</label><input type="number" min="10" max="60" data-relation-property="bandSpacing" value="${num(rel.bandSpacing,22)}"></div>`:''}<div class="split"><div class="field"><label>Line color</label><input type="color" data-relation-property="color" value="${html(rel.color||relColor(rel.rating||'A'))}"></div><div class="field"><label>Thickness</label><input type="number" min=".5" max="12" step=".5" data-relation-property="thickness" value="${num(rel.thickness,2.5)}"></div></div><div class="split"><div class="field"><label>Line pattern</label><select data-relation-property="dash">${['solid','dashed','dotted'].map(v=>`<option ${rel.dash===v?'selected':''}>${v}</option>`).join('')}</select></div><div class="field"><label>Route</label><select data-relation-property="route">${['straight','elbow','curve','spline'].map(v=>`<option ${rel.route===v?'selected':''}>${v}</option>`).join('')}</select></div></div><div class="field"><label>Curve / spline offset</label><input type="range" min="-180" max="180" step="5" data-relation-property="bend" value="${num(rel.bend,45)}"></div><div class="section-label">Reuse this line formatting</div><div class="row"><button data-action="copyLineStyle" class="primary" title="Copy visual style only; do not copy AEIOUX rating">◈ Format painter</button><button data-action="setRatingDefault" title="Make this style the default for every uncustomized connector with the same rating">Set as ${html(rel.rating||'U')} default</button></div><div class="row"><button data-action="ratingStyleManager">Edit A–X defaults…</button><button data-action="clearRelationStyle">Reset to rating default</button></div><p class="small">Style and AEIOUX rating remain independent. The default updates other uncustomized lines; customized ones retain their overrides.</p>`;return;}
if(selection.kind==='multi'){const ids=selection.ids||[],items=ids.map(space).filter(Boolean);h.textContent=items.length+' bubbles selected';el.innerHTML=`<p class="note">Change a property to apply it to all ${items.length} selected bubbles. Shift-click or Command-click to add/remove bubbles; Shift-drag empty canvas to marquee-select. Drag any selected bubble to move the group. Locked bubbles block group movement.</p><div class="section-label">Quick border roles</div>${styleRoles(items.every(x=>x.borderRole===items[0]?.borderRole)?items[0]?.borderRole:'')}<div class="split"><div class="field"><label>Fill color</label><input type="color" data-multi-property="fill" value="${html(items[0]?.fill||getColor(items[0]).fill)}"></div><div class="field"><label>Border color</label><input type="color" data-multi-property="stroke" value="${html(items[0]?.stroke||getColor(items[0]).stroke)}"></div></div><div class="split"><div class="field"><label>Border weight</label><input type="number" min="0" max="16" step=".5" data-multi-property="strokeWidth" value="${num(items[0]?.strokeWidth,2.2)}"></div><div class="field"><label>Outline type</label><select data-multi-property="strokeStyle"><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option></select></div></div><div class="field"><label>Functional zone</label><select data-multi-property="zone">${optionsZones(items[0]?.zone)}</select></div>${labelControlUI(items[0],"multiProperty")}<div class="section-label">Object management</div><div class="row"><button data-action="lockSelected">Lock selected</button><button data-action="unlockSelected">Unlock selected</button></div><p class="small">Shift + arrow nudges the selection by 12 diagram units. Dragging moves nested groups once and keeps attached notes with their spaces.</p><div class="row"><button data-action="delete" class="close-edit">Delete selected</button></div>`;return}
if(selection.kind==='note'){const n=(model.notes||[]).find(x=>x.id===selection.id);if(n){h.textContent='Text note';el.innerHTML=`<div class="field"><label>Text (double-click note to edit in place)</label><textarea rows="4" data-note-property="text">${html(n.text)}</textarea></div><div class="section-label">Text formatting</div><div class="split"><div class="field"><label>Font</label><select data-note-property="font">${['Arial, sans-serif','Georgia, serif','Helvetica, sans-serif','Courier New, monospace'].map(v=>`<option ${n.font===v?'selected':''} value="${v}">${v.split(',')[0]}</option>`).join('')}</select></div><div class="field"><label>Font size</label><input type="number" min="8" max="84" data-note-property="fontSize" value="${n.fontSize||17}"></div></div><div class="note-actions">${[['bold','B'],['italic','I'],['underline','U'],['strike','S']].map(([k,t])=>`<button data-note-toggle="${k}" class="${n[k]?'primary':''}" title="${k}">${t}</button>`).join('')}</div><div class="split"><div class="field"><label>Text color</label><input type="color" data-note-property="textColor" value="${n.textColor||'#0D2F4F'}"></div><div class="field"><label>Text highlight</label><input type="color" data-note-property="highlight" value="${n.highlight&&n.highlight!=='none'?n.highlight:'#fff1a4'}"></div></div><div class="field"><label>Alignment</label><select data-note-property="align">${['left','center','right'].map(v=>`<option ${n.align===v?'selected':''}>${v}</option>`).join('')}</select></div><div class="section-label">Text box appearance</div><div class="field"><label>Background fill</label><select data-note-property="fillMode"><option value="none" ${n.fillMode==='none'?'selected':''}>No fill · transparent</option><option value="solid" ${n.fillMode!=='none'?'selected':''}>Solid fill</option></select></div><div class="split"><div class="field"><label>Fill color</label><input type="color" data-note-property="fill" value="${n.fill||'#ffffff'}" ${n.fillMode==='none'?'disabled':''}></div><div class="field"><label>Border</label><input type="color" data-note-property="stroke" value="${n.stroke||'#7595a4'}"></div></div><div class="split"><div class="field"><label>Border weight</label><input type="number" min="0" max="8" step=".5" data-note-property="borderWidth" value="${n.borderWidth||0}"></div><div class="field"><label>Border style</label><select data-note-property="dash">${['solid','dashed','dotted'].map(v=>`<option ${n.dash===v?'selected':''}>${v}</option>`).join('')}</select></div></div><div class="split"><div class="field"><label>Rotation (°)</label><input type="number" data-note-property="angle" value="${n.angle||0}"></div><div class="field"><label>Opacity</label><input type="number" min="0" max="1" step=".1" data-note-property="opacity" value="${n.opacity??1}"></div></div><div class="section-label">Position and attachment</div><div class="field"><label>Attach text to</label><select data-note-attachment="1">${noteAttachmentOptions(n)}</select></div>${n.lineAnchor?`<div class="field"><label>Position along line · ${Math.round(num(n.lineAnchor.t,.5)*100)}%</label><input type="range" min="0" max="100" step="1" data-note-anchor="t" value="${Math.round(num(n.lineAnchor.t,.5)*100)}"></div><p class="note">Drag this label to adjust its offset. It follows the line as bubbles move or its routing changes.</p>`:''}<button data-action="delete" class="full close-edit">Delete note</button>`;return}}
if(s){h.textContent='Selected bubble';el.innerHTML=`<div class="section-label">Space ${html(s.id)}</div><div class="field"><label>Name (click bubble to edit directly)</label><input data-property="name" value="${html(s.name)}"></div><div class="split"><div class="field"><label>Required area (m²)</label><input type="number" min="1" step=".1" data-property="area" value="${s.area}"></div><div class="field"><label>Functional category</label><select data-property="zone">${optionsZones(s.zone)}</select></div></div><div class="field"><label>Within / Parent bubble</label><select data-property="parentId">${chooseParent(s)}</select></div><div class="section-label">Geometry</div><div class="split"><div class="field"><label>Center X</label><input type="number" step="1" data-position="x" value="${Math.round(s.x)}" ${s.pinned?'disabled':''}></div><div class="field"><label>Center Y</label><input type="number" step="1" data-position="y" value="${Math.round(s.y)}" ${s.pinned?'disabled':''}></div></div><div class="split"><div class="field"><label>Bubble style</label><select data-property="shape">${['circle','ellipse','organic'].map(v=>`<option value="${v}" ${s.shape===v?'selected':''}>${v==='organic'?'Organic blob':v[0].toUpperCase()+v.slice(1)}</option>`).join('')}</select></div><div class="field"><label>Rotation (°)</label><input data-property="angle" type="number" min="-360" max="360" value="${num(s.angle,0)}"></div></div><div class="field">${model.sizingMode==='area'?`<p class="note">Actual bubble area reflects the programmed m². Reshaping changes aspect or outline, not the represented area. To exaggerate sizes, choose Conceptual sizing in the canvas toolbar.</p>`:`<label>Individual conceptual size multiplier · ${num(s.scale,1).toFixed(2)}×</label><input data-property="scale" type="range" min="0.35" max="3" step="0.05" value="${num(s.scale,1)}">`}</div><div class="field row-inline"><input type="checkbox" data-property="pinned" ${s.pinned?'checked':''} style="width:auto"><label>Lock position (manual and automatic moves)</label></div>${s.shape==='organic'?`<button data-action="editOutline" class="full ${editOutline?'primary':''}">${editOutline?'Finish editing vertices':'Edit organic outline vertices'}</button><p class="note">Move the teal control points to reshape the blob. The outline will remain smooth.</p>`:''}${labelControlUI(s)}<div class="section-label">Appearance</div><div class="field"><label>Area label</label><select data-property="areaLabel">${[['inherit','Follow diagram setting'],['show','Always show'],['hide','Always hide']].map(([v,t])=>`<option value="${v}" ${((s.areaLabel||'inherit')===v)?'selected':''}>${t}</option>`).join('')}</select></div><div class="section-label">Quick border role</div>${styleRoles(s.borderRole||'Support')}<div class="split"><div class="field"><label>Fill</label><input type="color" data-property="fill" value="${html(s.fill||getColor(s).fill)}"></div><div class="field"><label>Border</label><input type="color" data-property="stroke" value="${html(s.stroke||getColor(s).stroke)}"></div></div><div class="split"><div class="field"><label>Outline weight</label><input type="number" data-property="strokeWidth" min="0" max="14" step=".5" value="${num(s.strokeWidth,2.2)}"></div><div class="field"><label>Outline type</label><select data-property="strokeStyle"><option value="solid" ${s.strokeStyle==='solid'?'selected':''}>Solid</option><option value="dashed" ${s.strokeStyle==='dashed'?'selected':''}>Dashed</option><option value="dotted" ${s.strokeStyle==='dotted'?'selected':''}>Dotted</option></select></div></div><div class="section-label">Actions</div><div class="row"><button data-action="copyStyle">Copy style</button><button data-action="duplicate">Duplicate</button><button data-action="delete" class="close-edit">Delete</button></div><p class="note">Use Option+drag to duplicate while positioning, or click the bubble to edit its name. Changes propagate to the Program and Matrix.</p>`;return}
if(f){h.textContent='Architectural line / arrow';el.innerHTML=`<div class="field"><label>Label</label><input data-flow-property="label" value="${html(f.label||'')}"></div><div class="field"><label>Line / arrow meaning</label><select data-flow-property="preset">${lineStyleOptions(f.preset||'custom')}</select></div><button data-action="addLineNote" class="full">＋ Attach text note to this arrow</button><div class="section-label">Arrow appearance · select a visual style</div>${arrowGallery(f)}<div class="field"><label>Graphic arrow style</label><select data-flow-property="graphicStyle">${arrowStyleOptions(f.graphicStyle||'classic')}</select></div><div class="split"><div class="field"><label>Head size</label><input type="number" data-flow-property="headSize" min="8" max="60" step="2" value="${num(f.headSize,26)}"></div><div class="field"><label>Shaft / band width</label><input type="number" data-flow-property="bodyWidth" min="4" max="38" step="1" value="${num(f.bodyWidth,13)}"></div></div><div class="field"><label>Dash / band spacing</label><input type="number" data-flow-property="bandSpacing" min="10" max="60" step="2" value="${num(f.bandSpacing,22)}"></div><p class="note">Appearance is independent of architectural meaning. Change the style at any time without disconnecting the arrow.</p><div class="field"><label>Route geometry</label><select data-flow-property="route">${[['straight','Straight'],['elbow','Orthogonal / elbow'],['curve','Curved'],['spline','Editable spline-style']].map(([v,t])=>`<option value="${v}" ${f.route===v?'selected':''}>${t}</option>`).join('')}</select></div><div class="split"><div class="field"><label>Arrowhead</label><select data-flow-property="head">${['filled','open','chevron','double','outline','none'].map(v=>`<option ${f.head===v?'selected':''}>${v}</option>`).join('')}</select></div><div class="field"><label>Arrowhead points toward</label><select data-flow-property="direction">${arrowDirectionOptions(displayedArrowDirection(f,graphicArrowPoints(f)))}</select></div></div><div class="split"><div class="field"><label>Line color</label><input type="color" data-flow-property="color" value="${html(f.color||'#0d2f4f')}"></div><div class="field"><label>Weight</label><input type="number" data-flow-property="thickness" step=".5" min=".5" max="12" value="${num(f.thickness,2.5)}"></div></div><div class="field"><label>Line pattern</label><select data-flow-property="dash">${['solid','dashed','dotted','short'].map(v=>`<option ${f.dash===v?'selected':''}>${v}</option>`).join('')}</select></div><div class="field"><label>Spline curvature</label><input type="range" data-flow-property="bend" min="-180" max="180" step="5" value="${num(f.bend,60)}"></div>${f.start&&f.end?`<div class="section-label">Free line endpoints · drag handles on the canvas</div><div class="split"><div class="field"><label>Start X</label><input type="number" data-flow-point="start.x" value="${Math.round(f.start.x)}"></div><div class="field"><label>Start Y</label><input type="number" data-flow-point="start.y" value="${Math.round(f.start.y)}"></div></div><div class="split"><div class="field"><label>End X</label><input type="number" data-flow-point="end.x" value="${Math.round(f.end.x)}"></div><div class="field"><label>End Y</label><input type="number" data-flow-point="end.y" value="${Math.round(f.end.y)}"></div></div>`:''}<button data-action="delete" class="close-edit full">Delete arrow / line</button>`;return}
if(selection.kind==='underlay'&&model.underlay){h.textContent='Image underlay';const u=model.underlay;el.innerHTML=`<p class="note">Move and scale the image independently of the programmed bubble areas. Use this as a visual reference, not as proof of physical fit.</p><div class="field"><label>Image opacity</label><input type="range" data-underlay="opacity" min=".05" max="1" step=".05" value="${num(u.opacity,.36)}"></div><div class="split"><div class="field"><label>X</label><input type="number" data-underlay="x" value="${num(u.x,0)}"></div><div class="field"><label>Y</label><input type="number" data-underlay="y" value="${num(u.y,0)}"></div></div><div class="split"><div class="field"><label>Width</label><input type="number" min="40" data-underlay="w" value="${num(u.w,800)}"></div><div class="field"><label>Height</label><input type="number" min="40" data-underlay="h" value="${num(u.h,550)}"></div></div><div class="field"><label>Rotation °</label><input type="number" data-underlay="angle" value="${num(u.angle,0)}"></div><label class="field row-inline"><input type="checkbox" data-underlay="locked" ${u.locked?'checked':''}> Lock underlay against dragging</label><div class="row"><button data-action="underlayFit">Fit image to canvas</button><button data-action="underlayDelete" class="close-edit">Remove image</button></div>`;return}
h.textContent='Diagram & presentation';el.innerHTML=`<div class="section-label">Concept settings</div><p class="note"><strong>Current template:</strong> ${html(KDG_ZONE_PROFILES[model.zoneTemplate]?.name||'Custom')} · <strong>Size mode:</strong> ${model.sizingMode==='area'?'mathematical area proportional':'conceptual emphasis'}</p><p class="note">Edit the program and matrix first. Refine adjusts the existing arrangement. Alternate generates a new layout, repositioning only unlocked bubbles. Lock important positions first.</p><div class="field row-inline"><input id="showRelations" type="checkbox" ${model.showRelations?'checked':''}><label>Show proximity relations</label></div><div class="field row-inline"><input id="showAvoid" type="checkbox" ${model.showAvoid?'checked':''}><label>Show separation warnings</label></div><div class="row"><button data-action="refine" class="full">Refine existing layout (preserve placements)</button><button data-action="alternative" class="full">Generate alternate layout (reposition unlocked bubbles)</button></div><p class="small">Locked bubbles never move during either operation. Both actions support Undo.</p><div class="section-label">Site underlay</div><button data-action="underlayChoose" class="full">${model.underlay?'Select / resize current underlay':'Import site plan / image'}</button><div class="section-label">Environmental graphics</div><p class="note">Add illustrative sun-path arcs or wind-flow ribbons. These are presentation symbols, not computed climate studies.</p><div class="row"><button data-action="envSunGallery">☼ Sun paths</button><button data-action="envWindGallery">≋ Wind flow</button></div><div class="section-label">Style management</div><button data-action="manageZones" class="full primary">Edit zones and their properties</button><p class="small">All diagram data—including matrix ratings and categories—stays within this DiagramIt project.</p>`;
}
function render(){for(const p of ['program','matrix','canvas']){$(p==='program'?'programSheet':p==='matrix'?'matrixSheet':'canvasPage').classList.toggle('hidden',p!==pane);$('tab'+(p==='program'?'Program':p==='matrix'?'Matrix':'Canvas')).classList.toggle('on',p===pane)}if(pane==='program')renderProgram();if(pane==='matrix')renderMatrix();if(pane==='canvas'){renderCanvas();renderInspector()} if(auditOpen)renderAuditPanel(); if(EMBEDDED) notifyShellState();}
function update(e){const t=e.target;
 if(t.dataset.position&&selection.kind==='space'){
   const s=space(selection.id);if(!s)return;const desired=num(t.value,s[t.dataset.position]);
   const dx=t.dataset.position==='x'?desired-s.x:0,dy=t.dataset.position==='y'?desired-s.y:0;
   if(!dx&&!dy)return;
   if(!rootGroupValid(selectedRoots([s.id]),dx,dy)){showToast('Position blocked by a lock, parent boundary, or canvas edge.');renderInspector();return;}
   checkpoint();translateSelection([s.id],dx,dy);commit();return;
 }
 if(t.dataset.envProp&&selection.kind==='envGraphic'){const g=envItem(selection.id);if(!g)return;const k=t.dataset.envProp;checkpoint();g[k]=k==='showLabel'?t.checked:['x','y','scale','angle','opacity','curve','spacing','thickness'].includes(k)?num(t.value):t.value;Object.assign(g,envNorm(g));commit(false);renderCanvas();return;}if(t.dataset.relationProperty&&selection.kind==='relation'){const k=t.dataset.relationProperty;checkpoint();const rel=model.relations[selection.id]||={rating:'U'};if(k==='graphicStyle')setRelationGraphicStyle(rel,t.value);else rel[k]=['thickness','bend','headSize','bodyWidth','bandSpacing'].includes(k)?num(t.value):t.value;commit(false);renderCanvas();if(['graphicStyle','rating','direction'].includes(k))renderInspector();return;}if(t.dataset.multiProperty&&selection.kind==='multi'){const k=t.dataset.multiProperty;checkpoint();for(const id of selection.ids||[]){const x=space(id);if(x)x[k]=['strokeWidth','labelFontSize'].includes(k)?num(t.value,k==='strokeWidth'?2.2:0):t.value;}commit(false);renderCanvas();if(k==='labelColorMode')renderInspector();return;}if(t.dataset.noteAttachment&&selection.kind==='note'){const n=model.notes.find(x=>x.id===selection.id);if(n){checkpoint();attachNote(n,t.value);commit();}return;}if(t.dataset.noteAnchor&&selection.kind==='note'){const n=model.notes.find(x=>x.id===selection.id);if(n?.lineAnchor){checkpoint();n.lineAnchor.t=clamp(num(t.value,50)/100,0,1);commit(false);renderCanvas();renderInspector();}return;}if(t.dataset.noteProperty&&selection.kind==='note'){const n=(model.notes||[]).find(x=>x.id===selection.id);if(!n)return;checkpoint();const k=t.dataset.noteProperty;n[k]=['fontSize','borderWidth','angle','opacity'].includes(k)?num(t.value):t.value;commit(false);renderCanvas();if(k==='fillMode')renderInspector();return;}if(t.id==='showAreasToggle'){checkpoint();model.showAreas=t.checked;commit(false);renderCanvas();return;}if(t.dataset.pair){checkpoint();model.relations[t.dataset.pair]={...(model.relations[t.dataset.pair]||{}),rating:t.value};t.className='rate-'+t.value;
   // Only the upper triangle is editable, including when rows are windowed.
   // Update the visible read-only mirror immediately; off-screen rows read the
   // canonical pair record when their window is rendered.
   for(const mirror of $('matrixBody').querySelectorAll('td[data-mirror-pair]')){
     if(mirror.dataset.mirrorPair!==t.dataset.pair)continue;
     mirror.className='rating-cell rate-'+t.value;mirror.textContent=t.value;
     const from=space(mirror.dataset.mirrorFrom)?.name||'Space';
     const to=space(mirror.dataset.mirrorTo)?.name||'Space';
     mirror.setAttribute('aria-label',`${from} versus ${to}: ${t.value} (read-only mirror)`);
     mirror.title=to+': '+t.value;
   }
   commit(false);return}let id=t.dataset.name||t.dataset.area||t.dataset.zone||t.dataset.parent||t.dataset.shape,s=id&&space(id);if(s){let k=t.dataset.name?'name':t.dataset.area?'area':t.dataset.zone?'zone':t.dataset.parent?'parentId':'shape';if(k==='parentId'&&!safeParent(id,t.value)){showToast('A space cannot contain its own ancestor.');render();return;}checkpoint();s[k]=k==='area'?Math.max(1,num(t.value,50)):t.value;if(k==='shape')s.vertices=null;
 if(k==='parentId'&&s.parentId){const p=space(s.parentId);
   if(p&&!s.pinned&&!descendantsOf(s.id).some(cid=>space(cid)?.pinned))moveWithChildren(s,p.x,p.y);
 }
 ensureContainment();commit(false);return}if(t.dataset.property){const s=space(selection.id);if(!s)return;const k=t.dataset.property;if(k==='parentId'&&!safeParent(s.id,t.value)){showToast('Circular nesting is not allowed.');renderInspector();return;}checkpoint();s[k]=['pinned','labelBold','labelItalic','labelUnderline','labelStrike'].includes(k)?t.checked:['area','angle','scale','strokeWidth','labelFontSize'].includes(k)?num(t.value,0):t.value;if(k==='shape')s.vertices=null;if(k==='parentId'&&s.parentId){const p=space(s.parentId);
   if(p&&!s.pinned&&!descendantsOf(s.id).some(cid=>space(cid)?.pinned))moveWithChildren(s,p.x,p.y);
   ensureContainment();}commit(false);renderCanvas();queueMicrotask(renderInspector);return}if(t.dataset.flowProperty){const f=model.flows.find(x=>x.id===selection.id);if(!f)return;checkpoint();if(t.dataset.flowProperty==='preset')applyPreset(f,t.value);else if(t.dataset.flowProperty==='graphicStyle')setArrowGraphicStyle(f,t.value);else{f[t.dataset.flowProperty]=['thickness','bend','headSize','bodyWidth','bandSpacing'].includes(t.dataset.flowProperty)?num(t.value):t.value;if(!['label','bend','headSize','bodyWidth','bandSpacing','head','color','thickness','dash','direction','route'].includes(t.dataset.flowProperty))f.preset='custom';}commit(false);renderCanvas();if(['preset','graphicStyle'].includes(t.dataset.flowProperty))renderInspector();return}if(t.dataset.flowPoint){const f=model.flows.find(x=>x.id===selection.id);if(f){const [end,key]=t.dataset.flowPoint.split('.');checkpoint();f[end][key]=num(t.value);commit(false);renderCanvas();}return}if(t.dataset.underlay){const u=model.underlay;if(!u)return;checkpoint();u[t.dataset.underlay]=t.dataset.underlay==='locked'?t.checked:num(t.value);commit(false);renderCanvas();return}if(t.dataset.environment){const [which,key]=t.dataset.environment.split('.');checkpoint();model.environment[which][key]=key==='on'?t.checked:num(t.value);commit(false);renderCanvas();return}if(t.id==='showRelations'||t.id==='showAvoid'){checkpoint();model[t.id]=t.checked;commit(false);renderCanvas();return}}
function setFlow(){tool=tool==='arrow'?'select':'arrow';flowSource=null;renderCanvas();showToast(tool==='arrow'?'Click departure bubble, then arrival bubble.':'Connection mode ended.');}
function newFlow(from,to){if(from===to)return;checkpoint();const id=uid();const f={id,source:from,target:to,label:'',bend:60};applyPreset(f,model.selectedLinePreset||'primary');model.flows.push(f);selection={kind:'flow',id};tool='select';flowSource=null;commit();}
function styleOf(s){return {fill:s.fill||getColor(s).fill,stroke:s.stroke||getColor(s).stroke,strokeWidth:num(s.strokeWidth,2.2),strokeStyle:s.strokeStyle||'solid',fillOpacity:num(s.fillOpacity,.90),labelFont:s.labelFont||'auto',labelFontSize:num(s.labelFontSize,0),labelColorMode:s.labelColorMode||'auto',labelColor:s.labelColor||'#0D2F4F',labelAlign:s.labelAlign||'center',labelBold:s.labelBold!==false,labelItalic:!!s.labelItalic,labelUnderline:!!s.labelUnderline,labelStrike:!!s.labelStrike}}
function applyStyle(to,style){Object.assign(to,style)}

// A shared, semantic-safe Format Painter for shapes and BOTH line types.
function activatePainter(){
 const kind=selection.kind;
 if(kind==='space'){const s=space(selection.id);if(!s)return;paintSource={type:'space',style:styleOf(s)};}
 else if(kind==='relation'){const r=model.relations[selection.id];if(!r)return;paintSource={type:'line',style:lineVisual(r,'relation')};}
 else if(kind==='flow'){const f=model.flows.find(x=>x.id===selection.id);if(!f)return;paintSource={type:'line',style:lineVisual(f,'flow')};}
 else if(kind==='envGraphic'){const g=envItem(selection.id);if(!g)return;paintSource={type:'envGraphic',style:Object.fromEntries(['color','accent','opacity','thickness','spacing','curve','showLabel','strandOffsets'].map(k=>[k,g[k]]))};}
 else {showToast('Select a bubble or connector to copy its formatting first.');return;}
 showToast('Format Painter active · click another '+(paintSource.type==='line'?'line':paintSource.type==='envGraphic'?'environmental graphic':'bubble')+' · Esc cancels');
 renderCanvas();
}
function applyPaintTo(kind,id){
 if(!paintSource)return false;
 const destType=kind==='space'?'space':kind==='envGraphic'?'envGraphic':'line';
 if(destType!==paintSource.type){showToast('Choose a '+(paintSource.type==='line'?'connector or arrow':'bubble')+' to apply formatting. Esc cancels.');return true;}
 if(kind==='envGraphic'){const dest=envItem(id);if(!dest)return false;checkpoint();Object.assign(dest,paintSource.style);}
 else if(kind==='space'){
  const dest=space(id);if(!dest)return false;
  checkpoint();applyStyle(dest,paintSource.style);
 }else if(kind==='relation'){
  const dest=model.relations[id];if(!dest)return false;
  checkpoint();applyLineVisual(dest,paintSource.style);
 }else if(kind==='flow'){
  const dest=model.flows.find(x=>x.id===id);if(!dest)return false;
  checkpoint();applyLineVisual(dest,paintSource.style);
 }else return false;
 selection={kind,id};paintSource=null;commit();showToast('Formatting applied without changing relationship meaning.');return true;
}
function manageRatingStyles(){
 // Each rating owns a default appearance and visibility; per-line manual edits take precedence.
 const overlay=document.createElement('div');overlay.className='rating-editor-overlay';
 overlay.innerHTML=`<div class="rating-editor" role="dialog" aria-modal="true" aria-label="Adjacency line standards"><div class="row" style="justify-content:space-between;align-items:center"><div><h2 style="margin:0;color:#0D2F4F">Adjacency line standards</h2><p class="small">Choose the default appearance for each AEIOUX rating. Existing customized lines are preserved.</p></div><button id="rateDefaultsClose" title="Close">Done ✕</button></div><div class="field"><label>Relationship rating</label><select id="rateDefaultsRate">${RATING_KEYS.map(r=>`<option value="${r}">${r} · ${RATINGS[r].desc}</option>`).join('')}</select></div><div id="rateDefaultsBody"></div><div class="row" style="justify-content:space-between"><button id="rateDefaultsReset">Restore original ${'A–X'} standard for selected rating</button><button id="rateDefaultsDone" class="primary">Done</button></div></div>`;
 document.body.append(overlay);
 const rateSelect=overlay.querySelector('#rateDefaultsRate'),body=overlay.querySelector('#rateDefaultsBody');
 if(selection.kind==='relation')rateSelect.value=model.relations[selection.id]?.rating||'A';
 function panel(){const r=rateSelect.value,v=ratingDefault(r);body.innerHTML=`<div class="field row-inline"><input type="checkbox" data-rating-field="visible" ${v.visible?'checked':''} id="ratingVisible"><label for="ratingVisible">Draw ${r} connections by default</label></div>${r==='U'?'<p class="small">Showing unimportant (U) relationships can create many lines on dense matrices.</p>':''}<div class="section-label">Graphic treatment</div>${arrowGallery(v,true)}<div class="split"><div class="field"><label>Line color</label><input type="color" data-rating-field="color" value="${html(v.color)}"></div><div class="field"><label>Line thickness</label><input type="number" step=".5" min=".5" max="15" data-rating-field="thickness" value="${v.thickness}"></div></div><div class="split"><div class="field"><label>Pattern</label><select data-rating-field="dash">${['solid','dashed','dotted'].map(k=>`<option value="${k}" ${v.dash===k?'selected':''}>${k}</option>`).join('')}</select></div><div class="field"><label>Route</label><select data-rating-field="route">${['straight','elbow','curve','spline'].map(k=>`<option value="${k}" ${v.route===k?'selected':''}>${k}</option>`).join('')}</select></div></div><div class="split"><div class="field"><label>Arrowhead</label><select data-rating-field="head">${['open','filled','chevron','none'].map(k=>`<option value="${k}" ${v.head===k?'selected':''}>${k}</option>`).join('')}</select></div><div class="field"><label>Arrowhead points toward</label><select data-rating-field="direction">${arrowDirectionOptions(displayedArrowDirection(v,[{x:0,y:0},{x:100,y:0}]))}</select></div></div><div class="split"><div class="field"><label>Head size</label><input type="number" min="8" max="60" data-rating-field="headSize" value="${v.headSize}"></div><div class="field"><label>Shaft / band width</label><input type="number" min="4" max="38" data-rating-field="bodyWidth" value="${v.bodyWidth}"></div></div><div class="split"><div class="field"><label>Segment spacing</label><input type="number" min="10" max="60" data-rating-field="bandSpacing" value="${v.bandSpacing}"></div><div class="field"><label>Curve bend</label><input type="number" min="-180" max="180" data-rating-field="bend" value="${v.bend}"></div></div><p class="note">These are visual conventions, not definitions of the adjacency rating. Arrowheads never convert proximity into circulation.</p>`;}
 panel();
 rateSelect.onchange=panel;
 overlay.onchange=e=>{const t=e.target,field=t.dataset.ratingField;if(!field)return;const rating=rateSelect.value;checkpoint();const target=model.ratingLineDefaults[rating];target[field]=field==='visible'?t.checked:['thickness','headSize','bodyWidth','bandSpacing','bend'].includes(field)?num(t.value):t.value;notify();renderCanvas();if(selection.kind==='relation')renderInspector();};
 overlay.onclick=e=>{e.stopPropagation();const t=e.target;if(t===overlay||['rateDefaultsClose','rateDefaultsDone'].includes(t.id)){overlay.remove();return;}
  if(t.id==='rateDefaultsReset'){checkpoint();model.ratingLineDefaults[rateSelect.value]=clone(RATING_LINE_DEFAULTS[rateSelect.value]);notify();renderCanvas();if(selection.kind==='relation')renderInspector();panel();return;}
  const styleButton=t.closest('[data-graphic-style]');if(styleButton){const k=styleButton.dataset.graphicStyle,rate=rateSelect.value;checkpoint();const v=model.ratingLineDefaults[rate];if(k==='plain')v.graphicStyle='plain';else setRelationGraphicStyle(v,k);notify();renderCanvas();if(selection.kind==='relation')renderInspector();panel();}
 };
}
function triggerAction(action){const s=selection.kind==='space'?space(selection.id):null;
 if(action==='delete'){deleteSelectionReliable();return;}
 if(action==='duplicate'){duplicateSelectionReliable();return;}
 if(action==='lockSelected'||action==='unlockSelected'){
   const ids=selectionIds();if(!ids.length)return;const val=action==='lockSelected';
   if(ids.every(id=>space(id)?.pinned===val))return;
   checkpoint();for(const id of ids){const item=space(id);if(item)item.pinned=val;}commit();return;
 }
if(action==='envSunGallery'){envGallery('sun');return;}if(action==='envWindGallery'){envGallery('wind');return;}if(action==='envResetStrands'){if(selection.kind==='envGraphic'){const g=envItem(selection.id);if(g){checkpoint();g.strandOffsets={};commit();showToast('Environmental strands restored to preset positions.');}}return;}if(action==='envDelete'){if(selection.kind==='envGraphic'){checkpoint();model.envGraphics=model.envGraphics.filter(g=>g.id!==selection.id);selection={kind:null,id:null};commit();}return;}if(action==='envDuplicate'){const g=envItem(selection.id);if(g){checkpoint();const cp={...clone(g),id:uid(),x:g.x+38,y:g.y+38};model.envGraphics.push(cp);selection={kind:'envGraphic',id:cp.id};commit();}return;}if(action==='addLineNote'){addNoteOnSelectedLine();return;}
if(action==='clearRelationStyle'&&selection.kind==='relation'){checkpoint();const rel=model.relations[selection.id];if(rel){for(const k of LINE_VISUAL_KEYS)delete rel[k];}commit();return;}
if(action==='ratingStyleManager'){manageRatingStyles();return;}
if(action==='copyLineStyle'){activatePainter();return;}
if(action==='setRatingDefault'&&selection.kind==='relation'){
 const rel=model.relations[selection.id],rating=rel.rating||'U';checkpoint();
 model.ratingLineDefaults[rating]={...ratingDefault(rating),...lineVisual(rel,'relation')};
 for(const k of LINE_VISUAL_KEYS)delete rel[k];commit();showToast(rating+' line standard updated. Other customized connectors stay unchanged.');return;
}if(action==='add'){addSpace(false);pane='canvas';render();return}
if(action==='delete'){if(selection.kind==='envGraphic'){checkpoint();model.envGraphics=model.envGraphics.filter(g=>g.id!==selection.id);selection={kind:null,id:null};commit();return;}if(selection.kind==='relation'){checkpoint();for(const n of model.notes||[])if(n.lineAnchor?.kind==='relation'&&n.lineAnchor.id===selection.id){const p=notePosition(n);n.x=p.x;n.y=p.y;n.lineAnchor=null;}model.relations[selection.id]={rating:'U'};selection={kind:null,id:null};commit();return;}if(selection.kind==='multi'){const ids=[...selection.ids];checkpoint();model.spaces=model.spaces.filter(x=>!ids.includes(x.id));model.flows=model.flows.filter(f=>!ids.includes(f.source)&&!ids.includes(f.target));for(const k of Object.keys(model.relations))if(k.split('|').some(x=>ids.includes(x)))delete model.relations[k];for(const x of model.spaces)if(ids.includes(x.parentId))x.parentId='';selection={kind:null,id:null};commit();return;}if(selection.kind==='note'){checkpoint();model.notes=model.notes.filter(n=>n.id!==selection.id);selection={kind:null,id:null};commit();return;}if(selection.kind==='space')deleteSpace(selection.id);else if(selection.kind==='flow'){checkpoint();for(const n of model.notes||[])if(n.lineAnchor?.kind==='flow'&&n.lineAnchor.id===selection.id){const p=notePosition(n);n.x=p.x;n.y=p.y;n.lineAnchor=null;}model.flows=model.flows.filter(x=>x.id!==selection.id);selection={kind:null,id:null};commit()}return}
if(action==='duplicate'&&s){checkpoint();const cp={...clone(s),id:uid(),name:s.name+' copy',x:s.x+34,y:s.y+34,pinned:false};model.spaces.push(cp);selection={kind:'space',id:cp.id};commit();startInline(cp);return}
if(action==='copyStyle'&&(s||selection.kind==='envGraphic')){activatePainter();return}
if(action==='editOutline'){editOutline=!editOutline;render();return}
if(action==='underlayChoose'){if(model.underlay){selection={kind:'underlay',id:null};renderInspector();}else $('underlayFile').click();return}
if(action==='underlayDelete'){checkpoint();model.underlay=null;selection={kind:null,id:null};commit();return}
if(action==='underlayFit'){if(model.underlay){checkpoint();Object.assign(model.underlay,{x:30,y:30,w:W-60,h:H-60,angle:0});commit()}return}
if(action==='refine'){generate(false);return}
if(action==='alternative'){generate(true);return}
if(action==='manageZones'){manageZones();return}}
function addTextNote(){checkpoint();const n={id:uid(),text:'Text note',x:view.x+view.w*.5,y:view.y+view.h*.38,w:225,h:64,font:'Arial, sans-serif',fontSize:18,bold:false,italic:false,underline:false,strike:false,textColor:'#0D2F4F',highlight:'none',align:'center',fill:'#ffffff',fillMode:'none',stroke:'#7595a4',borderWidth:0,dash:'solid',opacity:1,angle:0,attachedTo:''};model.notes.push(n);selection={kind:'note',id:n.id};tool='select';commit();startNoteInline(n);}
function startNoteInline(n){endInline(true);const fo=document.createElementNS(NS,'foreignObject');const w=Math.max(160,num(n.w,225));const pos=notePosition(n);fo.setAttribute('x',pos.x-w/2);fo.setAttribute('y',pos.y-34);fo.setAttribute('width',w);fo.setAttribute('height',100);fo.dataset.noteEditor=n.id;const input=document.createElement('textarea');input.className='editing';input.style.cssText='width:100%;height:88px;resize:both;text-align:left';input.value=n.text;fo.appendChild(input);$('diagram').appendChild(fo);editing={kind:'note',id:n.id,element:fo,input,original:n.text};input.focus();input.select();input.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();endInline(false)}else if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();endInline(true)}};input.onblur=()=>queueMicrotask(()=>{if(editing?.element===fo)endInline(true)});}
function manageZones(){
 const overlay=document.createElement('div');overlay.style.cssText='position:fixed;inset:0;background:#09263e91;display:grid;place-items:center;z-index:999';
 overlay.innerHTML=`<div role="dialog" aria-modal="true" aria-label="Edit functional zone properties" style="background:white;border-radius:14px;padding:18px;width:min(960px,96vw);max-height:90vh;overflow:auto;box-shadow:0 18px 45px #0005"><h2 style="margin:0 0 5px;color:#0d2f4f">Functional zones &amp; properties</h2><p class="small">Rename zones, choose program group, set fill / outline colors, and edit the CAD layer identifier. Changes stay in this project; original KDG templates remain unchanged.</p><div style="display:grid;grid-template-columns:minmax(120px,1.25fr) minmax(85px,.75fr) 54px 54px minmax(160px,1fr) 40px;gap:6px;font-size:11px;font-weight:700;color:#517082;margin:14px 0 4px"><span>Zone name</span><span>Group</span><span>Fill</span><span>Border</span><span>CAD layer / code</span><span></span></div><div id="zoneRows"></div><div class="row" style="margin-top:12px"><button id="zoneAdd">＋ Add zone</button><button id="zoneClose" class="primary">Done</button></div></div>`;
 document.body.append(overlay);
 const paint=()=>{$('zoneRows').innerHTML=Object.entries(model.zones).map(([name,z])=>`<div class="zone-editor-row" style="display:grid;grid-template-columns:minmax(120px,1.25fr) minmax(85px,.75fr) 54px 54px minmax(160px,1fr) 40px;gap:6px;align-items:center;margin:6px 0"><input aria-label="Zone name" data-zone-rename="${html(name)}" value="${html(name)}"><input aria-label="Zone group" data-zone-field="group" data-zone-key="${html(name)}" value="${html(z.group||'Custom')}"><input aria-label="Zone fill" type="color" data-zone-field="fill" data-zone-key="${html(name)}" value="${html(z.fill||'#d9e8eb')}"><input aria-label="Zone border" type="color" data-zone-field="stroke" data-zone-key="${html(name)}" value="${html(z.stroke||'#527b8a')}"><input aria-label="CAD layer" data-zone-field="cadLayer" data-zone-key="${html(name)}" value="${html(z.cadLayer||z.code||'')}"><button aria-label="Remove zone" data-zone-remove="${html(name)}" title="Remove zone" ${Object.keys(model.zones).length<=1?'disabled':''}>×</button></div>`).join('');};paint();
 const close=()=>{overlay.remove();render();};
 overlay.onclick=e=>{const t=e.target;if(t===overlay||t.id==='zoneClose'){close();return}if(t.id==='zoneAdd'){let i=1;while(model.zones['New Zone '+i])i++;checkpoint();model.zones['New Zone '+i]={fill:'#d9e8eb',stroke:'#527b8a',group:'Custom',cadLayer:'ZONE_CUSTOM-'+i,code:'ZONE_CUSTOM-'+i};commit(false);paint();return}if(t.dataset.zoneRemove){const name=t.dataset.zoneRemove;if(Object.keys(model.zones).length<=1)return;checkpoint();delete model.zones[name];for(const s of model.spaces)if(s.zone===name)s.zone=Object.keys(model.zones)[0];commit(false);paint();}};
 overlay.onchange=e=>{const t=e.target;if(t.dataset.zoneRename){const old=t.dataset.zoneRename,v=t.value.trim();if(!v||v===old||model.zones[v]){paint();return;}checkpoint();const before=Object.entries(model.zones);model.zones=Object.fromEntries(before.map(([name,z])=>name===old?[v,z]:[name,z]));for(const s of model.spaces)if(s.zone===old)s.zone=v;commit(false);paint();return;}if(t.dataset.zoneField){const k=t.dataset.zoneKey,field=t.dataset.zoneField,z=model.zones[k];if(!z)return;checkpoint();z[field]=t.value;if(field==='cadLayer')z.code=t.value;commit(false);}};
 overlay.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close();}});
}

function fitView(){let b={x:40,y:35,w:W-80,h:H-70};if(model.spaces.length){const minx=Math.min(...model.spaces.map(s=>s.x-radius(s))),maxx=Math.max(...model.spaces.map(s=>s.x+radius(s))),miny=Math.min(...model.spaces.map(s=>s.y-radius(s))),maxy=Math.max(...model.spaces.map(s=>s.y+radius(s)));if(maxx>minx&&maxy>miny)b={x:minx-40,y:miny-40,w:maxx-minx+80,h:maxy-miny+80}}const ratio=Math.max(b.w/W,b.h/H,1);model.view={x:b.x-(W*ratio-b.w)/2,y:b.y-(H*ratio-b.h)/2,w:W*ratio,h:H*ratio};renderCanvas()}
function svgPoint(e){const el=$('diagram'),p=el.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const m=el.getScreenCTM();return m?p.matrixTransform(m.inverse()):{x:0,y:0}}
function descendantsOf(id,out=[]){for(const s of model.spaces)if(s.parentId===id&&!out.includes(s.id)){out.push(s.id);descendantsOf(s.id,out)}return out}
function moveWithChildren(s,x,y){const dx=x-s.x,dy=y-s.y;
 if(!dx&&!dy)return;
 const members=new Set([s.id,...descendantsOf(s.id)]);
 s.x=x;s.y=y;
 for(const id of members){if(id===s.id)continue;const c=space(id);if(c){c.x+=dx;c.y+=dy;}}
 for(const n of model.notes||[])if(members.has(n.attachedTo)){n.x+=dx;n.y+=dy;}
}
function startInline(s){endInline(true);const svg=$('diagram');const fo=document.createElementNS(NS,'foreignObject');fo.setAttribute('x',s.x-105);fo.setAttribute('y',s.y-28);fo.setAttribute('width',210);fo.setAttribute('height',70);fo.setAttribute('data-inline','1');const input=document.createElement('textarea');input.className='editing';input.style.cssText='width:205px;height:60px';input.value=s.name;fo.appendChild(input);svg.appendChild(fo);editing={id:s.id,element:fo,input,original:s.name};input.focus();input.select();input.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();endInline(false)}else if((e.key==='Delete'||e.key==='Backspace')&&input.value===s.name&&input.selectionStart===0&&input.selectionEnd===input.value.length){e.preventDefault();endInline(false);deleteSpace(s.id)}else if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();endInline(true)}};input.onblur=()=>queueMicrotask(()=>{if(editing?.element===fo)endInline(true)});}
function endInline(commitValue){
 if(!editing)return;
 const e=editing;editing=null;
 const s=e.kind==='note'?(model.notes||[]).find(n=>n.id===e.id):space(e.id),value=e.input.value.trim();
 // Remove the in-SVG editor before rebuilding SVG. Its blur event otherwise
 // causes a reentrant innerHTML mutation in Chromium.
 e.input.onblur=null;e.element.remove();
 if(commitValue&&s&&value&&(e.kind==='note'?value!==s.text:value!==s.name)){checkpoint();if(e.kind==='note')s.text=value;else s.name=value;notify();render();}
}


/* v0.9.9: group selection is view-only; no new project schema fields.
   Nested roots are moved once, attached notes follow, and locked descendants are respected. */
function selectBubbleIds(ids){const uniq=[...new Set(ids)].filter(id=>!!space(id));selection=uniq.length>1?{kind:'multi',ids:uniq,id:uniq[0]}:uniq.length?{kind:'space',id:uniq[0]}:{kind:null,id:null};}
function selectionIds(){return selection.kind==='multi'?(selection.ids||[]):selection.kind==='space'?[selection.id]:[];}
function selectedRoots(ids){const picked=new Set(ids.filter(id=>space(id)));return [...picked].map(space).filter(s=>{let p=space(s.parentId),guard=new Set();while(p&&!guard.has(p.id)){if(picked.has(p.id))return false;guard.add(p.id);p=space(p.parentId);}return true;});}
function rootGroupValid(roots,dx,dy){if(!roots.length)return false;
 const members=new Set();for(const root of roots){members.add(root.id);descendantsOf(root.id).forEach(id=>members.add(id));}
 for(const id of members){const obj=space(id);if(!obj||obj.pinned)return false;
   const r=radius(obj),x=obj.x+dx,y=obj.y+dy;
   if(x-r<9||x+r>W-9||y-r<9||y+r>H-9)return false;
 }
 for(const root of roots){const p=space(root.parentId);if(!p||members.has(p.id))continue;
   const bound=Math.max(0,radius(p)-radius(root)-6);
   if(Math.hypot(root.x+dx-p.x,root.y+dy-p.y)>bound+.001)return false;
 }
 return true;
}
function translateSelection(ids,dx,dy){const roots=selectedRoots(ids);if(!rootGroupValid(roots,dx,dy))return false;
 for(const root of roots)moveWithChildren(root,root.x+dx,root.y+dy);return true;
}
function selectedCanMove(ids){return selectedRoots(ids).every(root=>[root.id,...descendantsOf(root.id)].every(id=>!space(id)?.pinned));}
function selectionBox(p,q){const x=Math.min(p.x,q.x),y=Math.min(p.y,q.y),w=Math.abs(p.x-q.x),h=Math.abs(p.y-q.y);return {x,y,w,h};}
function paintMarquee(){if(!drag||drag.kind!=='marquee')return;const r=selectionBox(drag.start,drag.end);const box=document.createElementNS(NS,'rect');
 for(const [key,val] of Object.entries(r))box.setAttribute(key,val);box.setAttribute('fill','#0d7475');box.setAttribute('fill-opacity','.09');box.setAttribute('stroke','#0d7475');box.setAttribute('stroke-dasharray','7 5');box.setAttribute('stroke-width','2');box.setAttribute('pointer-events','none');box.setAttribute('data-marquee-preview','true');$('diagram').appendChild(box);}
function pointerDown(e){const eg=e.target.closest('[data-env-graphic]');if(eg){endInline(true);const g=envItem(eg.dataset.envGraphic);if(g){if(applyPaintTo('envGraphic',g.id)){e.preventDefault();return;}selection={kind:'envGraphic',id:g.id};drag={kind:'envGraphic',id:g.id,which:e.target.closest('[data-env-handle]')?.dataset.envHandle||'move',start:svgPoint(e),old:clone(g),moved:false};$('diagram').setPointerCapture(e.pointerId);renderInspector();e.preventDefault();return;}}const noteEl=e.target.closest('[data-note]');if(noteEl){endInline(true);const id=noteEl.dataset.note;selection={kind:'note',id};const n=model.notes.find(n=>n.id===id);if(n){drag={kind:'note',id,start:svgPoint(e),old:clone(n),moved:false};$('diagram').setPointerCapture(e.pointerId);}renderInspector();e.preventDefault();return;}const relation=e.target.closest('[data-relation]');if(relation){if(applyPaintTo('relation',relation.dataset.relation)){e.preventDefault();return;}endInline(true);selection={kind:'relation',id:relation.dataset.relation};renderCanvas();renderInspector();e.preventDefault();return;}const node=e.target.closest('[data-space]'),flow=e.target.closest('[data-flow]'),handle=e.target.closest('[data-handle]'),underlay=e.target.closest('[data-underlay]'),environment=e.target.closest('[data-environment]');const flowHandle=e.target.closest('[data-flow-handle]');if(flowHandle&&flow){const f=model.flows.find(x=>x.id===flow.dataset.flow);if(f?.start){selection={kind:'flow',id:f.id};drag={kind:'flow-handle',id:f.id,which:flowHandle.dataset.flowHandle,start:svgPoint(e),old:clone(f),moved:false};$('diagram').setPointerCapture(e.pointerId);e.preventDefault();return;}}if(environment){const key=environment.dataset.environment;selection={kind:null,id:null};drag={kind:'environment',which:key,start:svgPoint(e),moved:false};$('diagram').setPointerCapture(e.pointerId);showToast('Drag to reorient '+key+' direction.');return}if(node){const id=node.dataset.space,s=space(id);if(!s)return;if(tool==='arrow'){if(!flowSource){flowSource=id;selection={kind:'space',id};render();showToast('Select destination bubble.');}else newFlow(flowSource,id);e.preventDefault();return}
if((e.metaKey||e.ctrlKey||e.shiftKey)&&tool!=='arrow'&&!handle){endInline(true);let ids=selectionIds();ids=ids.includes(id)?ids.filter(x=>x!==id):[...ids,id];selectBubbleIds(ids);render();e.preventDefault();return;}if(selection.kind==='multi'&&selection.ids.includes(id)&&!handle&&tool==='select'&&!e.altKey){endInline(true);drag={kind:'multi-space',ids:[...selection.ids],start:svgPoint(e),last:{dx:0,dy:0},moved:false};$('diagram').setPointerCapture(e.pointerId);e.preventDefault();return;}if(applyPaintTo('space',id)){e.preventDefault();return}endInline(true);selection={kind:'space',id};editOutline=editOutline&&selection.id===id;const p=svgPoint(e);if(!handle&&tool==='select'&&(s.pinned||descendantsOf(s.id).some(cid=>space(cid)?.pinned))&&!e.altKey){renderCanvas();renderInspector();showToast('Position locked. Unlock the bubble or its descendant before moving it.');e.preventDefault();return;}drag={kind:handle?.dataset.handle||'space',id,start:p,old:clone(s),moved:false,index:num(handle?.dataset.index,-1),alt:e.altKey,cloned:false};$('diagram').setPointerCapture(e.pointerId);renderInspector();e.preventDefault();return}
if(flow){if(applyPaintTo('flow',flow.dataset.flow)){e.preventDefault();return;}endInline(true);selection={kind:'flow',id:flow.dataset.flow};renderCanvas();renderInspector();e.preventDefault();return}
if(e.shiftKey&&tool==='select'){endInline(true);drag={kind:'marquee',start:svgPoint(e),end:svgPoint(e),moved:false};$('diagram').setPointerCapture(e.pointerId);e.preventDefault();return;}if(underlay&&model.underlay&&!model.underlay.locked){selection={kind:'underlay',id:null};drag={kind:'underlay',start:svgPoint(e),old:clone(model.underlay),moved:false};$('diagram').setPointerCapture(e.pointerId);renderInspector();return}
if(tool==='arrow'){endInline(true);const p=svgPoint(e);drag={kind:'freeflow',start:p,end:p,moved:false};$('diagram').setPointerCapture(e.pointerId);e.preventDefault();return;}endInline(true);selection={kind:null,id:null};editOutline=false;paintSource=null;renderCanvas();renderInspector();}
// T42-C: pointercancel and Escape are aborts, not commits. Keep a shallow
// undo/redo stack snapshot before the FIRST drag checkpoint; the project
// snapshot also restores nested children, attached notes and cloned links.
function captureDragRollback(){
 if(!drag||drag.rollback)return;
 drag.rollback={raw:JSON.stringify(model),history:[...history],redo:[...redoStack],selection:clone(selection)};
}
function rollbackDrag(d,{notifyHost=true}={}){
 if(d?.rollback){
   model=upgrade(JSON.parse(d.rollback.raw));
   history=d.rollback.history;redoStack=d.rollback.redo;
   selection=d.rollback.selection;
   // Alt-duplicate can publish before pointerup; a compensating owner
   // notification removes that temporary clone from the parent snapshot.
   if(notifyHost)notify();
 }
 render();
}
function pointerCancel(){
 const d=drag;drag=null;
 if(d)rollbackDrag(d);
}
function pointerMove(e){if(!drag)return;const p=svgPoint(e),dx=p.x-drag.start.x,dy=p.y-drag.start.y;
 if(drag.kind==='marquee'){drag.end=p;drag.moved=Math.hypot(dx,dy)>4;renderCanvas();paintMarquee();return;}
 if(drag.kind==='multi-space'){
   if(!drag.moved&&Math.hypot(dx,dy)<3)return;
   const stepx=dx-drag.last.dx,stepy=dy-drag.last.dy;
   if(!selectedCanMove(drag.ids)){showToast('Group contains a locked bubble or descendant. Unlock it before moving.');pointerCancel();return;}
   if(!rootGroupValid(selectedRoots(drag.ids),stepx,stepy))return;
   if(!drag.moved){captureDragRollback();checkpoint();drag.moved=true;}
   translateSelection(drag.ids,stepx,stepy);drag.last={dx,dy};renderCanvas();return;
 }
 if(!drag.moved&&Math.abs(dx)+Math.abs(dy)<3)return;
 if(!drag.moved){
   captureDragRollback();
   if(drag.kind==='space'&&drag.alt&&!drag.cloned){
     const sourceId=drag.id;
     const captured=captureBubbleSelection();
     const sourceIndex=captured?.spaces?.findIndex(x=>x.id===sourceId)??-1;
     const oldIds=new Set(model.spaces.map(x=>x.id));
     duplicateSelectionReliable(); // one checkpoint; includes children, internal links and attached notes
     const created=model.spaces.filter(x=>!oldIds.has(x.id));
     const cp=created[sourceIndex]||created[0];
     if(!cp){drag=null;return;}
     drag.id=cp.id;drag.old=clone(cp);drag.cloned=true;
     selection={kind:'space',id:cp.id};
     showToast('Copied nested space and linked notes. Drag the duplicate into position.');
   }else checkpoint();
   drag.moved=true;
 }
const s=space(drag.id);if(drag.kind==='envGraphic'){const g=envItem(drag.id);if(g){if(drag.which==='rotate'){g.angle=Math.round(Math.atan2(p.y-g.y,p.x-g.x)*180/Math.PI+90);}else if(drag.which==='resize'){g.scale=clamp(Math.hypot(p.x-g.x,p.y-g.y)/Math.hypot(163,108),.25,4);}
   else if(drag.which==='curve'){const q=envLocalPoint(g,p);g.curve=clamp(g.kind==='sun'?2*(q.y-12.5):64+(-37-q.y)/.52,10,130);}
   else if(drag.which.startsWith('strand:')){const i=Number(drag.which.split(':')[1]),offsets=envBaseOffsets(g),q=envLocalPoint(g,p);
     const main=g.kind==='sun'?(.75*(-9)+.25*(num(g.curve,64)+34)):-37-(num(g.curve,64)-64)*.52;
     g.strandOffsets||={};g.strandOffsets[i]=clamp(q.y-main-offsets[i],-105,105);}
   else{g.x=drag.old.x+dx;g.y=drag.old.y+dy;}}}else if(drag.kind==='freeflow'){drag.end=p;}else if(drag.kind==='note'){const n=model.notes.find(x=>x.id===drag.id);if(n){if(n.lineAnchor){n.lineAnchor.dx=num(drag.old.lineAnchor?.dx,0)+dx;n.lineAnchor.dy=num(drag.old.lineAnchor?.dy,0)+dy;}else{n.x=drag.old.x+dx;n.y=drag.old.y+dy;}}}else if(drag.kind==='flow-handle'){const f=model.flows.find(x=>x.id===drag.id);if(f?.[drag.which]){f[drag.which]={x:p.x,y:p.y};}}else if(drag.kind==='environment'){const center=drag.which==='sun'?{x:W-102,y:88}:{x:W-215,y:88};model.environment[drag.which].angle=Math.round((Math.atan2(p.y-center.y,p.x-center.x)*180/Math.PI+90+360)%360);}else if(drag.kind==='underlay'&&model.underlay){model.underlay.x=drag.old.x+dx;model.underlay.y=drag.old.y+dy;}else if(s){if(drag.kind==='space'){let px=drag.old.x+dx,py=drag.old.y+dy;const par=space(s.parentId);if(par){const bound=Math.max(0,radius(par)-radius(s)-6),vx=px-par.x,vy=py-par.y,d=Math.hypot(vx,vy);if(d>bound&&d>0){px=par.x+vx/d*bound;py=par.y+vy/d*bound;}}moveWithChildren(s,px,py)}else if(drag.kind==='resize'){const init=radii(drag.old),fx=Math.abs(p.x-drag.old.x)/Math.max(8,init.rx*.78),fy=Math.abs(p.y-drag.old.y)/Math.max(8,init.ry*.78);s.stretchX=clamp(num(drag.old.stretchX,1)*fx,.3,4);s.stretchY=clamp(num(drag.old.stretchY,1)*fy,.3,4);if(drag.old.shape==='circle'&&Math.abs(s.stretchX-s.stretchY)>.15)s.shape='ellipse'}else if(drag.kind==='rotate'){s.angle=Math.round(Math.atan2(p.y-s.y,p.x-s.x)*180/Math.PI+90)}else if(drag.kind==='vertex'){const {rx,ry}=radii(s),ang=-num(s.angle,0)*Math.PI/180,ox=p.x-s.x,oy=p.y-s.y,u=(ox*Math.cos(ang)-oy*Math.sin(ang))/rx,v=(ox*Math.sin(ang)+oy*Math.cos(ang))/ry;s.vertices=drag.old.vertices||vertices(drag.old);s.vertices=clone(s.vertices);if(s.vertices[drag.index])s.vertices[drag.index]={x:u,y:v};}}
renderCanvas();if(drag?.kind==='freeflow'){const ln=document.createElementNS(NS,'line');ln.setAttribute('x1',drag.start.x);ln.setAttribute('y1',drag.start.y);ln.setAttribute('x2',drag.end.x);ln.setAttribute('y2',drag.end.y);ln.setAttribute('stroke','#0D7475');ln.setAttribute('stroke-width','2.2');ln.setAttribute('stroke-dasharray','6 4');ln.setAttribute('pointer-events','none');$('diagram').appendChild(ln);}}
function pointerUp(e){if(!drag)return;const d=drag;drag=null;
 if(d.kind==='marquee'){if(d.moved){const r=selectionBox(d.start,d.end);selectBubbleIds(model.spaces.filter(s=>s.x>=r.x&&s.x<=r.x+r.w&&s.y>=r.y&&s.y<=r.y+r.h).map(s=>s.id));}render();return;}
 if(d.kind==='multi-space'){if(d.moved){notify();render();}else render();return;}
 if(d.kind==='freeflow'){if(Math.hypot(d.end.x-d.start.x,d.end.y-d.start.y)>12){const f={id:uid(),start:{x:d.start.x,y:d.start.y},end:{x:d.end.x,y:d.end.y},source:null,target:null,label:'',bend:60};applyPreset(f,model.selectedLinePreset);model.flows.push(f);selection={kind:'flow',id:f.id};tool='select';commit();showToast('Free-standing '+LINE_PRESETS[f.preset].label+' placed. Drag its endpoints; choose Arrow appearance in Properties.')}else rollbackDrag(d,{notifyHost:false});return;}const s=space(d.id);if(d.moved){if(d.kind==='resize')ensureContainment();notify();render();if(d.cloned&&s)startInline(s)}else{render();if(d.kind==='space'&&s)startInline(s);if(d.kind==='note'){const n=model.notes.find(x=>x.id===d.id);if(n)startNoteInline(n);}}}
function exportDiagramSVG(){return `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="790" viewBox="0 0 1100 790">${svgMarkup(true)}</svg>`;}
function exportPrintDiagram(){
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
 svg.setAttribute('xmlns',ns);svg.setAttribute('width','1100');svg.setAttribute('height','790');
 svg.setAttribute('viewBox','0 0 1100 790');svg.innerHTML=svgMarkup(true);
 // The first rectangle is the full-workspace background. Measure only drawable content.
 const bg=[...svg.children].find(e=>e.localName==='rect');
 const group=document.createElementNS(ns,'g');
 [...svg.children].filter(e=>e!==bg&&e.localName!=='defs').forEach(e=>group.appendChild(e));
 svg.appendChild(group);
 svg.style.cssText='position:fixed;left:-20000px;top:-20000px;opacity:0;pointer-events:none;';
 document.body.appendChild(svg);
 let bounds={x:0,y:0,width:1100,height:790};
 try{const q=group.getBBox();if(Number.isFinite(q.x)&&Number.isFinite(q.y)&&q.width>2&&q.height>2){
   const pad=Math.max(22,Math.min(45,Math.max(q.width,q.height)*.045));
   bounds={x:q.x-pad,y:q.y-pad,width:q.width+2*pad,height:q.height+2*pad};
 }}catch(err){console.warn('Print content bounds unavailable, falling back to full canvas',err)}
 svg.remove();
 const v=[bounds.x,bounds.y,bounds.width,bounds.height].map(x=>Number(x.toFixed(2)));
 // Extend background to cover artwork outside the fixed editable canvas.
 if(bg){bg.setAttribute('x',Math.min(0,v[0]));bg.setAttribute('y',Math.min(0,v[1]));
   bg.setAttribute('width',Math.max(1100,v[0]+v[2])-Math.min(0,v[0]));
   bg.setAttribute('height',Math.max(790,v[1]+v[3])-Math.min(0,v[1]));}
 svg.removeAttribute('style');
 return {svg:svg.outerHTML,viewBox:v.join(' ')};
}
function exportSVG(){download('ThinkIt_Bubble.svg',exportDiagramSVG(),'image/svg+xml')}
function download(name,text,mime){const blob=new Blob([text],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),7000)}
async function exportPNG(){try{const xml=exportDiagramSVG(),url=URL.createObjectURL(new Blob([xml],{type:'image/svg+xml'})),im=new Image();await new Promise((ok,bad)=>{im.onload=ok;im.onerror=bad;im.src=url});const canvas=document.createElement('canvas');canvas.width=2200;canvas.height=1580;canvas.getContext('2d').drawImage(im,0,0,2200,1580);URL.revokeObjectURL(url);canvas.toBlob(b=>{if(!b)return;const u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download='ThinkIt_Bubble.png';a.click();setTimeout(()=>URL.revokeObjectURL(u),7000)},'image/png')}catch(e){showToast('PNG export failed; use SVG export instead.')}}
function exportHostPNG(){exportPNG()}
function keydown(e){const isField=!!e.target.closest('input,select,textarea,[contenteditable]');if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'&&!isField){e.preventDefault();e.shiftKey?redo():undo();return}if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='s'){e.preventDefault();if(EMBEDDED)parent.postMessage({channel:CHANNEL,type:'save'},location.origin);else notify();return}if(isField)return;
if((e.metaKey||e.ctrlKey)&&e.altKey&&e.key.toLowerCase()==='c'){e.preventDefault();activatePainter();return;}
if((e.metaKey||e.ctrlKey)&&e.altKey&&e.key.toLowerCase()==='v'){e.preventDefault();if(paintSource&&selection.kind&&selection.id)applyPaintTo(selection.kind,selection.id);return;}
if(e.key==='Escape'){if(drag)pointerCancel();tool='select';flowSource=null;paintSource=null;selection={kind:null,id:null};editOutline=false;render();return}if((e.key==='Backspace'||e.key==='Delete')&&selection.kind){e.preventDefault();triggerAction('delete');return}if(e.key.toLowerCase()==='v'&&!e.ctrlKey&&!e.metaKey){tool='select';renderCanvas();return}if(e.key.toLowerCase()==='c'&&!e.ctrlKey&&!e.metaKey){tool='arrow';renderCanvas();return}if(e.key==='ArrowLeft'||e.key==='ArrowRight'||e.key==='ArrowUp'||e.key==='ArrowDown'){const s=space(selection.id);if(!s)return;e.preventDefault();const dir={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(e.shiftKey){const ids=selectionIds();if(rootGroupValid(selectedRoots(ids),dir[0]*12,dir[1]*12)){checkpoint();translateSelection(ids,dir[0]*12,dir[1]*12);commit();}else showToast('Movement blocked: locked bubble, nesting constraint, or canvas edge.');}else{if(selection.kind==='multi')return;let best=null,score=Infinity;for(const t of model.spaces){if(t.id===s.id)continue;const dx=t.x-s.x,dy=t.y-s.y,fwd=dx*dir[0]+dy*dir[1],cross=Math.abs(dx*dir[1]-dy*dir[0]);if(fwd>0&&fwd+cross*1.8<score){score=fwd+cross*1.8;best=t}}if(best){selection={kind:'space',id:best.id};render()}}return}}
function importUnderlay(f){if(!f)return;if(f.size>9*1024*1024){showToast('Choose an image below 9 MB for this offline project.');return;}if(!['image/png','image/jpeg','image/webp','image/gif'].includes(f.type)){showToast('Choose a PNG, JPEG, WebP or GIF image.');return;}const reader=new FileReader();reader.onerror=()=>showToast('Image file could not be read.');reader.onload=()=>{if(!safeUnderlayDataUrl(reader.result)){showToast('Image format is not supported.');return;}const im=new Image();im.onerror=()=>showToast('Image could not be decoded.');im.onload=()=>{if(!im.width||!im.height){showToast('Image has no usable dimensions.');return;}const ratio=Math.min((W-60)/im.width,(H-60)/im.height);checkpoint();model.underlay={data:reader.result,name:f.name,x:(W-im.width*ratio)/2,y:(H-im.height*ratio)/2,w:im.width*ratio,h:im.height*ratio,opacity:.4,angle:0,locked:true};selection={kind:'underlay',id:null};pane='canvas';model.generated=true;commit();showToast('Underlay imported. Unlock it to reposition and resize.');};im.src=reader.result};reader.readAsDataURL(f)}
function attach(){document.addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b){tab(b.dataset.view);return}const act=e.target.closest('[data-action]');if(act){triggerAction(act.dataset.action);return}const graphic=e.target.closest('[data-graphic-style]');if(graphic&&(selection.kind==='flow'||selection.kind==='relation')){if(selection.kind==='flow'){const f=model.flows.find(x=>x.id===selection.id);if(f){checkpoint();setArrowGraphicStyle(f,graphic.dataset.graphicStyle);commit();}}else{const r=model.relations[selection.id];if(r){checkpoint();setRelationGraphicStyle(r,graphic.dataset.graphicStyle);commit();}}return;}const role=e.target.closest('[data-border-role]');if(role){const ids=selection.kind==='multi'?(selection.ids||[]):selection.kind==='space'?[selection.id]:[];if(ids.length){checkpoint();for(const id of ids){const s=space(id);if(s){s.borderRole=role.dataset.borderRole;s.strokeStyle=BORDER_ROLES[s.borderRole].dash;s.strokeWidth=BORDER_ROLES[s.borderRole].weight;}}commit();}return;}const toggle=e.target.closest('[data-note-toggle]');if(toggle&&selection.kind==='note'){const n=model.notes.find(x=>x.id===selection.id);if(n){checkpoint();n[toggle.dataset.noteToggle]=!n[toggle.dataset.noteToggle];commit();}return;}const labelToggle=e.target.closest('[data-label-toggle]');if(labelToggle&&(selection.kind==='space'||selection.kind==='multi')){const k=labelToggle.dataset.labelToggle,ids=selection.kind==='multi'?selection.ids:[selection.id],objs=ids.map(space).filter(Boolean);if(objs.length){const next=!(k==='labelBold'?objs.every(s=>s.labelBold!==false):objs.every(s=>!!s[k]));checkpoint();for(const s of objs)s[k]=next;commit();}return;}const rem=e.target.closest('[data-remove]');if(rem){deleteSpace(rem.dataset.remove);return}});
document.addEventListener('change',update);$('firstSpace').onclick=$('addSpaceProgram').onclick=$('addSpaceMatrix').onclick=$('emptyAdd').onclick=()=>addSpace();$('auditMatrixBtn').onclick=$('auditCanvasBtn').onclick=openAudit;$('addTextNoteBtn').onclick=addTextNote;$('envGallerySun').onclick=()=>envGallery('sun');$('envGalleryWind').onclick=()=>envGallery('wind');$('addCanvasSpaceBtn').onclick=()=>{const s=addSpace(false);pane='canvas';selection={kind:'space',id:s.id};render();startInline(s)};$('ratingDefaultsMatrix').onclick=$('ratingDefaultsCanvas').onclick=manageRatingStyles;$('goMatrixBtn').onclick=()=>tab('matrix');$('goProgramBtn').onclick=()=>tab('program');$('backMatrixBtn').onclick=()=>tab('matrix');$('generateBtn').onclick=$('generateMatrixBtn').onclick=()=>generate(false);$('selectToolBtn').onclick=()=>{tool='select';renderCanvas()};$('arrowToolBtn').onclick=setFlow;$('semanticArrowPreset').innerHTML=lineStyleOptions(model.selectedLinePreset);$('graphicArrowStyle').innerHTML=arrowStyleOptions(model.selectedArrowStyle);$('graphicArrowStyle').onchange=e=>{checkpoint();const style=e.target.value;model.selectedArrowStyle=style;const f=selection.kind==='flow'?model.flows.find(x=>x.id===selection.id):null;if(f){setArrowGraphicStyle(f,style);commit();}else{notify();showToast('New arrows will use: '+GRAPHIC_ARROW_STYLES[style].label);renderCanvas();}};$('semanticArrowPreset').onchange=e=>{checkpoint();model.selectedLinePreset=e.target.value;notify();tool='arrow';flowSource=null;renderCanvas();showToast('Drawing '+LINE_PRESETS[model.selectedLinePreset].label+'. Select two bubbles.');};$('matrixHeaderMode').onchange=e=>{checkpoint();model.matrixHeaderMode=e.target.value;notify();renderMatrix();};
$('matrixPrevRows').onclick=()=>{matrixRowStart=Math.max(0,matrixRowStart-MATRIX_ROW_LIMIT);renderMatrix();};
$('matrixNextRows').onclick=()=>{matrixRowStart=Math.min(Math.max(0,Math.floor((model.spaces.length-1)/MATRIX_ROW_LIMIT)*MATRIX_ROW_LIMIT),matrixRowStart+MATRIX_ROW_LIMIT);renderMatrix();};
$('matrixGoRowBtn').onclick=()=>{matrixPageToRow(num($('matrixJumpRow').value,1)-1);renderMatrix();};
$('matrixJumpRow').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();matrixPageToRow(num(e.currentTarget.value,1)-1);renderMatrix();}});$('sizingMode').onchange=e=>{checkpoint();model.sizingMode=e.target.value;notify();renderCanvas();renderInspector();};$('paintBtn').onclick=activatePainter;$('fitBtn').onclick=fitView;$('themeSelect').onchange=e=>{checkpoint();model.theme=e.target.value;commit()};$('sketchIntensity').onchange=e=>{checkpoint();model.sketchStrength=clamp(num(e.target.value,2),1,3);commit()};let scaleEditActive=false;
 $('bubbleScaleRange').oninput=e=>{if(!scaleEditActive){checkpoint();scaleEditActive=true;}model.bubbleScale=clamp(num(e.target.value,1),.45,2.4);renderCanvas()};
 $('bubbleScaleRange').onchange=e=>{if(!scaleEditActive){checkpoint();model.bubbleScale=clamp(num(e.target.value,1),.45,2.4);}scaleEditActive=false;notify();renderInspector()};$('overlayBtn').onclick=$('importPlanBtn').onclick=()=>{if(model.underlay){pane='canvas';selection={kind:'underlay',id:null};render()}else $('underlayFile').click()};$('underlayFile').onchange=e=>{importUnderlay(e.target.files?.[0]);e.target.value=''};$('editZonesCanvasBtn').onclick=$('editZonesMatrixBtn').onclick=manageZones;$('undoBtn').onclick=undo;$('exportSvgBtn').onclick=exportSVG;$('addZoneBtn').onclick=manageZones;
const svg=$('diagram');svg.ondblclick=e=>{const el=e.target.closest('[data-note]');if(el){const n=model.notes.find(n=>n.id===el.dataset.note);if(n)startNoteInline(n);}};svg.onpointerdown=pointerDown;svg.onpointermove=pointerMove;svg.onpointerup=pointerUp;svg.onpointercancel=pointerCancel;document.addEventListener('keydown',keydown);
// Allow mouse-wheel zoom without stealing document scroll from the Program / Matrix tables.
svg.addEventListener('wheel',e=>{e.preventDefault();const p=svgPoint(e),factor=e.deltaY>0?1.08:1/1.08;const old=model.view||{x:0,y:0,w:W,h:H},newW=clamp(old.w*factor,250,4000),newH=newW*H/W;model.view={x:p.x-(p.x-old.x)*newW/old.w,y:p.y-(p.y-old.y)*newH/old.h,w:newW,h:newH};renderCanvas()},{passive:false});
}
window.addEventListener('message',e=>{if(!EMBEDDED||e.origin!==location.origin||e.source!==parent||e.data?.channel!==CHANNEL)return;const msg=e.data;if(msg.type==='export'){if(msg.kind==='svg')exportSVG();else if(msg.kind==='png')exportHostPNG();else if(msg.kind==='print-svg'){
 const used=[...new Set(model.spaces.map(s=>s.zone))],printArt=exportPrintDiagram();
 parent.postMessage({channel:CHANNEL,type:'print-svg',requestId:msg.requestId,pageId:hostPageId,svg:printArt.svg,contentViewBox:printArt.viewBox,
   title:String(model.title||'Bubble Diagram'),
   spaces:model.spaces.length,area:model.spaces.reduce((t,s)=>t+num(s.area,0),0),
   zones:used.map(name=>({name,fill:String(model.zones[name]?.fill||'#d9e8eb'),stroke:String(model.zones[name]?.stroke||'#527b8a')}))},location.origin);
 }else if(msg.kind==='print')window.print();return}if(msg.type==='load'){hostPageId=msg.pageId;model=upgrade(msg.model||fresh());history=[];redoStack=[];auditOpen=false;auditFocus=null;auditPreview=null;auditFeedback='';auditFilter='all';auditQuery='';auditPage=0;auditPlanPreview=null;auditPlanMessage='';$('auditPanel').classList.add('hidden');selection={kind:null,id:null};pane=model.generated?'canvas':'program';tool='select';editOutline=false;render()}});
if(!EMBEDDED){try{const saved=localStorage.getItem('diagramit-bubble-v085-local');if(saved)model=upgrade(JSON.parse(saved))}catch{}pane=model.generated?'canvas':'program';}
attach();render();if(EMBEDDED)parent.postMessage({channel:CHANNEL,type:'ready'},location.origin);

/* v0.9 command adapter. Same command IDs as the main editor's menus/ribbon. */
let shellClipboard=null;
function captureBubbleSelection(){
 if(selection.kind==='envGraphic'){const g=envItem(selection.id);return g?{envGraphics:[clone(g)],count:0}:null;}
 if(selection.kind==='note'){const n=(model.notes||[]).find(n=>n.id===selection.id);return n?{notes:[clone(n)],count:0,standaloneNote:true}:null;}
 const ids=selectionIds();if(!ids.length)return null;
 const keep=new Set(ids);let grown=true;
 while(grown){grown=false;for(const s of model.spaces)if(s.parentId&&keep.has(s.parentId)&&!keep.has(s.id)){keep.add(s.id);grown=true;}}
 const spaces=model.spaces.filter(s=>keep.has(s.id)).map(clone);
 const flows=model.flows.filter(f=>keep.has(f.source)&&keep.has(f.target)).map(clone),flowIds=new Set(flows.map(f=>f.id));
 const relations=Object.fromEntries(Object.entries(model.relations).filter(([k])=>k.split('|').every(id=>keep.has(id))).map(([k,v])=>[k,clone(v)]));
 const relationIds=new Set(Object.keys(relations));
 const notes=(model.notes||[]).filter(n=>(n.attachedTo&&keep.has(n.attachedTo))||(n.lineAnchor&&(n.lineAnchor.kind==='flow'?flowIds.has(n.lineAnchor.id):relationIds.has(n.lineAnchor.id)))).map(clone);
 return {spaces,flows,relations,notes,count:0};
}
function shellCopyObjects(cut=false){
 const c=captureBubbleSelection();if(!c){showToast('Select a bubble, environmental graphic, or note first.');return;}
 shellClipboard=c;
 if(cut){
   checkpoint();
   if(c.envGraphics)model.envGraphics=model.envGraphics.filter(g=>g.id!==selection.id);
   else if(c.standaloneNote)model.notes=model.notes.filter(n=>n.id!==selection.id);
   else{const ids=c.spaces.map(s=>s.id),clipNotes=new Set(c.notes.map(n=>n.id));removeSpacesCore(ids,false);model.notes=model.notes.filter(n=>!clipNotes.has(n.id));}
   selection={kind:null,id:null};commit();
 }
 showToast((cut?'Cut ':'Copied ')+(c.spaces?c.spaces.length+' bubble(s)':c.envGraphics?'environmental graphic':'note')+'.');
}
function shellPasteObjects(){
 const c=shellClipboard;if(!c){showToast('Nothing copied in ThinkIt.');return;}
 c.count++;const dx=35*c.count,dy=30*c.count;
 if(c.envGraphics?.length){checkpoint();const g={...clone(c.envGraphics[0]),id:uid(),x:c.envGraphics[0].x+dx,y:c.envGraphics[0].y+dy};model.envGraphics.push(g);pane='canvas';selection={kind:'envGraphic',id:g.id};commit();return;}
 if(c.standaloneNote){checkpoint();const n={...clone(c.notes[0]),id:uid(),x:c.notes[0].x+dx,y:c.notes[0].y+dy};
   if(n.lineAnchor){const p=notePosition(n);n.lineAnchor.dx=num(n.lineAnchor.dx,0)+dx;n.lineAnchor.dy=num(n.lineAnchor.dy,0)+dy;n.x=p.x+dx;n.y=p.y+dy;}
   model.notes.push(n);pane='canvas';selection={kind:'note',id:n.id};commit();return;}
 if(!c.spaces?.length)return;
 const idMap=new Map(c.spaces.map(s=>[s.id,uid()])),flowMap=new Map(c.flows.map(f=>[f.id,uid()]));
 checkpoint();const ids=[];
 for(const old of c.spaces){const sp=clone(old);sp.id=idMap.get(old.id);sp.x+=dx;sp.y+=dy;sp.pinned=false;sp.parentId=idMap.get(old.parentId)||'';model.spaces.push(sp);ids.push(sp.id);}
 for(const old of c.flows){const f=clone(old);f.id=flowMap.get(old.id);f.source=idMap.get(old.source);f.target=idMap.get(old.target);model.flows.push(f);}
 const relMap=new Map();for(const [key,val] of Object.entries(c.relations)){const [a,b]=key.split('|');if(!idMap.has(a)||!idMap.has(b))continue;const mapped=relationKey(idMap.get(a),idMap.get(b));model.relations[mapped]=clone(val);relMap.set(key,mapped);}
 for(const old of c.notes){const n=clone(old);n.id=uid();if(n.attachedTo)n.attachedTo=idMap.get(n.attachedTo)||'';
   if(n.lineAnchor){const k=n.lineAnchor.kind,ref=n.lineAnchor.id,mapped=k==='flow'?flowMap.get(ref):relMap.get(ref);if(mapped)n.lineAnchor={...n.lineAnchor,id:mapped};else n.lineAnchor=null;}
   n.x+=dx;n.y+=dy;model.notes.push(n);}
 model.generated=true;pane='canvas';selectBubbleIds(ids);commit();showToast('Pasted '+ids.length+' bubble(s) with linked annotations.');
}
function duplicateSelectionReliable(){
 const prior=shellClipboard,priorSelection=selection;
 const temporary=captureBubbleSelection();if(!temporary){showToast('Select bubbles, a note, or an environmental graphic to duplicate.');return;}
 try{shellClipboard=temporary;shellPasteObjects();}finally{shellClipboard=prior;}
}
function notifyShellState(){
  if(!EMBEDDED)return;
  try{parent.postMessage({channel:CHANNEL,type:'ui-state',pageId:hostPageId,pane,selection:selection.kind||'none',theme:model.theme,showAreas:!!model.showAreas,tool},location.origin)}catch{}
}
function runShellCommand(action,p={}){
  if(action==='view.audit'){openAudit();return;}
   if(action==='view.program'||action==='view.matrix'||action==='view.canvas'){tab(action.split('.')[1]);return;}
  if(action==='edit.undo'){undo();return;}if(action==='edit.redo'){redo();return;}
  if(action==='edit.copy'){shellCopyObjects();return;}if(action==='edit.cut'){shellCopyObjects(true);return;}if(action==='edit.paste'){shellPasteObjects();return;}
  if(action==='edit.delete'){deleteSelectionReliable();return;}
  if(action==='edit.duplicate'){duplicateSelectionReliable();return;}
  if(action==='edit.selectAll'){if(pane!=='canvas'){showToast('Select All operates on diagram objects.');return;}selection={kind:'multi',ids:model.spaces.map(s=>s.id)};render();return;}
  if(action==='edit.deselect'){selection={kind:null,id:null};render();return;}
  if(action==='edit.formatPainter'){activatePainter();return;}
  if(action==='insert.bubble'){addSpace(pane!=='canvas');if(pane==='canvas')render();return;}
  if(action==='insert.arrow'){if(pane!=='canvas')tab('canvas');setFlow();return;}
  if(action==='insert.text'){if(pane!=='canvas')tab('canvas');addTextNote();return;}
  if(action==='insert.underlay'){document.getElementById('importPlanBtn')?.click();return;}
  if(action==='insert.sun'){if(pane!=='canvas')tab('canvas');envGallery('sun');return;}
  if(action==='insert.wind'){if(pane!=='canvas')tab('canvas');envGallery('wind');return;}
  if(action==='format.zones'){manageZones();return;}
  if(action==='format.lineDefaults'){manageRatingStyles();return;}
  if(action==='format.presentation'){checkpoint();model.theme=p.value==='sketch'?'sketch':'formal';commit();return;}
  if(action==='format.showAreas'){checkpoint();model.showAreas=!!p.value;commit();return;}
  if(action==='format.sizing'){checkpoint();model.sizingMode=p.value==='conceptual'?'conceptual':'area';commit();return;}
  if(action==='format.quick'){
    const k=p.key, v=p.value;
    if(selection.kind==='envGraphic'){
      const g=envItem(selection.id);if(!g)return;
      if(['style','color','accent','layer','scale','thickness','angle'].includes(k)){checkpoint();g[k]=['scale','thickness','angle'].includes(k)?Number(v):v;Object.assign(g,envNorm(g));commit();}return;
    }
    if(selection.kind==='space'||selection.kind==='multi'){
      const ids=selection.kind==='space'?[selection.id]:selection.ids||[];
      checkpoint();for(const id of ids){const sp=space(id);if(!sp)continue;
        if(k==='labelFontSize')sp.labelFontSize=Number(v);
        else if(k==='borderRole'&&BORDER_ROLES[v]){sp.borderRole=v;sp.strokeStyle=BORDER_ROLES[v].dash;sp.strokeWidth=BORDER_ROLES[v].weight;}
        else if(k==='labelFont')sp.labelFont=v;
        else if(k==='labelAlign')sp.labelAlign=v;
      }commit();return;
    }
    if(selection.kind==='flow'||selection.kind==='relation'){
      const target=selection.kind==='flow'?model.flows.find(f=>f.id===selection.id):model.relations[selection.id];
      if(!target)return;checkpoint();
      if(k==='graphicStyle'){
        if(selection.kind==='relation')setRelationGraphicStyle(target,v);
        else setArrowGraphicStyle(target,v);
      }else if(['route','direction','dash','color','head'].includes(k))target[k]=v;
      else if(k==='thickness')target.thickness=Number(v);
      commit();return;
    }
    if(selection.kind==='note'){
      const note=(model.notes||[]).find(n=>n.id===selection.id);if(!note)return;checkpoint();
      if(k==='fontSize')note.fontSize=Number(v);
      if(k==='fillMode')note.fillMode=v;
      commit();return;
    }
    showToast('Select an object to format.');return;
  }
  if(action==='view.fit'){fitView();return;}
  if(action==='view.selectTool'){tool='select';renderCanvas();notifyShellState();return;}
  if(action==='file.exportSvg'){exportSVG();return;}
  if(action==='file.exportPng'){exportPNG();return;}
  if(action==='file.print'){window.print();return;}
  if(action==='help.guide'){showToast('Use Space Program → Matrix → Diagram; select a bubble to format it.');return;}
  showToast('This command is not yet available in the Bubble workspace.');
}
document.addEventListener('keydown',e=>{
 if(!EMBEDDED||!(e.metaKey||e.ctrlKey)||e.target.closest('input,select,textarea,[contenteditable]'))return;
 const key=e.key.toLowerCase();if(['c','x','v','d'].includes(key)&&!e.altKey){e.preventDefault();e.stopImmediatePropagation();runShellCommand(key==='c'?'edit.copy':key==='x'?'edit.cut':key==='v'?'edit.paste':'edit.duplicate')}
},true);
window.addEventListener('message',e=>{
  if(!EMBEDDED||e.origin!==location.origin||e.source!==parent||e.data?.channel!==CHANNEL)return;
  if(e.data.type==='ui-command'){
    try{runShellCommand(e.data.action,e.data.payload||{});notifyShellState();parent.postMessage({channel:CHANNEL,type:'ui-command-result',requestId:e.data.requestId,ok:true},location.origin)}
    catch(err){console.error('DiagramIt Bubble adapter',err);parent.postMessage({channel:CHANNEL,type:'ui-command-result',requestId:e.data.requestId,ok:false,error:String(err.message||err)},location.origin)}
  }
});
