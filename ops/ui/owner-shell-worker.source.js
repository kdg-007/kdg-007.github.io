const CACHE='liveit-owner-shell-entry-v3';
const INITIAL=['/','/manifest.webmanifest','/assets/owner-entry-v2.js','/partners/connected/'];
// A stalled connection (common when an installed app wakes on iPad/iPhone) must never
// leave a blank screen: after NETWORK_WAIT a saved copy is used if there is one, and
// after GIVE_UP the page is told it could not be reached instead of waiting forever.
const NETWORK_WAIT=2500, GIVE_UP=25000;
const SHELLS=path=>path==='/partners/connected/'||path.startsWith('/partners/travelit/')||path.startsWith('/thinkit/');
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 for(const path of INITIAL){const response=await fetch(path,{cache:'no-store'});if(!response.ok)throw Error('Live shell resource unavailable');await cache.put(path,response);}
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('message',event=>{if(event.data?.type==='owner-shell-version')event.ports?.[0]?.postMessage({version:CACHE});});
const wait=ms=>new Promise(resolve=>setTimeout(()=>resolve('timeout'),ms));
const settle=promise=>promise.then(response=>({response}),error=>({error}));
async function saved(cache,request,url,document){
 const hit=await cache.match(request);
 if(hit)return hit;
 if(document&&SHELLS(url.pathname))return await cache.match(url.pathname)||await cache.match(request,{ignoreSearch:true});
 if(document&&(url.pathname==='/'||url.pathname==='/index.html'))return cache.match('/');
}
const unreachable=()=>new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Not reachable</title><style>body{margin:0;min-height:100vh;display:grid;place-content:center;gap:16px;text-align:center;background:#10212d;color:#e7f0f2;font:16px system-ui;padding:24px}a{color:#10212d;background:#9ce7db;border-radius:10px;padding:12px 20px;text-decoration:none;font-weight:600;justify-self:center}</style></head><body><p>Couldn\'t reach your apps. Check your connection, then try again.</p><a href="">Try again</a></body></html>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/auth/')||url.pathname.startsWith('/api/')||['code','state','access_token','id_token'].some(key=>url.searchParams.has(key)))return;
 const document=request.mode==='navigate';
 if(!document&&!/\.(?:js|mjs|css|webmanifest|svg|png|jpg|jpeg|woff2|wasm)$/.test(url.pathname))return;
 // Fingerprinted code is immutable; documents and mutable entry points check the network first.
 const immutable=!document&&/\/assets\/[^/]+-[A-Za-z0-9]{8,}\.(?:js|mjs|css)$/.test(url.pathname);
 const open=caches.open(CACHE);
 // Keep the worker alive until the background save finishes, even if a saved copy was shown first.
 let release;event.waitUntil(new Promise(resolve=>release=resolve));
 let network=null;
 const fromNetwork=()=>network||(network=(async()=>{
  try{
   const response=await fetch(request,{cache:'no-store'});
   if(response.ok&&response.type==='basic'){
    // Save in the background: the page gets the response while it is still downloading.
    const cache=await open,saves=[cache.put(request,response.clone())];
    if(document&&SHELLS(url.pathname))saves.push(cache.put(url.pathname,response.clone()));
    Promise.all(saves).catch(()=>{}).then(release);
   }else release();
   return response;
  }catch(error){release();throw error;}
 })());
 event.respondWith((async()=>{
  const cache=await open;
  if(immutable){const hit=await cache.match(request);if(hit){release();return hit;}}
  const first=await Promise.race([settle(fromNetwork()),wait(NETWORK_WAIT)]);
  if(first!=='timeout'&&first.response)return first.response;
  const hit=await saved(cache,request,url,document);
  if(hit)return hit;
  const last=first==='timeout'?await Promise.race([settle(fromNetwork()),wait(GIVE_UP)]):first;
  if(last!=='timeout'&&last.response)return last.response;
  if(document)return unreachable();
  throw last.error||Error('Network timeout');
 })());
});
