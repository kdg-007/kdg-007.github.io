// The pinned Playwright WebKit patch fails local Blob loads when setOffline is
// enabled. Cut HTTP(S) at routing instead, retaining local file APIs. This still
// blocks every HTTP request and sets navigator.onLine=false in every live frame.
// Source: microsoft/playwright v1.56.1 browser_patches/webkit/patches/bootstrap.diff
// WebLoaderStrategy::scheduleLoad's unconditional m_emulateOfflineState check.
const states=new WeakMap();
export async function setOriginalTestOffline(context,offline){
 if(context.browser().browserType().name()!=='webkit')return context.setOffline(offline);
 let state=states.get(context);
 if(!state){
  state={offline:false};states.set(context,state);
  await context.route('**/*',route=>state.offline&&/^https?:/.test(route.request().url())?route.abort('internetdisconnected'):route.fallback());
 }
 state.offline=offline;
 for(const page of context.pages())for(const frame of page.frames())if(!frame.isDetached())await frame.evaluate(offline=>{
  if(offline)Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false});
  else delete navigator.onLine;
  window.dispatchEvent(new Event(offline?'offline':'online'));
 },offline);
}
