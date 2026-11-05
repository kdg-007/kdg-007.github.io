// Public compiled-asset QA. Disposable browser contexts only; no OAuth, production files or cloud writes.
import assert from 'node:assert/strict';
import {createServer} from 'node:https';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,extname,sep} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(resolve(process.cwd(),'package.json'));
const {chromium,webkit}=require('playwright');
const root=resolve('.'),temp=mkdtempSync(join(tmpdir(),'keepit-connected-'));
const key=join(temp,'key.pem'),cert=join(temp,'cert.pem');
execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,
 '-out',cert,'-days','1','-subj','/CN=127.0.0.1',
 '-addext','subjectAltName=IP:127.0.0.1'],{stdio:'ignore'});
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
 '.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
 '.json':'application/json','.svg':'image/svg+xml','.png':'image/png',
 '.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
const server=createServer({key:readFileSync(key),cert:readFileSync(cert)},(req,res)=>{
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'https://127.0.0.1').pathname);}
 catch{res.writeHead(400);res.end();return;}
 const file=resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
 if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
 try{
  if(!statSync(file).isFile())throw Error('Not a file');
  res.writeHead(200,{'Content-Type':MIME[extname(file)]||'application/octet-stream',
   'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.end(readFileSync(file));
 }catch{res.writeHead(404);res.end('Not found');}
});
let browser=null;
const ua='Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1';
try{
 await new Promise((ok,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',ok)});
 const origin='https://127.0.0.1:'+server.address().port;
 for(const engine of [chromium,webkit]){
  browser=await engine.launch({headless:true});
  const tag=engine.name().toUpperCase();
  const ctx=await browser.newContext({userAgent:ua,ignoreHTTPSErrors:true,
   viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  await ctx.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'
   ?route.continue():route.abort());
  const page=await ctx.newPage(),errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  const inspect=async()=>({
   messages:errors.slice(-6),
   body:(await page.locator('body').innerText().catch(()=>'' )).slice(0,350)
  });
  try{
   await page.goto(origin+'/partners/connected/?connected-app=liveit',{waitUntil:'domcontentloaded'});
   const host=page.locator('section[aria-label="LiveIt connected workspace"]');
   await host.waitFor({state:'visible',timeout:40000}).catch(async()=>{
    throw Error('Actual KeepIt owner host not mounted: '+JSON.stringify(await inspect()));
   });
   const frame=page.frameLocator('iframe[title="LiveIt journal workspace"]');
   await frame.locator('#app .app-shell').waitFor({state:'visible',timeout:40000});
   await frame.locator('.quick-actions-panel .quick-action-tile[data-shortcut="note"]').click();
   await frame.locator('#captureDialog').waitFor({state:'visible'});
   const body='W18E connected note original '+tag;
   await frame.locator('#captureBody').fill(body);
   await frame.locator('[data-action="capture-save"]').first().click();
   await frame.locator('#captureDialog').waitFor({state:'hidden',timeout:30000});
   await host.getByRole('button',{name:'Refresh LiveIt records'}).click();
   const target=host.locator('select[aria-label="LiveIt note target"]');
   await page.waitForFunction(()=>document.querySelector(
    'section[aria-label="LiveIt connected workspace"] select')?.options.length>0,
    null,{timeout:30000});
   assert.ok(await target.locator('option').count()>0);
   await host.getByRole('button',{name:'Open native note'}).click();
   const note=page.locator('dialog.note-dialog');
   await note.waitFor({state:'visible',timeout:45000});
   const editor=note.locator('.note-editor [contenteditable="true"]');
   await editor.waitFor({state:'visible',timeout:30000});
   const noteText='Saved in canonical KeepIt library via W18E LiveIt '+tag;
   await editor.fill(noteText);
   await note.locator('.note-actions').getByRole('button',{name:'Save',exact:true}).click();
   try {
    await page.waitForFunction(text=>{
     const d=document.querySelector('dialog.note-dialog');
     // The current KeepIt native continuous-save editor correctly REMAINS
     // in edit mode. Its verified local-original status, not a preview
     // transition, is the durable-save acknowledgement.
     return d?.dataset.mode==='edit' &&
      d.querySelector('.note-editor')?.textContent?.includes(text) &&
      d.querySelector('.note-status')?.textContent?.includes('Verified in KeepIt');
    },noteText,{timeout:18000});
   } catch(e) {
    const diagnostics=await page.evaluate(()=>{
     const d=document.querySelector('dialog.note-dialog');
     return {mode:d?.dataset.mode,open:d?.open,status:d?.querySelector('.note-status')?.textContent,
      reader:d?.querySelector('.note-reader')?.textContent?.slice(0,250),
      editor:d?.querySelector('.note-editor')?.textContent?.slice(0,250),
      buttons:[...d?.querySelectorAll('button')||[]].map(x=>({text:x.textContent,disabled:x.disabled})).slice(-12),
      error:[...document.querySelectorAll('[role=alert],.message.error')].map(x=>x.textContent?.slice(0,180)).slice(0,8)};
    });
    throw Error('Native KeepIt save evidence unresolved: '+JSON.stringify({diagnostics,errors,hostStatus:await host.getByRole('status').textContent()}));
   }
   assert.match(await note.locator('.note-editor').innerText(),/Saved in canonical KeepIt library/);
   assert.match(await note.locator('.note-status').innerText(),/Verified in KeepIt/);
   await note.locator('button.note-exit').click();
   await note.waitFor({state:'hidden',timeout:20000});
   await host.getByRole('button',{name:'Open native note'}).click();
   await note.waitFor({state:'visible',timeout:30000});
   await page.waitForFunction(t=>document.querySelector('dialog.note-dialog')?.textContent?.includes(t),
    noteText,{timeout:30000});
   await note.locator('button.note-exit').click();
   await note.waitFor({state:'hidden',timeout:20000});
   console.log('KEEPIT_CONNECTED_LIVEIT_NATIVE_CREATE_SAVE_REOPEN_'+tag+'_PASS');
   // Other two first-party hosts must mount under the same KeepIt-owned origin.
   // Full topic/trip note roundtrip is a separate acceptance gate, NOT inferred.
   await page.goto(origin+'/partners/connected/?connected-app=travelit',{waitUntil:'domcontentloaded'});
   await page.locator('section[aria-label="TravelIt connected workspace"]')
     .waitFor({state:'visible',timeout:40000});
   await page.frameLocator('iframe[title="TravelIt trip planning workspace"]')
     .locator('body').waitFor({state:'visible'});
   console.log('KEEPIT_CONNECTED_TRAVELIT_NATIVE_HOST_MOUNT_'+tag+'_PASS');
   const travelHost=page.locator('section[aria-label="TravelIt connected workspace"]');
   const trip=page.frameLocator('iframe[title="TravelIt trip planning workspace"]');
   await trip.locator('#mobile-nav [data-view="trips"]').click();
   await trip.locator('[data-action="new-trip"]').first().click();
   await trip.locator('#modal-form').waitFor({state:'visible',timeout:15000});
   await trip.locator('#f-title').fill('W18E connected travel record '+tag);
   await trip.locator('#f-timezone').fill('Asia/Manila');
   await trip.locator('#f-startDate').fill('2026-11-12');
   await trip.locator('#f-endDate').fill('2026-11-13');
   await trip.locator('#modal-form button[type="submit"]').click();
   await trip.locator('#modal-backdrop').waitFor({state:'hidden',timeout:25000});
   await travelHost.getByRole('button',{name:'Refresh travel records'}).click();
   const travelTarget=travelHost.locator('select[aria-label="TravelIt note target"]');
   await page.waitForFunction(()=>document.querySelector(
    'section[aria-label="TravelIt connected workspace"] select')?.options.length>0,
    null,{timeout:25000});
   assert.ok((await travelTarget.locator('option').count())>0);
   await travelHost.getByRole('button',{name:'Open native note'}).click();
   await note.waitFor({state:'visible',timeout:35000}).catch(async()=>{
     throw Error('TravelIt native editor not opened: '+JSON.stringify({
      status:await travelHost.getByRole('status').textContent(),errors
     }));
   });
   const travelEditor=note.locator('.note-editor [contenteditable="true"]');
   await travelEditor.waitFor({state:'visible',timeout:25000});
   const travelNote='Saved via TravelIt in KeepIt canonical library '+tag;
   await travelEditor.click();
   await travelEditor.pressSequentially(travelNote,{delay:12});
   await page.waitForFunction(text=>
     document.querySelector('dialog.note-dialog .note-editor [contenteditable="true"]')?.textContent?.includes(text),
     travelNote,{timeout:15000});
   await note.locator('.note-actions').getByRole('button',{name:'Save',exact:true}).click();
   await page.waitForFunction(text=>{
    const d=document.querySelector('dialog.note-dialog');
    return d?.dataset.mode==='edit' &&
      d.querySelector('.note-editor')?.textContent?.includes(text) &&
      d.querySelector('.note-status')?.textContent?.includes('Verified in KeepIt');
   },travelNote,{timeout:30000}).catch(async()=>{
    throw Error('TravelIt native note save was not verified: '+JSON.stringify({
     status:await note.locator('.note-status').textContent(),
     hostStatus:await travelHost.getByRole('status').textContent(),
     editor:await travelEditor.innerText().catch(()=>''),errors
    }));
   });
   await note.locator('button.note-exit').click();
   await note.waitFor({state:'hidden'});
   await travelHost.getByRole('button',{name:'Open native note'}).click();
   await note.waitFor({state:'visible',timeout:35000});
   await page.waitForFunction(text=>document.querySelector('dialog.note-dialog')?.textContent?.includes(text),
     travelNote,{timeout:25000});
   await note.locator('button.note-exit').click();
   await note.waitFor({state:'hidden'});
   console.log('KEEPIT_CONNECTED_TRAVELIT_NATIVE_CREATE_SAVE_REOPEN_'+tag+'_PASS');
   await page.goto(origin+'/partners/connected/?connected-app=thinkit',{waitUntil:'domcontentloaded'});
   await page.locator('#thinkit-host-panel').waitFor({state:'visible',timeout:40000});
   console.log('KEEPIT_CONNECTED_THINKIT_NATIVE_HOST_MOUNT_'+tag+'_PASS');
  }finally{await ctx.close();await browser.close();browser=null;}
 }
 console.log('KEEPIT_CONNECTED_FIRST_PARTY_DISPOSABLE_QA_PASS');
}catch(e){console.error(e?.stack||String(e));process.exitCode=1;}
finally{await browser?.close();await new Promise(ok=>server.close(ok));rmSync(temp,{recursive:true,force:true});}
