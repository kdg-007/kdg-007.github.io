// PDF beside the note: a library PDF opens in a reader pane next to the page,
// the Pencil only inks the page, zoom/page/swap work, a captured region lands
// on the page as a new layer that links back to its PDF page, and reopening the
// drawing brings the PDF back at the same page. Uses a generated 3-page PDF.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {resolve,sep,extname} from 'node:path';

const {chromium,webkit}=createRequire(resolve('package.json'))('playwright');
const root=resolve('.');
const drawingPath=JSON.parse(readFileSync(resolve(root,'ops/ui/LIVE_STABILITY_MODULES.json'))).paths.drawing;

// A minimal PDF: each page has a title and one coloured block (page 2: red).
function makePdf(){
 const colours=['0 0 1','1 0 0','0 .6 0'],objects=[];
 const pages=colours.map((rgb,i)=>{
  const content=`${rgb} rg 150 300 300 200 re f BT /F1 36 Tf 72 700 Td (Page ${i+1}) Tj ET`;
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
const pdf=makePdf();
const types={'.js':'text/javascript','.mjs':'text/javascript','.wasm':'application/wasm'};
const server=createServer((req,res)=>{
 const pathname=new URL(req.url,'http://127.0.0.1').pathname;
 if(pathname==='/split.html'){res.writeHead(200,{'Content-Type':'text/html'}).end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body><p>Note</p></body>');return;}
 if(pathname==='/reader.pdf'){res.writeHead(200,{'Content-Type':'application/pdf'}).end(pdf);return;}
 const path=resolve(root,'.'+pathname);
 if(!path.startsWith(root+sep)){res.writeHead(403).end();return;}
 try{res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream'}).end(readFileSync(path));}catch{res.writeHead(404).end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin='http://127.0.0.1:'+server.address().port;
try{
 for(const engine of process.env.KEEPIT_BROWSER_ENGINE==='chromium'?[chromium]:[chromium,webkit]){
  const browser=await engine.launch({headless:true});
  try{
   const page=await browser.newPage({viewport:{width:1180,height:820}});
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto(origin+'/split.html');
   await page.evaluate(async path=>{
    window.sketch=await import('/'+path);window.commits=[];
    const pdf=await (await fetch('/reader.pdf')).blob();
    globalThis.keepitPdfLibrary={list:async()=>[{id:'doc-1',name:'Course reader'}],read:async id=>{if(id!=='doc-1')throw Error('unknown');return pdf;}};
    window.openSketch=blob=>window.sketch.drawNote(blob,async file=>{window.commits.push(file);});
   },drawingPath);
   await page.evaluate(()=>window.openSketch(null));
   const dialog=page.getByRole('dialog',{name:'Note drawing'});await dialog.waitFor();
   const surface=dialog.locator('canvas[aria-label^="Drawing surface"]');
   const reader=dialog.getByRole('region',{name:'PDF beside the note'});
   const fullWidth=(await surface.boundingBox()).width;

   // 1. Open a library PDF beside the page.
   await dialog.getByRole('button',{name:'PDF beside'}).click();
   await page.getByRole('button',{name:'Course reader'}).click();
   await reader.waitFor();
   await reader.locator('.kd-ref-page canvas').first().waitFor({timeout:20000});
   assert.equal(await reader.locator('.kd-ref-page').count(),3,'three PDF pages');
   const readerBox=await reader.boundingBox(),sheetBox=await dialog.locator('.kd-sheet').boundingBox();
   assert.ok(readerBox.x<10&&readerBox.width>300,'reader on the left');
   assert.ok(sheetBox.x>=readerBox.x+readerBox.width,'page on the right of the reader');
   assert.ok((await surface.boundingBox()).width<fullWidth,'page narrows to make room');
   const firstPage=reader.locator('.kd-ref-page').first().locator('canvas');
   const blueOnPage1=await firstPage.evaluate(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i+2]>200&&d[i]<60)n++;return n;});
   assert.ok(blueOnPage1>1000,'page 1 renders its blue block: '+blueOnPage1);
   assert.equal(await reader.getByRole('spinbutton',{name:'PDF page'}).inputValue(),'1');

   // 2. The Pencil on the reader never inks the page.
   const inkCount=()=>surface.evaluate(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]<120&&d[i+1]<120)n++;return n;});
   const inkBefore=await inkCount();
   await reader.locator('.kd-ref-scroll').evaluate(el=>{const r=el.getBoundingClientRect();
    for(const [type,f] of [['pointerdown',.3],['pointermove',.4],['pointermove',.5],['pointerup',.5]])el.dispatchEvent(new PointerEvent(type,{pointerId:3,pointerType:'pen',isPrimary:true,bubbles:true,cancelable:true,clientX:r.left+r.width*f,clientY:r.top+r.height*f,pressure:.5,buttons:type==='pointerup'?0:1}));});
   assert.equal(await inkCount(),inkBefore,'Pencil on the PDF does not draw');

   // 3. Page jump, zoom and swap.
   await reader.getByRole('spinbutton',{name:'PDF page'}).fill('2');await reader.getByRole('spinbutton',{name:'PDF page'}).press('Enter');
   await page.waitForFunction(()=>{const s=document.querySelector('.kd-ref-scroll'),p=document.querySelector('.kd-ref-page[data-page="2"]');return Math.abs(s.scrollTop-(p.offsetTop-8))<4;});
   const slotWidth=()=>reader.locator('.kd-ref-page').first().evaluate(el=>el.getBoundingClientRect().width);
   const w0=await slotWidth();await reader.getByRole('button',{name:'Zoom in'}).click();
   assert.ok(await slotWidth()>w0*1.2,'zoom in enlarges the pages');
   await reader.getByRole('button',{name:'Zoom out'}).click();
   await reader.getByRole('button',{name:'Swap sides'}).click();
   const swapped=await reader.boundingBox();
   assert.ok(swapped.x+swapped.width>1170,'reader moves to the right');
   await reader.getByRole('button',{name:'Swap sides'}).click();

   // 4. Capture the red block from page 2 onto the page as a new layer.
   await reader.getByRole('spinbutton',{name:'PDF page'}).fill('2');await reader.getByRole('spinbutton',{name:'PDF page'}).press('Enter');
   await reader.getByRole('button',{name:'Capture a region onto the page'}).click();
   const slot2=await reader.locator('.kd-ref-page[data-page="2"]').boundingBox();
   // The red block spans x 150–450, y 300–500 (PDF points, origin bottom-left) on a 612×792 page.
   const at=(px,py)=>({x:slot2.x+slot2.width*px/612,y:slot2.y+slot2.height*(792-py)/792});
   const a=at(140,510),b=at(460,290);
   await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move((a.x+b.x)/2,(a.y+b.y)/2,{steps:4});await page.mouse.move(b.x,b.y,{steps:4});await page.mouse.up();
   await dialog.locator('.kd-status').filter({hasText:'Captured page 2'}).waitFor({timeout:15000});
   const red=await surface.evaluate(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>200&&d[i+1]<60&&d[i+2]<60)n++;return n;});
   assert.ok(red>5000,'captured red block is on the page: '+red);
   await dialog.getByRole('button',{name:'Layers'}).click();
   await dialog.getByRole('button',{name:'Select Course reader · p. 2'}).waitFor();
   // 5. The captured layer links back to its page.
   await reader.getByRole('spinbutton',{name:'PDF page'}).fill('1');await reader.getByRole('spinbutton',{name:'PDF page'}).press('Enter');
   await dialog.getByRole('button',{name:'Show page 2 of Course reader'}).click();
   await page.waitForFunction(()=>document.querySelector('.kd-ref-pageno').value==='2');

   // 6. Insert, reopen: the PDF returns at the same page, the layer keeps its link.
   await dialog.getByRole('button',{name:'Insert'}).click();
   await page.waitForFunction(()=>window.commits.length===1);
   await page.evaluate(()=>window.openSketch(window.commits[0]));await dialog.waitFor();
   await reader.locator('.kd-ref-page canvas').first().waitFor({timeout:20000});
   await page.waitForFunction(()=>document.querySelector('.kd-ref-pageno')?.value==='2');
   await dialog.getByRole('button',{name:'Layers'}).click();
   await dialog.getByRole('button',{name:'Show page 2 of Course reader'}).waitFor();

   // 7. On a phone the PDF sits above the page.
   await page.setViewportSize({width:390,height:844});
   await page.waitForTimeout(400);
   const top=await reader.boundingBox(),below=await dialog.locator('.kd-sheet').boundingBox();
   assert.ok(top.y<5&&below.y>=top.y+top.height,'stacked on a phone');
   assert.deepEqual(errors,[]);
   console.log('KEEPIT_SKETCHBOOK_SPLIT_'+engine.name().toUpperCase()+'_PASS');
  }finally{await browser.close();}
 }
 console.log('keepit-sketchbook-split passed');
}finally{await new Promise(done=>server.close(done));}
