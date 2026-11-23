// Real compiled MSAL redirect/callback and canonical catalog reader, synthetic services only.
import assert from 'node:assert/strict';
import {createServer} from 'node:https';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,extname,sep} from 'node:path';
import {createRequire} from 'node:module';
import {connectionFixture} from './owner-connection-fixture.mjs';
import {checkOfflineOriginalCache} from './offline-originals.browser.mjs';
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
  browser=await engine.launch({headless:true});await checkOfflineOriginalCache(browser,origin);const context=await browser.newContext({ignoreHTTPSErrors:true,serviceWorkers:'block'}),fixture=connectionFixture(origin,{revisions:24,snapshotDelayMs:120}),errors=[];
  let recoverDownloads=true,failedFetchDownloads=0,xhrDownloads=0;
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.hostname==='fixture.livefilestore.com'&&recoverDownloads){
    if(request.resourceType()==='fetch'){failedFetchDownloads++;return route.abort('failed');}
    if(request.resourceType()==='xhr')xhrDownloads++;
   }
   return fixture.route(route);
  });const page=await context.newPage();currentPage=page;currentEngine=engine.name();page.on('pageerror',e=>errors.push(e.message));
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
  assert.ok(failedFetchDownloads>0,'Fixture must reproduce rejected signed-file fetches');
  assert.equal(xhrDownloads,failedFetchDownloads,'Every rejected download must recover using credential-free XHR');
  assert.equal(fixture.snapshotDownloads,24,'Cold connection must verify every revision exactly once');
  assert.ok(fixture.peakSnapshots>=3&&fixture.peakSnapshots<=4,'Read ahead must overlap responses and stay within the four-download limit');
  console.log('OWNER_BOUNDED_COLD_CATALOG_'+engine.name().toUpperCase()+'_PASS',JSON.stringify({snapshots:fixture.snapshotDownloads,peakConcurrent:fixture.peakSnapshots}));
  recoverDownloads=false;
  console.log('OWNER_SIGNED_DOWNLOAD_XHR_RECOVERY_'+engine.name().toUpperCase()+'_PASS');
  await page.locator('#connected-cloud-status').click();await page.locator('#onedrive-dialog[open]').waitFor();assert.equal(fixture.driveRequests,1,'Viewing the connected account must not reconnect');await page.locator('#onedrive-close').click();
  assert.deepEqual(nav.filter(p=>!p.startsWith('/consumers/')),['/partners/connected/?connected-app=liveit','/auth/callback/','/partners/connected/?connected-app=liveit']);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('keepit-onedrive-owner-1')).rootId),'library');
  console.log('OWNER_OAUTH_CALLBACK_DIRECT_RETURN_'+engine.name().toUpperCase()+'_PASS');
  // An older interrupted save can have metadata but no readable Blob.
  const pendingNotes=await page.evaluate(async()=>{
   const {c:NoteWorkspace}=await import('/assets/chunk-O6257ALA.js');
   const workspace=await new NoteWorkspace({name:'keepit-owner-note-workspace-v1'}).open();
   const saved=JSON.parse(localStorage.getItem('keepit-onedrive-owner-1'));
   const target=JSON.stringify(['cloud',saved.homeId,saved.driveId,saved.rootId,'a1000000-0000-4000-8000-000000000001']);
   const operations=[];
   for(const [title,blobData] of [['Interrupted note needing recovery',null],['Buffered pending note',new TextEncoder().encode('Retained pending bytes').buffer]]){
    const id=crypto.randomUUID();
    await workspace.db.operations.put({id,itemId:crypto.randomUUID(),target,state:'failed',retryAt:null,blob:null,blobData,createdAt:new Date().toISOString(),values:{title,domain:'Notes',tags:[],customFields:[]}});
    operations.push(id);
   }
   workspace.db.close();
   return operations;
  });
  const readOnlyRequests=fixture.requests.length;
  await page.waitForLoadState('networkidle');
  await page.goto(origin+'/partners/connected/?connected-app=keepit');
  await page.waitForFunction(()=>['connected','error'].includes(window.keepItConnectionState?.phase));
  assert.equal(await page.evaluate(()=>window.keepItConnectionState.phase),'connected',await page.evaluate(()=>window.keepItConnectionState.message));
  const interrupted=page.getByRole('button',{name:'Open Interrupted note needing recovery'});
  await interrupted.getByText('Pending note needs recovery',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Open Buffered pending note'}).waitFor();
  await interrupted.click();
  const recoveryDialog=page.locator('dialog.note-dialog[open]');
  await recoveryDialog.getByText(/missing its local source bytes/).waitFor();
  await recoveryDialog.getByRole('button',{name:'Close',exact:true}).click();
  assert.ok(fixture.requests.slice(readOnlyRequests).every(request=>request.method==='GET'));
  await page.evaluate(async ids=>{
   const {c:NoteWorkspace}=await import('/assets/chunk-O6257ALA.js');
   const workspace=await new NoteWorkspace({name:'keepit-owner-note-workspace-v1'}).open();
   for(const id of ids)if(!await workspace.db.operations.get(id))throw Error('Reconnecting removed a pending note');
   await workspace.db.operations.bulkDelete(ids); // synthetic rows only
   workspace.db.close();
  },pendingNotes);
  console.log('OWNER_REOPEN_WITH_INCOMPLETE_LOCAL_NOTE_'+engine.name().toUpperCase()+'_PASS');
  await page.waitForLoadState('networkidle');
  await page.goto(origin+'/partners/connected/?connected-app=liveit');
  await page.locator('#connected-cloud-status[data-phase=connected]').waitFor();
  // Let the previous page finish its catalog reads before simulating the
  // next reconnect. WebKit can report navigation cancellations as CORS errors.
  await page.waitForLoadState('networkidle');
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
  const picker=await browser.newContext({ignoreHTTPSErrors:true,serviceWorkers:'block',acceptDownloads:true,viewport:{width:393,height:852},isMobile:true,hasTouch:true}),nested=connectionFixture(origin,{nested:true,legacyRevisions:12,snapshotDelayMs:120});
  await picker.route('**/*',nested.route);const phone=await picker.newPage();currentPage=phone;
  await phone.goto(origin+'/partners/connected/?connected-app=liveit&connect-onedrive=1');await phone.locator('#onedrive-dialog[open]').waitFor();await phone.locator('#onedrive-signin').click();
  await phone.locator('#onedrive-folders button').filter({hasText:'Documents'}).waitFor();assert.equal(await phone.locator('#onedrive-use').isDisabled(),true);
  assert.match(await phone.locator('#connected-cloud-status').getAttribute('aria-label'),/^Choose KeepIt folder · Choose your OneDrive folder$/,'The folder picker must communicate the required KeepIt library choice');
  assert.ok(nested.requests.every(r=>r.method==='GET'),'Browsing never initializes or writes a library');
  await phone.locator('#onedrive-folders button').filter({hasText:'Family photos'}).click();await phone.locator('#onedrive-path').filter({hasText:'Family photos'}).waitFor();
  await phone.locator('#onedrive-use').click();await phone.locator('#onedrive-message').filter({hasText:'This folder contains files but is not a KeepIt library'}).waitFor();assert.ok(nested.requests.every(r=>r.method==='GET'));
  await phone.locator('#onedrive-up').click();await phone.locator('#onedrive-folders button').filter({hasText:'Documents'}).click();
  await phone.locator('#onedrive-folders button').filter({hasText:'Travel Library'}).click();await phone.locator('#onedrive-path').filter({hasText:'Documents / Travel Library'}).waitFor();
  await phone.waitForFunction(()=>!document.getElementById('onedrive-use').disabled);await phone.locator('#onedrive-use').click();
  await phone.locator('#connected-cloud-status[data-phase=connected]').waitFor();
  assert.equal(nested.legacyDownloads,12,'The very first library opening reads all original catalog revisions once');
  assert.ok(nested.peakLegacy>=3&&nested.peakLegacy<=4,'Cold legacy verification overlaps at most four downloads');
  await phone.locator('#connected-cloud-status').click();
  await phone.locator('#onedrive-connection-details summary').click();
  await phone.locator('#onedrive-connection-timing').filter({hasText:'Original catalog history:'}).waitFor();
  const reportDownload=phone.waitForEvent('download');await phone.locator('#onedrive-connection-report').click();
  const report=JSON.parse(readFileSync(await(await reportDownload).path(),'utf8'));
  assert.equal(report.schema,'keepit.connection-timing.v1');assert.equal(report.outcome,'connected');
  assert.ok(report.phases.some(p=>p.phase==='legacy-history'&&p.durationMs>0));
  assert.ok(report.requests['file-read'].peak>=3&&report.requests['file-read'].peak<=4);
  assert.doesNotMatch(JSON.stringify(report),/owner@example|fixture-user|fixture-access|fixture-drive|Travel Library|downloadUrl|https?:/);
  // iPhone Safari: copying is easier to share than downloading and locating JSON.
  // A blocked clipboard must expose the same sanitized JSON for manual selection.
  await phone.evaluate(()=>{
   Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copiedConnectionReport=text;}}});
  });
  await phone.locator('#onedrive-connection-copy').click();
  await phone.waitForFunction(()=>!!window.__copiedConnectionReport);
  assert.deepEqual(JSON.parse(await phone.evaluate(()=>window.__copiedConnectionReport)),report);
  await phone.locator('#onedrive-connection-copy-status').filter({hasText:'copied'}).waitFor();
  assert.equal(await phone.locator('#onedrive-connection-manual-copy').isVisible(),false);
  await phone.evaluate(()=>{
   Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('Permission denied');}}});
  });
  await phone.locator('#onedrive-connection-copy').click();
  await phone.locator('#onedrive-connection-manual-copy').waitFor({state:'visible'});
  const manual=await phone.locator('#onedrive-connection-manual-copy').inputValue();
  assert.deepEqual(JSON.parse(manual),report);
  assert.doesNotMatch(manual,/owner@example|fixture-user|fixture-access|fixture-drive|Travel Library|downloadUrl|https?:/);
  await phone.locator('#onedrive-close').click();
  console.log('OWNER_PHONE_FIRST_OPEN_LEGACY_HISTORY_AND_PRIVATE_REPORT_'+engine.name().toUpperCase()+'_PASS',JSON.stringify({legacyDownloads:nested.legacyDownloads,peakConcurrent:nested.peakLegacy,legacyMs:report.phases.find(p=>p.phase==='legacy-history').durationMs,totalMs:report.totalMs}));
  assert.equal(await phone.evaluate(()=>JSON.parse(localStorage.getItem('keepit-onedrive-owner-1')).path),'Documents / Travel Library');
  assert.ok(nested.requests.every(r=>r.method==='GET'),'Opening an existing nested library never changes cloud files');
  await phone.reload();await phone.locator('#connected-cloud-status[data-phase=connected]').waitFor();assert.equal(await phone.locator('#onedrive-dialog[open]').count(),0);
  assert.equal(nested.legacyDownloads,12,'A verified checkpoint reopens without downloading old history again');
  await phone.locator('#connected-cloud-status').click();await phone.locator('#onedrive-change-folder').click();await phone.locator('#onedrive-folders button').filter({hasText:'Documents'}).waitFor();
  console.log('OWNER_MOBILE_NESTED_RENAMED_FOLDER_PICKER_SELECTION_REOPEN_'+engine.name().toUpperCase()+'_PASS');
  await picker.close();
  const damagedContext=await browser.newContext({ignoreHTTPSErrors:true,serviceWorkers:'block',viewport:{width:393,height:852},isMobile:true,hasTouch:true});
  const damaged=connectionFixture(origin,{legacyRevisions:6,corruptLegacy:true,snapshotDelayMs:60});
  await damagedContext.route('**/*',damaged.route);const damagedPage=await damagedContext.newPage();currentPage=damagedPage;
  await damagedPage.goto(origin+'/partners/connected/?connected-app=keepit&connect-onedrive=1');
  await damagedPage.locator('#onedrive-dialog[open]').waitFor();await damagedPage.locator('#onedrive-signin').click();
  await damagedPage.locator('#connected-cloud-status[data-phase=error]').waitFor();
  await damagedPage.locator('#onedrive-message').filter({hasText:'checksum failed'}).waitFor({state:'attached'});
  assert.ok(damaged.requests.every(r=>r.method==='GET'),'Failed parallel verification never writes or repairs cloud data');
  assert.equal(await damagedPage.evaluate(()=>localStorage.getItem('keepit-onedrive-owner-1')),null,'Failed verification cannot establish a writable binding');
  await damagedPage.waitForLoadState('networkidle');await damagedContext.close();
  console.log('OWNER_COLD_PARALLEL_CHECKSUM_REJECTION_WITHOUT_WRITES_'+engine.name().toUpperCase()+'_PASS');
  await browser.close();browser=null;
 }
}catch(error){
 if(currentPage&&!currentPage.isClosed())console.error('OWNER_CONNECTION_DIAGNOSTIC',currentEngine,await currentPage.evaluate(()=>({path:location.pathname,state:window.keepItConnectionState,dialog:document.getElementById('onedrive-dialog')?.open,connectionMessage:document.getElementById('onedrive-message')?.textContent,appMessage:document.getElementById('message')?.textContent,library:document.getElementById('result-count')?.textContent})).catch(()=>({unavailable:true})));
 throw error;
}finally{await browser?.close();await new Promise(ok=>server.close(ok));rmSync(temp,{recursive:true,force:true});}
