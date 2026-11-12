(function(){
'use strict';
const CHANNEL='thinkit-bmc-v1',KEYS=['partners','activities','resources','value','relationships','channels','segments','costs','revenue'],MAX=8*1024*1024;
const BLOCK_MAX=2500000;
let currentPage=null,session=null,selected=null,range=null,ready=false,lastBlocks='',loadingImage=false;
const editors=Object.fromEntries(KEYS.map(k=>[k,document.querySelector('[data-key="'+k+'"] .editor')]));
const status=document.getElementById('status');
function notice(s,error=false){status.textContent=s;error?status.dataset.error='1':delete status.dataset.error;}
function allowedImage(s){return typeof s==='string'&&s.length<1500000&&/^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(s);}
const tags=new Set(['B','I','U','STRONG','EM','S','P','DIV','BR','UL','OL','LI','TABLE','CAPTION','THEAD','TBODY','TFOOT','TR','TH','TD','IMG','ASIDE','H1','H2','H3','H4','BLOCKQUOTE','SPAN']);
function sanitize(html){
 const template=document.createElement('template');template.innerHTML=String(html||'');
 function clean(node){
  if(node.nodeType===Node.TEXT_NODE)return document.createTextNode(node.textContent);
  if(node.nodeType!==Node.ELEMENT_NODE)return document.createDocumentFragment();
  const tag=node.tagName;
  if(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','SVG','MATH','FORM','INPUT','BUTTON','LINK','META'].includes(tag))return document.createDocumentFragment();
  const el=document.createElement(tags.has(tag)?tag.toLowerCase():'span');
  if(tag==='IMG'){if(!allowedImage(node.getAttribute('src')))return document.createDocumentFragment();el.setAttribute('src',node.getAttribute('src'));el.setAttribute('alt',String(node.getAttribute('alt')||'Picture').slice(0,200));}
  if(tag==='ASIDE'&&node.classList.contains('bmc-note'))el.className='bmc-note';
  if(tag==='TD'||tag==='TH')for(const key of ['rowspan','colspan']){
   const span=Number(node.getAttribute(key));if(Number.isInteger(span)&&span>1&&span<=20)el.setAttribute(key,String(span));
  }
  if(['SPAN','P','DIV','H1','H2','H3','H4'].includes(tag)){
   const style=node.style;
   if(['bold','600','700','800','900'].includes(style.fontWeight))el.style.fontWeight='bold';
   if(style.fontStyle==='italic')el.style.fontStyle='italic';
   if(['underline','line-through'].includes(style.textDecorationLine))el.style.textDecorationLine=style.textDecorationLine;
   if(['left','center','right','justify'].includes(style.textAlign))el.style.textAlign=style.textAlign;
  }
  for(const child of [...node.childNodes])el.append(clean(child));
  return el;
 }
 const out=document.createElement('div');for(const node of [...template.content.childNodes])out.append(clean(node));return out.innerHTML;
}
function readModel(){
 const blocks={};for(const k of KEYS){blocks[k]=sanitize(editors[k].innerHTML);}
 const data={format:'thinkit-bmc',version:1,blocks,updatedAt:new Date().toISOString()};
 if(Object.values(blocks).some(block=>block.length>BLOCK_MAX)||new TextEncoder().encode(JSON.stringify(data)).length>MAX)throw Error('Canvas exceeds 8 MiB. Reduce image size or number of pictures.');
 return data;
}
function send(){
 if(!ready||!currentPage)return;
 try{
  const model=readModel(),serialized=JSON.stringify(model.blocks);
  if(serialized===lastBlocks)return;
  if(!parent.thinkItAcceptBmcEdit?.(window,{session,pageId:currentPage,model}))
   throw Error('This canvas could not update the active project. Keep this page open and copy the latest edits.');
  lastBlocks=serialized;notice('Edits queued for device save');
 }
 catch(err){notice(err.message,true);}
}
function load(data){
 if(!data||data.format!=='thinkit-bmc'||data.version!==1||!data.blocks||typeof data.blocks!=='object')data={blocks:{}};
 // A fresh editable root separates native undo history between page loads.
 for(const k of KEYS){
  const value=typeof data.blocks[k]==='string'?data.blocks[k]:'';
  const editor=editors[k].cloneNode(false);editor.innerHTML=sanitize(value);
  editors[k].replaceWith(editor);editors[k]=editor;
 }
 selected=null;range=null;lastBlocks=JSON.stringify(Object.fromEntries(KEYS.map(key=>[key,editors[key].innerHTML])));
 notice('Ready · local project autosave');
}
function rememberSelection(){
 const selection=getSelection(),field=selected;
 if(field&&selection.rangeCount&&field.contains(selection.anchorNode)&&field.contains(selection.focusNode)){
  range=selection.getRangeAt(0).cloneRange();
 }
}
function focusEditor(){
 const field=selected||editors.value;
 field.focus({preventScroll:true});
 const selection=getSelection(),saved=range&&field.contains(range.commonAncestorContainer);
 const next=saved?range:document.createRange();
 if(!saved){next.selectNodeContents(field);next.collapse(false);}
 selection.removeAllRanges();selection.addRange(next);
 return field;
}
function insertHtml(html){
 if(!ready)return;
 const field=selected||editors.value;
 try{
  const model=readModel(),key=field.closest('[data-key]').dataset.key;
  model.blocks[key]+=html;
  if(model.blocks[key].length>BLOCK_MAX||new TextEncoder().encode(JSON.stringify(model)).length>MAX)throw Error('Content limit reached. Remove a picture or shorten this section.');
 }catch(error){notice(error.message,true);return;}
 focusEditor();document.execCommand('insertHTML',false,html);rememberSelection();send();
}
const canvas=document.getElementById('canvas');
canvas.addEventListener('focusin',e=>{
 const field=e.target.closest('.editor');if(field&&field!==selected){selected=field;range=null;}
});
document.addEventListener('selectionchange',rememberSelection);
canvas.addEventListener('input',()=>{rememberSelection();send();});
canvas.addEventListener('paste',e=>{
 if(!e.target.closest('.editor'))return;
 e.preventDefault();rememberSelection();
 const clipboard=e.clipboardData;
 const rich=clipboard?.getData('text/html');
 const text=document.createElement('div');text.textContent=clipboard?.getData('text/plain')||'';
 try{insertHtml(rich?sanitize(rich):text.innerHTML.replace(/\r?\n/g,'<br>'));}
 catch(err){notice(err.message,true);}
});
canvas.addEventListener('drop',e=>e.preventDefault());
document.querySelectorAll('.toolbar button').forEach(button=>button.addEventListener('mousedown',e=>{
 rememberSelection();e.preventDefault();
}));
document.querySelectorAll('[data-cmd]').forEach(button=>button.addEventListener('click',()=>{
 if(!ready)return;
 focusEditor();document.execCommand(button.dataset.cmd,false,button.dataset.value||null);rememberSelection();send();
}));
document.getElementById('addNote').onclick=()=>insertHtml('<aside class="bmc-note"><strong>Note</strong><div>Type your observation here.</div></aside><p><br></p>');
document.getElementById('addTable').onclick=()=>insertHtml('<table><tbody><tr><th>Item</th><th>Details</th></tr><tr><td>Item 1</td><td>Details</td></tr></tbody></table><p><br></p>');
function extendTable(column){
 if(!ready)return;
 const field=focusEditor(),anchor=getSelection().anchorNode;
 const cell=(anchor?.nodeType===Node.ELEMENT_NODE?anchor:anchor?.parentElement)?.closest('td,th');
 if(!cell||!field.contains(cell)){notice('Place the cursor in a table cell first.',true);return;}
 const table=cell.closest('table'),row=cell.parentElement,index=cell.cellIndex;
 if((column&&row.cells.length>=12)||(!column&&table.rows.length>=40)){
  notice('Table limit is 12 columns and 40 rows.',true);return;
 }
 if([...table.querySelectorAll('td,th')].some(cell=>cell.colSpan>1||cell.rowSpan>1)){
  notice('Add row and column support tables without merged cells.',true);return;
 }
 // A replacement is one native undo step, including when the table came from a paste.
 const copy=table.cloneNode(true),target=copy.rows[row.rowIndex];
 if(column){
  for(const item of copy.rows){
   const next=document.createElement(item.cells[0]?.tagName==='TH'?'th':'td');
   next.append(document.createElement('br'));item.insertBefore(next,item.cells[index+1]||null);
  }
 }else{
  const next=document.createElement('tr');
  for(let i=0;i<target.cells.length;i++)next.insertCell().append(document.createElement('br'));
  if(target.parentElement.tagName==='THEAD')(copy.tBodies[0]||copy.createTBody()).prepend(next);
  else target.after(next);
 }
 range=document.createRange();range.selectNode(table);
 getSelection().removeAllRanges();getSelection().addRange(range);
 document.execCommand('insertHTML',false,copy.outerHTML);rememberSelection();send();
}
document.getElementById('addRow').onclick=()=>extendTable(false);
document.getElementById('addColumn').onclick=()=>extendTable(true);
document.getElementById('addImage').onclick=()=>document.getElementById('imagePicker').click();
document.getElementById('imagePicker').onchange=async e=>{
 const file=e.target.files?.[0];e.target.value='';if(!file||loadingImage)return;
 if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)||file.size>1050000){notice('Use a PNG/JPEG/WebP/GIF image under 1 MB.',true);return;}
 const owner={page:currentPage,session,field:selected||editors.value,range};
 loadingImage=true;
 try{
  const reader=new FileReader();
  const url=await new Promise((resolve,reject)=>{reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Could not read the picture.'));reader.readAsDataURL(file);});
  if(!allowedImage(url))throw Error('Unsupported picture format.');
  const image=new Image();image.src=url;
  await image.decode();
  if(owner.page!==currentPage||owner.session!==session)return;
  selected=owner.field;range=owner.range;
  image.alt=file.name.slice(0,200);
  insertHtml(image.outerHTML+'<p><br></p>');
 }catch(err){if(owner.page===currentPage&&owner.session===session)notice(err.message,true);}
 finally{loadingImage=false;}
};
function setTitle(title){document.getElementById('canvasTitle').textContent=String(title||'Business model').slice(0,180);}
function paperSize(){return document.getElementById('paper').value==='A4'?[297,210]:[420,297];}
function setPaper(){
 const [w,h]=paperSize();
 const style=document.getElementById('printSize');
 style.textContent='@page{size:'+w+'mm '+h+'mm;margin:0}@media print{html,body{width:'+w+'mm!important;height:'+h+'mm!important}.sheet{width:'+w+'mm!important;min-height:'+h+'mm!important;max-height:'+h+'mm!important}.canvas{height:'+(h-37)+'mm!important}}';
 document.getElementById('sheet').style.width=w+'mm';
 document.getElementById('sheet').style.minHeight=h+'mm';
 document.getElementById('canvas').style.height=(h-37)+'mm';
}
function requestPrint(){
 if(!ready)return;
 const sheet=document.getElementById('sheet'),images=[...sheet.querySelectorAll('img')];
 if(loadingImage||images.some(image=>!image.complete)){notice('Wait for the pictures to load before printing.',true);return;}
 const [width,height]=paperSize();
 const proof=sheet.cloneNode(true);
 proof.removeAttribute('id');proof.querySelectorAll('[id]').forEach(element=>element.removeAttribute('id'));
 proof.classList.add('print-proof');
 Object.assign(proof.style,{width:width+'mm',height:height+'mm',minHeight:height+'mm'});
 proof.querySelectorAll('img').forEach((image,index)=>{
  image.width=images[index].naturalWidth;image.height=images[index].naturalHeight;
 });
 sheet.after(proof);
 const clipped=[...proof.querySelectorAll('.block')].filter(block=>{
  const editor=block.querySelector('.editor');
  return editor.scrollHeight>editor.clientHeight+2||editor.scrollWidth>editor.clientWidth+2;
 }).map(block=>block.querySelector('.editor').getAttribute('aria-label'));
 const pageOverflow=proof.scrollHeight>proof.clientHeight+2;
 proof.remove();
 if(clipped.length||pageOverflow){
  notice('Print would clip '+(clipped.length?clipped.join(', '):'the page heading or footer')+'. Choose larger paper or shorten that content.',true);
  return;
 }
 send();window.focus();window.print();
}
document.getElementById('paper').onchange=setPaper;
document.getElementById('print').onclick=requestPrint;
window.addEventListener('message',e=>{
 if(e.origin!==location.origin||e.source!==parent||e.data?.channel!==CHANNEL)return;
 if(e.data.type==='theme'){document.body.dataset.theme=e.data.theme==='dark'?'dark':'light';return;}
 if(e.data.type==='command'&&e.data.action==='print'&&e.data.session===session&&e.data.pageId===currentPage){requestPrint();return;}
 if(e.data.type==='title'&&e.data.session===session&&e.data.pageId===currentPage){setTitle(e.data.title);return;}
 if(e.data.type!=='load')return;
 const {pageId,model,theme,title}=e.data;
 if(typeof pageId!=='string'||!pageId||pageId.length>256)return;
 currentPage=pageId;session=e.data.session;ready=false;load(model);setTitle(title);
 document.body.dataset.theme=theme==='dark'?'dark':'light';ready=true;
});
setPaper();parent.postMessage({channel:CHANNEL,type:'ready'},location.origin);
})();
