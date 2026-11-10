import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
export async function checkExcelImport(browser,origin){
 const temp=mkdtempSync(join(tmpdir(),'excel-import-')),file=join(temp,'synthetic.xlsx');execFileSync('python3',[fileURLToPath(new URL('./excel-fixture.py',import.meta.url)),file]);
 const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:950},serviceWorkers:'block'}),path='/partners/travelit/thinkit/afda98f5ced9406d0fe5/';
 const snapshot=page=>page.evaluate(()=>new Promise((ok,no)=>{const r=indexedDB.open('travelit-foundation');r.onsuccess=()=>{const db=r.result,names=[...db.objectStoreNames],tx=db.transaction(names,'readonly'),data={version:db.version};for(const name of names){const r=tx.objectStore(name).getAll();r.onsuccess=()=>data[name]=r.result;}tx.oncomplete=()=>{db.close();ok(data);};tx.onerror=()=>no(tx.error);};r.onerror=()=>no(r.error);}));
 try{
  await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());const page=await context.newPage();
  await page.goto(origin+path+'tests/excel-blank.html');
  const upgrade=await page.evaluate(async path=>{
   const old=await new Promise((ok,no)=>{const r=indexedDB.open('travelit-foundation',4);r.onupgradeneeded=()=>{for(const [name,keyPath] of [['records','key'],['outbox','commandId'],['settings','key'],['recovery','id'],['mapPacks','id'],['atlasRegions','id'],['atlasTiles','key']])r.result.createObjectStore(name,{keyPath});};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});
   await new Promise((ok,no)=>{const tx=old.transaction(['records','mapPacks','atlasRegions','atlasTiles','recovery'],'readwrite');tx.objectStore('records').put({key:'trip:existing',id:'existing',type:'trip',localRevision:3,data:{id:'existing',title:'Existing trip',startDate:'2026-12-05',endDate:'2026-12-10',timezone:'Asia/Manila',createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z'}});for(const name of ['mapPacks','atlasRegions','atlasTiles','recovery'])tx.objectStore(name).put({[tx.objectStore(name).keyPath]:'migration-sentinel',bytes:[9,8,7]});tx.oncomplete=ok;tx.onerror=()=>no(tx.error);});
   let notified=false;old.onversionchange=()=>{notified=true;old.close();};const {openDatabase}=await import(path+'js/db.js?v=excel-import-1');const db=await openDatabase();const version=db.version;db.close();
   const rejected=await new Promise(ok=>{const r=indexedDB.open('travelit-foundation',4);r.onerror=e=>{e.preventDefault();ok(r.error.name);};r.onsuccess=()=>{r.result.close();ok('opened');};});return {notified,version,rejected};
  },path);
  assert.deepEqual(upgrade,{notified:true,version:5,rejected:'VersionError'});const baseline=await snapshot(page);
  await page.goto(origin+path+'index.html?view=trips');
  await page.getByRole('button',{name:'Import Excel',exact:true}).click();await page.locator('#excel-preview-file').setInputFiles(file);await page.getByRole('button',{name:'Preview workbook',exact:true}).click();await page.locator('#excel-preview-status').filter({hasText:'Preview ready — 48 activities'}).waitFor({timeout:20000});
  await page.getByRole('button',{name:'Import as a new trip',exact:true}).click();assert.match(await page.locator('#excel-import-error').innerText(),/Confirm/);assert.deepEqual(await snapshot(page),baseline);
  await page.locator('#excel-import-accept').check();await page.getByRole('button',{name:'Import as a new trip',exact:true}).click();await page.locator('#modal-backdrop').waitFor({state:'hidden'});
  const imported=await snapshot(page),trip=imported.records.find(r=>r.type==='trip'&&r.id!=='existing'),stops=imported.records.filter(r=>r.type==='stop'),places=imported.records.filter(r=>r.type==='place');
  assert.equal(stops.length,48);assert.equal(places.length,0);assert.equal(imported.outbox.length,49);assert.deepEqual(imported.records.find(r=>r.id==='existing'),baseline.records[0]);for(const name of ['mapPacks','atlasRegions','atlasTiles','recovery'])assert.deepEqual(imported[name],baseline[name]);
  await page.reload();await page.getByLabel('Selected trip',{exact:true}).selectOption(trip.id);assert.equal(await page.locator('.activity-summary-table tbody tr').count(),8);
  // No-op table save and a real Details edit must retain all source fields.
  await page.locator('.activity-summary-table tbody tr').first().getByRole('button',{name:'Details'}).click();assert.match(await page.locator('.excel-source-details').innerText(),/Excel source/);await page.locator('#f-title').fill('Edited imported activity');await page.locator('#modal-form button[type="submit"]').click();await page.locator('#modal-backdrop').waitFor({state:'hidden'});
  const edited=await snapshot(page);assert.deepEqual(edited.records.find(r=>r.id===stops[0].id).data.importSource,stops[0].data.importSource);
  const boundary=await page.evaluate(async({path,trip})=>{
   const dbmod=await import(path+'js/db.js?v=excel-import-1'),{createBackup,verifyBackup}=await import(path+'js/backup.js?v=excel-import-1'),{buildExcelBatch}=await import(path+'js/excel-save.js?v=excel-import-1');
   const db=await dbmod.openDatabase(),data=await dbmod.allData(db),backup=await createBackup(data);await verifyBackup(backup);
   const info=await dbmod.getWorkspaceMetadata(db);let undoError;try{await dbmod.undoExcelImport(db,trip,{expectedEpoch:info.epoch,expectedWorkspaceRevision:info.revision});}catch(e){undoError=e.message;}
   // Same logical schedule with new filenames/IDs cannot be committed twice.
   return {schema:backup.schemaVersion,undoError,records:data.records.length};
  },{path,trip:trip.data});assert.equal(boundary.schema,6);assert.match(boundary.undoError,/changed|removed/);
  // Re-selecting the workbook is rejected without adding another trip.
  await page.getByRole('button',{name:'Import Excel',exact:true}).click();await page.locator('#excel-preview-file').setInputFiles(file);await page.getByRole('button',{name:'Preview workbook',exact:true}).click();await page.locator('#excel-preview-status').filter({hasText:'Preview ready — 48 activities'}).waitFor();await page.locator('#excel-import-accept').check();await page.getByRole('button',{name:'Import as a new trip',exact:true}).click();await page.locator('#excel-import-error').filter({hasText:'already been imported'}).waitFor();assert.deepEqual(await snapshot(page),edited);await page.locator('#modal-close').click();
  // Real IndexedDB transaction: inject a synchronous write failure after several puts;
  // all preceding records/intents and the workspace revision must roll back.
  const dbTests=await page.evaluate(async path=>{
   const m=await import(path+'js/db.js?v=excel-import-1'),{normalizeTrip,normalizeStop}=await import(path+'js/domain.js?v=excel-import-1'),db=await m.openDatabase();
   const make=async n=>{const id=crypto.randomUUID(),batchId=crypto.randomUUID(),trip=normalizeTrip({id,title:'Atomic '+n,startDate:'2026-12-05',endDate:'2026-12-05'}),rows=[{key:'trip:'+id,type:'trip',id,data:trip}];for(let i=0;i<6;i++){const stop=normalizeStop({id:crypto.randomUUID(),title:'Stop '+i,date:trip.startDate,importSource:{version:1,batchId,code:String(i),sheet:'Activity',row:i+1,originalType:'Tour',flag:'',predecessors:[],detail:null}},trip);rows.push({key:'stop:'+stop.id,type:'stop',id:stop.id,data:stop});}trip.importReceipt={version:1,batchId,semanticDigest:n.repeat(64),fileDigest:n.repeat(64),filename:'atomic.xlsx',importedAt:new Date().toISOString(),createdKeys:rows.map(r=>r.key),activityCount:6,placeCount:0,scope:'itinerary-and-place-details'};return {trip,records:rows};};
   const before=JSON.stringify(await m.allData(db)),meta=await m.getWorkspaceMetadata(db),batch=await make('b'),original=IDBObjectStore.prototype.put;let count=0,rollback=false;
   IDBObjectStore.prototype.put=function(...args){if(this.name==='records'&&++count===4)throw new DOMException('Simulated quota failure','QuotaExceededError');return original.apply(this,args);};
   try{await m.importExcelBatch(db,batch,{expectedEpoch:meta.epoch,expectedWorkspaceRevision:meta.revision});}catch{rollback=true;}finally{IDBObjectStore.prototype.put=original;}
   const intact=before===JSON.stringify(await m.allData(db)),sameRevision=(await m.getWorkspaceMetadata(db)).revision===meta.revision;
   await m.importExcelBatch(db,batch,{expectedEpoch:meta.epoch,expectedWorkspaceRevision:meta.revision});const committed=await m.getWorkspaceMetadata(db);
   let duplicate=false,stale=false;try{await m.importExcelBatch(db,batch,{expectedEpoch:committed.epoch,expectedWorkspaceRevision:committed.revision});}catch(e){duplicate=/already/.test(e.message);}
   try{await m.importExcelBatch(db,await make('c'),{expectedEpoch:meta.epoch,expectedWorkspaceRevision:meta.revision});}catch(e){stale=/changed/.test(e.message);}
   const packing={id:crypto.randomUUID(),tripId:batch.trip.id,label:'Added after import',quantity:1,category:'Other',packed:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
   await m.guardedSaveRecord(db,'packing',packing,{expectedEpoch:committed.epoch});let shared=false;let current=await m.getWorkspaceMetadata(db);
   try{await m.undoExcelImport(db,batch.trip,{expectedEpoch:current.epoch,expectedWorkspaceRevision:current.revision});}catch(e){shared=/used by other/.test(e.message);}
   await m.guardedDeleteRecord(db,'packing',packing.id,{expectedEpoch:current.epoch,expectedRevisionByKey:{['packing:'+packing.id]:1}});current=await m.getWorkspaceMetadata(db);
   await m.undoExcelImport(db,batch.trip,{expectedEpoch:current.epoch,expectedWorkspaceRevision:current.revision});const after=await m.allData(db);const undone=!after.records.some(r=>batch.trip.importReceipt.createdKeys.includes(r.key));
   const {createBackup}=await import(path+'js/backup.js?v=excel-import-1'),backup=await createBackup(after);current=await m.getWorkspaceMetadata(db);await m.restore(db,backup,{expectedWorkspaceRevision:current.revision});const restored=JSON.stringify(await m.allData(db))===JSON.stringify(after);current=await m.getWorkspaceMetadata(db);await m.undoRestore(db,{expectedWorkspaceRevision:current.revision});const recovered=JSON.stringify(await m.allData(db))===JSON.stringify(after);db.close();return {rollback,intact,sameRevision,duplicate,stale,undone,shared,restored,recovered};
  },path);assert.deepEqual(dbTests,{rollback:true,intact:true,sameRevision:true,duplicate:true,stale:true,undone:true,shared:true,restored:true,recovered:true});
  await page.reload();await page.getByLabel('Selected trip',{exact:true}).selectOption(trip.id);await page.screenshot({path:'appearance-qa/travelit-excel-import-'+browser.browserType().name()+'.png'});
  // Older imports can retain linked trip places without listing them as discoveries.
  await page.evaluate(async({path,source})=>{
   const dbmod=await import(path+'js/db.js?v=excel-import-1'),db=await dbmod.openDatabase();
   const {epoch}=await dbmod.getWorkspaceMetadata(db);
   await dbmod.guardedSaveRecords(db,'place',[
    {id:'legacy-trip-place',name:'Legacy itinerary map link',category:'Other',stage:'Planned',lat:null,lng:null,updatedAt:source.baseline.date,importSource:source},
    {id:'explore-note',name:'Independent Explore note',category:'Note',stage:'Idea',lat:null,lng:null,updatedAt:source.baseline.date}
   ],{expectedEpoch:epoch});
   db.close();
  },{path,source:stops[0].data.importSource});
  await page.goto(origin+path+'index.html?view=explore');
  await page.locator('.place-card').filter({hasText:'Independent Explore note'}).waitFor();
  assert.equal(await page.locator('.place-card').count(),1);
  await page.evaluate(async({path,trip,stopId})=>{
   const m=await import(path+'js/db.js?v=excel-import-1'),db=await m.openDatabase();
   const {epoch,revision}=await m.getWorkspaceMetadata(db),updatedAt=new Date().toISOString();
   const owned={tripId:trip.id,updatedAt},guard={expectedEpoch:epoch};
   const link={id:crypto.randomUUID(),appId:'travelit',workspaceId:'fixture',entityType:'stop',entityId:stopId,purpose:'rich-note',reference:{itemId:crypto.randomUUID(),provider:'keepit',version:1,revision:0,scope:'sha256:'+'a'.repeat(64)},updatedAt};
   await m.guardedSaveRecord(db,'packing',{...owned,id:'trip-packing',label:'Trip packing',quantity:1},guard);
   await m.guardedSaveRecord(db,'expense',{...owned,id:'trip-cost',label:'Trip cost',plannedPhp:500},guard);
   await m.guardedSaveRecord(db,'annotation',{...owned,id:'trip-pin',kind:'pin',label:'Trip pin',points:[{lat:15,lng:121}]},guard);
   await m.guardedSaveRecord(db,'keepitAssociation',link,guard);
   const before=JSON.stringify(await m.allData(db));
   let stale=false;
   try{await m.guardedDeleteTrip(db,trip.id,{expectedEpoch:epoch,expectedWorkspaceRevision:revision,expectedTripRevision:1});}catch(error){stale=error.code==='STALE_LOCAL_WORKSPACE';}
   if(!stale||JSON.stringify(await m.allData(db))!==before)throw Error('Stale trip deletion changed records.');
   db.close();
  },{path,trip:trip.data,stopId:stops[0].id});
  await page.goto(origin+path+'index.html?view=trips');
  await page.getByLabel('Selected trip',{exact:true}).selectOption(trip.id);
  const deleteTrip=async accept=>{
   await page.getByText('Trip actions',{exact:true}).click();
   page.once('dialog',dialog=>accept?dialog.accept():dialog.dismiss());
   await page.getByRole('button',{name:'Delete trip',exact:true}).click();
  };
  const beforeDelete=await snapshot(page);
  await deleteTrip(false);assert.deepEqual(await snapshot(page),beforeDelete);
  await deleteTrip(true);
  await page.locator('#toast').filter({hasText:'Trip deleted.'}).waitFor();
  const afterDelete=await snapshot(page),ownedKeys=new Set([trip.key,...beforeDelete.records.filter(r=>r.data.tripId===trip.id||r.type==='keepitAssociation').map(r=>r.key)]);
  assert.deepEqual(afterDelete.records,beforeDelete.records.filter(r=>!ownedKeys.has(r.key)));
  assert.equal(await page.getByLabel('Selected trip',{exact:true}).inputValue(),'existing');
  await deleteTrip(true);
  await page.getByText('Create a trip or import an Excel itinerary to begin.').waitFor();
  await page.reload();
  await page.getByText('Create a trip or import an Excel itinerary to begin.').waitFor();
  assert.deepEqual((await snapshot(page)).records.map(r=>r.type),['place','place']);
  console.log('TRAVELIT_SCOPED_TRIP_DELETE_'+browser.browserType().name().toUpperCase()+'_PASS');
  console.log('TRAVELIT_EXCEL_ATOMIC_IMPORT_UNDO_UPGRADE_'+browser.browserType().name().toUpperCase()+'_PASS');
 }finally{await context.close();rmSync(temp,{recursive:true,force:true});}
}
