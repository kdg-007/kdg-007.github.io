// KI-010/KI-011 sketchbook regression: full-screen layout, icon controls and
// lossless round trip of the editable stroke payload (layers, visibility,
// order, paper) through insert and revision. Synthetic data only.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {resolve,sep,extname} from 'node:path';

const {chromium,webkit}=createRequire(resolve('package.json'))('playwright');
const root=resolve('.');
const modules=JSON.parse(readFileSync(resolve(root,'ops/ui/LIVE_STABILITY_MODULES.json')));
const drawingPath=modules.paths.drawing;
const server=createServer((req,res)=>{
 const pathname=new URL(req.url,'http://127.0.0.1').pathname;
 if(pathname==='/sketchbook.html'){res.writeHead(200,{'Content-Type':'text/html'}).end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body><p>Note</p></body>');return;}
 const path=resolve(root,'.'+pathname);
 if(!path.startsWith(root+sep)){res.writeHead(403).end();return;}
 try{
  const mime={'.js':'text/javascript','.png':'image/png'};
  res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream'}).end(readFileSync(path));
 }catch{res.writeHead(404).end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin='http://127.0.0.1:'+server.address().port;
async function stroke(page,dialog,from,to){
 const box=await dialog.locator('canvas[aria-label^="Drawing surface"]').boundingBox();
 await page.mouse.move(box.x+box.width*from[0],box.y+box.height*from[1]);
 await page.mouse.down();
 await page.mouse.move(box.x+box.width*to[0],box.y+box.height*to[1],{steps:5});
 await page.mouse.up();
}
try{
 for(const engine of process.env.KEEPIT_BROWSER_ENGINE==='chromium'?[chromium]:[chromium,webkit]){
  const browser=await engine.launch({headless:true});
  try{
   for(const viewport of [{width:1180,height:820},{width:390,height:844}]){
    const page=await browser.newPage({viewport});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin+'/sketchbook.html');
    await page.evaluate(async path=>{
     window.sketch=await import('/'+path);
     window.commits=[];
     window.openSketch=blob=>window.sketch.drawNote(blob,async file=>{window.commits.push(file);});
    },drawingPath);
    // New drawing: the canvas uses the full viewport behind floating controls.
    await page.evaluate(()=>window.openSketch(null));
    const dialog=page.getByRole('dialog',{name:'Note drawing'});
    await dialog.waitFor();
    const geometry=await dialog.evaluate(d=>{const r=d.getBoundingClientRect(),c=d.querySelector('canvas').getBoundingClientRect();return {w:r.width,h:r.height,canvas:c.width,vw:innerWidth,vh:innerHeight};});
    assert.equal(Math.round(geometry.w),geometry.vw);assert.equal(Math.round(geometry.h),geometry.vh);
    assert.ok(geometry.canvas>=geometry.vw-40,'page uses the available width');
    // Every control is an accessible, labelled button of touch size.
    for(const name of ['Cancel','Undo','Redo','Layers','Paper','Ruler','Full screen','More','Insert drawing','Pen','Pencil','Marker','Highlighter','Straight line','Eraser','Ink color and size']){
     const control=dialog.getByRole(['Pen','Pencil','Marker','Highlighter','Straight line','Eraser'].includes(name)?'radio':'button',{name,exact:true});
     const box=await control.boundingBox();
     assert.ok(box&&box.width>=44&&box.height>=44,name+' is a 44px touch target');
    }
    // Per-tool settings: highlighter opacity does not leak into the pen.
    await dialog.getByRole('radio',{name:'Highlighter',exact:true}).click();
    await dialog.getByRole('button',{name:'Ink color and size'}).click();
    assert.equal(await dialog.getByLabel('Opacity').inputValue(),'0.22');
    await dialog.getByRole('radio',{name:'Pen',exact:true}).click({force:true});
    assert.equal(await dialog.getByLabel('Opacity').inputValue(),'1');
    await dialog.getByRole('button',{name:'Ink color and size'}).click();
    await dialog.getByLabel('Hex ink color').fill('#2e7bd6');
    await page.keyboard.press('Escape');
    assert.equal(await dialog.getByRole('dialog',{name:'Ink'}).isHidden(),true,'Escape closes the popover first');
    await stroke(page,dialog,[.2,.05],[.6,.08]);
    // Second layer, drawn on, then hidden and moved below layer 1.
    await dialog.getByRole('button',{name:'Layers',exact:true}).click();
    await dialog.getByRole('button',{name:'Add layer'}).click();
    await page.keyboard.press('Escape');
    await stroke(page,dialog,[.3,.1],[.7,.12]);
    await dialog.getByRole('button',{name:'Layers',exact:true}).click();
    await dialog.getByRole('button',{name:'Lower layer'}).click();
    await dialog.getByRole('button',{name:'Hide Layer 2'}).click();
    await page.keyboard.press('Escape');
    // Keyboard undo/redo scoped to the sketchbook.
    await page.keyboard.press('Control+z');
    assert.equal(await dialog.getByRole('button',{name:'Redo'}).isEnabled(),true);
    await page.keyboard.press('Control+Shift+z');
    // Full screen toggles the immersive layout (native fullscreen where allowed).
    await dialog.getByRole('button',{name:'Full screen'}).click();
    assert.equal(await dialog.evaluate(d=>d.classList.contains('kd-immersive')),true);
    await dialog.getByRole('button',{name:'Exit full screen'}).click();
    assert.equal(await dialog.evaluate(d=>d.classList.contains('kd-immersive')),false);
    // Cancel with changes asks; "Keep drawing" returns without losing ink.
    await dialog.getByRole('button',{name:'Cancel'}).click();
    await page.getByRole('alertdialog',{name:'Unsaved drawing'}).getByRole('button',{name:'Keep drawing'}).click();
    await dialog.getByRole('button',{name:'Insert drawing'}).click();
    await dialog.waitFor({state:'detached'});
    const first=await page.evaluate(async()=>{
     const page=await window.sketch.readPage(window.commits[0]);
     return {layers:page.layers,strokes:page.strokes.map(s=>({layer:s.layer,color:s.color,opacity:s.opacity,tool:s.tool,points:s.points.length})),mm:page.mm,size:page.size};
    });
    assert.deepEqual(first.layers,[{id:1,name:'Layer 2',visible:false},{id:0,name:'Layer 1',visible:true}]);
    assert.equal(first.strokes.length,2);
    assert.deepEqual(first.strokes.map(s=>[s.layer,s.color,s.opacity,s.tool]),[[0,'#2e7bd6',1,'Pen'],[1,'#2e7bd6',1,'Pen']]);
    assert.deepEqual([first.mm,first.size],[[210,297],'A4']);
    // Revision: reopen, change nothing, update: payload is identical.
    await page.evaluate(()=>window.openSketch(window.commits[0]));
    await dialog.waitFor();
    assert.equal(await dialog.getByRole('button',{name:'Update drawing'}).isVisible(),true);
    await dialog.getByRole('button',{name:'Cancel'}).click();
    await dialog.waitFor({state:'detached'});
    assert.equal(await page.evaluate(()=>window.commits.length),1,'unchanged revision closes without asking or saving');
    await page.evaluate(()=>window.openSketch(window.commits[0]));
    await dialog.getByRole('button',{name:'Update drawing'}).click();
    await dialog.waitFor({state:'detached'});
    const same=await page.evaluate(async()=>{
     const [a,b]=await Promise.all(window.commits.map(f=>window.sketch.readPage(f)));
     return JSON.stringify({l:a.layers,s:a.strokes,m:a.mm})===JSON.stringify({l:b.layers,s:b.strokes,m:b.mm});
    });
    assert.equal(same,true,'editable stroke payload survives revision unchanged');
    // Discarding a revision keeps the original untouched.
    await page.evaluate(()=>window.openSketch(window.commits[0]));
    await stroke(page,dialog,[.2,.2],[.4,.25]);
    await dialog.getByRole('button',{name:'Cancel'}).click();
    await page.getByRole('alertdialog',{name:'Unsaved drawing'}).getByRole('button',{name:'Discard changes'}).click();
    await dialog.waitFor({state:'detached'});
    assert.equal(await page.evaluate(()=>window.commits.length),2);
    // Legacy raster PNG (no editable chunk) still opens as a background.
    await page.evaluate(async()=>window.openSketch(await (await fetch('/fixtures/synthetic-source.png')).blob()));
    await dialog.waitFor();
    await dialog.getByRole('button',{name:'Paper',exact:true}).click();
    assert.equal(await dialog.getByLabel('Paper size').inputValue(),'Custom');
    await page.keyboard.press('Escape');
    await dialog.getByRole('button',{name:'Cancel'}).click();
    await dialog.waitFor({state:'detached'});
    assert.deepEqual(errors,[]);
    console.log('KEEPIT_SKETCHBOOK_'+viewport.width+'_'+engine.name().toUpperCase()+'_PASS');
    await page.close();
   }
  }finally{await browser.close();}
 }
}finally{server.close();}
