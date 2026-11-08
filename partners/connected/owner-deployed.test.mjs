// Live static deployment verification. OAuth and Graph remain synthetic;
// no owner account, real Microsoft sign-in or production cloud data is used.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {connectionFixture} from './owner-connection-fixture.mjs';
const origin='https://kdg-007.github.io',proof=JSON.parse(readFileSync('partners/connected/owner-release.json','utf8'));
const url=path=>origin+'/'+path+'?owner-release='+proof.buildId;
async function verifyFiles(){
 const response=await fetch(url('partners/connected/owner-release.json'),{signal:AbortSignal.timeout(15000)});assert.equal(response.status,200);
 const published=await response.json();assert.equal(published.buildId,proof.buildId,'CDN has not received this owner build');
 const entries=Object.entries(proof.files);let cursor=0;
 await Promise.all(Array.from({length:6},async()=>{
  while(cursor<entries.length){const [path,expected]=entries[cursor++],response=await fetch(url(path),{signal:AbortSignal.timeout(15000)});assert.equal(response.status,200,path);const data=Buffer.from(await response.arrayBuffer());assert.equal(createHash('sha256').update(data).digest('hex'),expected,'Published bytes differ: '+path);}
 }));
 console.log('OWNER_DEPLOYED_ALL_'+entries.length+'_PINNED_FILES_PASS');
}
let fileError;
for(let attempt=0;attempt<6;attempt++){
 try{await verifyFiles();fileError=null;break;}catch(error){fileError=error;if(attempt<5)await new Promise(ok=>setTimeout(ok,10000));}
}
if(fileError)throw fileError;
const require=createRequire(resolve(process.cwd(),'package.json')),{chromium}=require('playwright'),browser=await chromium.launch({headless:true});
try{
 const ctx=await browser.newContext({serviceWorkers:'block'}),fixture=connectionFixture(origin,{nested:true}),page=await ctx.newPage(),errors=[],documents=[];
 await ctx.route('**/*',fixture.route);page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(r.isNavigationRequest()&&r.frame()===page.mainFrame())documents.push(new URL(r.url()).pathname);});
 await page.goto(origin+'/partners/connected/?connected-app=liveit&connect-onedrive=1&v=connection-3',{waitUntil:'domcontentloaded'});
 const workspace=page.frameLocator('iframe[title="LiveIt journal workspace"]').locator('#app .app-shell');await workspace.waitFor({state:'visible',timeout:40000});
 await page.locator('#onedrive-dialog[open]').waitFor();await page.locator('#onedrive-signin').click();
 await page.locator('#onedrive-folders button').filter({hasText:'Documents'}).click();await page.locator('#onedrive-folders button').filter({hasText:'Travel Library'}).click();await page.locator('#onedrive-use').click();
 await page.locator('#connected-cloud-status').filter({hasText:'OneDrive / Documents / Travel Library connected'}).waitFor({timeout:40000});
 await workspace.waitFor({state:'visible'});assert.equal(fixture.signins,1);assert.equal(fixture.driveRequests,1);assert.deepEqual(errors,[]);
 assert.deepEqual(documents.filter(x=>!x.startsWith('/consumers/')),['/partners/connected/','/auth/callback/','/partners/connected/']);assert.ok(fixture.requests.every(r=>r.method==='GET'));
 console.log('OWNER_DEPLOYED_COMPILED_SIGNIN_RETURN_AND_VISIBLE_WORKSPACE_PASS');console.log('OWNER_DEPLOYED_NESTED_FOLDER_SELECTION_PASS');console.log('Cloud services: synthetic GET only; owner account not used');await ctx.close();
}finally{await browser.close();}
