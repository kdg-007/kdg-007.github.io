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
let uploadFixture;
const server=createServer({key:readFileSync(join(temp,'key')),cert:readFileSync(join(temp,'cert'))},(req,res)=>{
 if(req.method==='PUT'&&req.url.startsWith('/__calendar-upload?')){const parts=[];req.on('data',part=>parts.push(part));req.on('end',()=>{const q=new URL(req.url,'https://127.0.0.1').searchParams,data=Buffer.concat(parts);assert.ok(data.length,'Browser must transmit the actual upload bytes');const result=uploadFixture.acceptUpload(q.get('parent'),q.get('name'),data);res.writeHead(result.status,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});res.end(JSON.stringify(result.value));});return;}
 const pathname=new URL(req.url,'https://127.0.0.1').pathname,file=resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
 try{assert.ok(file.startsWith(root+sep));assert.ok(statSync(file).isFile());res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(readFileSync(file));}catch{res.writeHead(404);res.end();}
});
let browser;
try{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const origin='https://127.0.0.1:'+server.address().port;
 for(const engine of process.env.OWNER_TEST_CHROMIUM_ONLY?[chromium]:[chromium,webkit]){
  browser=await engine.launch({headless:true});const fixture=connectionFixture(origin,{writable:true}),contexts=[];uploadFixture=fixture;fixture.uploadEndpoint=origin+'/__calendar-upload';
  async function device(){const context=await browser.newContext({ignoreHTTPSErrors:true,serviceWorkers:'block',viewport:{width:393,height:852},isMobile:true,hasTouch:true});contexts.push(context);const network={offline:false,expireNextWrite:false,expiredWrites:0};await context.route('**/*',route=>{
    const host=new URL(route.request().url()).hostname;
    if(network.offline&&['graph.microsoft.com','fixture.storage.live.com'].includes(host))return route.abort();
    if(network.expireNextWrite&&host==='graph.microsoft.com'&&['POST','PUT','PATCH'].includes(route.request().method())){
      network.expireNextWrite=false;network.expiredWrites++;
      return route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:{code:'InvalidAuthenticationToken',message:'Synthetic access expiry'}})});
    }
    return fixture.route(route);
   });const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
   console.log('CALENDAR_DEVICE_OPEN');
   await page.goto(origin+'/partners/connected/?connected-app=liveit&connect-onedrive=1');await page.locator('#onedrive-dialog[open]').waitFor().catch(async error=>{console.error('STARTUP_ERROR',errors,await page.locator('#result-count').textContent(),await page.locator('#message').textContent());throw error;});await page.locator('#onedrive-signin').click();await page.locator('#connected-cloud-status[data-phase="connected"]').waitFor({timeout:30000});const frame=page.frameLocator('iframe[title="LiveIt journal workspace"]');await frame.locator('#calendarSyncStatus[data-phase="synced"]').waitFor({timeout:20000}).catch(async error=>{console.error('INITIAL_CALENDAR_STATE',await frame.locator('#calendarSyncStatus').innerText(),errors);throw error;});console.log('CALENDAR_DEVICE_READY');return {context,page,frame,errors,network};}
  const a=await device();
  // Create originals through KeepIt, then associate them in LiveIt.
  await a.page.goto(origin+'/partners/connected/?connected-app=keepit');
  await a.page.locator('#connected-cloud-status[data-phase="connected"]').waitFor({timeout:30000});
  await a.page.locator('#add-files').click();
  await a.page.locator('#write-note').click();
  const editor=a.page.locator('dialog.note-dialog[open]');
  const noteText='Original meeting notes for the LiveIt link test.';
  const noteBody=editor.locator('.note-editor [contenteditable="true"]');
  await noteBody.click();
  await noteBody.pressSequentially(noteText);
  const subject=editor.getByRole('textbox',{name:'Subject'});
  await subject.fill('Synthetic meeting note');
  await subject.press('Tab');
  assert.equal(await subject.inputValue(),'Synthetic meeting note');
  assert.equal((await noteBody.innerText()).trim(),noteText);
  await editor.getByRole('button',{name:'Save',exact:true}).click();
  await editor.locator('.note-status').filter({hasText:/synced to OneDrive/i}).waitFor({state:'attached',timeout:30000}).catch(async error=>{console.error('LINK_FIXTURE_NOTE_SAVE',await editor.locator('.note-status').innerText(),a.errors);throw error;});
  await editor.getByText(noteText,{exact:true}).waitFor();
  await editor.getByRole('button',{name:'Close',exact:true}).click();
  await a.page.getByText('Synthetic meeting note',{exact:true}).first().waitFor({timeout:30000});
  await a.page.locator('#file-input').setInputFiles({name:'slides.txt',mimeType:'text/plain',buffer:Buffer.from('Synthetic presentation contents')});
  await a.page.locator('#capture-title').fill('Synthetic presentation');
  await a.page.locator('#capture-form').getByRole('button',{name:'Save',exact:true}).click();
  await a.page.getByText('Synthetic presentation',{exact:true}).first().waitFor({timeout:30000});
  await a.page.locator('#upload-summary').filter({hasText:'Uploads complete'}).waitFor({state:'attached',timeout:30000});
  await a.page.goto(origin+'/partners/connected/?connected-app=liveit');
  await a.page.locator('#connected-cloud-status[data-phase="connected"]').waitFor({timeout:30000});
  await a.frame.locator('#calendarSyncStatus[data-phase="synced"]').waitFor({timeout:30000});
  async function attach(frame,query,title){
    await frame.getByRole('button',{name:'Link from KeepIt'}).click();
    await frame.locator('#keepItSearch').fill(query);
    await frame.locator('#keepItResults').getByRole('button',{name:title,exact:true}).click().catch(async error=>{
     console.error('LIVEIT_KEEPIT_PICKER_RESULTS',await frame.locator('#keepItPickerStatus').textContent(),await frame.locator('#keepItResults').textContent());
     throw error;
    });
  }
  await a.frame.locator('[data-action="capture"][data-type="note"]').first().click();
  await a.frame.locator('#captureBody').fill('Synthetic LiveIt note with links');
  await attach(a.frame,'slides.txt','Synthetic presentation · file');
  await attach(a.frame,'meeting','Synthetic meeting note · note');
  await a.frame.locator('#captureDialog [data-action="capture-close"]').last().click();
  await a.frame.locator('#captureDialog').waitFor({state:'hidden'});
  await a.page.reload();
  await a.page.locator('#connected-cloud-status[data-phase="connected"]').waitFor({timeout:30000});
  await a.frame.locator('[data-action="capture"][data-type="note"]').first().click();
  assert.equal(await a.frame.locator('#captureBody').inputValue(),'Synthetic LiveIt note with links');
  assert.equal(await a.frame.locator('[data-action="keepit-unlink"]').count(),2);
  await a.frame.locator('#saveCapture').click();
  await a.frame.locator('#captureDialog').waitFor({state:'hidden'});
  await a.frame.getByText('Synthetic LiveIt note with links',{exact:true}).first().click();
  const noteDetail=a.frame.locator('#recordDialog');
  await noteDetail.getByRole('button',{name:'Synthetic meeting note · note'}).click();
  await a.page.locator('dialog.note-dialog[open]').getByText('Original meeting notes for the LiveIt link test.',{exact:true}).waitFor();
  await a.page.locator('dialog.note-dialog[open]').getByRole('button',{name:'Close',exact:true}).click();
  await noteDetail.getByRole('button',{name:'Synthetic presentation · file'}).click();
  await a.page.locator('#item-dialog[open] #item-heading').filter({hasText:'Synthetic presentation'}).waitFor();
  await a.page.locator('#item-dialog').evaluate(dialog=>dialog.close());
  await noteDetail.getByRole('button',{name:'Edit'}).click();
  await a.frame.getByRole('button',{name:'Remove link to Synthetic presentation'}).click();
  await a.frame.locator('#saveCapture').click();
  await a.frame.locator('#captureDialog').waitFor({state:'hidden'});
  await a.frame.getByText('Synthetic LiveIt note with links',{exact:true}).first().click();
  assert.equal(await noteDetail.locator('[data-action="keepit-open"]').count(),1);
  await noteDetail.locator('[data-action="detail-close"]').click();
  console.log('LIVEIT_KEEPIT_NOTE_AND_FILE_LINKS_OPEN_AND_RECOVER_'+engine.name().toUpperCase()+'_PASS');

  const month=await a.page.evaluate(()=>document.querySelector('iframe[title="LiveIt journal workspace"]').contentWindow.LiveItDemo.getTodayDate().slice(0,7));
  const eventStart=`${month}-16`,eventMiddle=`${month}-18`,eventEnd=`${month}-20`;
  await a.frame.locator('[data-action="capture"][data-type="event"]').first().click();await a.frame.locator('#captureBody').fill('ASEAN Summit');await a.frame.locator('#captureDate').fill(eventStart);await a.frame.locator('#captureEndDate').fill(eventEnd);await a.frame.locator('#captureAllDay').check();await attach(a.frame,'slides','Synthetic presentation · file');const signinsBeforeSave=fixture.signins;a.network.expireNextWrite=true;await a.frame.locator('#saveCapture').click();await a.frame.locator('#captureDialog').waitFor({state:'hidden'});
  await a.frame.locator('#calendarSyncStatus[data-phase="synced"]').waitFor({timeout:30000}).catch(async error=>{console.error('CALENDAR_SAVE_FAILURE',engine.name(),await a.frame.locator('#calendarSyncStatus').innerText(),a.errors,JSON.stringify(fixture.requests.slice(-15)),await a.page.evaluate(()=>document.querySelector('iframe[title="LiveIt journal workspace"]').contentWindow.LiveItDemo.state().records));throw error;});console.log('AFTER_SAVE',await a.frame.locator('#calendarSyncStatus').innerText());
  await a.page.waitForFunction(()=>{const f=document.querySelector('iframe[title="LiveIt journal workspace"]');return f.contentWindow.LiveItDemo.state().records.some(r=>r.body==='ASEAN Summit'&&r._calendarSync?.pending===false);});
  assert.equal(a.network.expiredWrites,1);assert.equal(fixture.signins,signinsBeforeSave);console.log('LIVEIT_EXPIRED_WRITE_RENEWS_WITHOUT_SIGNIN_'+engine.name().toUpperCase()+'_PASS');console.log('FIRST_DEVICE_EVENT_SAVED');const b=await device();await b.page.waitForFunction(()=>document.querySelector('iframe[title="LiveIt journal workspace"]').contentWindow.LiveItDemo.state().records.some(r=>r.body==='ASEAN Summit'));
  const received=await b.page.evaluate(()=>document.querySelector('iframe[title="LiveIt journal workspace"]').contentWindow.LiveItDemo.state().records.find(r=>r.body==='ASEAN Summit'));
  assert.equal(received.endDate,eventEnd);assert.equal(received.allDay,true);
  assert.deepEqual(received.keepItLinks.map(({kind,title})=>({kind,title})),[{kind:'file',title:'Synthetic presentation'}]);
  const wrongLibrary=await b.page.evaluate(async link=>{
    const access=document.querySelector('iframe[title="LiveIt journal workspace"]').contentWindow.liveItKeepItLinks;
    try{await access.open({...link,scope:'sha256:'+'0'.repeat(64)});return false;}
    catch(error){return error.message;}
  },received.keepItLinks[0]);
  assert.match(wrongLibrary,/original KeepIt library/);
  // The other workspace has the same date range, without duplicate records.
  await b.frame.locator('[data-action="scope"][data-scope="personal"]').first().click();await b.frame.locator('[data-action="nav"][data-view="calendar"]:visible').first().click();
  const weekdays=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  for(const width of [393,1440]){
   await b.page.setViewportSize({width,height:852});
   const {headers,days}=await b.frame.locator('.calendar-grid').evaluate(grid=>{
    const position=cell=>{const {left,top}=cell.getBoundingClientRect();return {left,top};};
    return {
     headers:[...grid.querySelectorAll('.calendar-wd')].map(cell=>({label:cell.textContent,...position(cell)})),
     days:[...grid.querySelectorAll('.calendar-cell')].map(cell=>({date:cell.dataset.date,...position(cell)}))
    };
   });
   assert.deepEqual(headers.map(header=>header.label),weekdays);
   assert.equal(new Set(headers.map(header=>header.top)).size,1,'Weekday labels share one row');
   assert.equal(days.length,42);
   for(const day of days){
    const weekday=(new Date(day.date+'T12:00:00Z').getUTCDay()+6)%7;
    assert.ok(day.top>headers[weekday].top&&day.left===headers[weekday].left,`${day.date} sits below ${weekdays[weekday]} at ${width}px`);
   }
  }
  await b.page.setViewportSize({width:393,height:852});
  // Inspect occurrence semantics directly, then navigate to an interior date through the real calendar.
  assert.equal(await b.page.evaluate(date=>{const w=document.querySelector('iframe[title="LiveIt journal workspace"]').contentWindow,r=w.LiveItDemo.state().records.find(r=>r.body==='ASEAN Summit');return w.LiveItW12.occurrenceOn(r,date)?.id===r.id;},eventMiddle),true);
  await b.frame.locator(`[data-action="calendar-day"][data-date="${eventMiddle}"]`).click();
  await b.frame.locator('[data-action="scope"][data-scope="work"]').first().click();assert.equal(await b.frame.locator('[data-record-id="'+received.id+'"] .feed-title').count()>0||await b.frame.locator('.calendar-mark').filter({hasText:'ASEAN Summit'}).count()>0,true);
  // Offline edit remains pending; reconnect sends it to the same cloud note.
  b.network.offline=true;await b.context.setOffline(true);
  await b.frame.locator('[data-action="detail"][data-id="'+received.id+'"]').first().click();await b.frame.locator('[data-action="edit"]').click();await b.frame.locator('#captureBody').fill('ASEAN Summit updated offline');await b.frame.getByRole('button',{name:'Remove link to Synthetic presentation'}).click();await b.frame.locator('#saveCapture').click();await b.frame.locator('#captureDialog').waitFor({state:'hidden'});
  assert.ok(await b.page.evaluate(()=>document.querySelector('iframe[title="LiveIt journal workspace"]').contentWindow.LiveItDemo.state().records.some(r=>r.body==='ASEAN Summit updated offline'&&r._calendarSync.pending)));
  b.network.offline=false;await b.context.setOffline(false);await b.frame.locator('[data-action="calendar-retry"]').click();await b.frame.locator('#calendarSyncStatus[data-phase="synced"]').waitFor({timeout:30000});
  await a.frame.locator('[data-action="calendar-retry"]').click();await a.page.waitForFunction(()=>document.querySelector('iframe[title="LiveIt journal workspace"]').contentWindow.LiveItDemo.state().records.some(r=>r.body==='ASEAN Summit updated offline'&&!r.keepItLinks?.length));
  // Concurrent offline changes are held for review, never last-write-wins.
  b.network.offline=true;
  await b.frame.locator('[data-action="detail"][data-id="'+received.id+'"]').first().click();await b.frame.locator('[data-action="edit"]').click();await b.frame.locator('#captureBody').fill('Offline alternative');await b.frame.locator('#saveCapture').click();await b.frame.locator('#captureDialog').waitFor({state:'hidden'});
  // Another device saves a newer revision through the same canonical UI path.
  await a.frame.locator('[data-action="detail"][data-id="'+received.id+'"]').first().click();await a.frame.locator('[data-action="edit"]').click();await a.frame.locator('#captureBody').fill('Newer saved version');await a.frame.locator('#saveCapture').click();await a.frame.locator('#captureDialog').waitFor({state:'hidden'});await a.page.waitForFunction(()=>document.querySelector('iframe[title="LiveIt journal workspace"]').contentWindow.LiveItDemo.state().records.some(r=>r.body==='Newer saved version'&&!r._calendarSync.pending));
  b.network.offline=false;await b.frame.locator('[data-action="calendar-retry"]').click();await b.frame.locator('[data-action="calendar-keep-both"]').waitFor();await b.frame.locator('[data-action="calendar-keep-both"]').click();
  await b.page.waitForFunction(()=>{const r=document.querySelector('iframe[title="LiveIt journal workspace"]').contentWindow.LiveItDemo.state().records;return r.some(x=>x.body==='Offline alternative (copy)'&&!x._calendarSync.pending)&&r.some(x=>x.body==='Newer saved version');});
  console.log('LIVEIT_CONCURRENT_EVENT_EDITS_KEEP_BOTH_'+engine.name().toUpperCase()+'_PASS');
  assert.deepEqual(a.errors,[]);assert.deepEqual(b.errors,[]);console.log('LIVEIT_MULTI_DAY_BOTH_CALENDARS_TWO_DEVICES_OFFLINE_KEEPIT_READBACK_'+engine.name().toUpperCase()+'_PASS');
  async function appFiles(page,name){
   await page.locator('#connected-cloud-status[data-phase="connected"]').waitFor({timeout:30000});
   await page.locator('#connected-apps-toggle').click();
   await page.locator('#connected-apps-list').getByRole('button',{name:`${name} files`,exact:true}).click();
   return page.getByRole('dialog',{name:`${name} files in KeepIt`});
  }
  async function saveAppFile(page,name){
   const files=await appFiles(page,name);
   await files.getByRole('status').filter({hasText:/folder is empty|Choose a file in KeepIt/}).waitFor();
   await files.getByRole('button',{name:'Save current work as new file'}).click();
   await files.getByRole('status').filter({hasText:`Saved and verified in KeepIt / ${name}`}).waitFor();
   await files.getByRole('button',{name:'Close',exact:true}).click();
  }
  async function openAppFile(page,name,title){
   const files=await appFiles(page,name);
   const accept=dialog=>dialog.accept();page.on('dialog',accept);
   try{await files.getByRole('button',{name:title,exact:true}).click();await files.waitFor({state:'hidden'});}
   finally{page.off('dialog',accept);}
  }
  await a.page.setViewportSize({width:1100,height:852});
  const beforeTask=await a.page.evaluate(()=>JSON.parse(localStorage.getItem('keepit-app-file-binding-v1:liveit')).revision);
  await a.frame.locator('[data-action="nav"][data-view="tasks"]:visible').first().click();
  await a.frame.locator('[data-action="capture"][data-type="task"]').first().click();
  await a.frame.locator('#captureBody').fill('App folder task');await a.frame.locator('#saveCapture').click();
  await a.frame.locator('#captureDialog').waitFor({state:'hidden'});
  await a.page.waitForFunction(previous=>JSON.parse(localStorage.getItem('keepit-app-file-binding-v1:liveit')).revision!==previous,beforeTask,{timeout:35000});
  await b.page.bringToFront();
  await b.page.waitForFunction(()=>document.querySelector('iframe[title="LiveIt journal workspace"]').contentWindow.LiveItDemo.state().records.some(r=>r.body==='App folder task'),null,{timeout:45000}).catch(async error=>{
   console.error('LIVEIT_WORKSPACE_AUTO_REOPEN_STATE',await a.frame.locator('#workspaceSyncStatus').textContent(),await b.frame.locator('#workspaceSyncStatus').textContent(),await b.page.evaluate(()=>({binding:JSON.parse(localStorage.getItem('keepit-app-file-binding-v1:liveit')),visible:document.visibilityState,records:document.querySelector('iframe[title="LiveIt journal workspace"]').contentWindow.LiveItDemo.state().records.filter(r=>r.type!=='event').map(r=>r.body)})));
   throw error;
  });
  assert.ok(await b.page.evaluate(()=>document.querySelector('iframe[title="LiveIt journal workspace"]').contentWindow.LiveItDemo.state().records.some(r=>r.type==='event')));

  const connectedPath=app=>origin+'/partners/connected/?connected-app='+app;
  await a.page.goto(connectedPath('thinkit'));await b.page.goto(connectedPath('thinkit'));
  const think=a.page.frameLocator('iframe[title="ThinkIt diagramming and Mind Map workspace"]');
  await think.locator('#diStartCreate').click();await think.locator('[data-project-mode="mind"]').click();
  await think.locator('#projectStartName').fill('App folder project');await think.locator('#modalRoot .modal-footer').getByRole('button',{name:'Create blank project',exact:true}).click();
  await saveAppFile(a.page,'ThinkIt');
  const lastRevision=await a.page.evaluate(()=>JSON.parse(localStorage.getItem('keepit-app-file-binding-v1:thinkit')).revision);
  await a.context.setOffline(true);await think.locator('#docName').fill('Edited offline');await think.locator('#docName').press('Tab');
  await think.locator('#saveStatus[data-state="saved"]').filter({hasText:'Saved on this device'}).waitFor({state:'attached'});
  await a.context.setOffline(false);
  await a.page.waitForFunction(previous=>JSON.parse(localStorage.getItem('keepit-app-file-binding-v1:thinkit')).revision!==previous,lastRevision,{timeout:35000});
  await openAppFile(b.page,'ThinkIt','Edited offline');
  assert.equal(await b.page.frameLocator('iframe[title="ThinkIt diagramming and Mind Map workspace"]').locator('#docName').inputValue(),'Edited offline');

  await a.page.goto(connectedPath('travelit'));await b.page.goto(connectedPath('travelit'));
  const travel=a.page.frameLocator('iframe[title="TravelIt trip planning workspace"]');
  await travel.locator('#view-select').selectOption('trips');await travel.locator('[data-action="new-trip"]').click();
  await travel.locator('#f-title').fill('App folder trip');
  await travel.locator('#f-startDate').fill(eventStart);await travel.locator('#f-endDate').fill(eventEnd);
  await travel.locator('#modal-form button[type="submit"]').click();
  await travel.locator('#modal-backdrop').waitFor({state:'hidden'});
  await travel.locator('#trip-cloud-status').filter({hasText:'Trips saved in KeepIt'}).waitFor({timeout:45000});
  await a.page.setViewportSize({width:393,height:852});
  await travel.locator('[data-trip-tab="prepare"]').click();
  await travel.getByRole('button',{name:'Open documents'}).click();
  const tripDocs=travel.getByRole('region',{name:'Trip documents'});
  await tripDocs.waitFor();
  assert.equal(await tripDocs.getByRole('link',{name:/Add files in KeepIt/}).getAttribute('href'),'/partners/connected/?connected-app=keepit');
  async function addTripDocument(query,title){
   await tripDocs.getByRole('button',{name:/Link from KeepIt/}).click();
   await travel.locator('#f-documentSearch').fill(query);
   const options=travel.locator('#keepit-document-choice');
   const option=options.locator('option').filter({hasText:title});
   await option.waitFor({state:'attached'});
   await options.selectOption(await option.getAttribute('value'));
   await travel.getByRole('button',{name:'Link to trip',exact:true}).click();
   await travel.locator('#modal-backdrop').waitFor({state:'hidden'});
  }
  // The original can be added from KeepIt in a different tab after the trip is open.
  const keepItTab=await a.context.newPage();
  await keepItTab.goto(connectedPath('keepit'));
  await keepItTab.locator('#connected-cloud-status[data-phase="connected"]').waitFor({timeout:30000});
  await keepItTab.locator('#file-input').setInputFiles({name:'boarding.txt',mimeType:'text/plain',buffer:Buffer.from('Synthetic boarding confirmation')});
  await keepItTab.locator('#capture-title').fill('Synthetic boarding pass');
  await keepItTab.locator('#capture-form').getByRole('button',{name:'Save',exact:true}).click();
  await keepItTab.getByText('Synthetic boarding pass',{exact:true}).first().waitFor();
  await keepItTab.locator('#upload-summary').filter({hasText:'Uploads complete'}).waitFor({state:'attached'});
  await keepItTab.close();
  await addTripDocument('boarding.txt','Synthetic boarding pass');
  await addTripDocument('meeting','Synthetic meeting note');
  await tripDocs.getByRole('button',{name:'Open Synthetic meeting note in KeepIt',exact:true}).click();
  await a.page.locator('dialog.note-dialog[open]').getByText('Original meeting notes for the LiveIt link test.',{exact:true}).waitFor();
  await a.page.locator('dialog.note-dialog[open]').getByRole('button',{name:'Close',exact:true}).click();
  await tripDocs.getByRole('button',{name:'Open Synthetic boarding pass in KeepIt',exact:true}).click();
  await a.page.locator('#item-dialog[open] #item-heading').filter({hasText:'Synthetic boarding pass'}).waitFor();
  await a.page.locator('#item-dialog').evaluate(dialog=>dialog.close());
  const [download]=await Promise.all([
   a.page.waitForEvent('download'),
   tripDocs.getByRole('button',{name:'Download Synthetic boarding pass for offline use',exact:true}).click()
  ]);
  assert.equal(download.suggestedFilename(),'boarding.txt');
  assert.equal(readFileSync(await download.path(),'utf8'),'Synthetic boarding confirmation');
  await a.page.reload();
  await travel.locator('#view-select').selectOption('trips');
  await travel.locator('[data-trip-tab="documents"]').click();
  assert.equal(await tripDocs.locator('li').count(),2);
  await a.page.waitForFunction(()=>{
   const frame=document.querySelector('iframe[title="TravelIt trip planning workspace"]');
   return frame?.contentDocument.querySelector('#trip-cloud-status')?.textContent==='Trips saved in KeepIt.';
  },null,{timeout:45000});
  const otherTravel=b.page.frameLocator('iframe[title="TravelIt trip planning workspace"]');
  await otherTravel.locator('#view-select').selectOption('trips');
  await otherTravel.getByRole('heading',{name:'App folder trip',exact:true}).waitFor({timeout:45000}).catch(async error=>{
   console.error('TRAVELIT_RESTORE_STATE',await otherTravel.locator('#trip-cloud-status').textContent(),await b.page.locator('#connected-cloud-status').textContent(),b.errors);
   throw error;
  });
  await otherTravel.locator('[data-trip-tab="documents"]').click();
  const restoredDocs=otherTravel.getByRole('region',{name:'Trip documents'});
  await restoredDocs.getByText('Synthetic meeting note',{exact:true}).waitFor({timeout:45000});
  assert.equal(await restoredDocs.locator('li').count(),2);
  await restoredDocs.getByRole('button',{name:'Remove link to Synthetic boarding pass',exact:true}).click();
  await restoredDocs.locator('li').filter({hasText:'Synthetic boarding pass'}).waitFor({state:'hidden'});
  await restoredDocs.getByRole('button',{name:/Link from KeepIt/}).click();
  await otherTravel.locator('#f-documentSearch').fill('boarding.txt');
  await otherTravel.locator('#keepit-document-choice option').filter({hasText:'Synthetic boarding pass'}).waitFor({state:'attached'});
  console.log('TRAVELIT_TRIP_KEEPIT_LINKS_CANONICAL_OPEN_DOWNLOAD_AND_REOPEN_'+engine.name().toUpperCase()+'_PASS');
  // Independent profile sees the verified cloud trip in LiveIt without copying it into Work.
  await a.page.goto(connectedPath('liveit'));
  const live=a.page.frameLocator('iframe[title="LiveIt journal workspace"]');
  await a.page.waitForFunction(()=>document.querySelector('iframe[title="LiveIt journal workspace"]')?.contentWindow?.LiveItDemo?.getProjectionCount()===1,null,{timeout:45000});
  await live.locator('[data-action="scope"][data-scope="work"]').first().click();
  await live.locator('[data-action="nav"][data-view="calendar"]:visible').first().click();
  await live.locator('[data-action="calendar-mode"][data-mode="month"]').click();
  await live.locator('.calendar-cell[data-date="'+eventStart+'"]').click();
  assert.equal(await live.locator('.feed-title').filter({hasText:'App folder trip'}).count(),0);
  await live.locator('[data-action="scope"][data-scope="personal"]').first().click();
  for(const day of [eventStart,eventMiddle,eventEnd]){
   await live.locator('[data-action="calendar-mode"][data-mode="month"]').click();
   await live.locator('.calendar-cell[data-date="'+day+'"]').click();
   await live.locator('.feed-title').filter({hasText:'App folder trip'}).waitFor();
  }
  b.page.once('dialog',dialog=>dialog.accept());
  await otherTravel.locator('#modal-close').click();
  await otherTravel.locator('#modal-backdrop').waitFor({state:'hidden'});
  await otherTravel.getByText('Trip actions',{exact:true}).click();
  b.page.once('dialog',dialog=>dialog.accept());
  const beforeDelete=await b.page.evaluate(()=>JSON.parse(localStorage.getItem('keepit-app-file-binding-v1:travelit')).revision);
  await otherTravel.getByRole('button',{name:'Delete trip',exact:true}).click();
  await otherTravel.getByText('Your journeys',{exact:true}).waitFor();
  await b.page.waitForFunction(previous=>JSON.parse(localStorage.getItem('keepit-app-file-binding-v1:travelit')).revision!==previous,beforeDelete,{timeout:30000}).catch(async error=>{
   console.error('TRAVELIT_DELETE_SYNC_STATE',await otherTravel.locator('#trip-cloud-status').textContent(),await b.page.evaluate(()=>document.visibilityState),b.errors);
   throw error;
  });
  await a.page.bringToFront();
  await a.page.waitForFunction(()=>document.querySelector('iframe[title="LiveIt journal workspace"]')?.contentWindow?.LiveItDemo?.getProjectionCount()===0,null,{timeout:45000}).catch(async error=>{
   console.error('LIVEIT_TRIP_DELETE_STATE',await a.page.evaluate(()=>document.visibilityState),await live.locator('#travelCalendarStatus').textContent(),a.errors);
   throw error;
  });
  assert.equal(await live.locator('.feed-title').filter({hasText:'App folder trip'}).count(),0);
  console.log('TRAVELIT_AUTOMATIC_WORKSPACE_AND_LIVEIT_PERSONAL_SPAN_'+engine.name().toUpperCase()+'_PASS');

  assert.deepEqual(a.errors,[]);assert.deepEqual(b.errors,[]);
  console.log('KEEPIT_DEDICATED_APP_FILES_TWO_DEVICES_'+engine.name().toUpperCase()+'_PASS');
  for(const context of contexts)await context.close();await browser.close();browser=null;
 }
}finally{await browser?.close();await new Promise(ok=>server.close(ok));rmSync(temp,{recursive:true,force:true});}
