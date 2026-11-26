// Nib sizes are real millimetres: a 1.0 mm pen draws about 1 mm on paper, 0.2 mm a
// fifth of that; each tool lists its own sizes and the choice is remembered.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {resolve,sep,extname} from 'node:path';

const {chromium,webkit}=createRequire(resolve('package.json'))('playwright');
const root=resolve('.');
const drawingPath=JSON.parse(readFileSync(resolve(root,'ops/ui/LIVE_STABILITY_MODULES.json'))).paths.drawing;
const server=createServer((req,res)=>{
 const pathname=new URL(req.url,'http://127.0.0.1').pathname;
 if(pathname==='/nibs.html'){res.writeHead(200,{'Content-Type':'text/html'}).end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body><p>Note</p></body>');return;}
 const path=resolve(root,'.'+pathname);
 if(!path.startsWith(root+sep)){res.writeHead(403).end();return;}
 try{res.writeHead(200,{'Content-Type':{'.js':'text/javascript'}[extname(path)]||'application/octet-stream'}).end(readFileSync(path));}catch{res.writeHead(404).end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin='http://127.0.0.1:'+server.address().port;
try{
 for(const engine of process.env.KEEPIT_BROWSER_ENGINE==='chromium'?[chromium]:[chromium,webkit]){
  const browser=await engine.launch({headless:true});
  try{
   const page=await browser.newPage({viewport:{width:1180,height:820}});
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto(origin+'/nibs.html');
   await page.evaluate(async path=>{localStorage.clear();window.sketch=await import('/'+path);window.commits=[];window.openSketch=blob=>window.sketch.drawNote(blob,async file=>{window.commits.push(file);});},drawingPath);
   await page.evaluate(()=>window.openSketch(null));
   const dialog=page.getByRole('dialog',{name:'Note drawing'});await dialog.waitFor();
   const surface=dialog.locator('canvas[aria-label^="Drawing surface"]');
   const pen=(type,x,y)=>surface.evaluate((c,[type,x,y])=>{const r=c.getBoundingClientRect();c.dispatchEvent(new PointerEvent(type,{pointerId:7,pointerType:'pen',isPrimary:true,bubbles:true,cancelable:true,clientX:r.left+r.width*x,clientY:r.top+r.height*y,pressure:.5,buttons:type==='pointerup'?0:1}));},[type,x,y]);
   const line=async y=>{await pen('pointerdown',.2,y);for(let i=1;i<=8;i++){await pen('pointermove',.2+.3*i/8,y);await page.waitForTimeout(16);}await pen('pointerup',.5,y);await page.waitForTimeout(60);};
   const thickness=y=>surface.evaluate((c,y)=>{const x=Math.round(c.width*.38),cy=Math.round(c.height*y),d=c.getContext('2d').getImageData(x,cy-60,1,120).data;let n=0;for(let i=0;i<120;i++)if(d[i*4]<200)n++;return n;},y);
   const ink=dialog.getByRole('button',{name:'Ink color and size'});
   await ink.click();
   const nibs=dialog.getByRole('radiogroup',{name:'Nib size'});
   assert.equal(await nibs.getByRole('radio',{checked:true}).getAttribute('aria-label'),'0.4 mm','pen starts at a 0.4 mm fineliner');
   assert.deepEqual(await nibs.getByRole('radio').evaluateAll(b=>b.map(x=>x.getAttribute('aria-label'))),['0.1 mm','0.2 mm','0.3 mm','0.4 mm','0.5 mm','0.6 mm','0.8 mm','1 mm','1.2 mm','1.4 mm','2 mm']);
   await dialog.getByRole('radio',{name:'Off',exact:true}).click();
   await nibs.getByRole('radio',{name:'1 mm',exact:true}).click();
   await page.keyboard.press('Escape');
   const pxPerMm=300/25.4;
   await line(.3);const one=await thickness(.3);
   assert.ok(one>=pxPerMm*.75&&one<=pxPerMm*1.35,'1 mm nib draws about 1 mm: '+one+' px vs '+pxPerMm.toFixed(1)+' px/mm');
   await ink.click();await nibs.getByRole('radio',{name:'0.2 mm',exact:true}).click();await page.keyboard.press('Escape');
   await line(.4);const fine=await thickness(.4);
   assert.ok(fine<=one/3&&fine>=1,'0.2 mm is a fifth of 1 mm: '+fine+' vs '+one);
   // Each tool has its own sizes and default.
   await dialog.getByRole('radio',{name:'Pencil',exact:true}).click();
   await ink.click();
   assert.equal(await nibs.getByRole('radio',{checked:true}).getAttribute('aria-label'),'0.5 mm','pencil starts at 0.5 mm lead');
   assert.equal(await nibs.getByRole('radio').count(),6);
   await page.keyboard.press('Escape');
   // Remembered next time.
   await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
   await dialog.getByRole('button',{name:'Discard changes'}).click();
   await dialog.waitFor({state:'detached'});
   await page.evaluate(()=>window.openSketch(null));await dialog.waitFor();
   await ink.click();
   assert.equal(await nibs.getByRole('radio',{checked:true}).getAttribute('aria-label'),'0.2 mm','the pen remembers 0.2 mm');
   assert.deepEqual(errors,[]);
   console.log('KEEPIT_SKETCHBOOK_NIBS_'+engine.name().toUpperCase()+'_PASS');
  }finally{await browser.close();}
 }
 console.log('keepit-sketchbook-nibs passed');
}finally{await new Promise(done=>server.close(done));}
