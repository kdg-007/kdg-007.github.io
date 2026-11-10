/* Shared by the standalone and connected ThinkIt shells. */
function mountThinkItBusinessModel({getDocument,getPage,makeSession,markDirty}){
 const channel='thinkit-bmc-v1';
 const keys=['partners','activities','resources','value','relationships','channels','segments','costs','revenue'];
 const frame=document.getElementById('bmcFrame');
 let ready=false,project=null,session=null,pageId=null,title=null,theme=null;

 function validModel(model){
  return model?.format==='thinkit-bmc'&&model.version===1&&model.blocks&&
   keys.every(key=>typeof model.blocks[key]==='string'&&model.blocks[key].length<=2500000)&&
   new TextEncoder().encode(JSON.stringify(model)).length<=8*1024*1024;
 }

 function send(type,data){
  frame.contentWindow.postMessage({channel,session,pageId,type,...data},location.origin);
 }

 function activate(){
  const page=getPage();
  if(page?.mode!=='bmc'||!document.body.classList.contains('bmc-active'))return;
  if(!frame.getAttribute('src')){frame.src='/thinkit/business-model.html?v=bmc-1';return;}
  if(project!==getDocument()){project=getDocument();session=makeSession();pageId=null;}
  if(!ready)return;
  const nextTheme=document.documentElement.style.colorScheme||document.body.dataset.theme;
  if(pageId!==page.id){
   pageId=page.id;title=page.name;theme=nextTheme;
   send('load',{model:page.bmcData,title,theme});
   return;
  }
  if(title!==page.name){title=page.name;send('title',{title});}
  if(theme!==nextTheme){theme=nextTheme;send('theme',{theme});}
 }

 // Save or navigation can run in the same turn as input. Update the parent
 // project synchronously and only accept edits from its current editor session.
 window.thinkItAcceptBmcEdit=(source,message)=>{
  const page=getPage();
  if(source!==frame.contentWindow||project!==getDocument()||message?.session!==session||
   message.pageId!==pageId||page?.mode!=='bmc'||page.id!==pageId||!validModel(message.model))return false;
  if(JSON.stringify(page.bmcData)!==JSON.stringify(message.model)){page.bmcData=message.model;markDirty();}
  return true;
 };
 window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==frame.contentWindow||
   event.data?.channel!==channel||event.data.type!=='ready')return;
  ready=true;pageId=null;activate();
 });
 new MutationObserver(activate).observe(document.documentElement,{attributeFilter:['style']});
 return {activate,validModel,print(){if(ready)send('command',{action:'print'});}};
}
