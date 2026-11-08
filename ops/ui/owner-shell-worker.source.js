const CACHE='liveit-owner-shell-entry-v3';
const INITIAL=['/','/manifest.webmanifest','/assets/owner-entry-v2.js'];
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 for(const path of INITIAL){const response=await fetch(path,{cache:'no-store'});if(!response.ok)throw Error('Live shell resource unavailable');await cache.put(path,response);}
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('message',event=>{if(event.data?.type==='owner-shell-version')event.ports?.[0]?.postMessage({version:CACHE});});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/auth/')||url.pathname.startsWith('/api/')||['code','state','access_token','id_token'].some(key=>url.searchParams.has(key)))return;
 const document=request.mode==='navigate';
 if(!document&&!/\.(?:js|mjs|css|webmanifest|svg|png|jpg|jpeg|woff2|wasm)$/.test(url.pathname))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  // Fingerprinted code is immutable; documents and mutable entry points always check the network.
  const immutable=!document&&/\/assets\/[^/]+-[A-Za-z0-9]{8,}\.(?:js|mjs|css)$/.test(url.pathname);
  if(immutable){const hit=await cache.match(request);if(hit)return hit;}
  try{const response=await fetch(request,{cache:'no-store'});if(response.ok&&response.type!=='opaque')await cache.put(request,response.clone());return response;}
  catch(error){const hit=await cache.match(request);if(hit)return hit;if(document&&(url.pathname==='/'||url.pathname==='/index.html')){const entry=await cache.match('/');if(entry)return entry;}throw error;}
 })());
});
