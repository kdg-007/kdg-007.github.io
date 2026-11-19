import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

export async function checkThinkitSwimlanes(browser,origin){
 for(const connected of [false,true]){
  const context=await browser.newContext({ignoreHTTPSErrors:true,acceptDownloads:true,
   viewport:connected?{width:390,height:844}:{width:1440,height:1000},serviceWorkers:'block'});
  try{
   await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
   const page=await context.newPage(),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto(origin+(connected?'/partners/connected/?connected-app=thinkit':'/thinkit/'));
   const editor=connected?page.frameLocator('iframe[title="ThinkIt diagramming and Mind Map workspace"]'):page;
   const make=(id,label,parent,role,shape='process')=>({id,label,shape,outlineParentId:parent,
    x:id==='phase'?0:id==='design'?250:500,y:100,w:190,h:70,collapsed:false,
    flowActivity:{responsible:role},noteHtml:id==='design'?'<p>Preserved design note</p>':''});
   const project={format:'DIAGRAMIT',version:3,id:'swimlane-test',name:'Swimlane verification',activePageId:'flow',
    pages:[{id:'flow',name:'House delivery',mode:'flow',nodes:[
     make('phase','Design phase',null,'','subprocess'),make('design','Prepare drawings','phase','Architect'),
     make('approval','Approve drawings','phase','Owner')],edges:[{id:'review',from:'design',to:'approval',kind:'flow',label:'For approval'}]}]};
   await editor.locator('#diStartScreen').waitFor({state:'visible'});
   await editor.locator('#fileInput').setInputFiles({name:'swimlanes.diagramit.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
   await editor.locator('#diStartScreen').waitFor({state:'hidden'});
   const readProject=async()=>{
    const wait=page.waitForEvent('download');
    await editor.locator('#diMenuTabs [data-tab=File]').click();
    await editor.locator('#diMenuPopup [data-dcmd="file.saveCopy"]').click();
    return JSON.parse(readFileSync(await (await wait).path(),'utf8'));
   };
   const before=(await readProject()).pages[0];
   await editor.getByRole('button',{name:'Swimlanes',exact:true}).click();
   await editor.locator('#sw1Panel .sw1-scroll svg').waitFor();
   assert.equal(await editor.locator('[data-sw1-id]').count(),1);
   assert.equal(await editor.locator('[data-sw1-id="phase"] .sw1-collapse-badge').textContent(),'+');
   await editor.locator('.sw1-focus-select').selectOption('phase');
   assert.equal(await editor.locator('[data-sw1-id]').count(),3);
   const viewed=(await readProject()).pages[0];
   assert.deepEqual(viewed.nodes,before.nodes);assert.deepEqual(viewed.edges,before.edges);
   await editor.getByRole('button',{name:'Review responsibility categories',exact:true}).click();
   await editor.getByLabel('New category',{exact:true}).fill('Design services');
   await editor.getByRole('button',{name:'Add category',exact:true}).click();
   const role=editor.locator('.sw3-role-row').filter({has:editor.getByText('Architect',{exact:true})});
   await role.locator('select').selectOption({label:'Design services'});
   await editor.locator('.sw3-group-select').selectOption('categories');
   await editor.locator('.sw1-lane-text').filter({hasText:'Design services'}).waitFor();
   await editor.locator('.sw3-undo').click();
   assert.equal(await role.locator('select').inputValue(),'');
   await editor.locator('.sw3-redo').click();
   assert.notEqual(await role.locator('select').inputValue(),'');
   const svgWait=page.waitForEvent('download');
   await editor.getByRole('button',{name:'Export current view · SVG',exact:true}).click();
   const svg=readFileSync(await (await svgWait).path(),'utf8');
   assert.match(svg,/<svg/);assert.match(svg,/Design services/);assert.match(svg,/<style/);
   assert.doesNotMatch(svg,/var\(--line-strong\)/);
   const saved=(await readProject()).pages[0];
   assert.deepEqual(saved.nodes,before.nodes);assert.deepEqual(saved.edges,before.edges);
   assert.ok(saved.responsibilityCatalog);
   await editor.locator('#btnSave').click();await editor.locator('#saveStatus[data-state=saved]').waitFor();
   await page.reload();await editor.locator('#diStartResume').click();
   await editor.getByRole('button',{name:'Swimlanes',exact:true}).click();
   await editor.getByRole('button',{name:'Review responsibility categories',exact:true}).click();
   await editor.locator('.sw1-focus-select').selectOption('phase');
   await editor.locator('.sw3-group-select').selectOption('categories');
   await editor.locator('.sw1-lane-text').filter({hasText:'Design services'}).waitFor();
   assert.deepEqual((await readProject()).pages[0].responsibilityCatalog,saved.responsibilityCatalog);
   assert.deepEqual(errors,[]);
   console.log('THINKIT_SWIMLANES_FOCUS_CATEGORIES_HISTORY_SVG_REOPEN_'+browser.browserType().name().toUpperCase()+'_'+(connected?'CONNECTED_PHONE':'STANDALONE')+'_PASS');
  }finally{await context.close();}
 }
}
