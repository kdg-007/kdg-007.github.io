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
  browser=await engine.launch({headless:true});const fixture=connectionFixture(origin,{writable:true}),contexts=[];
  async function device(){const context=await browser.newContext({ignoreHTTPSErrors:true,serviceWorkers:'block',viewport:{width:393,height:852},isMobile:true,hasTouch:true});contexts.push(context);await context.route('**/*',fixture.route);const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
   console.log('CALENDAR_DEVICE_OPEN');
   await page.goto(origin+'/partners/connected/?connected-app=liveit&connect-onedrive=1');await page.locator('#onedrive-dialog[open]').waitFor();await page.locator('#onedrive-signin').click();await page.locator('#connected-cloud-status[data-phase="connected"]').waitFor({timeout:30000});const frame=page.frameLocator('iframe[title="LiveIt journal workspace"]');await frame.locator('#calendarSyncStatus[data-phase="synced"]').waitFor({timeout:20000}).catch(async error=>{console.error('INITIAL_CALENDAR_STATE',await frame.locator('#calendarSyncStatus').innerText(),errors);throw error;});console.log('CALENDAR_DEVICE_READY');return {context,page,frame,errors};}
  const a=await device();
  await a.frame.locator('[data-action="capture"][data-type="event"]').first().click();await a.frame.locator('#captureBody').fill('ASEAN Summit');await a.frame.locator('#captureDate').fill('2026-11-16');await a.frame.locator('#captureEndDate').fill('2026-11-20');await a.frame.locator('#captureAllDay').check();await a.frame.locator('#saveCapture').click();await a.frame.locator('#captureDialog').waitFor({state:'hidden'});
  await a.frame.locator('#calendarSyncStatus[data-phase="synced"]').waitFor({timeout:30000}).catch(async error=>{console.error('CALENDAR_SAVE_FAILURE',engine.name(),await a.frame.locator('#calendarSyncStatus').innerText(),a.errors,JSON.stringify(fixture.requests.slice(-15)),await a.page.evaluate(()=>document.querySelector('iframe[title="LiveIt journal workspace"]').contentWindow.LiveItDemo.state().records));throw error;});console.log('AFTER_SAVE',await a.frame.locator('#calendarSyncStatus').innerText());
  await a.page.waitForFunction(()=>{const f=document.querySelector('iframe[title="LiveIt journal workspace"]');return f.contentWindow.LiveItDemo.state().records.some(r=>r.body==='ASEAN Summit'&&r._calendarSync?.pending===false);});
  console.log('FIRST_DEVICE_EVENT_SAVED');const b=await device();await b.page.waitForFunction(()=>document.querySelector('iframe[title="LiveIt journal workspace"]').contentWindow.LiveItDemo.state().records.some(r=>r.body==='ASEAN Summit'));
  const received=await b.page.evaluate(()=>document.querySelector('iframe[title="LiveIt journal workspace"]').contentWindow.LiveItDemo.state().records.find(r=>r.body==='ASEAN Summit'));
  assert.equal(received.endDate,'2026-11-20');assert.equal(received.allDay,true);
  // The other workspace has the same date range, without duplicate records.
  await b.frame.locator('[data-action="scope"][data-scope="personal"]').first().click();await b.frame.locator('[data-action="nav"][data-view="calendar"]:visible').first().click();
  // Inspect occurrence semantics directly, then navigate to an interior date through the real calendar.
  assert.equal(await b.page.evaluate(()=>{const w=document.querySelector('iframe[title="LiveIt journal workspace"]').contentWindow,r=w.LiveItDemo.state().records.find(r=>r.body==='ASEAN Summit');return w.LiveItW12.occurrenceOn(r,'2026-11-18')?.id===r.id;}),true);
  await b.frame.locator('[data-action="calendar-day"][data-date="2026-11-18"]').click();
  await b.frame.locator('[data-action="scope"][data-scope="work"]').first().click();assert.equal(await b.frame.locator('[data-record-id="'+received.id+'"] .feed-title').count()>0||await b.frame.locator('.calendar-mark').filter({hasText:'ASEAN Summit'}).count()>0,true);
  // Offline edit remains pending; reconnect sends it to the same cloud note.
  fixture.offline=true;await b.context.setOffline(true);
  await b.frame.locator('[data-action="detail"][data-id="'+received.id+'"]').first().click();await b.frame.locator('[data-action="edit"]').click();await b.frame.locator('#captureBody').fill('ASEAN Summit updated offline');await b.frame.locator('#saveCapture').click();await b.frame.locator('#captureDialog').waitFor({state:'hidden'});
  assert.ok(await b.page.evaluate(()=>document.querySelector('iframe[title="LiveIt journal workspace"]').contentWindow.LiveItDemo.state().records.some(r=>r.body==='ASEAN Summit updated offline'&&r._calendarSync.pending)));
  fixture.offline=false;await b.context.setOffline(false);await b.frame.locator('[data-action="calendar-retry"]').click();await b.frame.locator('#calendarSyncStatus[data-phase="synced"]').waitFor({timeout:30000});
  await a.frame.locator('[data-action="calendar-retry"]').click();await a.page.waitForFunction(()=>document.querySelector('iframe[title="LiveIt journal workspace"]').contentWindow.LiveItDemo.state().records.some(r=>r.body==='ASEAN Summit updated offline'));
  // Concurrent offline changes are held for review, never last-write-wins.
  fixture.offline=true;
  await b.frame.locator('[data-action="detail"][data-id="'+received.id+'"]').first().click();await b.frame.locator('[data-action="edit"]').click();await b.frame.locator('#captureBody').fill('Offline alternative');await b.frame.locator('#saveCapture').click();await b.frame.locator('#captureDialog').waitFor({state:'hidden'});
  fixture.offline=false;
  // Another device saves a newer revision through the same canonical UI path.
  await a.frame.locator('[data-action="detail"][data-id="'+received.id+'"]').first().click();await a.frame.locator('[data-action="edit"]').click();await a.frame.locator('#captureBody').fill('Newer saved version');await a.frame.locator('#saveCapture').click();await a.frame.locator('#captureDialog').waitFor({state:'hidden'});await a.page.waitForFunction(()=>document.querySelector('iframe[title="LiveIt journal workspace"]').contentWindow.LiveItDemo.state().records.some(r=>r.body==='Newer saved version'&&!r._calendarSync.pending));
  await b.frame.locator('[data-action="calendar-retry"]').click();await b.frame.locator('[data-action="calendar-keep-both"]').waitFor();await b.frame.locator('[data-action="calendar-keep-both"]').click();
  await b.page.waitForFunction(()=>{const r=document.querySelector('iframe[title="LiveIt journal workspace"]').contentWindow.LiveItDemo.state().records;return r.some(x=>x.body==='Offline alternative (copy)'&&!x._calendarSync.pending)&&r.some(x=>x.body==='Newer saved version');});
  console.log('LIVEIT_CONCURRENT_EVENT_EDITS_KEEP_BOTH_'+engine.name().toUpperCase()+'_PASS');
  assert.deepEqual(a.errors,[]);assert.deepEqual(b.errors,[]);console.log('LIVEIT_MULTI_DAY_BOTH_CALENDARS_TWO_DEVICES_OFFLINE_KEEPIT_READBACK_'+engine.name().toUpperCase()+'_PASS');
  for(const context of contexts)await context.close();await browser.close();browser=null;
 }
}finally{await browser?.close();await new Promise(ok=>server.close(ok));rmSync(temp,{recursive:true,force:true});}
