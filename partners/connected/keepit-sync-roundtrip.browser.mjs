import assert from 'node:assert/strict';
import {createServer} from 'node:https';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync,statSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,extname,sep} from 'node:path';
import {createRequire} from 'node:module';
import {connectionFixture} from './owner-connection-fixture.mjs';
const {chromium,webkit}=createRequire(resolve('package.json'))('playwright');
const root=resolve('.'),temp=mkdtempSync(join(tmpdir(),'save-connection-'));
const proof=JSON.parse(readFileSync('partners/connected/owner-release.json'));
const modulePath=prefix=>'/'+Object.keys(proof.files).find(p=>p.startsWith('assets/'+prefix+'-'));
execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(temp,'key'),'-out',join(temp,'cert'),'-days','1','-subj','/CN=127.0.0.1'],{stdio:'ignore'});
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
let uploads;
const server=createServer({key:readFileSync(join(temp,'key')),cert:readFileSync(join(temp,'cert'))},(req,res)=>{
 if(req.method==='PUT'&&req.url.startsWith('/__upload?')){
  const parts=[];req.on('data',p=>parts.push(p));req.on('end',()=>{
   const q=new URL(req.url,'https://localhost').searchParams,data=Buffer.concat(parts);assert.ok(data.length);
   const result=uploads.acceptUpload(q.get('parent'),q.get('name'),data);res.writeHead(result.status,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}).end(JSON.stringify(result.value));
  });return;
 }
 const pathname=new URL(req.url,'https://localhost').pathname,file=resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
 try{assert.ok(file.startsWith(root+sep));assert.ok(statSync(file).isFile());const bytes=readFileSync(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(bytes);}catch{res.writeHead(404).end();}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const origin='https://127.0.0.1:'+server.address().port;
// KI-004: repeated edits between two devices (Mac and iPad) with the note left
// open on both, in the editor or the reader. Each edit must reach the other
// device through the regular 30 s check, with no conflict, in both directions.
const ARRIVAL_MS=45000;
const openDevice=async(browser,fixture)=>{
 const context=await browser.newContext({ignoreHTTPSErrors:true,serviceWorkers:'block',viewport:{width:1280,height:860}});
 await context.route('**/*',fixture.route);const page=await context.newPage();
 await page.goto(origin+'/partners/connected/?connected-app=keepit&connect-onedrive=1');await page.locator('#onedrive-signin').click();
 await page.locator('#connected-cloud-status[data-phase=connected]').waitFor({timeout:30000});
 return {context,page,note:page.locator('dialog.note-dialog[open]')};
};
const save=async({note},subject)=>{
 if(await note.getAttribute('data-mode')==='preview')await note.getByRole('button',{name:'Edit',exact:true}).click();
 await note.getByRole('textbox',{name:'Subject'}).fill(subject);
 await note.getByRole('button',{name:'Save',exact:true}).click();
 await note.locator('.note-status').filter({hasText:/Verified synced to OneDrive|Synced to OneDrive/}).waitFor({timeout:40000});
};
const arrives=async({page},subject,label)=>{
 const started=Date.now();
 await page.waitForFunction(subject=>{
  const dialog=document.querySelector('dialog.note-dialog[open]');if(!dialog)return false;
  const heading=dialog.querySelector('.note-reader h1'),box=dialog.querySelector('input.note-subject');
  return heading?.textContent.trim()===subject||box?.value===subject;
 },subject,{timeout:ARRIVAL_MS}).catch(()=>{throw Error(label+' did not arrive within '+ARRIVAL_MS/1000+' s');});
 console.log('  '+label+' arrived after '+((Date.now()-started)/1000).toFixed(1)+' s');
};
try{
 for(const engine of process.env.KEEPIT_BROWSER_ENGINE==='chromium'||process.env.STABILITY_CHROMIUM_ONLY?[chromium]:[chromium,webkit]){
  const browser=await engine.launch({headless:true});
  try{
   const fixture=connectionFixture(origin,{writable:true});uploads=fixture;fixture.uploadEndpoint=origin+'/__upload';
   const mac=await openDevice(browser,fixture);
   await mac.page.locator('#add-files').click();await mac.page.locator('#write-note').click();
   await mac.note.getByRole('textbox',{name:'Subject'}).fill('Round trip v1');
   await mac.note.locator('.note-editor [contenteditable=true]').fill('Body');
   await mac.note.getByRole('button',{name:'Save',exact:true}).click();
   await mac.note.locator('.note-status').filter({hasText:/Verified synced to OneDrive|Synced to OneDrive/}).waitFor({timeout:40000});
   const ipad=await openDevice(browser,fixture);
   const entry=ipad.page.locator('main').getByText('Round trip v1',{exact:true}).filter({visible:true}).first();
   await entry.waitFor({timeout:60000});await entry.click();await ipad.note.locator('.note-reader').waitFor();
   for(const [who,subject] of [['mac','Mac edit 1'],['ipad','iPad edit 1'],['mac','Mac edit 2'],['ipad','iPad edit 2'],['mac','Mac edit 3']]){
    const [from,to]=who==='mac'?[mac,ipad]:[ipad,mac];
    await save(from,subject);
    await arrives(to,subject,who==='mac'?'Mac -> iPad "'+subject+'"':'iPad -> Mac "'+subject+'"');
   }
   console.log('KEEPIT_SYNC_ROUNDTRIP_'+engine.name().toUpperCase()+'_PASS');
  }finally{await browser.close();}
 }
 console.log('keepit-sync-roundtrip passed');
}finally{await new Promise(ok=>server.close(ok));rmSync(temp,{recursive:true,force:true});}
