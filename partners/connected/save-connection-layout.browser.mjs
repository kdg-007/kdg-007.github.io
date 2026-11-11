import assert from 'node:assert/strict';
import {createServer} from 'node:https';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync,statSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,extname,sep} from 'node:path';
import {createRequire} from 'node:module';
import {connectionFixture} from './owner-connection-fixture.mjs';
const {chromium,webkit}=createRequire(resolve('package.json'))('playwright');
const root=resolve('.'),temp=mkdtempSync(join(tmpdir(),'save-connection-'));
const proof=JSON.parse(readFileSync('partners/connected/owner-release.json'));
const modulePath=prefix=>'/'+Object.keys(proof.files).find(p=>p.startsWith('assets/'+prefix+'-'));
execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(temp,'key'),'-out',join(temp,'cert'),'-days','1','-subj','/CN=127.0.0.1'],{stdio:'ignore'});
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
let uploads;
const server=createServer({key:readFileSync(join(temp,'key')),cert:readFileSync(join(temp,'cert'))},(req,res)=>{
 if(req.method==='PUT'&&req.url.startsWith('/__upload?')){
  const parts=[];req.on('data',p=>parts.push(p));req.on('end',()=>{
   const q=new URL(req.url,'https://localhost').searchParams,data=Buffer.concat(parts);assert.ok(data.length);
   const result=uploads.acceptUpload(q.get('parent'),q.get('name'),data);res.writeHead(result.status,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}).end(JSON.stringify(result.value));
  });return;
 }
 const pathname=new URL(req.url,'https://localhost').pathname,file=resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
 try{assert.ok(file.startsWith(root+sep));assert.ok(statSync(file).isFile());const bytes=readFileSync(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(bytes);}catch{res.writeHead(404).end();}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const origin='https://127.0.0.1:'+server.address().port;
async function authAndEditor(browser){
 const context=await browser.newContext({ignoreHTTPSErrors:true,serviceWorkers:'block'}),page=await context.newPage();
 try{
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  await page.goto(origin+'/partners/connected/status.json');
  const auth=await page.evaluate(async path=>{
   const {b:Auth}=await import(path);const account={homeAccountId:'synthetic-account'};
   let mode='timeout',requests=[];
   const client=new Auth({clientId:'c2afef6b-096d-4b89-80e0-09738f32132a'});client.timeoutMs=25;
   client.pca={getActiveAccount:()=>account,acquireTokenSilent:async request=>{requests.push({force:request.forceRefresh,policy:request.cacheLookupPolicy});if(mode==='timeout')await new Promise(()=>{});if(mode==='denied')throw {errorCode:'invalid_grant'};return {account,accessToken:'synthetic-token'};}};
   let timeout;try{await client.token(account.homeAccountId);}catch(e){timeout=e.code;}
   const retained=!client.reconnectRequired;mode='ok';const token=await client.token(account.homeAccountId);
   client.invalidateToken();await client.token(account.homeAccountId);const forced=requests.at(-1);
   mode='denied';let denied;try{await client.token(account.homeAccountId);}catch(e){denied=e.code;}
   return {timeout,retained,token,forced,denied,requiresInteraction:client.reconnectRequired};
  },modulePath('keepit-auth-live'));
  assert.deepEqual(auth,{timeout:'NETWORK_UNKNOWN',retained:true,token:'synthetic-token',forced:{force:true,policy:3},denied:'AUTH_REQUIRED',requiresInteraction:true});
  await page.evaluate(async path=>{
   const {a:NoteUI}=await import(path),{c:NoteWorkspace}=await import('/assets/chunk-O6257ALA.js');
   const workspace=await new NoteWorkspace({name:'synthetic-offline-note-'+crypto.randomUUID()}).open();
   const target=JSON.stringify(['cloud','synthetic-account','drive','root','library']);
   const values={title:'Offline note',domain:'Aviation',recordType:'Notes',tags:['test'],customFields:[],source:'',notes:'',favorite:false};
   const draft=await workspace.saveDraft({id:crypto.randomUUID(),itemId:crypto.randomUUID(),noteId:crypto.randomUUID(),target,document:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Keep this body'}]}]},assets:[],values},0);
   const qa={workspace,target,writable:false,saved:null,writes:0};
   const library=()=>({isCloud:true,readOnly:false,getItem:async()=>qa.saved?.item||null,original:async()=>qa.saved.blob,saveNote:async job=>{qa.writes++;const item={...job.values,id:job.id,version:job.expectedVersion+1,digest:job.digest,trashedAt:null};qa.saved={item,blob:job.blob};return item;}});
   qa.library=library();qa.nextLibrary=library;
   const schema={version:1,revision:0,categories:['Aviation'],recordTypes:['Notes'],fields:[]};
   const ui=new NoteUI({workspace,getLibrary:()=>qa.library,getTarget:async()=>qa.target,getSchema:()=>schema,getRecords:()=>[],canWrite:()=>qa.writable,onChange:()=>{}});
   ui.library=qa.library;ui.target=target;qa.ui=ui;window.saveQA=qa;await ui.editDraft(draft);
  },modulePath('keepit-note-ui'));
  const editor=page.getByRole('dialog',{name:'KeepIt note'}),subject=editor.getByRole('textbox',{name:'Subject'});
  await subject.fill('Saved while disconnected');await editor.getByRole('button',{name:'Save',exact:true}).click();
  await page.waitForFunction(()=>saveQA.ui.session.draft.connectedAuto&&!saveQA.ui.preparing);
  assert.equal(await subject.isEnabled(),true);assert.equal(await editor.getAttribute('data-mode'),'edit');
  await subject.fill('Latest edit while disconnected');
  await page.evaluate(async()=>{await saveQA.ui.session.chain;saveQA.session=saveQA.ui.session;saveQA.library=saveQA.nextLibrary();saveQA.writable=true;await saveQA.ui.reconnectThinkItLibrary(saveQA.library);});
  await editor.locator('.note-status').filter({hasText:'Verified synced to OneDrive'}).waitFor({timeout:15000});
  assert.equal(await subject.inputValue(),'Latest edit while disconnected');
  const saved=await page.evaluate(async()=>({same:saveQA.ui.session===saveQA.session,title:saveQA.saved.item.title,writes:saveQA.writes,body:JSON.stringify((await (await import('/assets/chunk-G42SHEZJ.js')).r(saveQA.saved.blob)).document)}));
  assert.equal(saved.same,true);assert.equal(saved.title,'Latest edit while disconnected');assert.equal(saved.writes,1);assert.ok(saved.body.includes('Keep this body'));
  await page.evaluate(async()=>{saveQA.target='another-library';saveQA.library=saveQA.nextLibrary();saveQA.wrongAccepted=await saveQA.ui.reconnectThinkItLibrary(saveQA.library);saveQA.writable=false;});
  await subject.fill('Keep in the original library');await editor.getByRole('button',{name:'Save',exact:true}).click();
  const guarded=await page.evaluate(async()=>{await saveQA.ui.session.chain;return {accepted:saveQA.wrongAccepted,target:saveQA.ui.session.draft.target,title:saveQA.ui.session.draft.values.title,writes:saveQA.writes};});
  assert.equal(guarded.accepted,false);assert.ok(guarded.target.includes('synthetic-account'));assert.equal(guarded.title,'Keep in the original library');assert.equal(guarded.writes,1);
  await page.evaluate(async()=>{const note=await (await import('/assets/chunk-G42SHEZJ.js')).r(saveQA.saved.blob);saveQA.ui.showPreview(note,saveQA.saved.item,saveQA.saved.blob,{id:'synthetic-old-pending',state:'failed'});});
  assert.equal(await editor.getByRole('button',{name:'Edit',exact:true}).isDisabled(),true,'Legacy pending sources remain protected until a recovery copy is made');
 }finally{await context.close();}
}
async function connected(browser){
 const context=await browser.newContext({ignoreHTTPSErrors:true,serviceWorkers:'block',viewport:{width:1440,height:900}}),page=await context.newPage();
 const fixture=connectionFixture(origin,{writable:true});uploads=fixture;fixture.uploadEndpoint=origin+'/__upload';let rejected=0,networkOffline=false;
 try{
  await context.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(networkOffline&&['graph.microsoft.com','fixture.storage.live.com'].includes(url.hostname))return route.abort();
   if(url.hostname==='graph.microsoft.com'&&route.request().method()==='GET'&&rejected++===0)return route.fulfill({status:401,contentType:'application/json',body:'{"error":{"code":"InvalidAuthenticationToken"}}'});
   return fixture.route(route);
  });
  await page.goto(origin+'/partners/connected/?connected-app=keepit&connect-onedrive=1');await page.locator('#onedrive-signin').click();
  await page.locator('#connected-cloud-status[data-phase=connected]').waitFor({timeout:30000});
  await page.locator('#add-files').click();await page.locator('#write-note').click();
  const note=page.locator('dialog.note-dialog[open]');await note.getByRole('textbox',{name:'Subject'}).fill('Actual reconnect regression');
  await note.getByLabel('More note actions',{exact:true}).click();await note.getByRole('textbox',{name:'Subject'}).click();assert.equal(await note.locator('details.note-command-menu[open]').count(),0);
  await note.locator('.note-editor [contenteditable=true]').fill('Retain body across the reconnected library object');
  // Exercise a fresh verified connection while the ordinary editor stays open.
  await page.evaluate(()=>document.getElementById('onedrive-retry').click());
  await page.waitForFunction(()=>window.keepItConnectionState?.phase==='connected');
  await note.getByRole('button',{name:'Save',exact:true}).click();
  await note.locator('.note-status').filter({hasText:/Synced to OneDrive|Verified synced to OneDrive/}).waitFor({timeout:30000});
  assert.equal(await note.locator('.note-status').filter({hasText:'selected library changed'}).count(),0);
  await note.getByRole('button',{name:'Edit',exact:true}).click();
  await note.getByRole('textbox',{name:'Subject'}).fill('Edited before a lost connection');networkOffline=true;
  await note.getByRole('button',{name:'Save',exact:true}).click();
  await note.locator('.note-status').filter({hasText:'Saved on this device'}).waitFor();
  if(await note.getAttribute('data-mode')==='preview')await note.getByRole('button',{name:'Edit',exact:true}).click();
  await note.getByRole('textbox',{name:'Subject'}).fill('Latest offline change must survive');
  assert.equal(await note.getByRole('textbox',{name:'Subject'}).isEnabled(),true);
  await page.locator('#connected-cloud-status[data-phase=waiting]').waitFor();
  networkOffline=false;await page.evaluate(()=>document.getElementById('onedrive-retry').click());
  await note.locator('.note-status').filter({hasText:'Verified synced to OneDrive'}).waitFor({timeout:40000});
  assert.equal(await note.getByRole('textbox',{name:'Subject'}).inputValue(),'Latest offline change must survive');
  await note.getByRole('button',{name:'Close',exact:true}).click();
 }finally{await context.close();}
}
async function headers(browser){
 const context=await browser.newContext({ignoreHTTPSErrors:true,serviceWorkers:'block'}),page=await context.newPage();
 try{
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  for(const app of ['liveit','thinkit','travelit']){
   await page.goto(origin+'/partners/connected/?connected-app='+app);
   await page.locator('iframe').first().waitFor();
   const frame=page.frameLocator('iframe').first();await frame.locator('.topbar').waitFor();
   if(app==='thinkit'){await frame.locator('#diStartCreate').click();await frame.getByRole('button',{name:'Create blank project',exact:true}).click();}
   await page.evaluate(()=>window.dispatchEvent(new CustomEvent('keepit-connection-state',{detail:{phase:'connected',message:'OneDrive / Very long folder path / 06 Database / 05 Knowledge Base / KeepIt connected'}})));
   for(const width of [320,393,744,1100,1280,1600,2048]){
    await page.setViewportSize({width,height:900});await page.evaluate(()=>new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(ok))));
    const geometry=await page.evaluate(()=>{
     const bar=document.querySelector('.connected-shell-bar').getBoundingClientRect(),frame=document.querySelector('iframe'),f=frame.getBoundingClientRect();
     const controls=[...frame.contentDocument.querySelectorAll('.topbar button,.topbar input,.topbar select')].filter(e=>e.getBoundingClientRect().width&&getComputedStyle(e).visibility!=='hidden');
     const overlap=controls.filter(e=>{const r=e.getBoundingClientRect(),x=r.left+f.left,y=r.top+f.top;return x<bar.right&&x+r.width>bar.left&&y<bar.bottom&&y+r.height>bar.top;}).map(e=>e.textContent||e.id);
     return {left:bar.left,right:bar.right,width:innerWidth,overlap};
    });
    assert.ok(geometry.left>=0&&geometry.right<=width+1,app+' bar '+JSON.stringify(geometry));assert.deepEqual(geometry.overlap,[],app+' '+width+' controls overlap');
    if(process.env.STABILITY_PREVIEW_DIR&&[393,2048].includes(width)){mkdirSync(process.env.STABILITY_PREVIEW_DIR,{recursive:true});await page.screenshot({path:join(process.env.STABILITY_PREVIEW_DIR,app+'-'+width+'.png'),clip:{x:0,y:0,width,height:220}});}
   }
   await page.locator('#connected-apps-toggle').click();await frame.locator('.topbar').click({position:{x:10,y:10}});assert.equal(await page.locator('#connected-apps-list').isHidden(),true);
   await page.locator('#connected-apps-toggle').click();await frame.locator('body').press('Escape');assert.equal(await page.locator('#connected-apps-list').isHidden(),true);
   if(app==='travelit'){
    await frame.locator('#view-select').selectOption('trips');await frame.getByRole('button',{name:'+ New trip',exact:true}).click();await frame.locator('#f-title').fill('Menu dismissal test');await frame.locator('#f-startDate').fill('2026-12-01');await frame.locator('#f-endDate').fill('2026-12-02');await frame.locator('#modal-form button[type=submit]').click();
    const actions=frame.locator('details.action-menu').first();await actions.locator('summary').click();await frame.locator('.topbar').click({position:{x:10,y:10}});assert.equal(await actions.getAttribute('open'),null);
   }
   if(app==='thinkit'){
    await frame.locator('#diMenuTabs [data-tab=File]').click();await page.locator('#connected-apps-toggle').click();assert.equal(await frame.locator('#diMenuPopup').isHidden(),true);
   }
  }
 }finally{await context.close();}
}
try{
 for(const engine of process.env.STABILITY_CHROMIUM_ONLY?[chromium]:[chromium,webkit]){
  const browser=await engine.launch({headless:true});
  try{if(!process.env.STABILITY_HEADERS_ONLY){await authAndEditor(browser);console.log('OFFLINE_NOTE_EDIT_RECONNECT_SCOPE_AND_AUTH_RECOVERY_'+engine.name().toUpperCase()+'_PASS');await connected(browser);console.log('COMPILED_OWNER_GET_401_REFRESH_AND_OPEN_EDITOR_RECONNECT_'+engine.name().toUpperCase()+'_PASS');}await headers(browser);console.log('RESPONSIVE_RESERVED_HEADERS_AND_CROSS_FRAME_DISMISS_'+engine.name().toUpperCase()+'_PASS');}
  finally{await browser.close();}
 }
}finally{await new Promise(ok=>server.close(ok));rmSync(temp,{recursive:true,force:true});}
