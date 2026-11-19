
/* ThinkIt print-layout: paper millimetres are authoritative; viewport zoom is preview-only. */
(()=>{'use strict';
const $=id=>document.getElementById(id),MM_TO_PX=96/25.4,SVG_NS='http://www.w3.org/2000/svg';
const RULER_INSET_MM=5,RULER_BAND_MM=6;
const SETTINGS_KEY='thinkit-print-page-settings-v1';
const choices={paper:['A4','A3','A2','Letter','Legal'],orientation:['landscape','portrait'],margins:['5','10','15','20']};
const rulerChoices=['rulerH','rulerV','rulerPrint'];
function restoreSettings(){
 try{const saved=JSON.parse(localStorage.getItem(SETTINGS_KEY));if(saved?.version!==1)return;
  for(const [id,allowed] of Object.entries(choices))if(allowed.includes(saved[id]))$(id).value=saved[id];
  for(const id of rulerChoices)if(typeof saved[id]==='boolean')$(id).checked=saved[id];
 }catch{}
}
function rememberSettings(){
 try{localStorage.setItem(SETTINGS_KEY,JSON.stringify({version:1,...Object.fromEntries(Object.keys(choices).map(id=>[id,$(id).value])),...Object.fromEntries(rulerChoices.map(id=>[id,$(id).checked]))}));}catch{}
}
const paper={A4:[210,297],A3:[297,420],A2:[420,594],Letter:[215.9,279.4],Legal:[215.9,355.6]};
const contentViewBox=document.getElementById('diagramSlot').dataset.contentViewBox,canvasViewBox='0 0 1100 790';
const diagram=$('diagramSlot').querySelector('svg');
const fields=['paper','orientation','margins','framing','scale','halign','valign','offsetX','offsetY','dimensionMode','unitMillimeters'];
function value(id){return $(id).value;}
function addControls(){
 const outer=document.createElement('section');outer.id='measurementControls';
 outer.innerHTML='<h2>Measured layout</h2>'+
  '<label for="dimensionMode">Artwork dimensions</label><select id="dimensionMode">'+
  '<option value="fit">Fit to printable area (not a physical drawing scale)</option>'+
  '<option value="physical">Physical scale · millimetres per drawing unit</option></select>'+
  '<label for="unitMillimeters">1 drawing unit equals (mm on paper)</label>'+
  '<input id="unitMillimeters" type="number" min="0.001" max="100" step="any" value="0.2" disabled>'+
  '<p class="muted">Physical mode retains the selected scale even if the artwork clips. '+
  'Use Fit when diagram coordinates are schematic rather than dimensional.</p>'+
  '<p id="artworkSize" class="muted" role="status"></p>'+
  '<h2>Paper rulers</h2><label class="check"><input id="rulerH" type="checkbox" checked> Horizontal (mm)</label>'+
  '<label class="check"><input id="rulerV" type="checkbox" checked> Vertical (mm)</label>'+
  '<label class="check"><input id="rulerPrint" type="checkbox"> Include rulers on printed sheet</label>'+
  '<p class="muted">Rulers measure from the paper edge. The first ticks sit 5 mm inside the sheet. '+
  'Print at 100%, turn off “Fit to page”, and check a 100 mm interval against a physical ruler.</p>';
 $('controls').insertBefore(outer,$('controls').querySelector('.buttons'));
 const css=document.createElement('style');
 css.textContent='#paperRulers{position:absolute;top:0;left:0;z-index:15;pointer-events:none;max-width:none;max-height:none}'+
  '#paperRulers text{font-family:Arial,sans-serif;font-weight:600;fill:#244353}'+
  '#paperRulers .ruler-band{fill:#ebf4f6;fill-opacity:.91}'+
  '#paperRulers .ruler-tick{stroke:#244353;stroke-width:.18}'+
  '#paperRulers .ruler-major{stroke-width:.32}'+
  '@media screen and (max-width:600px){body{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,45dvh) minmax(0,1fr);height:100dvh}#controls{height:auto;max-height:45dvh;border-right:0;border-bottom:1px solid #b8cacc}#stage{min-height:0}#stageHead{padding:8px;gap:8px;flex-wrap:wrap}#stageArea{padding:12px}}'+
  '@media print{#paperRulers:not(.print-rulers){display:none!important}#paperRulers.print-rulers{display:block!important}}';
 document.head.append(css);
 const ruler=document.createElementNS(SVG_NS,'svg');ruler.id='paperRulers';ruler.setAttribute('aria-hidden','true');$('sheet').append(ruler);
 for(const id of ['rulerH','rulerV','rulerPrint'])$(id).addEventListener('change',calculate);
}
function addSvg(parent,tag,attrs,text){
 const e=document.createElementNS(SVG_NS,tag);
 for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));
 if(text!==undefined)e.textContent=text;parent.append(e);return e;
}
function drawRulers(width,height){
 const svg=$('paperRulers');svg.replaceChildren();
 svg.setAttribute('width',width+'mm');svg.setAttribute('height',height+'mm');svg.setAttribute('viewBox','0 0 '+width+' '+height);
 const horizontal=$('rulerH').checked,vertical=$('rulerV').checked;
 svg.hidden=!(horizontal||vertical);
 svg.classList.toggle('print-rulers',$('rulerPrint').checked);
 const inset=RULER_INSET_MM,band=RULER_BAND_MM,density=5;
 if(horizontal){
  addSvg(svg,'rect',{x:inset,y:inset,width:width-inset*2,height:band,class:'ruler-band'});
  for(let mm=inset;mm<=width-inset;mm+=density){
   const major=mm%10===0;
   addSvg(svg,'line',{x1:mm,x2:mm,y1:inset,y2:inset+(major?3.5:2),class:major?'ruler-tick ruler-major':'ruler-tick'});
   if(major&&mm<=width-inset-6)addSvg(svg,'text',{x:mm+0.6,y:inset+5.3,'font-size':2.25},String(mm));
  }
 }
 if(vertical){
  addSvg(svg,'rect',{x:inset,y:horizontal?inset+band:inset,width:band,height:height-inset*2-(horizontal?band:0),class:'ruler-band'});
  for(let mm=inset;mm<=height-inset;mm+=density){
   const major=mm%10===0;
   // The first horizontal band covers the corner. Keep the 10 mm division
   // on each axis and omit only the overlapping vertical 5 mm minor tick.
   if(horizontal&&mm===inset)continue;
   addSvg(svg,'line',{x1:inset,x2:inset+(major?3.5:2),y1:mm,y2:mm,class:major?'ruler-tick ruler-major':'ruler-tick'});
   if(major&&mm<=height-inset-6){
    const x=inset+3.1,y=mm+1;
    addSvg(svg,'text',{x,y,'font-size':2.2,transform:'rotate(90 '+x+' '+y+')'},String(mm));
   }
  }
 }
}
function calculate(){
 const p=paper[value('paper')]||paper.A4,landscape=value('orientation')==='landscape';
 const width=landscape?Math.max(...p):Math.min(...p),height=landscape?Math.min(...p):Math.max(...p);
 const margin=Number(value('margins'))||10,sheet=$('sheet');
 sheet.style.width=width+'mm';sheet.style.height=height+'mm';sheet.style.padding=margin+'mm';
 if($('rulerPrint').checked){
  const gutter=Math.max(margin,RULER_INSET_MM+RULER_BAND_MM)+'mm';
  if($('rulerH').checked)sheet.style.paddingTop=gutter;
  if($('rulerV').checked)sheet.style.paddingLeft=gutter;
 }
 $('pageRules').textContent='@page{size:'+width+'mm '+height+'mm;margin:0}';
 $('pageInfo').textContent=value('paper')+' '+value('orientation')+' · '+width+' × '+height+' mm · 1 page';
 const box=$('diagramSlot'),size=getComputedStyle(box),cw=parseFloat(size.width),ch=parseFloat(size.height);
 const vb=(value('framing')==='canvas'?canvasViewBox:contentViewBox).split(/[,\s]+/).map(Number);
 const bw=Math.max(1,vb[2]),bh=Math.max(1,vb[3]);
 diagram.setAttribute('viewBox',vb.join(' '));diagram.setAttribute('preserveAspectRatio','xMidYMid meet');
 const physical=value('dimensionMode')==='physical';
 $('unitMillimeters').disabled=!physical;
 $('scale').disabled=physical;
 $('print').disabled=false;
 let factor;
 if(physical){
  const mm=Number(value('unitMillimeters'));
  if(!Number.isFinite(mm)||mm<0.001||mm>100){$('artworkSize').textContent='Enter a valid physical size to preview the artwork.';$('print').disabled=true;$('warning').hidden=false;$('warning').textContent='Enter a physical size from 0.001 to 100 mm per drawing unit.';return false;}
  factor=mm*MM_TO_PX;
 }else factor=Math.min(cw/bw,ch/bh)*(Number(value('scale'))||100)/100;
 const aw=bw*factor,ah=bh*factor;
 $('artworkSize').textContent='Artwork '+(aw/MM_TO_PX).toFixed(1)+' × '+(ah/MM_TO_PX).toFixed(1)+' mm · 1 drawing unit = '+(factor/MM_TO_PX).toFixed(3)+' mm on paper.';
 const dx=(Number(value('offsetX'))||0)*MM_TO_PX,dy=(Number(value('offsetY'))||0)*MM_TO_PX;
 const ha=value('halign'),va=value('valign');
 const left=(ha==='left'?0:ha==='right'?cw-aw:(cw-aw)/2)+dx;
 const top=(va==='top'?0:va==='bottom'?ch-ah:(ch-ah)/2)+dy;
 Object.assign(diagram.style,{width:aw+'px',height:ah+'px',left:left+'px',top:top+'px'});
 $('scaleValue').textContent=physical?'Physical':value('scale')+'%';
 const clipped=left < -1||top < -1||left+aw > cw+1||top+ah > ch+1;
 const warn=$('warning');warn.hidden=!clipped;
 if(clipped)warn.textContent='Artwork extends beyond the printable area. Reduce its physical size or shift, or use Fit to Page for schematic artwork.';
 drawRulers(width,height);
 const stage=$('stageArea'),maxW=Math.max(220,stage.clientWidth-38),maxH=Math.max(220,stage.clientHeight-30);
 const sw=sheet.offsetWidth,sh=sheet.offsetHeight,zoom=Math.min(1,maxW/sw,maxH/sh);
 sheet.style.transform='scale('+zoom+')';
 $('sheetHost').style.width=(sw*zoom)+'px';$('sheetHost').style.height=(sh*zoom)+'px';
 return true;
}
function fit(){$('framing').value='content';$('dimensionMode').value='fit';$('unitMillimeters').disabled=true;$('scale').value='100';$('offsetX').value='0';$('offsetY').value='0';$('halign').value='center';$('valign').value='center';calculate();}
addControls();
restoreSettings();
[...Object.keys(choices),...rulerChoices].forEach(id=>$(id).addEventListener('change',rememberSettings));
fields.forEach(id=>$(id).addEventListener(['scale','unitMillimeters'].includes(id)?'input':'change',calculate));
$('fit').addEventListener('click',fit);
$('print').addEventListener('click',()=>{if(calculate()){window.focus();window.print();}});
window.addEventListener('resize',calculate);
window.addEventListener('beforeprint',calculate);
window.addEventListener('afterprint',calculate);
document.fonts?.ready.then(calculate);
requestAnimationFrame(()=>requestAnimationFrame(calculate));
})();
