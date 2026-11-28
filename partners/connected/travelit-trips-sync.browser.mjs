// TravelIt trips workspace syncs through KeepIt app files: a trip imported on one device
// opens on a second, edits return, and offline road maps save, back up and draw without signal.
// Synthetic Microsoft and OneDrive services only.
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
const base='/partners/travelit/thinkit/afda98f5ced9406d0fe5/';
const overpass={elements:[{type:'way',tags:{highway:'primary',name:'Lake road'},geometry:[{lat:14.395,lon:121.19},{lat:14.425,lon:121.25}]},{type:'way',tags:{highway:'residential',name:'Pier lane'},geometry:[{lat:14.418,lon:121.238},{lat:14.421,lon:121.242}]}]};
try{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const origin='https://127.0.0.1:'+server.address().port;
 for(const engine of process.env.STABILITY_CHROMIUM_ONLY?[chromium]:[chromium,webkit]){
  browser=await engine.launch({headless:true});const fixture=connectionFixture(origin,{writable:true});uploadFixture=fixture;fixture.uploadEndpoint=origin+'/__calendar-upload';
  async function device(){
   const context=await browser.newContext({ignoreHTTPSErrors:true,serviceWorkers:'block',viewport:{width:1200,height:900}});
   await context.route('**/*',fixture.route);
   await context.route('https://overpass-api.de/api/interpreter',route=>route.fulfill({status:200,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:JSON.stringify(overpass)}));
   await context.route(/tile\.openstreetmap\.org/,route=>route.abort());
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
   await page.goto(origin+'/partners/connected/?connected-app=travelit&connect-onedrive=1');
   await page.locator('#onedrive-signin').click();await page.locator('#connected-cloud-status[data-phase=connected]').waitFor({timeout:30000});
   const frame=page.frameLocator('iframe[title="TravelIt trip planning workspace"]');
   await frame.locator('html[data-travelit-trips=ready]').waitFor({timeout:30000});
   return {context,page,frame,errors};
  }
  const tab=async(f,name)=>{await f.locator('.tabs a',{hasText:name}).click();await f.locator('#view h1',{hasText:name}).waitFor();};
  // iPad: import a trip; KeepIt saves the workspace file.
  const ipad=await device();
  const [chooser]=await Promise.all([ipad.page.waitForEvent('filechooser'),ipad.frame.getByRole('button',{name:'Import spreadsheet'}).first().click()]);
  await chooser.setFiles(join(root,base,'tests/fixtures-sample-trip.xlsx'));
  await ipad.frame.locator('.stop .what',{hasText:'Boat tour'}).waitFor({timeout:30000});
  await ipad.frame.locator('#sync[data-state=ok]').waitFor({timeout:60000});
  // A photo added from a stop is saved into KeepIt through the real host bridge and shows as a thumbnail.
  await ipad.frame.locator('.stop .what',{hasText:'Boat tour'}).click();await ipad.frame.locator('#sheet[open]').waitFor();
  const [pick]=await Promise.all([ipad.page.waitForEvent('filechooser'),ipad.frame.locator('[data-sact=att-photo]').click()]);
  await pick.setFiles({name:'pier.jpg',mimeType:'image/jpeg',buffer:Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAkADADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwCCiiivjj9VCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//9k=','base64')});
  await ipad.frame.locator('#att-list').getByText('pier · file').waitFor({timeout:30000});
  await ipad.frame.locator('#att-list img.thumb').waitFor({timeout:30000});
  await ipad.frame.locator('#sheet button[value=save]').click();await ipad.frame.locator('#sheet').waitFor({state:'hidden'});
  await ipad.frame.locator('.stop',{hasText:'Boat tour'}).locator('img.thumb').waitFor({timeout:30000});
  // The journal shows the stop photo as a blog post cover, and a day turns into a real KeepIt note whose text shows in the post.
  await tab(ipad.frame,'Journal');await ipad.frame.locator('.post img.cover-img').first().waitFor({timeout:30000});
  await ipad.frame.locator('[data-act=journal-text]').first().fill('Calm lake, great pancakes.');await ipad.frame.getByText('Journal saved').waitFor();
  await ipad.frame.locator('.post').first().getByRole('button',{name:'Write in KeepIt'}).click();
  await ipad.frame.getByText(/Journal is now a KeepIt note/).waitFor({timeout:60000});
  // KeepIt opens the saved note for writing; closing it returns to the trip.
  await ipad.page.getByText('Lake weekend · Day 1 · Fri, Mar 1').first().waitFor();await ipad.page.getByRole('button',{name:'Close',exact:true}).click();
  await ipad.frame.locator('.post').first().locator('.note-text',{hasText:'Calm lake, great pancakes.'}).waitFor({timeout:30000});
  // Offline road maps for the trip's pinned places, then backed up to KeepIt.
  await tab(ipad.frame,'Map');await ipad.frame.getByText('0/1 areas saved').waitFor();
  await ipad.frame.getByRole('button',{name:'Save offline maps for this trip'}).click();
  await ipad.frame.getByText('1/1 areas saved').waitFor({timeout:30000});
  await ipad.page.waitForFunction(()=>localStorage.getItem('keepit-map-backup-pending')===null,null,{timeout:60000});
  // Without signal the saved roads draw under the pins.
  await ipad.context.setOffline(true);await tab(ipad.frame,'Plan');await ipad.frame.locator('.tabs a',{hasText:'Map'}).click();
  await ipad.frame.getByText('Offline road map · © OpenStreetMap contributors').waitFor({timeout:20000});
  assert.ok(await ipad.frame.locator('#map canvas').count()>0,'offline roads drawn');
  await ipad.context.setOffline(false);

  // iPhone: an empty device opens the trip from KeepIt by itself.
  const phone=await device();
  await phone.frame.getByText('Lake weekend').first().waitFor({timeout:60000});
  await phone.frame.locator('.stub').click();await tab(phone.frame,'Packing');
  assert.equal(await phone.frame.locator('.money').innerText(),'1/3');
  await phone.frame.locator('label',{hasText:'Swimwear'}).click();await phone.frame.locator('.money',{hasText:'2/3'}).waitFor();
  await phone.frame.locator('#sync[data-state=ok]').waitFor({timeout:60000});
  // The offline map saved on the iPad installs on the second device by itself.
  await phone.page.waitForFunction(async()=>(await document.querySelector('iframe[title="TravelIt trip planning workspace"]').contentWindow.keepItAppFiles.listMaps()).length===1,null,{timeout:60000,polling:1000});
  await tab(phone.frame,'Map');await phone.frame.getByText('1/1 areas saved').waitFor({timeout:15000});

  // Back on the iPad the edit from the phone arrives.
  await ipad.page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await ipad.frame.locator('.tabs a',{hasText:'Packing'}).click();
  await ipad.page.waitForFunction(()=>document.querySelector('iframe[title="TravelIt trip planning workspace"]').contentDocument.querySelector('.money')?.textContent==='2/3',null,{timeout:60000}).catch(async e=>{await ipad.page.reload();throw e});
  assert.deepEqual([...ipad.errors,...phone.errors],[]);
  await ipad.context.close();await phone.context.close();await browser.close();browser=null;
  console.log('TRAVELIT_TRIPS_SYNC_AND_OFFLINE_MAPS_'+engine.name().toUpperCase()+'_PASS');
 }
}finally{if(browser)await browser.close();await new Promise(ok=>server.close(ok));rmSync(temp,{recursive:true,force:true});}
