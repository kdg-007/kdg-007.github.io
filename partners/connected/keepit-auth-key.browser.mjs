// Microsoft sign-in survives the end of a browser session (an installed iPad/iPhone
// app being closed): MSAL's cache encryption key must be the same on the next launch,
// otherwise the saved sign-in cannot be decrypted and KeepIt asks to connect again.
// Uses the real bundled MSAL; no Microsoft network access.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {resolve,sep} from 'node:path';

const {chromium,webkit}=createRequire(resolve('package.json'))('playwright');
const root=resolve('.');
const authPath=JSON.parse(readFileSync(resolve(root,'ops/ui/LIVE_STABILITY_MODULES.json'))).paths.auth;
const server=createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/auth.html'){res.writeHead(200,{'Content-Type':'text/html'}).end('<!doctype html><p>auth');return;}
 const path=resolve(root,'.'+pathname);
 if(!path.startsWith(root+sep)){res.writeHead(403).end();return;}
 try{res.writeHead(200,{'Content-Type':'text/javascript'}).end(readFileSync(path));}catch{res.writeHead(404).end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin='http://localhost:'+server.address().port;
try{
 for(const engine of process.env.KEEPIT_BROWSER_ENGINE==='chromium'?[chromium]:[chromium,webkit]){
  const browser=await engine.launch({headless:true});
  try{
   const context=await browser.newContext();
   const launch=async()=>{
    const page=await context.newPage();await page.goto(origin+'/auth.html');
    const id=await page.evaluate(async path=>{
     const module=await import('/'+path);const auth=new module.b({clientId:module.c,scope:'visible_root'});await auth.initialize();
     const cookie=document.cookie.split(';').map(part=>part.trim()).find(part=>part.startsWith('msal.cache.encryption='));
     return cookie?JSON.parse(decodeURIComponent(cookie.slice('msal.cache.encryption='.length))).id:null;
    },authPath);
    await page.close();return id;
   };
   const first=await launch();
   assert.ok(first,'MSAL created a cache key');
   const stored=(await context.cookies()).find(cookie=>cookie.name==='msal.cache.encryption');
   assert.ok(stored.expires>Date.now()/1000+86400,'cache key outlives the browser session');
   await context.clearCookies();   // session ends: session cookies are gone, local storage stays
   assert.equal(await launch(),first,'same cache key after the session ends');
   console.log('KEEPIT_AUTH_KEY_'+engine.name().toUpperCase()+'_PASS');
  }finally{await browser.close();}
 }
 console.log('keepit-auth-key passed');
}finally{await new Promise(done=>server.close(done));}
