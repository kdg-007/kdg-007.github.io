// Apple Pencil capture regression: back-to-back pen strokes are never lost
// (even after a missed lift), pressure changes line weight and pencil softness,
// opacity is exact, and a straight line previews and commits. Synthetic pointer
// events only.
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
 if(pathname==='/pen.html'){res.writeHead(200,{'Content-Type':'text/html'}).end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body><p>Note</p></body>');return;}
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
   await page.goto(origin+'/pen.html');
   await page.evaluate(async path=>{window.sketch=await import('/'+path);window.commits=[];window.openSketch=blob=>window.sketch.drawNote(blob,async file=>{window.commits.push(file);});},drawingPath);
   await page.evaluate(()=>window.openSketch(null));
   const dialog=page.getByRole('dialog',{name:'Note drawing'});await dialog.waitFor();
   // Dispatches Pencil-style pointer events straight onto the canvas.
   const pen=(type,x,y,pressure,extra={})=>dialog.locator('canvas[aria-label^="Drawing surface"]').evaluate((c,[type,x,y,pressure,extra])=>{
    const r=c.getBoundingClientRect();
    c.dispatchEvent(new PointerEvent(type,{pointerId:7,pointerType:'pen',isPrimary:true,bubbles:true,cancelable:true,clientX:r.left+r.width*x,clientY:r.top+r.height*y,pressure,buttons:type==='pointerup'||type==='pointercancel'?0:1,...extra}));
   },[type,x,y,pressure,extra]);
   const line=async(y,pressure,{lift=true,x0=.2,x1=.5}={})=>{await pen('pointerdown',x0,y,pressure);for(let i=1;i<=6;i++)await pen('pointermove',x0+(x1-x0)*i/6,y,pressure);if(lift)await pen('pointerup',x1,y,pressure);};
   const surface=dialog.locator('canvas[aria-label^="Drawing surface"]');
   const darkest=(y)=>surface.evaluate((c,y)=>{const r=c.getContext('2d').getImageData(Math.round(c.width*.375),Math.round(c.height*y)-30,1,60).data;let m=255;for(let i=0;i<r.length;i+=4)m=Math.min(m,r[i]);return Math.round((255-m)/(255-23)*255);},y);
   const thickness=(y)=>surface.evaluate((c,y)=>{const x=Math.round(c.width*.35),cy=Math.round(c.height*y),d=c.getContext('2d').getImageData(x,cy-60,1,120).data;let n=0;for(let i=0;i<120;i++)if(d[i*4]<200)n++;return n;},y);

   // 1. Pressure: harder presses draw a thicker line, and Off ignores pressure.
   await line(.2,.05);await line(.3,.3);await line(.4,.8);
   const [light,mid,hard]=[await thickness(.2),await thickness(.3),await thickness(.4)];
   assert.ok(light<mid&&mid<hard,'line weight follows pen pressure: '+[light,mid,hard]);
   await dialog.getByRole('button',{name:'Ink color and size'}).click();
   await dialog.getByRole('radio',{name:'Off',exact:true}).click();
   await page.keyboard.press('Escape');
   await line(.5,.05);await line(.6,.8);
   assert.ok(Math.abs(await thickness(.5)-await thickness(.6))<=2,'Pressure Off gives an even line');
   await dialog.getByRole('button',{name:'Ink color and size'}).click();
   await dialog.getByRole('radio',{name:'Normal',exact:true}).click();
   await page.keyboard.press('Escape');

   // 2. Nothing is dropped: each contact below begins while the previous one
   // never lifted (a missed pointerup), and one is cancelled mid-way.
   await dialog.getByRole('button',{name:'Undo',exact:true}).click({clickCount:1});for(let i=0;i<4;i++)await dialog.getByRole('button',{name:'Undo',exact:true}).click();
   for(let i=0;i<3;i++)await dialog.getByRole('button',{name:'Undo',exact:true}).click().catch(()=>{});
   await line(.15,.4,{lift:false});
   await line(.25,.4,{lift:false});                 // previous lift was lost
   await pen('pointerdown',.2,.35,.4);await pen('pointermove',.4,.35,.4);await pen('pointercancel',.4,.35,.4);
   await line(.45,.4);
   const saved=await dialog.getByRole('button',{name:'More',exact:true}).click().then(()=>dialog.getByRole('button',{name:'Pen check'}).click()).then(()=>dialog.locator('[class~="kd-status"]').textContent());
   assert.match(saved,/replaced/);assert.match(saved,/pressure 0\.\d+–0\.\d+/);
   for(const y of [.15,.25,.35,.45])assert.ok(await thickness(y)>0,'stroke at y='+y+' was kept');

   // 3. Translucent tools are even: Pencil at 50% has the same opacity along its
   // whole length (no dots at the pen samples), however densely the pen reports.
   await dialog.getByRole('radio',{name:'Highlighter',exact:true}).click();
   await dialog.getByRole('button',{name:'Ink color and size'}).click();
   await dialog.getByLabel('Opacity',{exact:true}).fill('0.5');await page.keyboard.press('Escape');
   await pen('pointerdown',.2,.7,.6);
   for(let i=1;i<=90;i++)await pen('pointermove',.2+.3*i/90+(i%2?.0004:-.0004),.7,.6);
   await pen('pointerup',.5,.7,.6);
   const levels=await surface.evaluate(c=>{const g=c.getContext('2d'),y=Math.round(c.height*.7),out=[];for(let x=Math.round(c.width*.23);x<c.width*.47;x+=7){const d=g.getImageData(x,y,1,1).data;out.push(d[0]);}return out;});
   assert.ok(Math.max(...levels)-Math.min(...levels)<=6,'even opacity along the stroke: '+Math.min(...levels)+'-'+Math.max(...levels));
   assert.ok(Math.abs((255-levels[0])/(255-23)-.5)<.06,'highlighter at 50% is 50%: '+levels[0]);
   // Marker as well, and an overlapping second stroke builds up like real marker.
   await dialog.getByRole('radio',{name:'Marker',exact:true}).click();
   await dialog.getByRole('button',{name:'Ink color and size'}).click();
   await dialog.getByLabel('Opacity',{exact:true}).fill('0.5');await page.keyboard.press('Escape');
   await pen('pointerdown',.2,.8,.6);
   for(let i=1;i<=90;i++)await pen('pointermove',.2+.3*i/90,.8,.6);
   await pen('pointerup',.5,.8,.6);
   const marker=await surface.evaluate(c=>{const g=c.getContext('2d'),y=Math.round(c.height*.8),out=[];for(let x=Math.round(c.width*.23);x<c.width*.47;x+=5)out.push(g.getImageData(x,y,1,1).data[0]);return out;});
   assert.ok(Math.max(...marker)-Math.min(...marker)<=6,'marker is even: '+Math.min(...marker)+'-'+Math.max(...marker));

   // Pencil behaves like graphite on paper: light pressure leaves a sparse grainy
   // line, heavy pressure fills the paper's tooth; tilting lays down wide shading.
   await dialog.getByRole('radio',{name:'Pencil',exact:true}).click();
   await dialog.getByRole('button',{name:'Ink color and size'}).click();
   await dialog.getByLabel('Opacity',{exact:true}).fill('1');await page.keyboard.press('Escape');
   const coverage=(y)=>surface.evaluate((c,y)=>{const g=c.getContext('2d'),cy=Math.round(c.height*y),x0=Math.round(c.width*.25),w=Math.round(c.width*.2),d=g.getImageData(x0,cy-50,w,100).data;let dark=0,n=0;for(let i=0;i<d.length;i+=4){n++;if(d[i]<150)dark++;}return dark/n;},y);
   const pencilLine=async(y,pressure,extra={})=>{await pen('pointerdown',.2,y,pressure,extra);for(let i=1;i<=60;i++)await pen('pointermove',.2+.3*i/60,y,pressure,extra);await pen('pointerup',.5,y,pressure,extra);};
   for(const p of [.05,.3,.9,.9])await pencilLine(.55+.0*p,p); // warm up the pressure range
   await dialog.getByRole('button',{name:'Undo',exact:true}).click();await dialog.getByRole('button',{name:'Undo',exact:true}).click();await dialog.getByRole('button',{name:'Undo',exact:true}).click();await dialog.getByRole('button',{name:'Undo',exact:true}).click();
   await pencilLine(.56,.04);await pencilLine(.62,.95);
   const [faintCover,heavyCover]=[await coverage(.56),await coverage(.62)];
   assert.ok(heavyCover>faintCover*1.8,'harder pencil pressure fills more paper tooth: '+faintCover+' < '+heavyCover);
   assert.ok(faintCover>0&&heavyCover<.97,'pencil line is grainy, not solid or empty: '+faintCover+', '+heavyCover);
   const band=(y)=>surface.evaluate((c,y)=>{const g=c.getContext('2d'),x=Math.round(c.width*.35),cy=Math.round(c.height*y),d=g.getImageData(x,cy-80,1,160).data;let n=0;for(let i=0;i<160;i++)if(d[i*4]<200)n++;return n;},y);
   await pencilLine(.66,.5,{tiltX:10,tiltY:60});
   await pencilLine(.76,.5);
   const [wide,thin2]=[await band(.66),await band(.76)];
   assert.ok(wide>thin2*2,'a tilted pencil shades wider: '+thin2+' vs '+wide);
   // 3b. The page keeps up: a stroke whose pen events arrive faster than frames
   // is still captured completely.
   await dialog.getByRole('radio',{name:'Pen',exact:true}).click();
   await pen('pointerdown',.1,.95,.5);
   for(let i=1;i<=400;i++)await pen('pointermove',.1+.8*i/400,.95+Math.sin(i/9)*.01,.5);
   await pen('pointerup',.9,.95,.5);
   const kept=await dialog.getByRole('button',{name:'More',exact:true}).click().then(()=>dialog.getByRole('button',{name:'Pen check'}).click()).then(()=>dialog.locator('[class~="kd-status"]').textContent());
   assert.match(kept,/errors 0/);
   const ends=await surface.evaluate(c=>{const g=c.getContext('2d'),y=Math.round(c.height*.95);const dark=x=>{const d=g.getImageData(x,y-40,1,80).data;let m=255;for(let i=0;i<d.length;i+=4)m=Math.min(m,d[i]);return m<120;};return [dark(Math.round(c.width*.12)),dark(Math.round(c.width*.88))];});
   assert.deepEqual(ends,[true,true],'both ends of a fast stroke are drawn');

   // 4. Straight line previews while dragging and commits on release.
   await dialog.getByRole('radio',{name:'Straight line',exact:true}).click();
   await pen('pointerdown',.2,.9,.5);await pen('pointermove',.5,.9,.5);await page.waitForTimeout(150);
   assert.ok(await thickness(.9)>0,'preview is visible before release');
   await pen('pointerup',.5,.9,.5);await page.waitForTimeout(150);
   assert.ok(await thickness(.9)>0,'line stays after release');

   // 4b. Fallback: a stylus touch that never produced pointer events is drawn from touch events.
   await dialog.getByRole('radio',{name:'Pen',exact:true}).click();
   const before=await surface.evaluate(c=>{const g=c.getContext('2d'),d=g.getImageData(0,Math.round(c.height*.1)-40,c.width,80).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]<120)n++;return n;});
   await surface.evaluate(async c=>{
    const r=c.getBoundingClientRect(),mk=(x,y)=>{const t=new Touch({identifier:9,target:c,clientX:r.left+r.width*x,clientY:r.top+r.height*y,force:.4});Object.defineProperty(t,'touchType',{value:'stylus'});return t;};
    const fire=(type,t)=>c.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,changedTouches:[t],touches:type==='touchend'?[]:[t],targetTouches:type==='touchend'?[]:[t]}));
    fire('touchstart',mk(.3,.1));await new Promise(r=>setTimeout(r,5));
    for(let i=1;i<=20;i++){fire('touchmove',mk(.3+.3*i/20,.1));await new Promise(r=>setTimeout(r,8));}
    fire('touchend',mk(.6,.1));await new Promise(r=>setTimeout(r,120));
   });
   const after=await surface.evaluate(c=>{const g=c.getContext('2d'),d=g.getImageData(0,Math.round(c.height*.1)-40,c.width,80).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]<120)n++;return n;});
   assert.ok(after>before+200,'stylus touch without pointer events still draws: '+before+' -> '+after);
   // 4c. A Pencil touch on a panel, button or the ruler never draws on the paper behind it.
   const ink=()=>surface.evaluate(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]<120)n++;return n;});
   const inkBefore=await ink();
   await dialog.evaluate(async d=>{
    const c=d.querySelector('canvas'),r=c.getBoundingClientRect(),targets=[d.querySelector('button'),d.querySelector('[data-ruler]')].filter(Boolean);
    for(const target of targets){
     const mk=x=>{const t=new Touch({identifier:21,target,clientX:r.left+r.width*x,clientY:r.top+r.height*.5,force:.4});Object.defineProperty(t,'touchType',{value:'stylus'});return t;};
     const fire=(type,t)=>target.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,changedTouches:[t],touches:type==='touchend'?[]:[t],targetTouches:type==='touchend'?[]:[t]}));
     fire('touchstart',mk(.3));for(let i=1;i<=10;i++){fire('touchmove',mk(.3+.03*i));await new Promise(z=>setTimeout(z,8));}
     fire('touchend',mk(.6));await new Promise(z=>setTimeout(z,120));
    }
   });
   assert.equal(await ink(),inkBefore,'Pencil touches on controls must not draw');
   // 5. Palette is pastel: ink first, then soft tones.
   await dialog.getByRole('button',{name:'Ink color and size'}).click();
   const colours=await dialog.locator('.kd-swatches button').evaluateAll(b=>b.map(x=>x.dataset.color));
   assert.equal(colours[0],'#173449');assert.equal(colours.length,12);
   assert.deepEqual(errors,[]);
   await page.close();
  }finally{await browser.close();}
 }
 console.log('keepit-sketchbook-pen passed');
}finally{server.close();}
