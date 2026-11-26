// Paper guides: one tap cycles Plain, Ruled, Grid and Dots; spacing changes the
// pitch; turning off "Include guides in the note" leaves them out of the insert.
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
 if(pathname==='/guides.html'){res.writeHead(200,{'Content-Type':'text/html'}).end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body><p>Note</p></body>');return;}
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
   await page.goto(origin+'/guides.html');
   await page.evaluate(async path=>{window.sketch=await import('/'+path);window.commits=[];window.openSketch=blob=>window.sketch.drawNote(blob,async file=>{window.commits.push(file);});},drawingPath);
   await page.evaluate(()=>window.openSketch(null));
   const dialog=page.getByRole('dialog',{name:'Note drawing'});await dialog.waitFor();
   const surface=dialog.locator('canvas[aria-label^="Drawing surface"]');
   // Guide pixels in a band across the middle of the page (light blue, not white).
   const guidePixels=()=>surface.evaluate(c=>{const d=c.getContext('2d').getImageData(0,Math.round(c.height*.45),c.width,Math.round(c.height*.1)).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]<235&&d[i+2]>d[i])n++;return n;});
   const button=()=>dialog.locator('button[aria-label^="Guides:"]');
   assert.equal(await button().getAttribute('aria-label'),'Guides: Plain');
   assert.equal(await guidePixels(),0,'plain paper has no guides');
   const seen={};
   for(const name of ['Ruled','Grid','Dots']){
    await button().click();
    assert.equal(await button().getAttribute('aria-label'),'Guides: '+name);
    seen[name]=await guidePixels();
    assert.ok(seen[name]>0,name+' guides are drawn');
   }
   assert.ok(seen.Grid>seen.Ruled,'grid adds vertical lines: '+JSON.stringify(seen));
   assert.ok(seen.Dots<seen.Ruled,'dots are lighter than lines: '+JSON.stringify(seen));
   // Spacing: Wide dots are sparser than Narrow.
   await dialog.getByRole('button',{name:'Paper',exact:true}).click();
   const spacing=dialog.getByRole('combobox',{name:'Guide spacing'});
   await spacing.selectOption('Narrow');const narrow=await guidePixels();
   await spacing.selectOption('Wide');const wide=await guidePixels();
   assert.ok(narrow>wide*1.5,'narrow spacing is denser: '+narrow+' vs '+wide);
   // Guides off in the insert, still visible while drawing.
   await dialog.getByRole('checkbox',{name:'Include guides in the note'}).uncheck();
   await page.keyboard.press('Escape');
   assert.ok(await guidePixels()>0,'guides stay visible while drawing');
   await dialog.getByRole('button',{name:'Insert'}).click();
   await page.waitForFunction(()=>window.commits.length===1);
   const inserted=await page.evaluate(async()=>{const bitmap=await createImageBitmap(window.commits[0]);const c=new OffscreenCanvas(bitmap.width,bitmap.height),x=c.getContext('2d');x.drawImage(bitmap,0,0);const d=x.getImageData(0,Math.round(c.height*.45),c.width,Math.round(c.height*.1)).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]<235&&d[i+2]>d[i])n++;return n;});
   assert.equal(inserted,0,'guides left out of the inserted page');
   // Reopening keeps the guide settings.
   await page.evaluate(()=>window.openSketch(window.commits[0]));await dialog.waitFor();
   assert.equal(await button().getAttribute('aria-label'),'Guides: Dots');
   await dialog.getByRole('button',{name:'Paper',exact:true}).click();
   assert.equal(await dialog.getByRole('combobox',{name:'Guide spacing'}).inputValue(),'Wide');
   assert.equal(await dialog.getByRole('checkbox',{name:'Include guides in the note'}).isChecked(),false);
   assert.deepEqual(errors,[]);
   console.log('KEEPIT_SKETCHBOOK_GUIDES_'+engine.name().toUpperCase()+'_PASS');
  }finally{await browser.close();}
 }
 console.log('keepit-sketchbook-guides passed');
}finally{await new Promise(done=>server.close(done));}
