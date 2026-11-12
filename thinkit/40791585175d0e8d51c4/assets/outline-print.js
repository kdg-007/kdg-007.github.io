/* T22-E · printable full outline. Receives only bounded read-only snapshot from same-origin parent. */
(()=>{'use strict';
 const channel='thinkit-outline-print-v1';
 const $=id=>document.getElementById(id);
 let accepted=false;
 const fields=['code','label','dependencies','parent'];
 function accept(event){
  if(accepted||event.origin!==location.origin||event.source!==window.opener)return;
  const data=event.data;
  if(data?.channel!==channel||data.type!=='data'||!Array.isArray(data.rows)||data.rows.length>25000)return;
  if(typeof data.title!=='string'||data.title.length>250||typeof data.codeLabel!=='string'||data.codeLabel.length>64)return;
  if(data.rows.some(r=>!r||fields.some(k=>typeof r[k]!=='string'||r[k].length>5000)))return;
  accepted=true;
  $('title').textContent=data.title;$('mode').textContent=({flow:'Flowchart',mind:'Mind Map',org:'Organization Chart'})[data.mode]||'Outline';
  $('codeHead').textContent=data.codeLabel;
  $('nameHead').textContent=data.mode==='org'?'Position / Unit':'Activity / Item';
  $('depsHead').textContent=data.mode==='org'?'Department / Unit':'Dependencies';
  $('parentHead').textContent=data.mode==='org'?'Reports To':'Parent / Group';
  const fragment=document.createDocumentFragment();
  for(const row of data.rows){const tr=document.createElement('tr');for(const key of fields){const cell=document.createElement('td');cell.textContent=row[key];tr.append(cell);}fragment.append(tr);}
  $('rows').append(fragment);
  $('footer').textContent=data.rows.length+' items · snapshot only; printing does not change the diagram';
  $('state').textContent='Ready · '+data.rows.length+' items';$('print').disabled=false;
 }
 window.addEventListener('message',accept);
 $('print').addEventListener('click',()=>{if(accepted)window.print();});
 if(window.opener)window.opener.postMessage({channel,type:'ready'},location.origin);
})();
