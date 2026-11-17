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
  await page.getByLabel('Itinerary view',{exact:true}).selectOption('gantt');assert.equal(await page.locator('.gantt-bar').count(),2);
  // Source of the November desktop screenshots: a fixed 600px axis let the
  // last date/time tick collide with 22:00. Start/End scrolled away from the
  // activities, and 12.5% painted gridlines did not match 2-hour ticks.
  const ganttGeometry=()=>page.locator('.gantt-table').evaluate(table=>{
    const wrap=table.closest('.gantt-wrap'),axis=table.querySelector('.gantt-axis'),
      track=table.querySelector('.gantt-track');
    const a=axis.getBoundingClientRect(),t=track.getBoundingClientRect();
    const head=[...table.querySelectorAll('thead th')].slice(0,4)
      .map(el=>el.getBoundingClientRect().left);
    const tickBoxes=[...axis.querySelectorAll('span')].map(el=>{
      const b=el.getBoundingClientRect();return {left:b.left,right:b.right};
    });
    const gridLines=[...track.querySelectorAll('.gantt-gridline')].map(el=>({
      left:el.getBoundingClientRect().left,position:parseFloat(el.style.left)
    }));
    return {head,axisLeft:a.left,axisWidth:a.width,trackLeft:t.left,
      trackWidth:t.width,gridLines,tickBoxes,scrollWidth:wrap.scrollWidth,
      clientWidth:wrap.clientWidth};
  });
  const initial=await ganttGeometry();
  assert.ok(initial.tickBoxes.length>=8,'Day Gantt must expose legible, useful time labels');
  assert.ok(initial.tickBoxes.every((b,i)=>i===0||b.left>=initial.tickBoxes[i-1].right+2),
    'Each time-axis label must remain distinct with at least 2px separation');
  assert.ok(Math.abs(initial.axisLeft-initial.trackLeft)<2&&
    Math.abs(initial.axisWidth-initial.trackWidth)<2,
    'Time ticks and bar track must share the exact left edge and width');
  assert.ok(initial.gridLines.length===initial.tickBoxes.length);
  assert.ok(initial.gridLines.every(g=>Math.abs(g.left-
    (initial.axisLeft+initial.axisWidth*g.position/100))<2),
    'Gridline x positions must exactly follow the same time-axis percentages');
  assert.ok(initial.scrollWidth>initial.clientWidth,
    'At MacBook width the axis should scroll instead of compressing tick labels');
  await page.locator('.gantt-wrap').evaluate(el=>{el.scrollLeft=el.scrollWidth;});
  const scrolled=await ganttGeometry();
  for(let i=0;i<4;i++)assert.ok(Math.abs(initial.head[i]-scrolled.head[i])<2,
    'Activity, duration, start and end columns must remain frozen while chart scrolls');
  assert.ok(Math.abs(scrolled.axisLeft-scrolled.trackLeft)<2,
    'Chart scroll must not decouple time labels and bar/grid positions');
  await page.screenshot({path:'appearance-qa/travelit-desktop-gantt-sticky-'+browser.browserType().name()+'.png'});
  await page.locator('.gantt-wrap').evaluate(el=>{el.scrollLeft=0;});await page.getByLabel('Gantt period',{exact:true}).selectOption('trip');assert.equal(await page.locator('.gantt-bar').count(),3);assert.match(await page.locator('.gantt-axis').innerText(),/12-05/);assert.match(await page.locator('.gantt-table tbody tr').first().locator('td').nth(1).innerText(),/12-05 08:00/);await page.screenshot({path:'appearance-qa/travelit-gantt-'+browser.browserType().name()+'.png'});
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
  await page.evaluate(()=>{window.workspaceMapNode=document.querySelector('#street-map');});await page.getByText('Map tools',{exact:true}).click();const menuBox=await page.locator('.map-tools-menu .action-menu-items').boundingBox();assert.ok(menuBox.x>=0&&menuBox.x+menuBox.width<=1440,'Every map-tool label must fit the viewport');await page.getByRole('button',{name:'Sketch route',exact:true}).click();await page.locator('#street-map').click({position:{x:box.width*.4,y:box.height*.4}});await page.locator('#street-map').click({position:{x:box.width*.55,y:box.height*.5}});await page.getByText('2 point(s).',{exact:false}).waitFor();assert.equal(await page.evaluate(()=>window.workspaceMapNode===document.querySelector('#street-map')),true,'Drawing must not replace the map');await page.getByRole('button',{name:'Undo point',exact:true}).click();await page.getByText('1 point(s).',{exact:false}).waitFor();await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await page.evaluate(()=>window.workspaceMapNode===document.querySelector('#street-map')),true);assert.ok(await page.locator('#street-map .leaflet-tile-loaded').count()>0);await page.getByRole('button',{name:'Full screen',exact:true}).click();await page.waitForFunction(()=>!!document.fullscreenElement);assert.equal(await page.evaluate(()=>window.workspaceMapNode===document.querySelector('#street-map')),true);const fullscreenMap=await page.locator('#street-map').boundingBox();assert.equal(await page.locator('html').getAttribute('data-map-fullscreen'),'true');assert.ok(fullscreenMap.height>=Math.max(700,box.height*0.9),'Fullscreen must preserve a usable map rather than shrink or replace it');await page.getByRole('button',{name:'Exit full screen',exact:true}).click();await page.waitForFunction(()=>!document.fullscreenElement);await page.screenshot({path:'appearance-qa/travelit-map-workspace-'+browser.browserType().name()+'.png'});
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
    if(mode==='source'&&url.pathname===path+'index.html')return route.fulfill({status:200,contentType:'text/html',body:readFileSync('partners/travelit/thinkit/afda98f5ced9406d0fe5/index.html','utf8').replace('app-fast.js?', 'app.js?')});
    return route.continue();
   });
   const page=await context.newPage(),start=Date.now();await page.goto(origin+path+'index.html');await page.locator('html[data-travelit-ready=true]').waitFor();results.push({mode,ms:Date.now()-start,jsRequests:requests.length});
   assert.ok(!requests.some(p=>p.includes('/vendor/excel/')),'Workbook reader must remain lazy');
  }finally{await context.close();}
 }
 assert.ok(results[0].jsRequests>=30);assert.ok(results[1].jsRequests<=2);assert.ok(results[1].ms<results[0].ms,'Bundling must improve cold startup with simulated 150 ms request latency');
 writeFileSync('appearance-qa/travelit-startup-'+browser.browserType().name()+'.json',JSON.stringify(results,null,2));console.log('TRAVELIT_COLD_START_'+browser.browserType().name().toUpperCase(),JSON.stringify(results));
}


export async function checkMobileTripDensity(browser,origin){
 const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:390,height:844},
  isMobile:true,hasTouch:true,serviceWorkers:'block'});
 try{
  await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const page=await context.newPage();
  await page.goto(origin+'/partners/connected/?connected-app=travelit',{waitUntil:'domcontentloaded'});
  const frame=page.frameLocator('iframe[title="TravelIt trip planning workspace"]');
  await frame.locator('html[data-travelit-ready="true"]').waitFor({timeout:20000});
  await frame.getByLabel('Workspace',{exact:true}).selectOption('trips');
  await frame.getByRole('button',{name:'+ New trip',exact:true}).click();
  await frame.locator('#f-title').fill('Compact layout acceptance trip');
  await frame.locator('#f-startDate').fill('2026-12-05');
  await frame.locator('#f-endDate').fill('2026-12-10');
  await frame.locator('#modal-form button[type=submit]').click();
  await frame.locator('#modal-backdrop').waitFor({state:'hidden'});
  await frame.getByRole('button',{name:'Activities table',exact:true}).click();
  const first=frame.locator('#activity-entry-rows tr').first();
  await first.locator('[data-field=title]').fill('Morning departure');
  await first.locator('[data-field=time]').fill('07:00');
  await first.locator('[data-field=durationMinutes]').fill('60');
  await frame.getByRole('button',{name:'Save activities',exact:true}).click();
  await frame.locator('#modal-backdrop').waitFor({state:'hidden'});
  await frame.getByLabel('Itinerary view',{exact:true}).selectOption('gantt');
  const layout=await frame.locator('html').evaluate(root=>{
    const chart=document.querySelector('.gantt-wrap'),tabs=document.querySelector('.view-tabs');
    const dates=document.querySelector('.day-strip');
    return {chartTop:chart?.getBoundingClientRect().top??Infinity,
      docOverflow:root.scrollWidth-root.clientWidth,
      tabsRows:new Set([...tabs.querySelectorAll('button')].map(el=>Math.round(el.getBoundingClientRect().top))).size,
      tabsScrollable:tabs.scrollWidth>tabs.clientWidth,
      dayToolsVisible:getComputedStyle(document.querySelector('.day-tools')).display!=='none',
      quickSaveVisible:getComputedStyle(document.querySelector('#quick-save')).display!=='none',
      datesVisible:dates.getBoundingClientRect().height>40};
  });
  assert.ok(layout.chartTop<475,'Actual trip Gantt must start within the first 475 CSS px: '+JSON.stringify(layout));
  assert.ok(layout.docOverflow<=3,'Mobile trip must not overflow full page horizontally: '+JSON.stringify(layout));
  assert.equal(layout.tabsRows,1,'Trip tabs must remain on one horizontal scroll row');
  assert.ok(layout.tabsScrollable&&layout.datesVisible,'Trip tabs scroll while the day strip remains visible');
  assert.equal(layout.dayToolsVisible,false);
  assert.equal(layout.quickSaveVisible,false);
  await frame.locator('.trip-command-bar>.action-menu>summary').click();
  assert.equal(await frame.locator('.mobile-trip-menu-actions [data-action=preview-excel]').isVisible(),true);
  assert.equal(await frame.locator('.mobile-trip-menu-actions [data-action=new-trip]').isVisible(),true);
  await frame.locator('.trip-command-bar>.action-menu>summary').click();
  await frame.locator('.day-strip+.row-between .action-menu>summary').click();
  assert.equal(await frame.locator('.mobile-day-menu-actions [data-action=review-trip-dependencies]').isVisible(),true);
  await frame.locator('.mobile-day-menu-actions [data-action=day-next]').click();
  await frame.locator('.day-tile.active').getByText('06',{exact:true}).waitFor();
  await frame.getByRole('button',{name:'Packing',exact:true}).click();
  await frame.getByRole('button',{name:'Itinerary',exact:true}).click();
  await frame.getByLabel('Itinerary view',{exact:true}).selectOption('gantt');
  if(browser.browserType().name()==='chromium')
    await page.screenshot({path:'appearance-qa/travelit-compact-connected-iphone.png'});
  console.log('TRAVELIT_COMPACT_CONNECTED_IPHONE_'+browser.browserType().name().toUpperCase()+'_PASS',JSON.stringify(layout));
 }finally{await context.close();}
}
