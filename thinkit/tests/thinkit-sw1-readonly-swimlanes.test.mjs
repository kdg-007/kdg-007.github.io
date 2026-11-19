import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','..');
function load(rel) {
  const module={exports:{}};
  vm.runInNewContext(fs.readFileSync(path.join(root,rel),'utf8'),{module,globalThis:{}},{filename:rel});
  return module.exports;
}
const model=load('thinkit/assets/swimlane-view.js');
const hierarchy=load('thinkit/assets/flow-hierarchy.js');
const focus=load('thinkit/assets/flow-focus.js');
const snapshot=value=>JSON.stringify(value);
function sample() {
  return {mode:'flow',nodes:[
    {id:'s',label:'Design stage',shape:'subprocess',outlineParentId:null,collapsed:false,
      x:0,y:0,w:200,h:80,flowActivity:{responsible:'Architect'}},
    {id:'a',label:'Develop drawings',outlineParentId:'s',x:0,y:120,w:180,h:70,
      flowActivity:{responsible:' Architect '},dependencies:[]},
    {id:'b',label:'Approve drawings',outlineParentId:'s',x:280,y:120,w:180,h:70,
      flowActivity:{responsible:'Owner'},dependencies:[{id:'a',type:'FS'}]},
    {id:'c',label:'Issue permit',outlineParentId:null,x:600,y:0,w:180,h:70,
      data:{role:'City Building Official'},dependencies:[{id:'b',type:'FS'}]},
    {id:'d',label:'Prepare documents',outlineParentId:null,x:800,y:0,w:180,h:70,
      flowActivity:{responsible:''},data:{role:'Consultant'}}
  ],edges:[
    {id:'e1',from:'a',to:'b',kind:'flow',label:'For approval'},
    {id:'e2',from:'b',to:'c',kind:'flow'},
    {id:'free',start:{x:0,y:0},end:{x:100,y:40},kind:'annotation'}
  ]};
}
test('SW1 displays canonical graphical handoffs and never creates dependencies or changes source',()=>{
  const p=sample(),before=snapshot(p);
  const out=model.project(p,hierarchy.plan(p),n=>focus.activityDetails(n));
  assert.equal(out.visibleCount,5);
  assert.equal(out.assignedCount,4);
  assert.equal(out.links.length,2);
  assert.equal(out.excludedFree,1);
  assert.equal(out.handoffs,2);
  assert.equal(out.links.find(e=>e.id==='e1').from,'a');
  assert.equal(out.links.find(e=>e.id==='e1').to,'b');
  assert.ok(out.lanes.some(l=>l.label==='Unassigned / needs review'));
  assert.equal(snapshot(p),before,'Projection must not mutate original coordinates or metadata');
});
test('SW1 respects explicit blank ownership overrides and legacy role fallback',()=>{
  const p=sample();
  assert.equal(model.ownerOf(p.nodes[0],focus.activityDetails),'Architect');
  assert.equal(model.ownerOf(p.nodes[3],focus.activityDetails),'City Building Official');
  assert.equal(model.ownerOf(p.nodes[4],focus.activityDetails),'');
  const plan=model.project(p,hierarchy.plan(p),focus.activityDetails);
  assert.equal(plan.lanes.find(l=>l.key==='Architect').nodes.length,2);
});
test('SW1 collapse uses existing visible proxies; canonical suppressed connectors stay untouched',()=>{
  const p=sample();p.nodes[0].collapsed=true;
  const before=snapshot(p),projected=hierarchy.plan(p);
  const out=model.project(p,projected,focus.activityDetails);
  assert.equal(out.visibleCount,3);
  assert.equal(out.links.length,1);
  assert.equal(out.links[0].from,'s');
  assert.equal(out.projectedCount,1);
  assert.ok(out.suppressedCount>=1);
  assert.equal(snapshot(p),before);
});
test('SW1 scoped subprocess uses focused hierarchy projection',()=>{
  const p=sample(),before=snapshot(p),scoped=focus.scope(p,hierarchy.plan(p),'s');
  const out=model.project(p,scoped,focus.activityDetails);
  assert.equal(out.visibleCount,3);
  assert.equal(out.links.length,1);
  assert.ok(out.nodes.every(n=>['s','a','b'].includes(n.id)));
  assert.equal(snapshot(p),before);
});
test('SW1 does not confuse WBS dependencies with drawn connectors',()=>{
  const p=sample();p.edges=[];
  const plan=model.project(p,hierarchy.plan(p),focus.activityDetails);
  assert.equal(plan.links.length,0);
  assert.equal(p.nodes[2].dependencies[0].id,'a');
});
test('SW1 source order and lane assignments are stable through repeated projections',()=>{
  const p=sample(),projection=hierarchy.plan(p);
  const a=model.project(p,projection,focus.activityDetails);
  const b=model.project(p,projection,focus.activityDetails);
  assert.equal(snapshot(a),snapshot(b));
  assert.deepEqual(Array.from(a.lanes.find(l=>l.key==='Architect').nodes,n=>n.id),['s','a']);
});
test('SW1 fail-closed validation rejects non-Flowcharts and invalid projections',()=>{
  const p=sample(),projected=hierarchy.plan(p);
  assert.throws(()=>model.project({...p,mode:'mind'},projected),/Flowchart/);
  assert.throws(()=>model.project(p,{...projected,visibleNodeIds:['a','a']}),/duplicate/);
  assert.throws(()=>model.project(p,{...projected,visibleNodeIds:['missing']}),/Invalid/);
  assert.throws(()=>model.project(p,{...projected,edgeViews:[{id:'dangling',from:'a',to:'missing'}]}),/unprojected/);
});
test('SW1 integration assets and Flowchart-only view controls are wired in correct order',()=>{
  const html=fs.readFileSync(path.join(root,'thinkit/index.html'),'utf8');
  const editor=fs.readFileSync(path.join(root,'thinkit/assets/thinkit-2.js'),'utf8');
  for(const name of ['swimlane-view.js','swimlane-view.css']){
    assert.ok(html.includes('/thinkit/assets/'+name),name+' missing');
    assert.ok(fs.existsSync(path.join(root,'thinkit/assets',name)));
  }
  assert.ok(html.indexOf('swimlane-view.js')<html.indexOf('thinkit-2.js'));
  assert.ok(html.includes('id="t22SwimlaneBtn"'));
  assert.ok(html.includes('id="sw1Panel"'));
  assert.ok(editor.includes('function t22IsSwimlane()'));
  assert.ok(editor.includes('function sw1RenderWorkspace()'));
  assert.ok(editor.includes("page.mode!=='flow'"),'View must be restricted to Flowchart');
  assert.ok(editor.includes('!t22IsSwimlane())renderCanvas()'),
    'Hidden diagram SVG must not redraw while swimlane is active');
});
