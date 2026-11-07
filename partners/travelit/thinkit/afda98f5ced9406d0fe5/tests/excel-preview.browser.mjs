import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
export async function checkExcelPreview(browser,origin){
 const temp=mkdtempSync(join(tmpdir(),'excel-browser-')),fixture=join(temp,'synthetic.xlsx');
 execFileSync('python3',[fileURLToPath(new URL('./excel-fixture.py',import.meta.url)),fixture]);
 const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:950},serviceWorkers:'block'});
 const snapshot=page=>page.evaluate(()=>new Promise((resolve,reject)=>{
  const req=indexedDB.open('travelit-foundation');req.onerror=()=>reject(req.error);req.onsuccess=()=>{
   const db=req.result,names=[...db.objectStoreNames],tx=db.transaction(names,'readonly'),values={version:db.version};
   for(const name of names){const r=tx.objectStore(name).getAll();r.onsuccess=()=>values[name]=r.result;}
   tx.oncomplete=()=>{db.close();resolve(values);};tx.onerror=()=>reject(tx.error);
  };
 }));
 try{
  const writes=[];
  await context.route('**/*',route=>{const req=route.request();if(req.method()!=='GET')writes.push(req.url());return new URL(req.url()).hostname==='127.0.0.1'?route.continue():route.abort();});
  const page=await context.newPage(),path='/partners/travelit/thinkit/afda98f5ced9406d0fe5/';
  await page.goto(origin+path+'index.html?view=trips',{waitUntil:'domcontentloaded'});
  await page.locator('[data-action="new-trip"]').first().click();
  await page.locator('#f-title').fill('Existing trip — keep unchanged');
  await page.locator('#f-startDate').fill('2026-12-05');await page.locator('#f-endDate').fill('2026-12-10');
  await page.locator('#modal-form button[type="submit"]').click();await page.locator('#modal-backdrop').waitFor({state:'hidden'});
  await page.locator('[data-action="add-stop"]').first().click();
  await page.locator('#activity-entry-rows [data-field="title"]').first().fill('Existing activity');
  await page.getByRole('button',{name:'Save activities',exact:true}).click();await page.locator('#modal-backdrop').waitFor({state:'hidden'});
  // Populate the other stores without invoking any feature under test. Distinct test-only
  // keys remain unselected; their bytes must survive preview just like real cached data.
  await page.evaluate(async path=>{
   const {openDatabase}=await import(path+'js/db.js'),db=await openDatabase();
   await new Promise((ok,no)=>{const tx=db.transaction(['settings','recovery','mapPacks','atlasRegions','atlasTiles'],'readwrite');
    for(const name of ['settings','recovery','mapPacks','atlasRegions','atlasTiles']){const key=tx.objectStore(name).keyPath;tx.objectStore(name).put({[key]:'excel-preview-sentinel',testOnly:{preserve:'unchanged',numbers:[1,2,3]}});}
    tx.oncomplete=ok;tx.onerror=()=>no(tx.error);
   });db.close();
  },path);
  const baseline=await snapshot(page);assert.ok(baseline.records.length>=2);assert.ok(baseline.outbox.length>=2);
  const open=async()=>page.getByRole('button',{name:'Preview Excel',exact:true}).click();
  const choose=async()=>page.locator('#excel-preview-file').setInputFiles(fixture);
  const read=async()=>page.getByRole('button',{name:'Preview workbook',exact:true}).click();
  await open();assert.equal(await page.locator('#modal-form button[type="submit"]').count(),0);
  await choose();await read();await page.locator('#excel-preview-status').filter({hasText:'Preview ready — 48 activities'}).waitFor({timeout:20000});
  assert.equal(await page.locator('.excel-preview-table tbody tr').count(),48);
  assert.match(await page.locator('#excel-preview-summary').innerText(),/48 activities · 6 days · 48 matched/);
  assert.match(await page.locator('#excel-preview-result').innerText(),/42 predecessor/);
  assert.deepEqual(await snapshot(page),baseline,'Valid preview must not change any existing store or schema');
  await page.screenshot({path:'appearance-qa/travelit-excel-preview-'+browser.browserType().name()+'.png'});
  await page.getByRole('button',{name:'Close preview',exact:true}).click();
  assert.deepEqual(await snapshot(page),baseline);
  // Hold worker startup so cancel/close is deterministic on fast CI machines.
  let release;const hold=new Promise(ok=>release=ok);
  await context.route('**/excel-preview-worker.js',async route=>{await hold;await route.continue();});
  await open();await choose();await read();await page.getByRole('button',{name:'Cancel reading',exact:true}).click();
  assert.match(await page.locator('#excel-preview-status').innerText(),/cancelled/);
  await read();await page.locator('#modal-close').click();release();await context.unrouteAll({behavior:'wait'});
  await open();await choose();await read();await page.locator('#excel-preview-status').filter({hasText:'Preview ready — 48 activities'}).waitFor({timeout:20000});
  assert.equal(await page.locator('.excel-preview-table tbody tr').count(),48,'Only latest preview may appear');
  await page.locator('#excel-preview-file').setInputFiles({name:'broken.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from('not a workbook')});
  await read();await page.locator('#excel-preview-status.excel-preview-error').waitFor();assert.equal(await page.locator('.excel-preview-table').count(),0);
  assert.deepEqual(await snapshot(page),baseline,'Error/cancel/reopen paths must preserve all stores');assert.deepEqual(writes,[],'Workbook preview must not upload data');
  await page.locator('#modal-close').click();
  await page.locator('[data-action="add-stop"]').first().click();assert.equal(await page.locator('.excel-preview-dialog').count(),0);await page.locator('#modal-close').click();
  console.log('TRAVELIT_EXCEL_READONLY_'+browser.browserType().name().toUpperCase()+'_PASS');
 }finally{await context.close();rmSync(temp,{recursive:true,force:true});}
}
