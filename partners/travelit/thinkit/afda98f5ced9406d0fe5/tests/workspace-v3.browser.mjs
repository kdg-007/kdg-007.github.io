import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const path='/partners/travelit/thinkit/afda98f5ced9406d0fe5/';
export async function checkWorkspaceV3(browser,origin){
 const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:950},serviceWorkers:'block'});
 try{
  await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await context.newPage();await page.goto(origin+path+'index.html?view=trips');
  await page.locator('html[data-travelit-ready="true"]').waitFor();assert.equal(await page.locator('.sidebar').isVisible(),false);await page.getByRole('button',{name:'Toggle navigation'}).click();assert.equal(await page.locator('.sidebar').isVisible(),true);await page.getByRole('button',{name:'Toggle navigation'}).click();
  await page.getByRole('button',{name:'+ New trip',exact:true}).click();await page.locator('#f-title').fill('Workspace test');await page.locator('#f-startDate').fill('2026-12-05');await page.locator('#f-endDate').fill('2026-12-10');await page.locator('#modal-form button[type=submit]').click();await page.locator('#modal-backdrop').waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Activities table',exact:true}).click();const rows=page.locator('#activity-entry-rows tr');
  for(const [i,title,time,duration,date] of [[0,'Morning walk','08:00','60','2026-12-05'],[1,'Lunch','12:00','45','2026-12-05'],[2,'Next day swim','09:00','90','2026-12-06']]){const row=rows.nth(i);await row.locator('[data-field=title]').fill(title);await row.locator('[data-field=time]').fill(time);await row.locator('[data-field=durationMinutes]').fill(duration);await row.locator('[data-field=date]').fill(date);}
  await page.getByRole('button',{name:'Save activities',exact:true}).click();await page.locator('#modal-backdrop').waitFor({state:'hidden'});
  assert.equal(await page.locator('.activity-summary-table td small').count(),0);assert.ok(await page.locator('.activity-summary-table').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))>=15);
  await page.getByLabel('Itinerary view',{exact:true}).selectOption('gantt');assert.equal(await page.locator('.gantt-bar').count(),2);await page.getByLabel('Gantt period',{exact:true}).selectOption('trip');assert.equal(await page.locator('.gantt-bar').count(),3);await page.screenshot({path:'appearance-qa/travelit-gantt-'+browser.browserType().name()+'.png'});
  await page.getByRole('button',{name:'Calendar',exact:true}).click();assert.equal(await page.locator('.calendar-day.has-schedule').count(),2);assert.ok(await page.locator('.calendar-day.has-schedule').first().isVisible());
  await page.getByRole('button',{name:'Packing',exact:true}).click();await page.getByRole('button',{name:'Use a template',exact:true}).click();await page.getByLabel('Swimming',{exact:true}).check();await page.getByLabel('Beach',{exact:true}).check();await page.getByLabel('Mountain',{exact:true}).check();await page.getByRole('button',{name:'Add missing items',exact:true}).click();await page.locator('#modal-backdrop').waitFor({state:'hidden'});const checks=page.locator('[data-pack-id]'),count=await checks.count();assert.ok(count>=15);await checks.first().check();await page.getByRole('button',{name:'Use a template',exact:true}).click();await page.getByLabel('Swimming',{exact:true}).check();await page.getByLabel('Beach',{exact:true}).check();await page.getByLabel('Mountain',{exact:true}).check();await page.getByRole('button',{name:'Add missing items',exact:true}).click();await page.locator('#modal-backdrop').waitFor({state:'hidden'});assert.equal(await checks.count(),count);assert.equal(await checks.first().isChecked(),true);
  await page.getByRole('button',{name:'Budget',exact:true}).click();const field=(index,key)=>page.locator('.budget-input-table tbody tr').nth(index).locator('[data-budget-field="'+key+'"]');
  await field(0,'label').fill('Food');await field(0,'plannedPhp').fill('500');await field(0,'actualPhp').fill('550');await field(1,'label').fill('Hotel');await field(1,'plannedPhp').fill('2000');await field(2,'label').fill('Invalid row');await field(2,'plannedPhp').fill('-1');await page.getByRole('button',{name:'Save budget',exact:true}).click();await page.locator('#budget-panel-error').filter({hasText:'Row 3'}).waitFor();
  const expenses=()=>page.evaluate(()=>new Promise(ok=>{const r=indexedDB.open('travelit-foundation');r.onsuccess=()=>{const db=r.result,tx=db.transaction('records','readonly'),q=tx.objectStore('records').getAll();tx.oncomplete=()=>{db.close();ok(q.result.filter(r=>r.type==='expense'));};};}));assert.equal((await expenses()).length,0);
  await field(2,'label').fill('');await field(2,'plannedPhp').fill('');await page.getByRole('button',{name:'Save budget',exact:true}).click();await page.getByText('₱2,500.00',{exact:true}).first().waitFor();assert.equal((await expenses()).length,2);assert.ok((await page.locator('.budget-metrics').innerText()).includes('₱50.00'));
  await field(0,'plannedPhp').fill('700');await page.getByRole('button',{name:'Itinerary',exact:true}).click();await page.getByRole('button',{name:'Budget',exact:true}).click();assert.equal(await field(0,'plannedPhp').inputValue(),'700');
  await page.reload();await page.getByRole('button',{name:'Budget',exact:true}).click();assert.equal((await expenses()).length,2);const amounts=await page.locator('[data-budget-field=plannedPhp]').evaluateAll(els=>els.map(el=>el.value));assert.ok(amounts.includes('500'));assert.ok(amounts.includes('2000'));await page.screenshot({path:'appearance-qa/travelit-budget-'+browser.browserType().name()+'.png'});
  await context.route('https://tile.openstreetmap.org/**',r=>r.fulfill({status:200,contentType:'image/png',body:readFileSync('partners/design/fixtures/street-tile-test.png')}));
  await page.getByLabel('Workspace',{exact:true}).selectOption('map');await page.locator('#street-map-status[data-state=ready]').waitFor();const box=await page.locator('#street-map').boundingBox();assert.ok(box.width>1300&&box.height>700,'Map must occupy most of the MacBook workspace');
  await page.evaluate(()=>{window.workspaceMapNode=document.querySelector('#street-map');});await page.getByText('Map tools',{exact:true}).click();await page.getByRole('button',{name:'Sketch route',exact:true}).click();await page.locator('#street-map').click({position:{x:box.width*.4,y:box.height*.4}});await page.locator('#street-map').click({position:{x:box.width*.55,y:box.height*.5}});await page.getByText('2 point(s).',{exact:false}).waitFor();assert.equal(await page.evaluate(()=>window.workspaceMapNode===document.querySelector('#street-map')),true,'Drawing must not replace the map');await page.getByRole('button',{name:'Undo point',exact:true}).click();await page.getByText('1 point(s).',{exact:false}).waitFor();await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await page.evaluate(()=>window.workspaceMapNode===document.querySelector('#street-map')),true);assert.ok(await page.locator('#street-map .leaflet-tile-loaded').count()>0);await page.screenshot({path:'appearance-qa/travelit-map-workspace-'+browser.browserType().name()+'.png'});
  console.log('TRAVELIT_WORKSPACE_GANTT_CALENDAR_PACKING_BUDGET_'+browser.browserType().name().toUpperCase()+'_PASS');
 }finally{await context.close();}
}
export async function checkStartupBundle(browser,origin){
 const results=[];
 for(const mode of ['source','bundled']){
  const context=await browser.newContext({ignoreHTTPSErrors:true,serviceWorkers:'block'}),requests=[];
  try{
   await context.route('**/*',async route=>{
    const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1')return route.abort();
    if(url.pathname.startsWith(path)&&url.pathname.endsWith('.js')){requests.push(url.pathname);await new Promise(ok=>setTimeout(ok,150));}
    if(mode==='source'&&url.pathname===path+'index.html')return route.fulfill({status:200,contentType:'text/html',body:readFileSync('partners/travelit/thinkit/afda98f5ced9406d0fe5/index.html','utf8').replace('app-fast.js?v=workspace-3','app.js?v=workspace-3')});
    return route.continue();
   });
   const page=await context.newPage(),start=Date.now();await page.goto(origin+path+'index.html');await page.locator('html[data-travelit-ready=true]').waitFor();results.push({mode,ms:Date.now()-start,jsRequests:requests.length});
   assert.ok(!requests.some(p=>p.includes('/vendor/excel/')),'Workbook reader must remain lazy');
  }finally{await context.close();}
 }
 assert.ok(results[0].jsRequests>=30);assert.ok(results[1].jsRequests<=2);assert.ok(results[1].ms<results[0].ms,'Bundling must improve cold startup with simulated 150 ms request latency');
 writeFileSync('appearance-qa/travelit-startup-'+browser.browserType().name()+'.json',JSON.stringify(results,null,2));console.log('TRAVELIT_COLD_START_'+browser.browserType().name().toUpperCase(),JSON.stringify(results));
}
