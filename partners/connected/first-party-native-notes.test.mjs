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
  const desktop=await browser.newContext({ignoreHTTPSErrors:true,
   viewport:{width:1440,height:900},serviceWorkers:'block'});
  try{
   await desktop.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'
    ?route.continue():route.abort());
   const page=await desktop.newPage();
   await page.goto(origin+'/partners/connected/?connected-app=liveit',{waitUntil:'domcontentloaded'});
   const host=page.getByRole('region',{name:'LiveIt connected workspace'});
   const frame=host.frameLocator('iframe[title="LiveIt journal workspace"]');
   await frame.locator('#app .app-shell').waitFor({state:'visible',timeout:15000});
   assert.equal(await host.locator('.connected-shell-current').innerText(),'Today');

   await frame.locator('.quick-actions-panel .quick-action-tile[data-shortcut="note"]').click();
   await frame.locator('#captureBody').fill('LiveIt desktop capture without a KeepIt library');
   await frame.locator('[data-action="capture-save"]').first().click();
   await frame.locator('#captureDialog').waitFor({state:'hidden',timeout:15000});
   await host.locator('#connected-apps-toggle').click();
   await host.locator('#connected-note-tools-toggle').click();
   const tools=host.locator('#connected-note-tools');
   await tools.getByRole('button',{name:'Refresh LiveIt records'}).click();
   await tools.locator('select option').first().waitFor({state:'attached',timeout:10000});
   await tools.getByRole('button',{name:'Open native note'}).click();
   await tools.getByText('Connect a writable KeepIt library before opening a native note.',{exact:true})
    .waitFor({state:'visible',timeout:10000});
   assert.equal(await page.locator('dialog.note-dialog[open]').count(),0);
   console.log('LIVEIT_DESKTOP_WITHOUT_KEEPIT_LIBRARY_'+tag+'_PASS');
  }finally{await desktop.close();}

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
  // Diagnostic-only readback from disposable browser IndexedDB: never reports original note bytes.
  // The original Blob is a KEEPIT-NOTE-1 envelope containing a JSON document header.
  const nativeDiskEvidence=async text=>page.evaluate(async expected=>{
   return await new Promise((resolve,reject)=>{
    const request=indexedDB.open('mylibrary-device-v1');
    request.onupgradeneeded=()=>{request.transaction?.abort();reject(Error('No existing note database'));};
    request.onerror=()=>reject(request.error||Error('Database not readable'));
    request.onsuccess=()=>{
     const db=request.result;
     let tx;try{tx=db.transaction(['items','originals'],'readonly');}
     catch(e){db.close();reject(e);return;}
     const items=tx.objectStore('items').getAll();
     const originals=tx.objectStore('originals').getAll();
     tx.onerror=()=>{db.close();reject(tx.error||Error('Original read failed'));};
     tx.oncomplete=async()=>{
      db.close();
      const rows=(items.result||[]).filter(i=>i?.mime==='application/vnd.keepit.note'&&!i.trashedAt);
      const originalsById=new Map((originals.result||[]).map(i=>[i.id,i]));
      try{
       const notes=await Promise.all(rows.map(async i=>{
        const original=originalsById.get(i.id),stored=original?.blobData,legacy=original?.blob;
        // KeepIt's browser-safe persistence may store binary originals as blobData
        // (ArrayBuffer or a typed array), rather than as a direct Blob.
        const source=legacy instanceof Blob?legacy:
          stored instanceof Blob?stored:
          (stored instanceof ArrayBuffer||ArrayBuffer.isView(stored))?
            new Blob([stored],{type:original?.mime||'application/octet-stream'}):null;
        const raw=source?await source.slice(0,Math.min(source.size,128*1024)).text():'';
        const sha=source?await crypto.subtle.digest('SHA-256',await source.arrayBuffer()):null;
        const digest=sha?[...new Uint8Array(sha)].map(n=>n.toString(16).padStart(2,'0')).join(''):null;
        return {version:i.version,digestValid:/^[a-f0-9]{64}$/.test(i.digest||''),
                digestMatches:digest===i.digest,
                originalRowPresent:!!original,originalRowKeys:original?Object.keys(original):[],
                binaryType:legacy?.constructor?.name||typeof legacy,
                binaryDataType:stored?.constructor?.name||typeof stored,
                binaryDataTag:Object.prototype.toString.call(stored),
                binaryIsTypedArray:ArrayBuffer.isView(stored),
                binaryByteLength:stored?.byteLength??stored?.size??null,
                decodedOriginalPresent:!!source,
                containsExpected:raw.includes(expected)};
       }));
       resolve({noteCount:notes.length,matchingOriginals:notes.filter(x=>x.containsExpected).length,
                notes:notes.slice(-5)});
      }catch(e){reject(e)}
     };
    };
   });
  },text);
  try{
   // Previously installed KeepIt app links must not reopen the obsolete parent
   // banner; only an explicitly selected legacy app URL is redirected.
   await page.goto(origin+'/?connected-app=liveit',{waitUntil:'domcontentloaded'});
   await page.waitForURL(u=>{
    const url=new URL(u);
    return url.pathname==='/partners/connected/'&&url.searchParams.get('connected-app')==='liveit';
   },{timeout:25000});
   // The installed connected app must launch LiveIt first, even with no app query.
   await page.goto(origin+'/partners/connected/',{waitUntil:'domcontentloaded'});
   await page.waitForURL(url=>new URL(url).searchParams.get('connected-app')==='liveit',
    {timeout:25000});
   const identity=await page.evaluate(async()=>{
    const href=document.querySelector('link[rel="manifest"]')?.getAttribute('href');
    return {
     title:document.title,
     appleTitle:document.querySelector('meta[name="apple-mobile-web-app-title"]')?.content,
     manifestHref:href,
     manifest:href?await fetch(href).then(r=>r.json()):null
    };
   });
   assert.equal(identity.appleTitle,'LiveIt');
   assert.equal(identity.manifestHref,'/partners/connected/liveit.webmanifest');
   assert.equal(identity.manifest?.name,'LiveIt');
   assert.equal(identity.manifest?.start_url,'/partners/connected/?connected-app=liveit');
   assert.equal(identity.manifest?.scope,'/partners/connected/');
   const host=page.locator('section[aria-label="LiveIt connected workspace"]');
   await host.waitFor({state:'visible',timeout:40000}).catch(async()=>{
    throw Error('Actual KeepIt owner host not mounted: '+JSON.stringify(await inspect()));
   });
   const chrome=host.locator('.connected-shell-bar');
   await chrome.waitFor({state:'visible',timeout:20000});
   assert.equal(await chrome.locator('.connected-shell-current').innerText(),'Today');
   assert.equal(await page.locator('.keepit-qa-toggle').isVisible(),false,
    'QA controls must not float over the LiveIt workspace');
   const noteDrawer=host.locator('#connected-note-tools');
   await noteDrawer.waitFor({state:'attached',timeout:15000});
   assert.equal(await noteDrawer.getAttribute('open'),null,'KeepIt note tools must begin collapsed');
   assert.equal(await host.getByRole('button',{name:'Return to KeepIt'}).count(),0,
    'LiveIt must not have a Return to KeepIt parent control');
   const frame=page.frameLocator('iframe[title="LiveIt journal workspace"]');
   await frame.locator('#app .app-shell').waitFor({state:'visible',timeout:40000});
   // The owner can launch each first-party app through the connected menu
   // without leaving the current LiveIt draft or opening an external origin.
   await page.locator('#connected-apps-toggle').waitFor({state:'visible',timeout:10000});
   await page.locator('#connected-apps-toggle').click();
   for(const id of ['liveit','thinkit','travelit','keepit']){
    const a=page.locator('#connected-apps-list a').filter({hasText:id==='keepit'?'KeepIt':id==='thinkit'?'ThinkIt':id==='travelit'?'TravelIt':'LiveIt'});
    assert.equal(await a.count(),1);
    assert.equal(await a.getAttribute('target'),'_blank');
    const uri=new URL(await a.getAttribute('href'),origin);
    assert.equal(uri.origin,origin);
    assert.equal(uri.pathname,'/partners/connected/');
    assert.equal(uri.searchParams.get('connected-app'),id);
   }
   await page.locator('#connected-apps-toggle').click();
   await frame.locator('#liveit-apps-button').click();
   const menuLinks=await frame.locator('#liveit-app-switcher a').evaluateAll(els=>
     els.map(el=>el.getAttribute('href')));
   assert.ok(menuLinks.includes('/partners/connected/?connected-app=keepit'));
   assert.ok(menuLinks.includes('/partners/connected/?connected-app=thinkit'));
   assert.ok(menuLinks.includes('/partners/connected/?connected-app=travelit'));
   await frame.locator('#liveit-apps-button').click();
   await frame.locator('.quick-actions-panel .quick-action-tile[data-shortcut="note"]').click();
   await frame.locator('#captureDialog').waitFor({state:'visible'});
   const body='W18E connected note original '+tag;
   await frame.locator('#captureBody').fill(body);
   await frame.locator('[data-action="capture-save"]').first().click();
   await frame.locator('#captureDialog').waitFor({state:'hidden',timeout:30000});
   // Notes are intentionally accessed from Apps, not from an overlay on LiveIt.
   await page.locator('#connected-apps-toggle').click();
   await page.locator('#connected-note-tools-toggle').click();
   assert.notEqual(await noteDrawer.getAttribute('open'),null,'Note tools did not open');
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
   await editor.click();
   await editor.pressSequentially(noteText);
   // Confirm the editor accepted the synthetic text before Save; this differentiates
   // an input event failure from a later save/refresh regression.
   const liveitBeforeSave=await editor.innerText();
   assert.ok(liveitBeforeSave.includes(noteText),'LiveIt native editor did not accept input before Save');
   console.log('KEEPIT_QA_LIVEIT_EDITOR_INPUT_BEFORE_SAVE_'+tag+'_PASS');
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
    const disk=await nativeDiskEvidence(noteText).catch(e=>({error:String(e)}));
    throw Error('Native KeepIt save evidence unresolved: '+JSON.stringify({diagnostics,disk,
      inputHadTextBeforeSave:liveitBeforeSave.includes(noteText),
      errors,hostStatus:await host.getByRole('status').textContent()}));
   }
   assert.match(await note.locator('.note-editor').innerText(),/Saved in canonical KeepIt library/);
   assert.match(await note.locator('.note-status').innerText(),/Verified in KeepIt/);
   const liveitDisk=await nativeDiskEvidence(noteText);
   assert.ok(liveitDisk.matchingOriginals>=1,'LiveIt original body readback mismatch: '+JSON.stringify(liveitDisk));
   assert.ok(liveitDisk.notes.some(n=>n.containsExpected&&n.digestMatches),
     'liveitDisk expected note original SHA-256 must match the stored item digest');
   console.log('KEEPIT_QA_LIVEIT_ORIGINAL_BODY_READBACK_'+tag+'_PASS');
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
   const travelBar=travelHost.locator('.connected-shell-bar');
   await travelBar.waitFor({state:'visible',timeout:18000});
   assert.equal(await travelBar.locator('.connected-shell-current').innerText(),'TravelIt');
   const travelTools=travelHost.locator('#connected-note-tools');
   assert.equal(await travelTools.getAttribute('open'),null);
   assert.equal(await travelHost.getByRole('button',{name:'Return to KeepIt'}).count(),0);
   assert.equal(await page.locator('.keepit-qa-toggle').isVisible(),false);
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
   await page.locator('#connected-apps-toggle').click();
   await page.locator('#connected-note-tools-toggle').click();
   assert.notEqual(await travelTools.getAttribute('open'),null,'TravelIt note drawer did not open');
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
   const travelDisk=await nativeDiskEvidence(travelNote);
   assert.ok(travelDisk.matchingOriginals>=1,'TravelIt original body readback mismatch: '+JSON.stringify(travelDisk));
   assert.ok(travelDisk.notes.some(n=>n.containsExpected&&n.digestMatches),
     'travelDisk expected note original SHA-256 must match the stored item digest');
   console.log('KEEPIT_QA_TRAVELIT_ORIGINAL_BODY_READBACK_'+tag+'_PASS');
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
   const thinkHost=page.locator('#thinkit-host-panel');
   await thinkHost.waitFor({state:'visible',timeout:40000});
   const thinkBar=thinkHost.locator('.connected-shell-bar');
   await thinkBar.waitFor({state:'visible',timeout:18000});
   assert.equal(await thinkBar.locator('.connected-shell-current').innerText(),'ThinkIt');
   assert.equal(await thinkHost.locator('#connected-note-tools').getAttribute('open'),null);
   assert.equal(await thinkHost.getByRole('button',{name:'Return to KeepIt'}).count(),0);
   assert.equal(await page.locator('.keepit-qa-toggle').isVisible(),false);
   console.log('KEEPIT_CONNECTED_THINKIT_NATIVE_HOST_MOUNT_'+tag+'_PASS');
   // Actual Mind Map topic -> native KeepIt editor. Keep project/topic link
   // in ThinkIt's original record; KeepIt retains the only note body.
   await page.setViewportSize({width:1200,height:860});
   const thinkFrame=page.frameLocator('iframe[title="ThinkIt diagramming and Mind Map workspace"]');
   // ThinkIt starts with an explicit "Create Blank Project" welcome state.
   // Never bypass that user-mediated workflow or inject a synthetic diagram.
   const start=thinkFrame.locator('#diStartScreen');
   // The iframe shell mounts before ThinkIt's async project-selection UI.
   // A one-shot isVisible() races startup and leaves its editing toolbar hidden.
   await start.waitFor({state:'visible',timeout:25000});
   await thinkFrame.locator('#diStartCreate').click();
   await thinkFrame.locator('[data-project-mode="mind"]').click();
   await thinkFrame.locator('#projectStartName').fill('KeepIt-connected QA Mind Map');
   await thinkFrame.getByRole('button',{name:'Create blank project'}).click();
   await start.waitFor({state:'hidden',timeout:20000});
   // Mind Map Insert menu is accessible even when the Shape Library and
   // ribbon are collapsed. Exercise the visible first-party action instead
   // of clicking hidden controls or injecting internal diagram nodes.
   await thinkFrame.locator('#diMenuTabs .di-menu-tab[data-tab="Insert"]').click();
   await thinkFrame.locator('#diMenuPopup [data-dcmd="insert.shape"]').click();
   await thinkFrame.locator('body').press('Escape');
   const mindTab=thinkFrame.locator('#pageTabs .page-tab[title*="Mind Map"]');
   await mindTab.waitFor({state:'visible',timeout:9000}).catch(async()=>{
     const snapshot=await thinkFrame.locator('body').evaluate(el=>({
      className:el.className,
      text:el.innerText.slice(0,1250),
      tabs:[...el.querySelectorAll('#pageTabs button')].map(x=>({name:x.textContent,title:x.title,visible:!!x.getClientRects().length})).slice(0,12),
      current:el.querySelector('#modePill')?.textContent,
      start:el.querySelector('#diStartDialog')?.textContent?.slice(0,500),
      errors:[...el.querySelectorAll('[role="alert"]')].map(x=>x.textContent).slice(0,6)
     }));
     throw Error('ThinkIt Mind Map page not available in current startup: '+JSON.stringify({snapshot,errors}));
   });
   await mindTab.click();
   // v0.9.21 hides the legacy editor toolbar. Use the visible first-party
   // View > Outline / Shapes Panel action instead of a hidden button.
   const sidebarCollapsed=await thinkFrame.locator('body').evaluate(el=>
      el.classList.contains('sidebar-collapsed'));
   if(sidebarCollapsed){
     await thinkFrame.locator('#diMenuTabs .di-menu-tab[data-tab="View"]').click();
     await thinkFrame.locator('#diMenuPopup [data-dcmd="view.outline"]').click();
     await thinkFrame.locator('body').evaluate(el=>{
       if(el.classList.contains('sidebar-collapsed'))throw Error('Pages & Shapes did not open from View menu');
     });
   }
   await thinkFrame.locator('#btnMindNotes').waitFor({state:'visible',timeout:15000}).catch(async()=>{
    const state=await thinkFrame.locator('body').evaluate(el=>{
     const b=el.querySelector('#btnMindNotes'),tabs=[...el.querySelectorAll('#pageTabs .page-tab')];
     return {notesHidden:b?.hidden,notesDisplay:b?getComputedStyle(b).display:null,
       activeMode:el.querySelector('#modePill')?.textContent,
       statusMode:el.querySelector('#statusMode')?.textContent,
       activeTabs:tabs.filter(x=>x.classList.contains('active')).map(x=>({title:x.title,content:x.textContent})),
       mindTabs:tabs.filter(x=>x.title.includes('Mind Map')).map(x=>({title:x.title,active:x.classList.contains('active')})),
       startHidden:el.querySelector('#diStartScreen')?.hidden,
       bodyClasses:el.className, errors:[...el.querySelectorAll('[role="alert"]')].map(x=>x.textContent).slice(0,4)};
    });
    throw Error('ThinkIt Mind Map notes control not visible after selecting page: '+JSON.stringify(state));
   });
   await thinkFrame.locator('#btnMindNotes').click();
   await thinkFrame.locator('#mindOpenKeepItNative').waitFor({state:'visible',timeout:15000});
   await thinkFrame.locator('#mindOpenKeepItNative').click();
   await note.waitFor({state:'visible',timeout:30000}).catch(async()=>{
     throw Error('ThinkIt native note editor failed to open: '+JSON.stringify({
       body:(await page.locator('#thinkit-host-panel').innerText()).slice(0,600),errors
     }));
   });
   const thinkEditor=note.locator('.note-editor [contenteditable="true"]');
   await thinkEditor.waitFor({state:'visible',timeout:25000});
   const thinkNote='KeepIt canonical Mind Map note '+tag;
   await thinkEditor.click();
   await thinkEditor.pressSequentially(thinkNote,{delay:10});
   await page.waitForFunction(text=>
      document.querySelector('dialog.note-dialog .note-editor [contenteditable="true"]')?.textContent?.includes(text),
      thinkNote,{timeout:15000});
   await note.locator('.note-actions').getByRole('button',{name:'Save',exact:true}).click();
   await page.waitForFunction(text=>{
     const d=document.querySelector('dialog.note-dialog');
     return d?.dataset.mode==='edit' &&
       d.querySelector('.note-editor')?.textContent?.includes(text) &&
       d.querySelector('.note-status')?.textContent?.includes('Verified in KeepIt');
   },thinkNote,{timeout:30000}).catch(async()=>{
     throw Error('ThinkIt native note save not verified: '+JSON.stringify({
       status:await note.locator('.note-status').textContent(),errors
     }));
   });
   const thinkDisk=await nativeDiskEvidence(thinkNote);
   assert.ok(thinkDisk.matchingOriginals>=1,'ThinkIt original body readback mismatch: '+JSON.stringify(thinkDisk));
   assert.ok(thinkDisk.notes.some(n=>n.containsExpected&&n.digestMatches),
     'thinkDisk expected note original SHA-256 must match the stored item digest');
   console.log('KEEPIT_QA_THINKIT_ORIGINAL_BODY_READBACK_'+tag+'_PASS');
   await note.locator('button.note-exit').click();
   await note.waitFor({state:'hidden',timeout:15000});
   await thinkFrame.locator('#btnMindNotes').click();
   await thinkFrame.locator('#mindOpenKeepItNative').click();
   await note.waitFor({state:'visible',timeout:30000});
   await page.waitForFunction(text=>document.querySelector('dialog.note-dialog')?.textContent?.includes(text),
      thinkNote,{timeout:25000});
   await note.locator('button.note-exit').click();
   await note.waitFor({state:'hidden'});
   console.log('KEEPIT_CONNECTED_THINKIT_NATIVE_CREATE_SAVE_REOPEN_'+tag+'_PASS');
   // All three distinct consumer notes must exist as committed originals in
   // KeepIt's ONE canonical local library, not just in separate app links.
   const inventory=await page.evaluate(()=>new Promise((resolve,reject)=>{
     const open=indexedDB.open('mylibrary-device-v1');
     open.onupgradeneeded=()=>{open.transaction?.abort();reject(Error('Expected existing KeepIt library; refused to create one'))};
     open.onerror=()=>reject(open.error||Error('Cannot read KeepIt local library'));
     open.onsuccess=()=>{
       const db=open.result;
       let tx;
       try{tx=db.transaction(['items','originals'],'readonly');}
       catch(e){db.close();reject(e);return;}
       const items=tx.objectStore('items').getAll();
       const originals=tx.objectStore('originals').getAllKeys();
       tx.oncomplete=()=>{
         const rows=(items.result||[]).filter(x=>x?.mime==='application/vnd.keepit.note'&&!x.trashedAt);
         const keys=originals.result||[];
         db.close();
         resolve({notes:rows.map(x=>({id:x.id,version:x.version,digest:x.digest})),originals:keys});
       };
       tx.onerror=()=>{db.close();reject(tx.error||Error('KeepIt local readback failed'))};
       tx.onabort=()=>{db.close();reject(tx.error||Error('KeepIt local readback aborted'))};
     };
   }));
   assert.ok(inventory.notes.length>=3,'Expected three committed native notes in the SAME KeepIt library');
   assert.equal(new Set(inventory.notes.map(x=>x.id)).size,inventory.notes.length,
     'Canonical native note IDs must be distinct');
   const orig=new Set(inventory.originals);
   assert.ok(inventory.notes.every(x=>x.version>=1&&/^[a-f0-9]{64}$/.test(x.digest)&&orig.has(x.id)),
     'Every committed KeepIt note must retain its own original bytes');
   console.log('KEEPIT_CONNECTED_THREE_CONSUMERS_ONE_CANONICAL_LIBRARY_'+tag+'_PASS');

   // Close the original tab, reopen the actual KeepIt first-party hub in a
   // fresh document, then read committed original IDs/digests in the SAME
   // device browser profile. This tests navigation/restart durability without
   // claiming a physical iPhone or remote OneDrive roundtrip.
   await page.close();
   const reopened=await ctx.newPage();
   await reopened.goto(origin+'/partners/connected/',{waitUntil:'domcontentloaded'});
   await reopened.waitForURL(url=>{
    const u=new URL(url);
    return u.pathname==='/partners/connected/'&&u.searchParams.get('connected-app')==='liveit';
   },{timeout:30000});
   await reopened.waitForLoadState('load');
   await reopened.locator('#result-count').waitFor({state:'visible',timeout:35000});
   const after=await reopened.evaluate(()=>new Promise((resolve,reject)=>{
     const open=indexedDB.open('mylibrary-device-v1');
     open.onupgradeneeded=()=>{open.transaction?.abort();reject(Error('Cold reopen cannot find the original KeepIt library'));};
     open.onerror=()=>reject(open.error||Error('Cold reopen database read failed'));
     open.onsuccess=()=>{
       const db=open.result;
       let tx;
       try{tx=db.transaction(['items','originals'],'readonly');}
       catch(e){db.close();reject(e);return;}
       const items=tx.objectStore('items').getAll();
       const originals=tx.objectStore('originals').getAllKeys();
       tx.oncomplete=()=>{
         const notes=(items.result||[]).filter(x=>x?.mime==='application/vnd.keepit.note'&&!x.trashedAt);
         const keys=originals.result||[];
         db.close();
         resolve({notes:notes.map(x=>({id:x.id,version:x.version,digest:x.digest})),originals:keys});
       };
       tx.onerror=()=>{db.close();reject(tx.error||Error('Cold reopen transaction failed'));};
       tx.onabort=()=>{db.close();reject(tx.error||Error('Cold reopen transaction aborted'));};
     };
   }));
   const sortNotes=rows=>[...rows].sort((a,b)=>a.id.localeCompare(b.id));
   assert.deepEqual(sortNotes(after.notes),sortNotes(inventory.notes),
     'A fresh KeepIt tab must preserve all three consumers native note identities, versions and digests');
   assert.ok(after.notes.every(n=>after.originals.includes(n.id)),
     'A fresh KeepIt tab must retain every canonical native note original');
   console.log('KEEPIT_CONNECTED_THREE_CONSUMERS_COLD_TAB_REOPEN_'+tag+'_PASS');
   await reopened.close();
  }finally{await ctx.close();await browser.close();browser=null;}
 }
 console.log('KEEPIT_CONNECTED_FIRST_PARTY_DISPOSABLE_QA_PASS');
}catch(e){console.error(e?.stack||String(e));process.exitCode=1;}
finally{await browser?.close();await new Promise(ok=>server.close(ok));rmSync(temp,{recursive:true,force:true});}
