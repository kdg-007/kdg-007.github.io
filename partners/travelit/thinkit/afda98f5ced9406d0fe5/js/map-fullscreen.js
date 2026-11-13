// Map expansion remains available when native fullscreen is unsupported or
// refused inside an embedded/mobile browser. No map instance is recreated.
export function createMapFullscreen({document:doc,onResize=()=>{}}){
 let nativeOwned=false;
 const active=()=>doc.documentElement.dataset.mapFullscreen==='true';
 function update(){
  for(const button of doc.querySelectorAll('[data-action="map-fullscreen"]')){
   button.textContent=active()?'Exit full screen':'Full screen';
   button.setAttribute('aria-pressed',String(active()));
  }
 }
 function set(value){doc.documentElement.dataset.mapFullscreen=String(value);update();onResize();}
 async function exit(){
  set(false);
  if(nativeOwned&&doc.fullscreenElement){
   try{await doc.exitFullscreen();}catch(error){set(true);throw error;}
  }
  nativeOwned=false;
 }
 async function toggle(){
  if(active())return exit();
  set(true);
  if(doc.fullscreenEnabled&&doc.documentElement.requestFullscreen){
   try{await doc.documentElement.requestFullscreen();nativeOwned=true;}
   catch{nativeOwned=false;/* Keep the in-app expansion and visible exit. */}
  }
  update();onResize();
 }
 doc.addEventListener('fullscreenchange',()=>{
  if(nativeOwned&&!doc.fullscreenElement){nativeOwned=false;set(false);}
 });
 doc.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&active()&&!doc.fullscreenElement&&!doc.querySelector('dialog[open],#modal-backdrop:not(.hidden)')){event.preventDefault();void exit();}
 });
 const viewObserver=new MutationObserver(()=>{
  if(active()&&doc.documentElement.dataset.workspaceView!=='map')void exit().catch(()=>{});
 });
 viewObserver.observe(doc.documentElement,{attributes:true,attributeFilter:['data-workspace-view']});
 return Object.freeze({active,update,toggle,exit});
}
