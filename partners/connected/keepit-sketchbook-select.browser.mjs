// Lasso selection: lift strokes and pixels on the current layer, then move,
// resize, rotate, delete or duplicate them; undo; insert an image; save and reopen.
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {resolve,sep,extname} from 'node:path';

const {chromium,webkit}=createRequire(resolve('package.json'))('playwright');
const root=resolve('.');
const drawingPath=JSON.parse(readFileSync(resolve(root,'ops/ui/LIVE_STABILITY_MODULES.json'))).paths.drawing;
const server=createServer((req,res)=>{
 const pathname=new URL(req.url,'http://127.0.0.1').pathname;
 if(pathname==='/select.html'){res.writeHead(200,{'Content-Type':'text/html'}).end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body><p>Note</p></body>');return;}
 const path=resolve(root,'.'+pathname);
 if(!path.startsWith(root+sep)){res.writeHead(403).end();return;}
 try{res.writeHead(200,{'Content-Type':{'.js':'text/javascript'}[extname(path)]||'application/octet-stream'}).end(readFileSync(path));}catch{res.writeHead(404).end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin='http://127.0.0.1:'+server.address().port;
// A solid red PNG, made here so the test needs no image files.
function redPng(w,h){
 const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
 const crc=b=>{let c=0xffffffff;for(const x of b)c=crcTable[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
 const chunk=(type,data)=>{const len=Buffer.alloc(4);len.writeUInt32BE(data.length);const td=Buffer.concat([Buffer.from(type),data]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([len,td,c]);};
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=2;
 const row=Buffer.concat([Buffer.from([0]),Buffer.alloc(w*3).fill(Buffer.from([220,30,30]))]);
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(Buffer.concat(Array(h).fill(row)))),chunk('IEND',Buffer.alloc(0))]);
}
try{
 for(const engine of process.env.KEEPIT_BROWSER_ENGINE==='chromium'?[chromium]:[chromium,webkit]){
  const browser=await engine.launch({headless:true});
  try{
   const page=await browser.newPage({viewport:{width:1180,height:1760}});
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto(origin+'/select.html');
   await page.evaluate(async path=>{localStorage.clear();window.sketch=await import('/'+path);window.commits=[];window.openSketch=blob=>window.sketch.drawNote(blob,async file=>{window.commits.push(file);});},drawingPath);
   await page.evaluate(()=>window.openSketch(null));
   const dialog=page.getByRole('dialog',{name:'Note drawing'});await dialog.waitFor();
   const surface=dialog.locator('canvas[aria-label^="Drawing surface"]');
   const box=await surface.boundingBox();
   const at=(fx,fy)=>({x:box.x+box.width*fx,y:box.y+box.height*fy});
   // Ink in a page region (fractions of the page): dark pixels, and their bounding box.
   const ink=(x0,y0,x1,y1)=>surface.evaluate((c,[x0,y0,x1,y1])=>{const X=Math.round(c.width*x0),Y=Math.round(c.height*y0),W=Math.round(c.width*(x1-x0)),H=Math.round(c.height*(y1-y0));const d=c.getContext('2d').getImageData(X,Y,W,H).data;let n=0,minX=1e9,maxX=-1,minY=1e9,maxY=-1;for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4;if(d[i]<120&&d[i+1]<120){n++;if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}}return {n,w:maxX-minX+1,h:maxY-minY+1};},[x0,y0,x1,y1]);
   const red=(x0,y0,x1,y1)=>surface.evaluate((c,[x0,y0,x1,y1])=>{const d=c.getContext('2d').getImageData(Math.round(c.width*x0),Math.round(c.height*y0),Math.round(c.width*(x1-x0)),Math.round(c.height*(y1-y0))).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>180&&d[i+1]<80&&d[i+2]<80)n++;return n;},[x0,y0,x1,y1]);
   const drawLine=async(fx0,fy0,fx1,fy1)=>{const a=at(fx0,fy0),b=at(fx1,fy1);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:12});await page.mouse.up();};
   const lassoAround=async(fx0,fy0,fx1,fy1)=>{const pts=[[fx0,fy0],[fx1,fy0],[fx1,fy1],[fx0,fy1],[fx0,fy0+.001]].map(([x,y])=>at(x,y));await page.mouse.move(pts[0].x,pts[0].y);await page.mouse.down();for(const p of pts.slice(1))await page.mouse.move(p.x,p.y,{steps:6});await page.mouse.up();};
   const selection=dialog.getByRole('group',{name:'Selection'});
   const done=()=>dialog.getByRole('button',{name:'Done',exact:true}).click();
   const dragBy=async(locator,dx,dy)=>{const b=await locator.boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:10});await page.mouse.up();};

   await drawLine(.15,.2,.35,.2);
   await drawLine(.6,.6,.8,.6);
   const left0=await ink(.1,.15,.4,.25);assert.ok(left0.n>100,'first stroke drawn');

   // 1. Lasso the first stroke and move it down.
   await dialog.getByRole('radio',{name:'Select',exact:true}).click();
   await lassoAround(.1,.15,.4,.25);
   await selection.waitFor();
   assert.equal((await ink(.1,.15,.4,.25)).n,0,'lifted ink leaves its place while floating');
   await dragBy(selection,0,box.height*.2);
   await done();await selection.waitFor({state:'hidden'});
   assert.equal((await ink(.1,.15,.4,.25)).n,0,'moved away');
   const moved=await ink(.1,.35,.4,.45);assert.ok(moved.n>100,'moved into place');
   assert.ok((await ink(.55,.55,.85,.65)).n>100,'the other stroke is untouched');

   // 2. Undo puts it back; redo moves it again.
   await dialog.getByRole('button',{name:'Undo'}).click();
   assert.ok((await ink(.1,.15,.4,.25)).n>100,'undo restores the original place');
   await dialog.getByRole('button',{name:'Redo'}).click();
   assert.ok((await ink(.1,.35,.4,.45)).n>100,'redo moves it again');

   // 3. Resize with a corner handle: ink stays a crisp vector and grows.
   await lassoAround(.1,.35,.4,.45);await selection.waitFor();
   const se=selection.getByRole('button',{name:'Resize selection'}).nth(3);
   await dragBy(se,(await selection.boundingBox()).width*.5,0);
   await done();
   const bigger=await ink(.05,.3,.6,.55);
   assert.ok(bigger.w>moved.w*1.3,'resized wider: '+moved.w+' → '+bigger.w);
   assert.ok(bigger.h>moved.h*1.2,'line weight scales with it: '+moved.h+' → '+bigger.h);

   // 4. Rotate a quarter turn: the line stands upright.
   await lassoAround(.05,.3,.6,.55);await selection.waitFor();
   const sb=await selection.boundingBox(),knob=selection.getByRole('button',{name:'Rotate selection'});
   const kb=await knob.boundingBox(),cx=sb.x+sb.width/2,cy=sb.y+sb.height/2;
   await page.mouse.move(kb.x+kb.width/2,kb.y+kb.height/2);await page.mouse.down();
   await page.mouse.move(cx+(cy-(kb.y+kb.height/2)),cy,{steps:12});await page.mouse.up();
   await done();
   const upright=await ink(0,.05,.55,.57);
   assert.ok(upright.h>upright.w*2,'rotated upright: '+upright.w+'×'+upright.h);

   // 5. Delete, then undo; duplicate.
   await lassoAround(.55,.55,.85,.65);await selection.waitFor();
   await dialog.getByRole('button',{name:'Delete',exact:true}).click();
   assert.equal((await ink(.55,.55,.85,.65)).n,0,'deleted');
   await dialog.getByRole('button',{name:'Undo'}).click();
   assert.ok((await ink(.55,.55,.85,.65)).n>100,'undo brings it back');
   await lassoAround(.55,.55,.85,.65);await selection.waitFor();
   await dialog.getByRole('button',{name:'Duplicate',exact:true}).click();
   await dragBy(selection,0,box.height*.15);await done();
   assert.ok((await ink(.55,.55,.85,.65)).n>100&&(await ink(.55,.7,.85,.85)).n>100,'original and copy');

   // 6. Undo while a selection floats cancels it.
   await lassoAround(.55,.7,.85,.85);await selection.waitFor();
   await dragBy(selection,0,-box.height*.4);
   await dialog.getByRole('button',{name:'Undo'}).click();
   await selection.waitFor({state:'hidden'});
   assert.ok((await ink(.55,.7,.85,.85)).n>100,'cancelled move leaves it where it was');

   // 7. Insert an image: it arrives selected on its own layer.
   await dialog.getByRole('button',{name:'More'}).click();
   const chooser=page.waitForEvent('filechooser');
   await page.getByRole('button',{name:'Insert image…'}).click();
   await (await chooser).setFiles({name:'swatch.png',mimeType:'image/png',buffer:redPng(400,300)});
   await selection.waitFor();
   await dragBy(selection,-box.width*.25,-box.height*.25);
   await done();
   assert.ok(await red(0,0,.6,.6)>5000,'image placed');
   await dialog.getByRole('button',{name:'Layers'}).click();
   await dialog.getByRole('button',{name:'Select swatch'}).waitFor();
   await page.keyboard.press('Escape');

   // 8. Save and reopen: everything stays where it was put.
   const redBefore=await red(0,0,1,1),inkBefore=await ink(0,0,1,1);
   await dialog.getByRole('button',{name:'Insert'}).click();
   await page.waitForFunction(()=>window.commits.length===1);
   await page.evaluate(()=>window.openSketch(window.commits[0]));await dialog.waitFor();
   await page.waitForTimeout(300);
   assert.ok(Math.abs(await red(0,0,1,1)-redBefore)<redBefore*.05,'image kept');
   assert.ok(Math.abs((await ink(0,0,1,1)).n-inkBefore.n)<inkBefore.n*.1,'ink kept');
   assert.deepEqual(errors,[]);
   console.log('KEEPIT_SKETCHBOOK_SELECT_'+engine.name().toUpperCase()+'_PASS');
  }finally{await browser.close();}
 }
 console.log('keepit-sketchbook-select passed');
}finally{await new Promise(done=>server.close(done));}
