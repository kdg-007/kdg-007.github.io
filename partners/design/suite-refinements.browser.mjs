import assert from 'node:assert/strict';
import {createServer} from 'node:https';
import {createServer as createHTTPServer} from 'node:http';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,extname,sep} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(resolve('package.json')),{chromium,webkit}=require('playwright');
const root=resolve('.'),temp=mkdtempSync(join(tmpdir(),'suite-refinements-'));
execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(temp,'key'),'-out',join(temp,'cert'),'-days','1','-subj','/CN=127.0.0.1','-addext','subjectAltName=IP:127.0.0.1'],{stdio:'ignore'});
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json'};
const serve=(req,res)=>{
 const pathname=new URL(req.url,'https://localhost').pathname,file=resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
 try{assert.ok(file.startsWith(root+sep));res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(readFileSync(file));}catch{res.writeHead(404).end();}
};
const server=createServer({key:readFileSync(join(temp,'key')),cert:readFileSync(join(temp,'cert'))},serve);
const travelPath='/partners/travelit/thinkit/afda98f5ced9406d0fe5/';
async function calendar(browser,origin){
 const context=await browser.newContext({ignoreHTTPSErrors:true,serviceWorkers:'block'});
 try{
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  const page=await context.newPage();await page.goto(origin+'/partners/liveit/thinkit/connected-w18e-c15396/index.html');
  await page.locator('[data-action="nav"][data-view="calendar"]:visible').first().click();
  await page.locator('[data-action="calendar-mode"][data-mode="month"]').click();
  for(const width of [393,744,1440]){
   await page.setViewportSize({width,height:900});
   const result=await page.locator('.calendar-grid').evaluate(grid=>{
    const positions=selector=>[...grid.querySelectorAll(selector)].slice(0,7).map(node=>{const r=node.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y,width:r.width};});
    return {headings:positions('.calendar-wd'),dates:positions('.calendar-cell')};
   });
   assert.equal(result.headings.length,7);assert.equal(result.dates.length,7);
   for(let i=0;i<7;i++){assert.ok(Math.abs(result.headings[i].x-result.dates[i].x)<3);assert.ok(result.headings[i].y<result.dates[i].y);}
  }
  await page.locator('[data-action="calendar-mode"][data-mode="week"]').click();
  assert.match(await page.locator('.calendar-cell .calendar-daynum').first().textContent(),/Mon/);
 }finally{await context.close();}
}
async function layout(browser,origin){
 const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000},serviceWorkers:'block'});
 try{
  context.on('page',p=>{p.on('pageerror',e=>console.error('LAYOUT_PAGE_ERROR',e.message));p.on('console',m=>{if(m.type()==='error')console.error('LAYOUT_CONSOLE',m.text());});});context.on('requestfailed',r=>console.error('LAYOUT_REQUEST_FAILED',r.url(),r.failure()));
  const page=await context.newPage();await page.goto(origin+'/thinkit/');await page.locator('#diStartCreate').click();
  await page.getByRole('button',{name:'Create blank project',exact:true}).click();
  for(const scheme of ['journal','linen','midnight','forest','lavender']){
   await page.locator('html').evaluate((node,scheme)=>node.dataset.appScheme=scheme,scheme);
   const samples=await page.evaluate(()=>{
    const luminance=value=>(value.match(/[\d.]+/g)||[]).slice(0,3).map(Number).reduce((sum,n,i)=>{const v=n/255;return sum+[.2126,.7152,.0722][i]*(v<=.04045?v/12.92:((v+.055)/1.055)**2.4);},0);
    return ['.shape-card span','.page-item.active .page-name','.page-item.active .page-mode','.footer-action','.sidebar-bottom-note','.small-action'].map(selector=>{
     const element=document.querySelector(selector);let surface=element,background=getComputedStyle(surface).backgroundColor;
     while(background==='rgba(0, 0, 0, 0)'){surface=surface.parentElement;background=getComputedStyle(surface).backgroundColor;}
     const [a,b]=[luminance(getComputedStyle(element).color),luminance(background)].sort((a,b)=>b-a);return {selector,ratio:(a+.05)/(b+.05)};
    });
   });
   for(const sample of samples)assert.ok(sample.ratio>=4.5,scheme+' '+JSON.stringify(sample));
  }
  await page.locator('#diMenuTabs [data-tab=View]').click();
  const opened=page.waitForEvent('popup');await page.locator('#diMenuPopup [data-dcmd="view.ruler"]').click();const print=await opened;
  print.on('pageerror',e=>console.error('PRINT_ERROR',e.message));await print.locator('#measurementControls').waitFor().catch(async e=>{console.error('PRINT_BODY',await print.evaluate(()=>({url:location.href,base:document.baseURI,scripts:[...document.scripts].map(s=>s.src)}))); throw e;});
  await print.locator('#rulerPrint').check();
  for(const name of ['A4','A3','A2','Letter','Legal'])for(const orientation of ['portrait','landscape']){
   await print.locator('#paper').selectOption(name);await print.locator('#orientation').selectOption(orientation);
   const geometry=await print.locator('#paperRulers').evaluate(svg=>({box:svg.getAttribute('viewBox'),x:[...svg.querySelectorAll('line')].some(line=>line.getAttribute('x1')==='100'),y:[...svg.querySelectorAll('line')].some(line=>line.getAttribute('y1')==='100')}));
   assert.ok(geometry.x&&geometry.y);assert.match(geometry.box,/^0 0 /);
   if(browser.browserType().name()==='chromium'){
    const pdf=(await print.pdf({preferCSSPageSize:true,printBackground:true})).toString('latin1');assert.equal((pdf.match(/\/Type\s*\/Page\b/g)||[]).length,1,name+' '+orientation);
   }
  }
  await print.locator('#rulerH').uncheck();assert.equal(await print.locator('#paperRulers line').evaluateAll(lines=>lines.filter(line=>line.getAttribute('x1')===line.getAttribute('x2')).length),0);
  await print.locator('#dimensionMode').selectOption('physical');await print.locator('#unitMillimeters').fill('0');assert.equal(await print.locator('#print').isDisabled(),true);
  await print.close();
 }finally{await context.close();}
}
async function travel(browser,origin){
 const context=await browser.newContext({ignoreHTTPSErrors:true,serviceWorkers:'block',viewport:{width:1200,height:950}});
 try{
  await context.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.hostname==='overpass-api.de')return route.fulfill({status:200,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:JSON.stringify({elements:[{type:'way',tags:{highway:'residential',name:'Sample street'},geometry:[{lat:14.599,lon:120.984},{lat:14.601,lon:120.985}]}]})});
   return url.origin===origin?route.continue():route.abort();
  });
  const page=await context.newPage();await page.goto(origin+travelPath+'index.html?view=trips');
  await page.evaluate(async path=>{
   const m=await import(path+'js/db.js'),db=await m.openDatabase(),{epoch}=await m.getWorkspaceMetadata(db);
   await m.guardedSaveRecord(db,'trip',{id:'dependency-trip',title:'Synthetic trip',startDate:'2026-12-01',endDate:'2026-12-03',timezone:'Asia/Manila'},{expectedEpoch:epoch});
   const shared={tripId:'dependency-trip',date:'2026-12-01',time:'10:00',kind:'Activity',fixed:false,notes:''};
   await m.guardedSaveRecords(db,'stop',[{...shared,id:'museum',title:'Museum',durationMinutes:60},{...shared,id:'lunch',title:'Lunch',durationMinutes:30}],{expectedEpoch:epoch});db.close();
  },travelPath);
  await page.reload();await page.locator('[data-action="edit-stop:lunch"]').click();
  await page.locator('[data-predecessor]').selectOption('museum');await page.locator('[data-lag]').fill('15');
  await page.locator('#modal-form button[type=submit]').click();
  await page.getByRole('button',{name:'Review dependencies',exact:true}).click();await page.getByText(/2026-12-01 10:00 → 2026-12-01 11:15/).waitFor();
  await page.getByRole('button',{name:'Apply schedule changes',exact:true}).click();
  await page.locator('[data-action="edit-stop:lunch"]').click();assert.equal(await page.locator('#f-time').inputValue(),'11:15');
  await page.locator('#modal-close').click();await page.locator('#view-select').selectOption('map');
  await page.getByRole('button',{name:'Download offline map',exact:true}).click();await page.locator('#f-name').fill('Downloaded test region');
  await page.getByRole('button',{name:'Download to this device',exact:true}).click();
  await page.locator('.map-pack-meta').filter({hasText:'Downloaded test region'}).waitFor({state:'attached'}).catch(async error=>{console.error('MAP_DOWNLOAD',await page.locator('#form-error').allTextContents(),await page.locator('#road-download-status').allTextContents(),await page.locator('#toast').allTextContents());throw error;});
  const maps=await page.evaluate(()=>window.keepItAppFiles.listMaps());assert.equal(maps.length,1);
  await page.reload();await page.locator('#view-select').selectOption('map');await page.getByText('Map tools',{exact:true}).click();await page.getByRole('button',{name:'Offline maps',exact:true}).click();
  await page.locator('.map-pack-meta').filter({hasText:'Downloaded test region'}).waitFor({state:'attached'}).catch(async error=>{console.error('MAP_DOWNLOAD',await page.locator('#form-error').allTextContents(),await page.locator('#road-download-status').allTextContents(),await page.locator('#toast').allTextContents());throw error;});
 }finally{await context.close();}
}
async function offlineTravel(browser){
 const http=createHTTPServer(serve);await new Promise(ok=>http.listen(0,'127.0.0.1',ok));
 const origin='http://127.0.0.1:'+http.address().port,context=await browser.newContext();
 try{
  const page=await context.newPage();await page.goto(origin+travelPath+'index.html?view=more');
  await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js',{scope:'/'});await navigator.serviceWorker.ready;});
  await page.waitForFunction(()=>navigator.serviceWorker.controller);await page.reload();
  await page.getByRole('button',{name:'Prepare for offline use',exact:true}).click();
  await page.getByText('Cached for this browser',{exact:true}).waitFor();
  await page.locator('#view-select').selectOption('trips');
  await context.setOffline(true);await page.reload();
  await page.waitForFunction(()=>document.documentElement.dataset.travelitReady==='true');
  assert.match(await page.locator('#main').innerText(),/Your journeys|Create a trip/);
  console.log('TRAVELIT_PREPARE_AND_OFFLINE_REOPEN_CHROMIUM_PASS');
 }finally{await context.close();await new Promise(ok=>http.close(ok));}
}

try{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const origin='https://127.0.0.1:'+server.address().port;
 for(const engine of process.env.REFINEMENTS_CHROMIUM_ONLY?[chromium]:[chromium,webkit]){
  const browser=await engine.launch({headless:true});
  try{await calendar(browser,origin);console.log('CALENDAR_HEADERS_AND_WEEKDAYS_'+engine.name().toUpperCase()+'_PASS');await layout(browser,origin);console.log('THINKIT_CONTRAST_AND_PAPER_RULERS_'+engine.name().toUpperCase()+'_PASS');await travel(browser,origin);console.log('TRAVELIT_DEPENDENCY_PREVIEW_AND_DOWNLOADED_MAP_REOPEN_'+engine.name().toUpperCase()+'_PASS');if(engine.name()==='chromium')await offlineTravel(browser);}
  finally{await browser.close();}
 }
}finally{await new Promise(ok=>server.close(ok));rmSync(temp,{recursive:true,force:true});}
