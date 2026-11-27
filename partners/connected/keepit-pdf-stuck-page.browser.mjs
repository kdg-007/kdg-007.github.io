// A PDF page that never finishes drawing (iPadOS can stop the PDF worker when
// memory runs short) must not lock KeepIt: Close, Write beside and Download stay
// usable during page turns, and a stuck page gives up with a message.
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
// A minimal PDF: each page has a title and one coloured block (page 2: red).
function makePdf(label='Page'){
 const colours=['0 0 1','1 0 0','0 .6 0'],objects=[];
 const pages=colours.map((rgb,i)=>{
  const content=`${rgb} rg 150 300 300 200 re f BT /F1 36 Tf 72 700 Td (${label} ${i+1}) Tj ET`;
  return {content};
 });
 // 1 catalog, 2 pages, 3 font, then page/content pairs.
 const kids=pages.map((_,i)=>`${4+i*2} 0 R`).join(' ');
 objects.push('<< /Type /Catalog /Pages 2 0 R >>');
 objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
 objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
 pages.forEach((p,i)=>{
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5+i*2} 0 R >>`);
  objects.push(`<< /Length ${p.content.length} >>\nstream\n${p.content}\nendstream`);
 });
 let out='%PDF-1.4\n';const offsets=[];
 objects.forEach((o,i)=>{offsets.push(out.length);out+=`${i+1} 0 obj\n${o}\nendobj\n`;});
 const xref=out.length;
 out+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('');
 out+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
 return Buffer.from(out,'latin1');
}
try{
 for(const engine of process.env.KEEPIT_BROWSER_ENGINE==='chromium'||process.env.STABILITY_CHROMIUM_ONLY?[chromium]:[chromium,webkit]){
  const browser=await engine.launch({headless:true});
  try{
   const fixture=connectionFixture(origin,{writable:true});uploads=fixture;fixture.uploadEndpoint=origin+'/__upload';
   const context=await browser.newContext({ignoreHTTPSErrors:true,serviceWorkers:'block',viewport:{width:1180,height:820}});
   await context.route('**/*',fixture.route);const page=await context.newPage();
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto(origin+'/partners/connected/?connected-app=keepit&connect-onedrive=1');await page.locator('#onedrive-signin').click();
   await page.locator('#connected-cloud-status[data-phase=connected]').waitFor({timeout:30000});
   await page.locator('#file-input').setInputFiles({name:'heavy.pdf',mimeType:'application/pdf',buffer:makePdf()});
   await page.locator('#capture-title').fill('Heavy book');
   await page.locator('#capture-form').getByRole('button',{name:'Save',exact:true}).click();
   await page.locator('#upload-summary').filter({hasText:'Uploads complete'}).waitFor({state:'attached',timeout:30000});
   // Wait for the reader controls to attach to the shared PDF class, then make
   // later page renders hang the way a stopped PDF worker does.
   await page.waitForFunction(()=>!!document.querySelector('#pdf-controls button[aria-label="Show two PDF pages side by side"]'));
   await page.evaluate(async()=>{
    const {PdfReader}=await import('/assets/chunk-V6NBNB24.js');const render=PdfReader.prototype.render;
    PdfReader.prototype.render=function(...args){return globalThis.__stallPdf?new Promise(()=>{}):render.apply(this,args);};
    globalThis.keepitPdfPageBudgetMs=1500;
   });
   const open=async()=>{await page.locator('main').getByText('Heavy book').filter({visible:true}).first().click();
    await page.locator('#item-dialog[open]').waitFor();await page.locator('#pdf-controls:not([hidden])').waitFor({timeout:20000});};
   await open();
   const forward=page.locator('#pdf-forward');await forward.waitFor({state:'visible'});
   assert.equal(await forward.isDisabled(),false,engine.name()+': next page available');
   await page.evaluate(()=>{globalThis.__stallPdf=true;});
   await forward.click();
   // While the page is stuck, the rest of the window still works.
   for(const id of ['close-item','pdf-write-beside','download-original'])
    assert.equal(await page.locator('#'+id).isDisabled(),false,engine.name()+': '+id+' usable during a page turn');
   assert.equal(await forward.isDisabled(),true,engine.name()+': no second turn queued');
   await page.locator('#preview-status').filter({hasText:'taking too long'}).waitFor({timeout:10000});
   assert.equal(await forward.isDisabled(),false,engine.name()+': next page available again after the time limit');
   // Close works even with a render still hanging in the background.
   await forward.click();await page.locator('#close-item').click();
   await page.locator('#item-dialog').waitFor({state:'hidden',timeout:6000});
   // Escape-style cancel and reopening also work.
   await page.evaluate(()=>{globalThis.__stallPdf=false;});
   await open();
   await page.keyboard.press('Escape');await page.locator('#item-dialog').waitFor({state:'hidden',timeout:6000});
   assert.deepEqual(errors,[],engine.name()+': no page errors');
   console.log(engine.name()+': stuck PDF page no longer locks KeepIt');
   await context.close();
  }finally{await browser.close();}
 }
}finally{server.close();rmSync(temp,{recursive:true,force:true});}
