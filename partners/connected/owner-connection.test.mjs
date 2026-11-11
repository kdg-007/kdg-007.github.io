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
let browser,currentPage,currentEngine;
try{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const origin='https://127.0.0.1:'+server.address().port;
 for(const engine of process.env.OWNER_TEST_CHROMIUM_ONLY?[chromium]:[chromium,webkit]){
  browser=await engine.launch({headless:true});const context=await browser.newContext({ignoreHTTPSErrors:true,serviceWorkers:'block'}),fixture=connectionFixture(origin),errors=[];
  await context.route('**/*',fixture.route);const page=await context.newPage();currentPage=page;currentEngine=engine.name();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/partners/connected/?connected-app=keepit');
  await page.waitForFunction(()=>typeof document.getElementById('settings-onedrive').onclick==='function');
  await page.locator('#sidebar-settings').click();
  await page.locator('#settings-dialog[open] #settings-onedrive').click();
  await page.locator('#onedrive-dialog[open] #onedrive-signin').waitFor();
  assert.equal(await page.locator('#settings-dialog[open]').count(),0);
  assert.equal(fixture.signins,0,'Opening connection settings must wait for the Microsoft sign-in click');
  await page.locator('#onedrive-close').click();
  console.log('OWNER_KEEPIT_SETTINGS_ONEDRIVE_HANDOFF_'+engine.name().toUpperCase()+'_PASS');
  const nav=[];page.on('request',request=>{if(request.isNavigationRequest()&&request.frame()===page.mainFrame())nav.push(new URL(request.url()).pathname+new URL(request.url()).search)});
  await page.goto(origin+'/partners/connected/?connected-app=liveit');
  const workspace=()=>page.frameLocator('iframe[title="LiveIt journal workspace"]').locator('#app .app-shell');
  await workspace().waitFor({state:'visible'});await page.locator('#connected-apps-toggle').click();await page.locator('#connected-onedrive-toggle').click();await page.locator('#onedrive-dialog[open]').waitFor();
  await page.locator('#onedrive-signin').click();
  await page.locator('#connected-cloud-status[data-phase=connected]').waitFor({timeout:30000});
  await workspace().waitFor({state:'visible'});assert.equal(await page.locator('#onedrive-dialog[open]').count(),0);
  assert.match(await page.locator('#connected-cloud-status').getAttribute('aria-label'),/OneDrive \/ KeepIt connected/);
  assert.equal(fixture.signins,1);assert.equal(fixture.driveRequests,1);
  await page.locator('#connected-cloud-status').click();await page.locator('#onedrive-dialog[open]').waitFor();assert.equal(fixture.driveRequests,1,'Viewing the connected account must not reconnect');await page.locator('#onedrive-close').click();
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
  await page.locator('#connected-cloud-status[data-phase=connected]').waitFor();assert.ok(await frame.evaluate(el=>el.isConnected));
  assert.equal(fixture.driveRequests,before+2);assert.deepEqual(errors,[]);assert.ok(fixture.requests.every(r=>r.method==='GET'));
  console.log('OWNER_RETRY_ONCE_NO_REMOUNT_NO_CLOUD_WRITES_'+engine.name().toUpperCase()+'_PASS');
  // A request that never finishes must reach a bounded, actionable error.
  const timeoutStart=Date.now();fixture.hold=new Promise(ok=>{release=ok;});
  await page.reload({waitUntil:'domcontentloaded'});await workspace().waitFor({state:'visible'});
  await page.locator('#connected-cloud-status[data-phase="error"]').waitFor({timeout:28000});
  assert.ok(Date.now()-timeoutStart>=18000&&Date.now()-timeoutStart<28000);assert.match(await page.locator('#connected-cloud-status').getAttribute('aria-label'),/retry/i);
  release();fixture.hold=null;await page.locator('#connected-cloud-status').click();
  await page.locator('#connected-cloud-status[data-phase=connected]').waitFor();
  console.log('OWNER_UNRESPONSIVE_GRAPH_READ_TIMEOUT_AND_RETRY_'+engine.name().toUpperCase()+'_PASS');
  const beforeDisconnect=fixture.driveRequests;await page.locator('#connected-cloud-status').click();await page.locator('#onedrive-dialog[open]').waitFor();await page.locator('#onedrive-disconnect').click();await page.locator('#connected-cloud-status[data-phase="signin"]').waitFor();assert.equal(fixture.driveRequests,beforeDisconnect);await page.locator('#onedrive-close').click();await workspace().waitFor({state:'visible'});
  console.log('OWNER_ACCOUNT_DETAILS_AND_DISCONNECT_WITHOUT_RECONNECT_'+engine.name().toUpperCase()+'_PASS');
  await context.close();
  const picker=await browser.newContext({ignoreHTTPSErrors:true,serviceWorkers:'block',viewport:{width:393,height:852},isMobile:true,hasTouch:true}),nested=connectionFixture(origin,{nested:true});
  await picker.route('**/*',nested.route);const phone=await picker.newPage();currentPage=phone;
  await phone.goto(origin+'/partners/connected/?connected-app=liveit&connect-onedrive=1');await phone.locator('#onedrive-dialog[open]').waitFor();await phone.locator('#onedrive-signin').click();
  await phone.locator('#onedrive-folders button').filter({hasText:'Documents'}).waitFor();assert.equal(await phone.locator('#onedrive-use').isDisabled(),true);
  assert.equal(await phone.locator('#connected-cloud-status').getAttribute('aria-label'),'Choose your OneDrive folder');
  assert.ok(nested.requests.every(r=>r.method==='GET'),'Browsing never initializes or writes a library');
  await phone.locator('#onedrive-folders button').filter({hasText:'Family photos'}).click();await phone.locator('#onedrive-path').filter({hasText:'Family photos'}).waitFor();
  await phone.locator('#onedrive-use').click();await phone.locator('#onedrive-message').filter({hasText:'This folder contains files but is not a KeepIt library'}).waitFor();assert.ok(nested.requests.every(r=>r.method==='GET'));
  await phone.locator('#onedrive-up').click();await phone.locator('#onedrive-folders button').filter({hasText:'Documents'}).click();
  await phone.locator('#onedrive-folders button').filter({hasText:'Travel Library'}).click();await phone.locator('#onedrive-path').filter({hasText:'Documents / Travel Library'}).waitFor();
  await phone.waitForFunction(()=>!document.getElementById('onedrive-use').disabled);await phone.locator('#onedrive-use').click();
  await phone.locator('#connected-cloud-status[data-phase=connected]').waitFor();
  assert.equal(await phone.evaluate(()=>JSON.parse(localStorage.getItem('keepit-onedrive-owner-1')).path),'Documents / Travel Library');
  assert.ok(nested.requests.every(r=>r.method==='GET'),'Opening an existing nested library never changes cloud files');
  await phone.reload();await phone.locator('#connected-cloud-status[data-phase=connected]').waitFor();assert.equal(await phone.locator('#onedrive-dialog[open]').count(),0);
  await phone.locator('#connected-cloud-status').click();await phone.locator('#onedrive-change-folder').click();await phone.locator('#onedrive-folders button').filter({hasText:'Documents'}).waitFor();
  console.log('OWNER_MOBILE_NESTED_RENAMED_FOLDER_PICKER_SELECTION_REOPEN_'+engine.name().toUpperCase()+'_PASS');
  await picker.close();await browser.close();browser=null;
 }
}catch(error){
 if(currentPage&&!currentPage.isClosed())console.error('OWNER_CONNECTION_DIAGNOSTIC',currentEngine,await currentPage.evaluate(()=>({path:location.pathname,state:window.keepItConnectionState,dialog:document.getElementById('onedrive-dialog')?.open,connectionMessage:document.getElementById('onedrive-message')?.textContent,appMessage:document.getElementById('message')?.textContent,library:document.getElementById('result-count')?.textContent})).catch(()=>({unavailable:true})));
 throw error;
}finally{await browser?.close();await new Promise(ok=>server.close(ok));rmSync(temp,{recursive:true,force:true});}
