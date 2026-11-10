import assert from 'node:assert/strict';
import { createServer } from 'node:https';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';

const require=createRequire(resolve('package.json'));
const { chromium,webkit }=require('playwright');
const root=resolve('.'),temp=mkdtempSync(join(tmpdir(),'thinkit-bmc-'));
const key=join(temp,'key.pem'),cert=join(temp,'cert.pem');
execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,
 '-days','1','-subj','/CN=127.0.0.1','-addext','subjectAltName=IP:127.0.0.1'],{stdio:'ignore'});
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
const server=createServer({key:readFileSync(key),cert:readFileSync(cert)},async(req,res)=>{
 try{
  const url=new URL(req.url,'https://127.0.0.1');
  const path=resolve(root,'.'+url.pathname+(url.pathname.endsWith('/')?'index.html':''));
  assert.ok(path.startsWith(root+sep));
  const bytes=await readFile(path);
  res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});
  res.end(bytes);
 }catch{res.writeHead(404).end();}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const origin='https://127.0.0.1:'+server.address().port;
const image={name:"proof.png",mimeType:"image/png",buffer:Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8SsAAAAASUVORK5CYII=","base64")};
const paths=['/thinkit/','/partners/connected/?connected-app=thinkit'];

async function checkWorkspace(browser,index){
 const context=await browser.newContext({
  viewport:index?{width:390,height:844}:{width:1440,height:1000},acceptDownloads:true,hasTouch:Boolean(index),isMobile:Boolean(index),ignoreHTTPSErrors:true,serviceWorkers:'block'
 });
 try{
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const location=origin+paths[index];
  await page.goto(location,{waitUntil:'domcontentloaded'});
  const shell=index?page.frameLocator('iframe[title="ThinkIt diagramming and Mind Map workspace"]'):page;
  await shell.locator('#diStartCreate').click().catch(async error=>{
   console.error('ThinkIt startup',page.url(),errors,await page.locator('#connected-startup').allTextContents());
   throw error;
  });
  assert.deepEqual(await shell.locator('[data-project-mode]').evaluateAll(nodes=>nodes.map(node=>node.dataset.projectMode)),['flow','org','mind','bubble','bmc']);
  await shell.locator('[data-project-mode=bmc]').click();
  await shell.getByRole('button',{name:'Create blank project',exact:true}).click();
  const bmc=shell.frameLocator('#bmcFrame'),value=bmc.getByRole('textbox',{name:'Value Propositions',exact:true});
  await bmc.locator('#status').getByText('Ready · local project autosave').waitFor();
  assert.match(await shell.locator('#diActiveMode').textContent(),/Business Model Canvas/);
  assert.equal(await bmc.getByRole('textbox').count(),9);
  if(index){
   const layout=await bmc.locator('.canvas').evaluate(canvas=>({
    direction:getComputedStyle(canvas).flexDirection,
    fits:document.documentElement.scrollWidth<=document.documentElement.clientWidth
   }));
   assert.deepEqual(layout,{direction:'column',fits:true});
  }
  await value.click();
  await bmc.getByRole('button',{name:'Bold',exact:true}).click();
  await page.keyboard.insertText('Passenger journey evidence');
  await value.locator('b,strong').getByText('Passenger journey evidence').waitFor();
  await bmc.getByRole('button',{name:'Undo',exact:true}).click();
  await value.getByText('Passenger journey evidence').waitFor({state:'hidden'});
  await bmc.getByRole('button',{name:'Redo',exact:true}).click();
  await value.getByText('Passenger journey evidence').waitFor();
  await bmc.getByRole('button',{name:'+ Note',exact:true}).click();
  await value.locator('aside.bmc-note').waitFor();
  await bmc.getByRole('button',{name:'+ Table',exact:true}).click();
  await value.locator('td').first().click();
  await bmc.getByRole('button',{name:'+ Row',exact:true}).click();
  await bmc.getByRole('button',{name:'+ Column',exact:true}).click();
  assert.equal(await value.locator('tr').count(),3);
  assert.equal(await value.locator('tr').first().locator('th').count(),3);
  await bmc.locator('#imagePicker').setInputFiles(image);
  await value.locator('img[alt="proof.png"]').waitFor();

  const exported=page.waitForEvent('download');
  await shell.locator('#diMenuTabs [data-tab=File]').click();
  await shell.locator('#diMenuPopup [data-dcmd="file.saveAs"]').click();
  const project=JSON.parse(await readFile(await (await exported).path(),'utf8'));
  const original=project.pages.find(item=>item.mode==='bmc');
  assert.match(original.bmcData.blocks.value,/Passenger journey evidence/);
  assert.match(original.bmcData.blocks.value,/proof\.png/);
  assert.match(original.bmcData.blocks.value,/<table/);
  if(index){
   const payload=await shell.locator('body').evaluate(async()=>JSON.parse((await window.keepItAppFiles.capture()).payload));
   assert.deepEqual(payload.pages[0].bmcData.blocks,original.bmcData.blocks);
  }

  if(index){
   await shell.locator('#tabNewPage').tap();
   await shell.getByRole('button',{name:'Create page',exact:true}).tap();
  }else{
   await shell.locator('#diActiveMode').click();
   await shell.locator('[data-mode-choice=flow]').click();
  }
  await shell.locator('body:not(.bmc-active)').waitFor();
  await shell.locator('#pageTabs .page-tab[data-page-id='+JSON.stringify(original.id)+']').click();
  await value.getByText('Passenger journey evidence').waitFor();
  await shell.locator('#btnSave').click();
  await shell.locator('#saveStatus[data-state=saved]').waitFor();
  await page.reload();
  await shell.locator('#diStartResume').click();
  await value.locator('img[alt="proof.png"]').waitFor();
  assert.match(await value.innerText(),/Passenger journey evidence/);

  await shell.locator('#fileInput').setInputFiles({name:'canvas.diagramit.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
  await value.locator('aside.bmc-note').waitFor();
  assert.match(await value.innerText(),/Passenger journey evidence/);
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
}

async function checkPrint(browser){
 const context=await browser.newContext({ignoreHTTPSErrors:true,serviceWorkers:'block'});
 try{
  const page=await context.newPage();
  await page.goto(origin+'/thinkit/business-model.html');
  await page.evaluate(()=>{
   window.thinkItAcceptBmcEdit=()=>true;
   window.print=()=>document.body.dataset.printCalled='true';
   window.postMessage({channel:'thinkit-bmc-v1',type:'load',session:'test',pageId:'print',title:'Printable canvas',model:null},location.origin);
  });
  await page.getByRole('heading',{name:'Printable canvas',exact:true}).waitFor();
  const value=page.getByRole('textbox',{name:'Value Propositions',exact:true});
  await value.fill('Printable evidence');
  for(const [option,width,height] of [['A3',420,297],['A4',297,210]]){
   await page.locator('#paper').selectOption(option);
   await page.getByRole('button',{name:'Print / PDF'}).click();
   assert.equal(await page.locator('body').getAttribute('data-print-called'),'true');
   if(browser.browserType().name()==='chromium'){
    const pdf=(await page.pdf({preferCSSPageSize:true,printBackground:true})).toString('latin1');
    assert.equal((pdf.match(/\/Type\s*\/Page\b/g)||[]).length,1);
    const [,pdfWidth,pdfHeight]=pdf.match(/\/MediaBox\s*\[0 0 ([\d.]+) ([\d.]+)\]/);
    assert.ok(Math.abs(Number(pdfWidth)*25.4/72-width)<.3);
    assert.ok(Math.abs(Number(pdfHeight)*25.4/72-height)<.3);
   }else{
    await page.emulateMedia({media:'print'});
    const size=await page.locator('#sheet').boundingBox();
    assert.ok(Math.abs(size.width*25.4/96-width)<.3);
    assert.ok(Math.abs(size.height*25.4/96-height)<.3);
    assert.equal(await page.getByRole('textbox').count(),9);
    await page.emulateMedia({media:'screen'});
   }
   await page.evaluate(()=>delete document.body.dataset.printCalled);
  }
 }finally{await context.close();}
}

try{
 for(const engine of [chromium,webkit]){
  const browser=await engine.launch({headless:true});
  try{
   for(const index of paths.keys())await checkWorkspace(browser,index);
   await checkPrint(browser);
   console.log('THINKIT_BUSINESS_MODEL_SAVE_REOPEN_AND_PRINT_'+engine.name().toUpperCase()+'_PASS');
  }finally{await browser.close();}
 }
}finally{await new Promise(ok=>server.close(ok));rmSync(temp,{recursive:true,force:true});}
