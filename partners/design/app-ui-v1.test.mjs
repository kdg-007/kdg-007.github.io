// Presentation-only browser regression. Disposable HTTPS and no real user data.
import assert from 'node:assert/strict';
import {createServer} from 'node:https';
import {execFileSync} from 'node:child_process';
import {mkdirSync,mkdtempSync,readFileSync,rmSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,extname,sep} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(resolve(process.cwd(),'package.json'));
const {chromium,webkit}=require('playwright');
const root=resolve('.'),tmp=mkdtempSync(join(tmpdir(),'app-ui-v1-'));
const screenshots=resolve('appearance-qa');
mkdirSync(screenshots,{recursive:true});
const key=join(tmp,'key.pem'),cert=join(tmp,'cert.pem');
execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes',
 '-keyout',key,'-out',cert,'-days','1','-subj','/CN=127.0.0.1',
 '-addext','subjectAltName=IP:127.0.0.1'],{stdio:'ignore'});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
 '.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
 '.svg':'image/svg+xml','.png':'image/png','.json':'application/json',
 '.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
const server=createServer({key:readFileSync(key),cert:readFileSync(cert)},(req,res)=>{
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'https://127.0.0.1').pathname);}
 catch{res.writeHead(400);res.end();return;}
 const p=resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
 if(!p.startsWith(root+sep)){res.writeHead(403);res.end();return;}
 try{if(!statSync(p).isFile())throw Error('Not file');
  res.writeHead(200,{'Content-Type':mime[extname(p)]||'application/octet-stream','Cache-Control':'no-store'});
  res.end(readFileSync(p));
 }catch{res.writeHead(404);res.end('Not found');}
});
const screens=[
 {app:'liveit',path:'/partners/liveit/thinkit/c15396ee7cd1cba9b5e5/index.html',
  selector:'.app-shell',token:'--ground',expected:'#e9dfcb'},
 {app:'liveit',path:'/partners/liveit/thinkit/connected-w18e-c15396/index.html',
  selector:'.app-shell',token:'--ground',expected:'#e9dfcb'},
 {app:'thinkit',path:'/thinkit/index.html',
  selector:'#app .topbar',token:'--paper',expected:'#e9dfcb',onBody:true},
 {app:'travelit',path:'/partners/travelit/thinkit/afda98f5ced9406d0fe5/index.html',
  selector:'#app .topbar',token:'--paper',expected:'#e9dfcb'}
];
const layouts=[
 {name:'iphone',width:393,height:852,device:'iPhone'},
 {name:'ipad_mini_portrait',width:744,height:1133,device:'iPad'},
 {name:'ipad_mini_landscape',width:1133,height:744,device:'iPad'},
 {name:'macbook',width:1440,height:900}
];
const workspaces=[
 {id:'keepit',label:'KeepIt',content:page=>page.getByRole('heading',{name:'Library',exact:true})},
 {id:'thinkit',label:'ThinkIt',content:page=>page.frameLocator('iframe[title="ThinkIt diagramming and Mind Map workspace"]').locator('#diStartScreen')},
 {id:'travelit',label:'TravelIt',content:page=>page.frameLocator('iframe[title="TravelIt trip planning workspace"]').locator('#app .topbar')}
];

async function checkLauncher(browser,origin,layout){
 const context=await browser.newContext({ignoreHTTPSErrors:true,serviceWorkers:'block',
  viewport:{width:layout.width,height:layout.height},isMobile:!!layout.device,hasTouch:!!layout.device,
  userAgent:layout.device?`Mozilla/5.0 (${layout.device}; CPU OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1`:undefined});
 const entry='/partners/connected/?connected-app=';
 const bar=page=>page.locator('.connected-shell-bar');
 const open=async link=>{
  const [page]=await Promise.all([context.waitForEvent('page',{timeout:15000}),link.click()]);
  return page;
 };
 async function checkMenu(page,label){
  const shell=bar(page);
  assert.equal(await shell.locator('.connected-shell-current').innerText({timeout:15000}),label);
  await shell.getByRole('button',{name:/Apps/}).click();
  const menu=shell.locator('#connected-apps-list');
  const bounds=await menu.boundingBox();
  assert.ok(bounds && bounds.x>=0 && bounds.y>=0 && bounds.x+bounds.width<=layout.width &&
   bounds.y+bounds.height<=layout.height,layout.name+' '+label+' menu exceeds its viewport');
  return menu;
 }
 try{
  await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'
   ?route.continue():route.abort());
  const home=await context.newPage();
  await home.goto(origin+entry+'liveit',{waitUntil:'domcontentloaded'});
  await home.frameLocator('iframe[title="LiveIt journal workspace"]').locator('#app .app-shell')
   .waitFor({state:'visible',timeout:20000});
  if(layout.name==='macbook'){
   const live=home.frameLocator('iframe[title="LiveIt journal workspace"]');
   // Exercise the actual in-app launcher as well as the outer shared menu.
   await live.locator('#liveit-apps-button').click();
   const trip=await open(live.locator('#liveit-app-switcher a[data-app="travelit"]'));
   await trip.frameLocator('iframe[title="TravelIt trip planning workspace"]').locator('#app .topbar')
    .waitFor({state:'visible',timeout:20000});
   await trip.close();
   await live.locator('#liveit-apps-button').press('Escape');
   console.log('LIVEIT_INTERNAL_TRAVELIT_LAUNCH_'+browser.browserType().name().toUpperCase()+'_PASS');
  }
  for(const workspace of workspaces){
   const menu=await checkMenu(home,'Today');
   const page=await open(menu.locator('a[href="'+entry+workspace.id+'"]'));
   await workspace.content(page).waitFor({state:'visible',timeout:20000});
   if(workspace.id==='keepit'){
    await page.waitForFunction(()=>document.querySelector('#result-count')?.textContent?.includes('items'),null,{timeout:15000});
   }
   assert.equal(await page.locator('html').getAttribute('data-app-scheme'),'journal');
   if(layout.name==='macbook'&&browser.browserType().name()==='chromium'){
    await page.screenshot({path:join(screenshots,workspace.id+'-journal.png')});
   }
   await checkMenu(page,workspace.label);
   const returned=await open(bar(page).getByRole('link',{name:'LiveIt',exact:true}));
   assert.equal(await bar(returned).locator('.connected-shell-current').innerText({timeout:15000}),'Today');
   await returned.close();
   await page.close();
   await menu.locator('a[aria-current="page"]').press('Escape');
   await menu.waitFor({state:'hidden'});
  }
  if(layout.name==='macbook'){
   const mirror=await context.newPage();
   await mirror.goto(origin+'/partners/connected/?connected-app=keepit',{waitUntil:'domcontentloaded'});
   await home.getByRole('button',{name:'Appearance',exact:true}).click();
   const preference=home.getByLabel('Color scheme',{exact:true});
   const frame=home.frameLocator('iframe[title="LiveIt journal workspace"]');
   for(const value of ['midnight','linen','lavender','forest','journal']){
    await preference.selectOption(value);
    await frame.locator('html[data-app-scheme="'+value+'"]').waitFor({state:'attached'});
    await mirror.locator('html[data-app-scheme="'+value+'"]').waitFor({state:'attached'});
    assert.equal(await home.locator('html').getAttribute('data-app-scheme'),value);
   }
   await home.getByRole('button',{name:'Done',exact:true}).click();
   await mirror.close();
   const address=home.url();
   await home.close();
   const reopened=await context.newPage();
   await reopened.goto(address,{waitUntil:'domcontentloaded'});
   await reopened.frameLocator('iframe[title="LiveIt journal workspace"]').locator('#app .app-shell')
    .waitFor({state:'visible',timeout:20000});
   assert.equal(await reopened.locator('html').getAttribute('data-app-scheme'),'journal');
   if(browser.browserType().name()==='chromium')await reopened.screenshot({path:join(screenshots,'liveit-journal.png')});
   console.log('SHARED_APPEARANCE_SYNC_AND_REOPEN_'+browser.browserType().name().toUpperCase()+'_PASS');
  }
  console.log('CONNECTED_LAUNCHER_'+layout.name.toUpperCase()+'_'+browser.browserType().name().toUpperCase()+'_PASS');
 }finally{await context.close();}
}

let browser;
try {
 await new Promise((ok,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',ok);});
 const origin='https://127.0.0.1:'+server.address().port;
 for(const engine of [chromium,webkit]){
  browser=await engine.launch({headless:true});
  const ctx=await browser.newContext({ignoreHTTPSErrors:true,
    viewport:{width:1180,height:820},serviceWorkers:'block'});
  await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'
    ?r.continue():r.abort());
  try{
   for(const entry of screens){
    const page=await ctx.newPage();
    await page.goto(origin+entry.path,{waitUntil:'domcontentloaded'});
    await page.locator(entry.selector).waitFor({state:'visible',timeout:30000});
    assert.equal(await page.locator('html').getAttribute('data-suite-app'),entry.app);
    const palette=await page.evaluate(onBody=>getComputedStyle(onBody?document.body:
      document.documentElement).getPropertyValue(onBody?'--paper':
      document.documentElement.dataset.suiteApp==='liveit'?'--ground':'--paper').trim(),
      !!entry.onBody);
    assert.equal(palette,entry.expected,entry.app+' token mismatch');
    const loaded=await page.evaluate(()=>[...document.styleSheets].some(x=>
      x.href?.includes('/partners/design/app-family-v1.css')));
    assert.ok(loaded,'Shared CSS must load in '+entry.app);
    console.log('SHARED_APP_UI_V1_'+entry.app.toUpperCase()+'_'+engine.name().toUpperCase()+'_PASS');
    await page.close();
   }
   const page=await ctx.newPage();
   await page.goto(origin+'/partners/connected/',{waitUntil:'domcontentloaded'});
   await page.locator('#connected-apps-toggle').waitFor({state:'visible',timeout:30000});
   const colors=await page.evaluate(()=>getComputedStyle(document.documentElement)
      .getPropertyValue('--suite-navy-900').trim());
   assert.equal(colors,'#102d40','Connected KeepIt did not receive suite tokens');
   console.log('SHARED_APP_UI_V1_KEEPIT_CONNECTED_'+engine.name().toUpperCase()+'_PASS');
   await page.close();
  }finally{await ctx.close();}
  for(const layout of layouts)await checkLauncher(browser,origin,layout);
  await browser.close();browser=null;
 }
 console.log('SHARED_APP_UI_V1_PRESENTATION_SMOKE_PASS');
}catch(e){console.error(e?.stack||String(e));process.exitCode=1;}
finally{await browser?.close();await new Promise(ok=>server.close(ok));rmSync(tmp,{recursive:true,force:true});}
