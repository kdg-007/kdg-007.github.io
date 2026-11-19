import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','..');
const base='thinkit/assets/';
function load(name,document) {
  const module={exports:{}};
  const ctx={module,globalThis:{}};
  if(document)ctx.document=document;
  vm.runInNewContext(fs.readFileSync(path.join(root,base+name),'utf8'),ctx,{filename:name});
  return module.exports;
}
const hierarchy=load('flow-hierarchy.js');
const focus=load('flow-focus.js');
const swimlanes=load('swimlane-view.js');

class Element {
  constructor(tag) { this.tagName=tag;this.children=[];this.attrs={};this.handlers={};this.scrollLeft=0;this.scrollTop=0;this.value='';this.textContent=''; }
  appendChild(child) { this.children.push(child);child.parentNode=this;return child; }
  replaceChildren(...children) { this.children=children;for(const c of children)c.parentNode=this; }
  setAttribute(name,value) { this.attrs[name]=String(value); }
  getAttribute(name) { return this.attrs[name]??null; }
  addEventListener(name,handler) { this.handlers[name]=handler; }
  focus() {}
  querySelector(selector) { return this.querySelectorAll(selector)[0]||null; }
  querySelectorAll(selector) {
    const out=[];
    const visit=(parent)=>{for(const c of parent.children){
      const match=selector[0]==='.' ? c.className?.split(/\s+/).includes(selector.slice(1))
        : selector==='svg' ? c.tagName==='svg'
        : selector==='[data-sw1-id]' ? !!c.attrs['data-sw1-id']
        : selector==='[data-sw1-edge-id]' ? !!c.attrs['data-sw1-edge-id']
        : false;
      if(match)out.push(c);
      visit(c);
    }};
    visit(this);return out;
  }
}
const document={createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag)};
const renderModule=load('swimlane-view.js',document);
function sample(size=20) {
  const nodes=[],edges=[],parents=16;
  for(let i=0;i<parents;i++)nodes.push({id:'stage-'+i,label:'Stage '+i,
    outlineParentId:null,shape:'subprocess',collapsed:false,x:i*400,y:0,w:205,h:78,
    flowActivity:{responsible:'Coordinator'}});
  for(let i=0;i<size;i++)nodes.push({id:'act-'+i,label:'Process activity '+i,
    outlineParentId:'stage-'+(i%parents),shape:i%5===0?'decision':'process',
    x:i*230,y:170,w:178,h:70,dependencies:i?[{id:'act-'+(i-1),type:'FS'}]:[],
    flowActivity:{responsible:['Owner','Architect','Engineers','Contractor','Authority',''][i%6]}});
  for(let i=1;i<Math.min(size,185);i++)
    edges.push({id:'e-'+i,from:'act-'+(i-1),to:'act-'+i,kind:'flow',arrowEnd:'filled'});
  return {mode:'flow',nodes,edges};
}
test('SW2 large model announces density and offers focused subprocess navigation with no persisted changes',()=>{
  const page=sample(369),before=JSON.stringify(page);
  const result=swimlanes.project(page,hierarchy.plan(page),focus.activityDetails);
  assert.equal(result.visibleCount,385);
  assert.equal(result.links.length,184);
  assert.equal(result.focusOptions.length,16);
  assert.ok(result.width>3600);
  assert.equal(result.dense,true);
  assert.equal(JSON.stringify(page),before);
  const host=new Element('host'),picked=[];
  renderModule.render(host,result,{onSelect:id=>picked.push(id),onFocus:id=>picked.push('focus:'+id)});
  assert.ok(host.querySelector('.sw1-warning'));
  const select=host.querySelector('.sw1-focus-select');
  assert.ok(select);
  select.value='stage-5';select.handlers.change();
  assert.deepEqual(picked,['focus:stage-5']);
  assert.equal(JSON.stringify(page),before);
});
test('SW2 focus uses existing H5 scope and retains only original graphical connections',()=>{
  const page=sample(64),before=JSON.stringify(page);
  const scoped=focus.scope(page,hierarchy.plan(page),'stage-3');
  const result=swimlanes.project(page,scoped,focus.activityDetails);
  assert.equal(result.focusId,'stage-3');
  assert.ok(result.visibleCount<page.nodes.length);
  assert.ok(result.nodes.every(n=>n.id==='stage-3'||page.nodes.find(x=>x.id===n.id)?.outlineParentId==='stage-3'));
  assert.equal(result.links.length,0);
  assert.equal(JSON.stringify(page),before);
});
test('SW2 SVG keeps decision, subprocess and terminator symbols while selections remain keyboard accessible',()=>{
  const page={mode:'flow',nodes:[
    {id:'start',label:'Start',shape:'terminator',x:0,y:0,w:180,h:70,flowActivity:{responsible:'Owner'}},
    {id:'choice',label:'Approved?',shape:'decision',x:200,y:0,w:180,h:70,flowActivity:{responsible:'Architect'}},
    {id:'sub',label:'Subprocess',shape:'subprocess',x:400,y:0,w:180,h:70,flowActivity:{responsible:'Architect'}}
  ],edges:[{id:'link',from:'start',to:'choice',kind:'flow'}]};
  const plan=swimlanes.project(page,hierarchy.plan(page),focus.activityDetails);
  const host=new Element('host'),selected=[];
  renderModule.render(host,plan,{onSelect:id=>selected.push(id)});
  assert.ok(host.querySelector('svg'));
  const items=host.querySelectorAll('[data-sw1-id]');
  assert.equal(items.length,3);
  items[0].handlers.keydown({key:'Enter',preventDefault(){}});
  items[1].handlers.click();
  assert.deepEqual(selected,['start','choice']);
  const allElements=[];
  const gather=e=>{for(const c of e.children){allElements.push(c);gather(c);}};gather(host);
  assert.ok(allElements.some(x=>x.tagName==='polygon'&&x.className===undefined&&x.attrs.class==='sw1-activity-box'),
    'Decision should be drawn as a polygon');
  assert.ok(allElements.some(x=>x.attrs.class==='sw1-subprocess-bars'),
    'Subprocess bars should be visible');
  const first=host.querySelector('.sw1-scroll');first.scrollLeft=275;first.scrollTop=53;
  renderModule.render(host,plan,{onSelect:id=>selected.push(id)});
  const next=host.querySelector('.sw1-scroll');
  assert.equal(next.scrollLeft,275);
  assert.equal(next.scrollTop,53);
});
test('SW2 stakeholder casing is display-normalized without inferring different role identity',()=>{
  const page={mode:'flow',nodes:[
    {id:'a',label:'Activity A',x:0,y:0,w:100,h:60,flowActivity:{responsible:'Architect'}},
    {id:'b',label:'Activity B',x:200,y:0,w:100,h:60,flowActivity:{responsible:'  ARCHITECT  '}},
    {id:'c',label:'Activity C',x:400,y:0,w:100,h:60,flowActivity:{responsible:'Project Architect'}},
    {id:'d',label:'Activity D',x:600,y:0,w:100,h:60,flowActivity:{responsible:''}}
  ],edges:[]};
  const before=JSON.stringify(page);
  const result=swimlanes.project(page,hierarchy.plan(page),focus.activityDetails);
  assert.equal(result.lanes.length,3);
  assert.equal(result.lanes[0].label,'Architect');
  assert.equal(result.lanes[0].nodes.length,2);
  assert.equal(result.lanes[1].label,'Project Architect');
  assert.equal(result.lanes[2].label,'Unassigned / needs review');
  assert.equal(JSON.stringify(page),before);
});

test('SW2 view-local WBS projection progressively discloses stages without changing canonical collapse or geometry',()=>{
  const page=sample(64),before=JSON.stringify(page);
  const root=swimlanes.scopedProjection(page,hierarchy,focus,null,'next');
  const all=swimlanes.scopedProjection(page,hierarchy,focus,null,'all');
  const stage=swimlanes.scopedProjection(page,hierarchy,focus,'stage-3','next');
  assert.equal(root.visibleNodeIds.length,16);
  assert.equal(all.visibleNodeIds.length,80);
  assert.equal(stage.visibleNodeIds.length,5);
  assert.equal(stage.swimDepthMode,'next');
  assert.equal(JSON.stringify(page),before);
  const ui=swimlanes.project(page,root,focus.activityDetails);
  assert.equal(ui.depthMode,'next');
  const host=new Element('host'),selected=[];
  renderModule.render(host,ui,{onDepth:mode=>selected.push(mode)});
  const control=host.querySelector('.sw1-depth-select');
  assert.ok(control);
  control.value='all';control.handlers.change();
  assert.deepEqual(selected,['all']);
  assert.equal(JSON.stringify(page),before);
});
test('SW2 nested workstreams remain inspectable instead of expanding every activity in a phase',()=>{
  const nodes=[{id:'phase',shape:'subprocess',label:'Phase',outlineParentId:null,collapsed:true,
    x:0,y:0,w:200,h:70,flowActivity:{responsible:'Owners'}}];
  for(let w=0;w<9;w++){
    nodes.push({id:'w'+w,shape:'subprocess',label:'Workstream '+w,outlineParentId:'phase',
      collapsed:true,x:300,y:w*120,w:200,h:70,flowActivity:{responsible:'Lead(s) vary by activity'}});
    for(let j=0;j<8;j++)nodes.push({id:'a'+w+'-'+j,shape:'process',label:'Task',outlineParentId:'w'+w,
      collapsed:false,x:600+j*220,y:w*120,w:180,h:70,flowActivity:{responsible:'Role '+(w*8+j)}});
  }
  const page={mode:'flow',nodes,edges:[]},before=JSON.stringify(page);
  const phaseNext=swimlanes.scopedProjection(page,hierarchy,focus,'phase','next');
  const phaseAll=swimlanes.scopedProjection(page,hierarchy,focus,'phase','all');
  const workstream=swimlanes.scopedProjection(page,hierarchy,focus,'w4','next');
  assert.equal(phaseNext.visibleNodeIds.length,10);
  assert.equal(phaseAll.visibleNodeIds.length,82);
  assert.equal(workstream.visibleNodeIds.length,9);
  assert.equal(JSON.stringify(page),before);
  const result=swimlanes.project(page,phaseNext,focus.activityDetails);
  assert.equal(result.visibleCount,10);
  assert.equal(result.lanes.length,2);
});

test('SW2 full responsibility statements remain distinct beyond 160 characters',()=>{
  const shared='Owner, architect, consultant and statutory authority coordination for all technical disciplines: '.repeat(2);
  const page={mode:'flow',nodes:[
    {id:'one',label:'A',x:0,y:0,w:180,h:70,flowActivity:{responsible:shared+'Review'}},
    {id:'two',label:'B',x:200,y:0,w:180,h:70,flowActivity:{responsible:shared+'Approval'}}
  ],edges:[]};
  const before=JSON.stringify(page);
  const p=swimlanes.project(page,hierarchy.plan(page),focus.activityDetails);
  assert.equal(p.lanes.length,2);
  assert.ok(p.lanes.every(l=>l.label.length>160));
  assert.equal(JSON.stringify(page),before);
});

test('SW2 source contains read-only keyboard guard and focus callback wiring',()=>{
  const src=fs.readFileSync(path.join(root,base+'thinkit-2.js'),'utf8');
  assert.ok(src.includes('if(t22IsSwimlane())return;'));
  assert.ok(src.includes('sw1FocusByPage.set(page.id,id)'));
  assert.ok(src.includes('selected=new Set([id]);edgeSelected=null;selectedAnnotation=null;render();'));
  const swimRegion=src.slice(src.indexOf('function sw1RenderWorkspace()'),src.indexOf('function t22UiIssue('));
  // SW3 categorization is intentionally transactional, but navigation must
  // remain read-only. Test only the scope/depth/selection callbacks.
  const navStart=swimRegion.indexOf('onFocus:id=>');
  const navEnd=swimRegion.indexOf('}});',navStart);
  assert.ok(navStart>=0&&navEnd>navStart,'SW2 navigation callbacks must remain available');
  const navigation=swimRegion.slice(navStart,navEnd+4);
  assert.doesNotMatch(navigation,/flowSetFocus\(|flowRevealAncestors\(|transact\(/,
    'Swimlane navigation must not mutate the canonical WBS collapse state');
  assert.ok(swimRegion.includes('page.responsibilityCatalog=roleAPI.validate(next,page)'),
    'Explicit SW3 category edits must still use the transactional persistence path');
  assert.ok(src.includes('ThinkItSwimlanes.scopedProjection'));
  assert.ok(src.includes('onDepth:mode=>'));

  const html=fs.readFileSync(path.join(root,'thinkit/index.html'),'utf8');
  assert.ok(html.includes('id="t22SwimlaneBtn"'));
  assert.ok(html.indexOf('swimlane-view.js')<html.indexOf('thinkit-2.js'));
});

test('SW2 collapsed indicators follow the view-local disclosure rather than persisted flags',()=>{
  const page={mode:'flow',nodes:[
   {id:'phase',shape:'subprocess',outlineParentId:null,collapsed:false,label:'Phase',x:0,y:0,w:190,h:70,flowActivity:{responsible:'Client'}},
   {id:'work',shape:'subprocess',outlineParentId:'phase',collapsed:false,label:'Workstream',x:0,y:100,w:190,h:70,flowActivity:{responsible:'Architect'}},
   {id:'act',shape:'process',outlineParentId:'work',collapsed:false,label:'Activity',x:0,y:200,w:190,h:70,flowActivity:{responsible:'Architect'}}
  ],edges:[]};
  const before=JSON.stringify(page);
  const overview=swimlanes.scopedProjection(page,hierarchy,focus,null,'next');
  const overviewView=swimlanes.project(page,overview,focus.activityDetails);
  assert.equal(overviewView.nodes.find(n=>n.id==='phase')?.collapsed,true,
    'Root subprocess is a collapsed WBS proxy in the next-level overview');
  const scoped=swimlanes.scopedProjection(page,hierarchy,focus,'phase','next');
  const scopedView=swimlanes.project(page,scoped,focus.activityDetails);
  assert.equal(scopedView.nodes.find(n=>n.id==='phase')?.collapsed,false);
  assert.equal(scopedView.nodes.find(n=>n.id==='work')?.collapsed,true,
    'Workstream indicator must show the view-local one-level collapse');
  assert.equal(scopedView.nodes.some(n=>n.id==='act'),false);
  const all=swimlanes.scopedProjection(page,hierarchy,focus,'phase','all');
  const allView=swimlanes.project(page,all,focus.activityDetails);
  assert.equal(allView.nodes.find(n=>n.id==='work')?.collapsed,false);
  assert.equal(allView.nodes.some(n=>n.id==='act'),true);
  assert.equal(JSON.stringify(page),before,'View-local disclosure must not modify saved collapse state');
});
