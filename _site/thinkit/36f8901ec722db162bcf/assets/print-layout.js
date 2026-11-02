
(()=>{'use strict';
const $=id=>document.getElementById(id),mmPx=96/25.4;
const paper={A4:[210,297],A3:[297,420],A2:[420,594],Letter:[215.9,279.4],Legal:[215.9,355.6]};
const contentViewBox=document.getElementById('diagramSlot').dataset.contentViewBox;const canvasViewBox='0 0 1100 790';
const diagram=$('diagramSlot').querySelector('svg');
const fields=['paper','orientation','margins','framing','scale','halign','valign','offsetX','offsetY'];
function value(id){return $(id).value}
function calculate(){
 const p=paper[value('paper')]||paper.A4;const landscape=value('orientation')==='landscape';const width=landscape?Math.max(...p):Math.min(...p),height=landscape?Math.min(...p):Math.max(...p);
 const margin=Number(value('margins'))||10;
 const sheet=$('sheet');sheet.style.width=width+'mm';sheet.style.height=height+'mm';sheet.style.padding=margin+'mm';
 $('pageRules').textContent='@page{size:'+width+'mm '+height+'mm;margin:0}';
 $('pageInfo').textContent=value('paper')+' '+value('orientation')+' · '+Math.round(width)+' × '+Math.round(height)+' mm · 1 page';
 const box=$('diagramSlot'),cw=box.clientWidth,ch=box.clientHeight;
 const vb=(value('framing')==='canvas'?canvasViewBox:contentViewBox).split(/[,\s]+/).map(Number);
 const bx=vb[0],by=vb[1],bw=Math.max(1,vb[2]),bh=Math.max(1,vb[3]);
 diagram.setAttribute('viewBox',vb.join(' '));diagram.setAttribute('preserveAspectRatio','xMidYMid meet');
 // All dimensions below are CSS pixels; print uses identical CSS dimensions at 96px/in.
 const factor=Math.min(cw/bw,ch/bh)*(Number(value('scale'))||100)/100;
 const aw=bw*factor,ah=bh*factor;
 const dx=(Number(value('offsetX'))||0)*mmPx,dy=(Number(value('offsetY'))||0)*mmPx;
 const ha=value('halign'),va=value('valign');
 const left=(ha==='left'?0:ha==='right'?cw-aw:(cw-aw)/2)+dx;
 const top=(va==='top'?0:va==='bottom'?ch-ah:(ch-ah)/2)+dy;
 Object.assign(diagram.style,{width:aw+'px',height:ah+'px',left:left+'px',top:top+'px'});
 $('scaleValue').textContent=value('scale')+'%';
 const clipped=left < -1||top < -1||left+aw > cw+1||top+ah>ch+1;
 const warn=$('warning');warn.hidden=!clipped;if(clipped)warn.textContent='The artwork extends beyond the printable drawing area. Choose “Fit and center diagram,” reduce its size, or remove the shift to prevent clipping.';
 const stage=$('stageArea'),maxW=Math.max(220,stage.clientWidth-38),maxH=Math.max(220,stage.clientHeight-30);
 const sw=sheet.offsetWidth,sh=sheet.offsetHeight;
 const zoom=Math.min(1,maxW/sw,maxH/sh);
 sheet.style.transform='scale('+zoom+')';
 $('sheetHost').style.width=(sw*zoom)+'px';$('sheetHost').style.height=(sh*zoom)+'px';
}
function fit(){ $('framing').value='content';$('scale').value='100';$('offsetX').value='0';$('offsetY').value='0';$('halign').value='center';$('valign').value='center';calculate(); }
fields.forEach(id=>$(id).addEventListener(id==='scale'?'input':'change',calculate));$('fit').addEventListener('click',fit);
$('print').addEventListener('click',()=>{calculate();window.focus();window.print();});
window.addEventListener('resize',calculate);
requestAnimationFrame(()=>requestAnimationFrame(calculate));
})();
