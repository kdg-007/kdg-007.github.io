// Installed-app reopen on a stalled connection: the service worker must show the
// saved app instead of a blank screen, and an unreachable page instead of waiting
// forever when nothing is saved. Chromium only (Playwright routes worker requests
// only there).
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync,statSync} from 'node:fs';
import {resolve,sep,extname,join} from 'node:path';

const {chromium}=createRequire(resolve('package.json'))('playwright');
const root=resolve('.');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.wasm':'application/wasm'};
const server=createServer((req,res)=>{
 let path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname));
 if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403).end();return;}
 try{if(statSync(path).isDirectory())path=join(path,'index.html');res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream'}).end(readFileSync(path));}
 catch{res.writeHead(404).end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin='http://127.0.0.1:'+server.address().port,app=origin+'/partners/connected/?connected-app=keepit';
const browser=await chromium.launch({headless:true});
try{
 // 1. Reopen while every request stalls: the saved library appears within seconds.
 {
  const context=await browser.newContext({serviceWorkers:'allow'}),page=await context.newPage();
  await page.goto(app);
  await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js',{scope:'/'});await navigator.serviceWorker.ready;});
  await page.waitForFunction(()=>navigator.serviceWorker.controller);
  await page.reload();await page.locator('#all-count').waitFor();await page.waitForTimeout(1000);
  await context.route('**/*',()=>{});
  const started=Date.now();
  page.goto(app+'&reopen=1',{waitUntil:'commit',timeout:60000}).catch(()=>{});
  await page.locator('#all-count').waitFor({timeout:15000});
  console.log('saved app shown on stalled reopen after '+(Date.now()-started)+' ms');
  await context.close();
 }
 // 2. Nothing saved and no answer: an explicit retry page, never an endless blank screen.
 {
  const context=await browser.newContext({serviceWorkers:'allow'}),page=await context.newPage();
  await page.goto(origin+'/partners/connected/status.json');
  await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js',{scope:'/'});await navigator.serviceWorker.ready;});
  await page.waitForFunction(()=>navigator.serviceWorker.controller);
  await context.route('**/*',()=>{});
  page.goto(origin+'/partners/never-saved/',{waitUntil:'commit',timeout:60000}).catch(()=>{});
  await page.getByRole('link',{name:'Try again'}).waitFor({timeout:45000});
  assert.match(await page.locator('body').innerText(),/Couldn't reach your apps/);
  await context.close();
 }
 console.log('keepit-shell-worker-stall passed');
}finally{await browser.close();await new Promise(done=>server.close(done));}
