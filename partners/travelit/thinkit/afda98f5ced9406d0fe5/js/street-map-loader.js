/** Keep the street-map runtime off the startup path for trips and other views. */
export function createStreetMapLoader({document:doc=globalThis.document,getRuntime=()=>globalThis.L,timeoutMs=12000}={}){
 let pending=null;
 return function load(){
  if(getRuntime())return Promise.resolve(getRuntime());
  if(pending)return pending;
  pending=new Promise((resolve,reject)=>{
   const script=doc.createElement('script');let timer;
   const finish=error=>{
    clearTimeout(timer);script.onload=null;script.onerror=null;
    if(error){script.remove();reject(error);}else resolve(getRuntime());
   };
   script.src=new URL('../vendor/leaflet/leaflet.js',import.meta.url).href;script.async=true;
   script.onload=()=>finish(getRuntime()?null:Error('Street-map runtime did not initialize.'));
   script.onerror=()=>finish(Error('Street-map runtime could not load.'));
   timer=setTimeout(()=>finish(Error('Street-map runtime timed out.')),timeoutMs);
   doc.head.append(script);
  }).catch(error=>{pending=null;throw error;});
  return pending;
 };
}
export const loadStreetMapRuntime=createStreetMapLoader();
