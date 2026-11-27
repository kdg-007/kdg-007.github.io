// Large uploads survive a weak connection: failed pieces are retried after asking
// OneDrive where to resume, piece size adapts, and the original arrives intact.
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
const sessions=new Map();let sessionSerial=0,pieceRequests=0;const sizes=[],trouble=new Map([[2,'503'],[3,'drop'],[6,'503']]);
const server=createServer({key:readFileSync(join(temp,'key')),cert:readFileSync(join(temp,'cert'))},(req,res)=>{
 const cors={'Content-Type':'application/json','Access-Control-Allow-Origin':'*'};
 if(req.method==='PUT'&&req.url.startsWith('/__upload?')){
  const parts=[];req.on('data',p=>parts.push(p));req.on('end',()=>{
   const q=new URL(req.url,'https://localhost').searchParams,result=uploads.acceptUpload(q.get('parent'),q.get('name'),Buffer.concat(parts));res.writeHead(result.status,cors).end(JSON.stringify(result.value));
  });return;
 }
 if(req.url.startsWith('/__piece?')){
  const session=sessions.get(new URL(req.url,'https://localhost').searchParams.get('sid'));
  if(req.method==='GET'){res.writeHead(200,cors).end(JSON.stringify({expirationDateTime:session.expires,nextExpectedRanges:[session.received.length+'-']}));return;}
  const number=++pieceRequests,parts=[];req.on('data',p=>parts.push(p));req.on('end',()=>{
   const data=Buffer.concat(parts),[,from,to,total]=/^bytes (\d+)-(\d+)\/(\d+)$/.exec(req.headers['content-range']).map(Number);
   sizes.push(data.length);
   if(trouble.get(number)==='drop'){req.socket.destroy();return;}
   if(trouble.get(number)==='503'){res.writeHead(503,cors).end(JSON.stringify({error:{code:'serviceNotAvailable'}}));return;}
   assert.equal(from,session.received.length,'pieces arrive in order without gaps');assert.equal(to-from+1,data.length);
   session.received=Buffer.concat([session.received,data]);
   if(session.received.length<total){res.writeHead(202,cors).end(JSON.stringify({expirationDateTime:session.expires,nextExpectedRanges:[session.received.length+'-']}));return;}
   const result=uploads.acceptUpload(session.parent,session.name,session.received);res.writeHead(result.status,cors).end(JSON.stringify(result.value));
  });return;
 }
 const pathname=new URL(req.url,'https://localhost').pathname,file=resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
 try{assert.ok(file.startsWith(root+sep));assert.ok(statSync(file).isFile());const bytes=readFileSync(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(bytes);}catch{res.writeHead(404).end();}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const origin='https://127.0.0.1:'+server.address().port;
// A 6 MiB "PDF" (header plus deterministic filler) takes the upload-session path.
const source=Buffer.alloc(6*1024*1024);source.write('%PDF-1.4\n');for(let i=16;i<source.length;i++)source[i]=(i*31+7)&255;
try{
 for(const engine of process.env.KEEPIT_BROWSER_ENGINE==='chromium'||process.env.STABILITY_CHROMIUM_ONLY?[chromium]:[chromium,webkit]){
  const browser=await engine.launch({headless:true});
  try{
   sessions.clear();pieceRequests=0;sizes.length=0;
   const fixture=connectionFixture(origin,{writable:true});uploads=fixture;fixture.uploadEndpoint=origin+'/__upload';
   const context=await browser.newContext({ignoreHTTPSErrors:true,serviceWorkers:'block',viewport:{width:1180,height:820}});
   await context.route('**/*',async route=>{
    const url=new URL(route.request().url()),method=route.request().method();
    const session=/^\/v1\.0\/drives\/fixture-drive\/items\/([^/:]+):\/(.+):\/createUploadSession$/.exec(decodeURIComponent(url.pathname));
    if(url.hostname==='graph.microsoft.com'&&method==='POST'&&session){
     const sid='s'+(++sessionSerial),expires=new Date(Date.now()+3600e3).toISOString();
     sessions.set(sid,{parent:session[1],name:session[2],received:Buffer.alloc(0),expires});
     return route.fulfill({status:200,headers:{'access-control-allow-origin':origin,'access-control-allow-headers':'*'},contentType:'application/json',body:JSON.stringify({uploadUrl:'https://fixture.livefilestore.com/up/'+sid,expirationDateTime:expires})});
    }
    if(url.hostname==='fixture.livefilestore.com'&&url.pathname.startsWith('/up/')){
     if(method==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':origin,'access-control-allow-headers':'*','access-control-allow-methods':'GET,PUT,OPTIONS'}});
     return route.continue({url:origin+'/__piece?sid='+url.pathname.slice(4)});
    }
    return fixture.route(route);
   });
   const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto(origin+'/partners/connected/?connected-app=keepit&connect-onedrive=1');await page.locator('#onedrive-signin').click();
   await page.locator('#connected-cloud-status[data-phase=connected]').waitFor({timeout:30000});
   await page.evaluate(()=>{globalThis.__said=[];new MutationObserver(()=>{for(const el of document.querySelectorAll('#message,[role=status]'))if(el.textContent)globalThis.__said.push(el.textContent);}).observe(document.body,{subtree:true,childList:true,characterData:true});});
   await page.locator('#file-input').setInputFiles({name:'Large book.pdf',mimeType:'application/pdf',buffer:source});
   await page.locator('#capture-title').fill('Large book');
   await page.locator('#capture-form').getByRole('button',{name:'Save',exact:true}).click();
   await page.locator('#upload-summary').filter({hasText:'Uploads complete'}).waitFor({state:'attached',timeout:120000});
   // The queued card shows at once; wait for OneDrive to confirm the original.
   for(const started=Date.now();![...sessions.values()].some(s=>s.received.length===source.length)||!fixture.requests.some(r=>r.method==='PATCH'||r.method==='PUT');){
    if(Date.now()-started>150000)break;await page.waitForTimeout(500);
   }
   await page.waitForFunction(()=>/Saved|Uploads complete|uploaded/i.test(document.body.innerText)&&!/Saving Large book/.test(document.querySelector('#message')?.textContent||''),null,{timeout:60000}).catch(()=>{});
   const saved=[...sessions.values()].find(s=>s.received.length===source.length);
   assert.ok(saved,engine.name()+': the whole original reached OneDrive');
   assert.ok(saved.received.equals(source),engine.name()+': uploaded bytes match the original exactly');
   assert.ok(pieceRequests>=7,engine.name()+': failed pieces were retried ('+pieceRequests+' piece requests)');
   assert.equal(sizes[0],4*327680,engine.name()+': first piece is 1.25 MiB');
   assert.ok(sizes[1]>sizes[0],engine.name()+': pieces grow while they succeed');
   assert.ok(sizes[2]<sizes[1],engine.name()+': the piece after a failure is smaller');
   assert.ok(sizes.every((n,i)=>n%327680===0||i===sizes.length-1||sizes.slice(i+1).every(m=>m<=n)),engine.name()+': pieces stay 320 KiB multiples');
   const said=await page.evaluate(()=>globalThis.__said.join(' | '));
   assert.match(said,/Weak connection/,engine.name()+': the retry is shown');
   assert.deepEqual(errors,[],engine.name()+': no page errors');
   console.log(engine.name()+': large upload survived '+[...trouble.values()].length+' interruptions · pieces '+sizes.map(n=>Math.round(n/1024)+'K').join(','));
   await context.close();
  }finally{await browser.close();}
 }
}finally{server.close();rmSync(temp,{recursive:true,force:true});}
