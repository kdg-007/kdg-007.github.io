import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const path='/partners/travelit/thinkit/afda98f5ced9406d0fe5/';
export async function checkMapLifecycle(browser,origin){
 for(const mode of ['source','bundled']){
  const context=await browser.newContext({ignoreHTTPSErrors:true,serviceWorkers:'block',viewport:{width:1100,height:850}});
  let runtimeRequests=0,tileRequests=0,blockTiles=false,release;
  const gate=new Promise(resolve=>{release=resolve;});
  try{
   await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.hostname==='tile.openstreetmap.org'){
     tileRequests++;return blockTiles?route.abort():route.fulfill({status:200,contentType:'image/png',body:readFileSync('partners/design/fixtures/street-tile-test.png')});
    }
    if(url.origin!==origin)return route.abort();
    if(mode==='source'&&url.pathname===path+'index.html')return route.fulfill({status:200,contentType:'text/html',body:readFileSync('.'+path+'index.html','utf8').replace('app-fast.js?','app.js?')});
    if(url.pathname.endsWith('/vendor/leaflet/leaflet.js')){
     runtimeRequests++;if(runtimeRequests===1)return route.abort();
     if(runtimeRequests===2)await gate;
    }
    return route.continue();
   });
   const page=await context.newPage();page.setDefaultTimeout(15000);
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto(origin+path+'index.html?view=trips',{waitUntil:'domcontentloaded'});
   await page.locator('html[data-travelit-ready=true]').waitFor();
   assert.equal(runtimeRequests,0,'Trips must become interactive without requesting Leaflet');
   await page.getByLabel('Workspace',{exact:true}).selectOption('map');
   await page.locator('#street-map-status[data-state=unavailable]').waitFor();
   await page.getByText('Map tools',{exact:true}).click();await page.getByRole('button',{name:'Retry street map',exact:true}).click();
   await page.locator('#street-map-status[data-state=loading]').waitFor();
   await page.getByLabel('Workspace',{exact:true}).selectOption('trips');release();
   await page.waitForFunction(()=>typeof window.L?.map==='function');
   assert.equal(await page.locator('#street-map').count(),0,'Late map loading must not restore a view the user left');
   await page.getByLabel('Workspace',{exact:true}).selectOption('map');
   await page.locator('#street-map-status[data-state=ready]').waitFor();
   await page.evaluate(()=>{window.returnMapNode=document.querySelector('#street-map');window.returnMapTiles=[...document.querySelectorAll('#street-map .leaflet-tile-loaded')];});
   assert.ok(await page.locator('#street-map .leaflet-tile-loaded').count());
   const beforeRequests=tileRequests;blockTiles=true;
   await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));});
   // The real foreground listener debounces for 160 ms before reading metadata.
   await page.waitForTimeout(450);
   assert.equal(await page.evaluate(()=>window.returnMapNode===document.querySelector('#street-map')),true,'Unchanged foreground return must retain the map');
   assert.equal(await page.evaluate(()=>window.returnMapTiles.every(tile=>tile.isConnected)),true,'Previously loaded tiles must remain visible if the network is unavailable');
   assert.equal(tileRequests,beforeRequests,'Unchanged return must not request replacement tiles');
   blockTiles=false;
   await page.locator('#quick-save').click();
   const other=await context.newPage();await other.goto(origin+path+'index.html?view=explore');
   await other.locator('html[data-travelit-ready=true]').waitFor();await other.locator('#quick-save').click();
   await other.locator('#f-name').fill('Map recovery pin');await other.locator('#f-lat').fill('14.6');await other.locator('#f-lng').fill('121');
   await other.locator('#modal-form button[type=submit]').click();await other.locator('#modal-backdrop').waitFor({state:'hidden'});
   await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
   await page.locator('#external-tab-warning').waitFor();
   await page.locator('#modal-close').click();
   await page.getByRole('button',{name:'Open Map recovery pin',exact:true}).waitFor();
   assert.deepEqual(errors,[]);
   console.log('TRAVELIT_LAZY_MAP_FOREGROUND_RECOVERY_'+mode.toUpperCase()+'_'+browser.browserType().name().toUpperCase()+'_PASS');
  }finally{release();await context.close();}
 }
}
