import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, resolve, sep } from 'node:path';

const require = createRequire(resolve('package.json'));
const { chromium } = require('playwright');
const root = resolve('.');
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css' };
const server = createServer(async (req,res) => {
  try {
    const path = resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
    assert.ok(path.startsWith(root+sep));
    const bytes = await readFile(path);
    res.writeHead(200, { 'Content-Type':mime[extname(path)] || 'application/octet-stream' });
    res.end(bytes);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const origin = 'http://127.0.0.1:'+server.address().port;
let browser;
try {
  browser = await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1500,height:1000},acceptDownloads:true});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const url=origin+'/thinkit/36f8901ec722db162bcf/index.html';
  await page.goto(url);
  await page.locator('#diStartCreate').click();
  await page.locator('[data-project-mode=mind]').click();
  await page.getByRole('button',{name:'Create blank project',exact:true}).click();
  await page.locator('[data-tab=View]').first().click();
  const ruler=page.locator('#diRibbonContent [data-dcmd="view.ruler"]');
  await ruler.click();
  await page.waitForSelector('#diRulerOverlay svg text');
  assert.equal(await ruler.getAttribute('aria-pressed'),'true');
  const ticks=await page.locator('#diRulerOverlay svg').first().locator('path').getAttribute('d');
  await page.locator('#btnZoomIn').click();
  assert.notEqual(await page.locator('#diRulerOverlay svg').first().locator('path').getAttribute('d'),ticks);
  assert.equal(await page.locator('#diRulerOverlay svg').count(),2);
  const colors=await page.evaluate(()=>{
   const selectors=['.shape-card span','.page-item.active .page-name','.page-item.active .page-mode','.footer-action','.sidebar-bottom-note','.small-action','.mind-notes-trigger'];
   const rgb=s=>(s.match(/[\d.]+/g)||[]).map(Number).slice(0,3);
   const luminance=s=>rgb(s).reduce((total,n,i)=>{const v=n/255;return total+[.2126,.7152,.0722][i]*(v<=.04045?v/12.92:((v+.055)/1.055)**2.4)},0);
   const found={};
   for(const scheme of ['journal','linen','midnight','forest','lavender']){
    document.documentElement.dataset.appScheme=scheme;
    found[scheme]=selectors.map(selector=>{
     let e=document.querySelector(selector);
     const fg=getComputedStyle(e).color;
     let bg=getComputedStyle(e).backgroundColor;
     while(bg==='rgba(0, 0, 0, 0)'){e=e.parentElement;bg=getComputedStyle(e).backgroundColor;}
     const [x,y]=[luminance(fg),luminance(bg)].sort((a,b)=>b-a);
     return [selector,(x+.05)/(y+.05)];
    });
   }
   document.documentElement.dataset.appScheme='journal';
   return found;
  });
  for(const [theme,checks] of Object.entries(colors))for(const [selector,ratio] of checks)assert.ok(ratio>=4.5,theme+' '+selector+' '+ratio);
  await page.locator('#diActiveMode').click();
  await page.locator('[data-mode-choice=business]').click();
  await page.getByRole('button',{name:'Create page',exact:true}).click();
  await page.locator('#businessCanvas .business-block').first().waitFor();
  assert.equal(await page.locator('#businessCanvas .business-block').count(),9);
  await page.getByRole('button',{name:'Add note to Value Propositions'}).click();
  await page.locator('#businessTitle').fill('Airport offer');
  await page.locator('#businessEditor').click();
  await page.getByRole('button',{name:'Bold',exact:true}).click();
  await page.keyboard.insertText('Business proof');
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.getByRole('button',{name:'Insert table',exact:true}).click();
  await page.locator('#businessEditor th').first().click();
  await page.keyboard.insertText('Evidence');
  await page.getByRole('button',{name:'Add column',exact:true}).click();
  await page.getByRole('button',{name:'Add row',exact:true}).click();
  assert.equal(await page.locator('#businessEditor tr').count(),3);
  assert.equal(await page.locator('#businessEditor tr').first().locator('th').count(),3);
  await page.locator('#businessImage').setInputFiles({name:'test.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8SsAAAAASUVORK5CYII=','base64')});
  await page.locator('#businessEditor img').waitFor();
  await page.getByRole('button',{name:'Save card',exact:true}).click();
  assert.equal(await page.locator('#businessCanvas article strong').textContent(),'Airport offer');
  assert.equal(await page.locator('#businessCanvas article img').count(),1);
  assert.equal(await page.locator('#businessCanvas article table').count(),1);
  assert.equal(await page.locator('#businessCanvas article b, #businessCanvas article strong').count(),2);
  await page.locator('body').press('Control+s');
  await page.locator('#saveStatus[data-state=saved]').waitFor();
  await page.reload();
  await page.locator('#diStartResume').click();
  await page.getByRole('button',{name:'Edit Airport offer in Value Propositions'}).waitFor();
  const popupPromise=page.waitForEvent('popup');
  await page.locator('#diRibbonContent [data-dcmd="view.printRulers"]').click();
  const print=await popupPromise;
  print.on('pageerror',e=>errors.push(e.message));
  await print.waitForFunction(()=>document.querySelector('#artworkSize')?.textContent.includes('mm'));
  assert.equal(await print.locator('.business-print .business-block').count(),9);
  assert.equal(await print.locator('#sheetRulers svg').count(),2);
  await print.locator('#paper').selectOption('A3');
  await print.locator('#scaleMode').selectOption('actual');
  const size=await print.locator('#artworkSize').textContent();
  assert.match(size,/270.9/);
  const geometry=await print.evaluate(()=>{
   const r=document.getElementById('sheetRulerX');
   const labels=[...r.querySelectorAll('text')];
   const a=labels[0],b=labels[1];
   return {mm:Number(b.textContent)-Number(a.textContent), dx:Number(b.getAttribute('x'))-Number(a.getAttribute('x')),zoom:parseFloat(getComputedStyle(document.getElementById('sheet')).transform.split('(')[1])};
  });
  assert.ok(Math.abs(geometry.dx/geometry.zoom/geometry.mm-96/25.4)<.0001);
  await print.locator('#printRulers').uncheck();
  assert.equal(await print.locator('#sheetRulers').isVisible(),false);
  await print.locator('#printRulers').check();
  const pdf=await print.pdf({preferCSSPageSize:true,printBackground:true});
  const raw=pdf.toString('latin1');
  assert.equal((raw.match(/\/Type\s*\/Page\b/g)||[]).length,1);
  const [,width,height]=raw.match(/\/MediaBox\s*\[0 0 ([\d.]+) ([\d.]+)\]/);
  assert.ok(Math.abs(Number(width)*25.4/72-420)<.3);
  assert.ok(Math.abs(Number(height)*25.4/72-297)<.3);
  await print.close();
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.querySelector('#businessCanvas').scrollWidth===document.querySelector('#businessCanvas').clientWidth));
  await page.locator('#leftCollapse').click();
  await page.getByRole('button',{name:'Add text to Key Partnerships'}).click();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  const project=await page.evaluate(async()=>JSON.parse((await window.keepItAppFiles.capture()).payload));
  assert.equal(project.pages.find(p=>p.mode==='business').businessCanvas.value[0].title,'Airport offer');
  assert.deepEqual(errors,[]);
  console.log('THINKIT_CONTRAST_RULERS_BUSINESS_PRINT_PASS');
} finally {
  await browser?.close();
  server.close();
}
