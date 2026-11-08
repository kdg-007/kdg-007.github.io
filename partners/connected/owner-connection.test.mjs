// Real compiled MSAL redirect/callback and canonical catalog reader, synthetic services only.
import assert from 'node:assert/strict';
import {createServer} from 'node:https';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,extname,sep} from 'node:path';
import {createRequire} from 'node:module';
import {connectionFixture} from './owner-connection-fixture.mjs';
const require=createRequire(resolve(process.cwd(),'package.json')),{chromium,webkit}=require('playwright');
const root=resolve('.'),temp=mkdtempSync(join(tmpdir(),'owner-connect-'));
execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(temp,'key'),'-out',join(temp,'cert'),'-days','1','-subj','/CN=127.0.0.1','-addext','subjectAltName=IP:127.0.0.1'],{stdio:'ignore'});
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
const server=createServer({key:readFileSync(join(temp,'key')),cert:readFileSync(join(temp,'cert'))},(req,res)=>{
 const pathname=new URL(req.url,'https://127.0.0.1').pathname,file=resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
 try{assert.ok(file.startsWith(root+sep));assert.ok(statSync(file).isFile());res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(readFileSync(file));}catch{res.writeHead(404);res.end();}
});
let browser;
try{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const origin='https://127.0.0.1:'+server.address().port;
 for(const engine of process.env.OWNER_TEST_CHROMIUM_ONLY?[chromium]:[chromium,webkit]){
  browser=await engine.launch({headless:true});const context=await browser.newContext({ignoreHTTPSErrors:true,serviceWorkers:'block'}),fixture=connectionFixture(origin),errors=[];
  await context.route('**/*',fixture.route);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const nav=[];page.on('request',request=>{if(request.isNavigationRequest()&&request.frame()===page.mainFrame())nav.push(new URL(request.url()).pathname+new URL(request.url()).search)});
  await page.goto(origin+'/partners/connected/?connected-app=liveit');
  const workspace=()=>page.frameLocator('iframe[title="LiveIt journal workspace"]').locator('#app .app-shell');
  await workspace().waitFor({state:'visible'});await page.locator('#connected-apps-toggle').click();await page.locator('#connected-onedrive-toggle').click();await page.locator('#onedrive-dialog[open]').waitFor();
  await page.locator('#onedrive-signin').click();
  await page.locator('#connected-cloud-status').filter({hasText:'OneDrive / KeepIt connected'}).waitFor({timeout:30000});
  await workspace().waitFor({state:'visible'});assert.equal(await page.locator('#onedrive-dialog[open]').count(),0);
  assert.equal(fixture.signins,1);assert.equal(fixture.driveRequests,1);
  assert.deepEqual(nav.filter(p=>!p.startsWith('/consumers/')),['/partners/connected/?connected-app=liveit','/auth/callback/','/partners/connected/?connected-app=liveit']);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('keepit-onedrive-owner-1')).rootId),'library');
  console.log('OWNER_OAUTH_CALLBACK_DIRECT_RETURN_'+engine.name().toUpperCase()+'_PASS');
  // Hold the remembered-account Graph read. The app must be usable before it resolves.
  let release;fixture.hold=new Promise(ok=>{release=ok;});const before=fixture.driveRequests;
  await page.reload({waitUntil:'domcontentloaded'});await workspace().waitFor({state:'visible',timeout:10000});
  await page.waitForFunction(()=>window.keepItConnectionState?.phase==='connecting');
  assert.equal(await page.locator('#connected-startup').isVisible(),false);assert.equal(await page.locator('#onedrive-dialog[open]').count(),0);
  const frame=await page.locator('iframe[title="LiveIt journal workspace"]').elementHandle();
  assert.equal(fixture.driveRequests,before+1);fixture.failDrive=true;release();
  await page.locator('#connected-cloud-status[data-phase="error"]').waitFor();await workspace().waitFor({state:'visible'});assert.ok(await frame.evaluate(el=>el.isConnected));
  console.log('OWNER_STALLED_RECONNECT_WORKSPACE_VISIBLE_'+engine.name().toUpperCase()+'_PASS');
  fixture.hold=null;fixture.failDrive=false;await page.locator('#connected-cloud-status').click();
  await page.locator('#connected-cloud-status').filter({hasText:'OneDrive / KeepIt connected'}).waitFor();assert.ok(await frame.evaluate(el=>el.isConnected));
  assert.equal(fixture.driveRequests,before+2);assert.deepEqual(errors,[]);assert.ok(fixture.requests.every(r=>r.method==='GET'));
  console.log('OWNER_RETRY_ONCE_NO_REMOUNT_NO_CLOUD_WRITES_'+engine.name().toUpperCase()+'_PASS');
  // A request that never finishes must reach a bounded, actionable error.
  const timeoutStart=Date.now();fixture.hold=new Promise(ok=>{release=ok;});
  await page.reload({waitUntil:'domcontentloaded'});await workspace().waitFor({state:'visible'});
  await page.locator('#connected-cloud-status[data-phase="error"]').waitFor({timeout:28000});
  assert.ok(Date.now()-timeoutStart>=18000&&Date.now()-timeoutStart<28000);assert.match(await page.locator('#connected-cloud-status').innerText(),/retry/i);
  release();fixture.hold=null;await page.locator('#connected-cloud-status').click();
  await page.locator('#connected-cloud-status').filter({hasText:'OneDrive / KeepIt connected'}).waitFor();
  console.log('OWNER_UNRESPONSIVE_GRAPH_READ_TIMEOUT_AND_RETRY_'+engine.name().toUpperCase()+'_PASS');
  await context.close();await browser.close();browser=null;
 }
}finally{await browser?.close();await new Promise(ok=>server.close(ok));rmSync(temp,{recursive:true,force:true});}
