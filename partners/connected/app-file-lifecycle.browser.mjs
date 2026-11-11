// Real compiled MSAL redirect/callback and canonical catalog reader, synthetic services only.
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
try{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const origin='https://127.0.0.1:'+server.address().port;
 for(const engine of process.env.REFINEMENTS_CHROMIUM_ONLY?[chromium]:[chromium,webkit]){
 browser=await engine.launch({headless:true});const fixture=connectionFixture(origin,{writable:true});uploadFixture=fixture;fixture.uploadEndpoint=origin+'/__calendar-upload';
 async function device(){
  const context=await browser.newContext({ignoreHTTPSErrors:true,serviceWorkers:'block',viewport:{width:1200,height:900}});
  await context.route('**/*',fixture.route);const page=await context.newPage();
  await page.goto(origin+'/partners/connected/?connected-app=thinkit&connect-onedrive=1');
  await page.locator('#onedrive-signin').click();
  await page.locator('#connected-cloud-status[data-phase=connected]').waitFor({timeout:30000});
  const frame=page.frameLocator('iframe[title="ThinkIt diagramming and Mind Map workspace"]');
  await frame.locator('#diStartCreate').waitFor();
  return {context,page,frame,editor:frame.frameLocator('#bmcFrame')};
 }
 async function files(device){
  await device.page.locator('#connected-apps-toggle').click();
  await device.page.getByRole('button',{name:'ThinkIt files',exact:true}).click();
  return device.page.getByRole('dialog',{name:'ThinkIt files in KeepIt'});
 }
 const first=await device();
 await first.frame.locator('#diStartCreate').click();await first.frame.locator('[data-project-mode=bmc]').click();
 await first.frame.locator('#projectStartName').fill('Synthetic canvas integration');
 await first.frame.getByRole('button',{name:'Create blank project',exact:true}).click();
 await first.editor.getByText('Ready · local project autosave').waitFor();
 await first.editor.getByRole('textbox',{name:'Value Propositions',exact:true}).fill('Saved via KeepIt project folder');
 const original=JSON.parse((await first.frame.locator('body').evaluate(()=>window.keepItAppFiles.capture())).payload);
 await first.frame.locator('#keepitProjectSync').filter({hasText:/saved.*KeepIt/i}).waitFor({timeout:30000});const panel=await files(first);
 await panel.getByRole('button',{name:'Move Synthetic canvas integration to Trash',exact:true}).waitFor();first.page.once('dialog',dialog=>dialog.accept());await panel.getByRole('button',{name:'Move Synthetic canvas integration to Trash',exact:true}).click();await panel.getByRole('button',{name:'Show Trash',exact:true}).click();await panel.getByRole('button',{name:'Restore Synthetic canvas integration',exact:true}).click();await panel.getByRole('status').filter({hasText:'Restored in KeepIt.'}).waitFor();
 await first.context.close();
 const second=await device(),panel2=await files(second);
 await panel2.getByRole('button',{name:'Synthetic canvas integration',exact:true}).click();
 await panel2.waitFor({state:'hidden'});
 const value=second.editor.getByRole('textbox',{name:'Value Propositions',exact:true});
 await value.getByText('Saved via KeepIt project folder').waitFor();
 const reopened=JSON.parse((await second.frame.locator('body').evaluate(()=>window.keepItAppFiles.capture())).payload);
 assert.equal(original.id,reopened.id);assert.deepEqual(original.pages[0].bmcData.blocks,reopened.pages[0].bmcData.blocks);
 await value.fill('Updated from the second device');
 await second.frame.locator('#keepitProjectSync').filter({hasText:/saved.*KeepIt/i}).waitFor({timeout:30000});
 await second.context.close();
 const third=await device(),panel4=await files(third);
 await panel4.getByRole('button',{name:'Synthetic canvas integration',exact:true}).click();
 await third.editor.getByRole('textbox',{name:'Value Propositions',exact:true}).getByText('Updated from the second device').waitFor();
 await third.context.close();
 console.log('THINKIT_AUTOMATIC_SAVE_TRASH_RESTORE_AND_THREE_PROFILE_EDIT_'+engine.name().toUpperCase()+'_PASS');
 async function mapDevice(){
  const context=await browser.newContext({ignoreHTTPSErrors:true,serviceWorkers:'block',viewport:{width:1200,height:900}});
  await context.route('**/*',fixture.route);
  await context.route('https://overpass-api.de/api/interpreter',route=>route.fulfill({status:200,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:JSON.stringify({elements:[{type:'way',tags:{highway:'residential',name:'Synthetic road'},geometry:[{lat:14.599,lon:120.984},{lat:14.601,lon:120.985}]}]})}));
  const page=await context.newPage();await page.goto(origin+'/partners/connected/?connected-app=travelit&connect-onedrive=1');
  await page.locator('#onedrive-signin').click();await page.locator('#connected-cloud-status[data-phase=connected]').waitFor({timeout:30000});
  const frame=page.frameLocator('iframe[title="TravelIt trip planning workspace"]');
  await frame.locator('#view-select').waitFor();return {context,page,frame};
 }
 const sender=await mapDevice();await sender.frame.locator('#view-select').selectOption('map');
 await sender.frame.getByRole('button',{name:'Download offline map',exact:true}).click();await sender.frame.locator('#f-name').fill('Synthetic shared road map');
 await sender.frame.getByRole('button',{name:'Download to this device',exact:true}).click();
 await sender.page.waitForFunction(()=>localStorage.getItem('keepit-map-backup-pending')===null&&document.querySelector('iframe[title="TravelIt trip planning workspace"]').contentDocument.querySelector('.map-pack-meta')?.textContent.includes('Synthetic shared road map'));
 await sender.page.locator('#connected-apps-toggle').click();await sender.page.getByRole('button',{name:'TravelIt files',exact:true}).click();
 await sender.page.getByRole('dialog',{name:'TravelIt files in KeepIt'}).getByRole('button',{name:'Install Synthetic shared road map on this device',exact:true}).waitFor({timeout:30000});
 await sender.context.close();
 const receiver=await mapDevice();await receiver.page.locator('#connected-apps-toggle').click();await receiver.page.getByRole('button',{name:'TravelIt files',exact:true}).click();
 const mapFiles=receiver.page.getByRole('dialog',{name:'TravelIt files in KeepIt'});
 await mapFiles.getByRole('button',{name:'Install Synthetic shared road map on this device',exact:true}).click();
 await mapFiles.getByRole('status').filter({hasText:'Installed “Synthetic shared road map” for offline use on this device.'}).waitFor();
 const installed=await receiver.frame.locator('body').evaluate(()=>window.keepItAppFiles.listMaps());assert.equal(installed.length,1);assert.equal(installed[0].name,'Synthetic shared road map');
 await receiver.context.close();
 console.log('TRAVELIT_DOWNLOADED_MAP_AUTOMATIC_BACKUP_AND_SECOND_DEVICE_INSTALL_'+engine.name().toUpperCase()+'_PASS');
 console.log('Microsoft and OneDrive fixtures are synthetic. No live account accessed.');
 await browser.close();
 }
}finally{if(browser)await browser.close();await new Promise(ok=>server.close(ok));rmSync(temp,{recursive:true,force:true});}
