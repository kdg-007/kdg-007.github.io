import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','..');
function load(filename,document) {
 const module={exports:{}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'thinkit/assets',filename),'utf8'),
  {module,globalThis:{},document},{filename});
 return module.exports;
}
const C=load('responsibility-catalog.js');
const H=load('flow-hierarchy.js');
const F=load('flow-focus.js');
const S=load('swimlane-view.js');

class Element {
 constructor(tag){this.tagName=tag;this.children=[];this.listeners={};this.attributes={};this.value='';this.className='';this.style={};this.textContent='';this.scrollTop=0;this.open=false;}
 appendChild(n){this.children.push(n);n.parent=this;return n}
 replaceChildren(...items){this.children=items;for(const n of items)n.parent=this}
 setAttribute(k,v){this.attributes[k]=String(v)}
 addEventListener(k,cb){this.listeners[k]=cb}
 getAttribute(k){return this.attributes[k]||null}
 focus(){dom.activeElement=this}
 get classList(){return {contains:key=>this.className.split(/\s+/).includes(key)}}
 contains(el){while(el){if(el===this)return true;el=el.parent}return false}
 closest(selector){let el=this;while(el){if(selector.startsWith('.')&&el.classList.contains(selector.slice(1)))return el;el=el.parent}return null}
 querySelector(q){return this.querySelectorAll(q)[0]||null}
 querySelectorAll(q){
  const found=[];const match=(e)=>q.startsWith('.')?e.className.split(/\s+/).includes(q.slice(1))
   :q.startsWith('[')?!!e.attributes[q.slice(1,-1)]
   :q===e.tagName;
  const walk=n=>{for(const child of n.children){if(match(child))found.push(child);walk(child)}};
  walk(this);return found;
 }
}
const dom={createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag)};
const SVG=load('swimlane-view.js',dom),UI=load('role-review.js',dom);
const sample=()=>({mode:'flow',nodes:[
 {id:'stage',shape:'subprocess',label:'Stage',outlineParentId:null,collapsed:true,x:0,y:0,w:190,h:70,flowActivity:{responsible:'Multi-party process'}},
 {id:'a',shape:'process',label:'Design',outlineParentId:'stage',collapsed:false,x:100,y:100,w:190,h:70,flowActivity:{responsible:'Architect'}},
 {id:'b',shape:'process',label:'Coordinate',outlineParentId:'stage',collapsed:false,x:350,y:100,w:190,h:70,flowActivity:{responsible:'Architect / Project manager'}},
 {id:'c',shape:'process',label:'Approve',outlineParentId:'stage',collapsed:false,x:600,y:100,w:190,h:70,flowActivity:{responsible:''}},
 {id:'gate',shape:'decision',label:'Approval gate',outlineParentId:'stage',collapsed:false,x:900,y:100,w:190,h:70,flowActivity:{responsible:'Owners / Authority'}}
],edges:[{id:'e1',from:'a',to:'b',kind:'flow'}]});
const original=x=>JSON.stringify(x);

test('SW3 reviewed categories preserve all originals while separating unclassified and summary roles',()=>{
 const p=sample(),before=original(p);
 let c=C.withCategory(C.empty(),'design','Architectural Design');
 c=C.assignRole(c,'Architect','design');
 const resolver=C.createResolver(c,F.activityDetails);
 const projection=S.scopedProjection(p,H,F,'stage','all');
 const view=S.project(p,projection,F.activityDetails,{groupMode:'categories',resolveCategory:resolver.resolve});
 assert.equal(view.visibleCount,5);
 assert.equal(view.links.length,1);
 assert.equal(view.reviewedCount,1);
 assert.equal(view.unclassifiedCount,1);
 assert.ok(view.lanes.some(l=>l.key==='cat:design'));
 assert.ok(view.lanes.some(l=>l.key==='meta:subprocess'));
 assert.ok(view.lanes.some(l=>l.key==='meta:decision'));
 assert.ok(view.lanes.some(l=>l.key==='meta:unclassified'));
 assert.equal(original(p),before);
 assert.equal(view.nodes.find(n=>n.id==='b').originalRole,'Architect / Project manager');
});
test('SW3 standalone reviewer requires explicit assignments and never fabricates role splits',()=>{
 const p=sample(),before=original(p),roles=C.audit(p,F.activityDetails,C.empty());
 const rootNode=new Element('div'),events=[];
 UI.render(rootNode,roles,C.empty(),{
  initialSearch:'',onCreateCategory:name=>events.push(['create',name]),
  onAssignRole:(role,id)=>events.push(['role',role,id]),onSearch:text=>events.push(['search',text]),
  selectedNode:p.nodes[1],assignable:C.assignable,originalRole:n=>n.flowActivity.responsible
 });
 const inputs=rootNode.querySelectorAll('input');
 assert.ok(inputs.length>=2);
 inputs[0].value='Architectural Coordination';
 const add=rootNode.querySelectorAll('button').find(b=>b.textContent==='Add category');
 assert.ok(add);add.listeners.click();
 assert.deepEqual(events[0],['create','Architectural Coordination']);
 const search=inputs.find(e=>e.type==='search');
 assert.ok(search);search.value='project manager';search.listeners.input();
 assert.deepEqual(events[1],['search','project manager']);
 assert.equal(original(p),before);
});
test('SW3 mapping dropdown affects the exact role label only; category review is undoable',()=>{
 const p=sample(),before=original(p);
 let cat=C.withCategory(C.empty(),'design','Design and coordination');
 const audit=C.audit(p,F.activityDetails,cat);
 const r=new Element('div'),events=[];
 UI.render(r,audit,cat,{onAssignRole:(role,id)=>events.push({role,id})});
 const select=r.querySelectorAll('select').find(s=>s.parent?.parent?.className==='sw3-role-row'&&
  s.parent.parent.querySelector('.sw3-role-text')?.textContent==='Architect / Project manager');
 assert.ok(select);
 select.value='design';select.listeners.change();
 assert.deepEqual(events[0],{role:'Architect / Project manager',id:'design'});
 const after=C.assignRole(cat,events[0].role,events[0].id);
 const resolved=C.createResolver(after,F.activityDetails);
 assert.equal(resolved.resolve(p.nodes[2]).categoryId,'design');
 assert.equal(resolved.resolve(p.nodes[1]).status,'unclassified');
 const saved={...p,responsibilityCatalog:after};
 assert.equal(C.validate(JSON.parse(original(saved)).responsibilityCatalog).version,1);
 assert.equal(original(p),before,'Role review must not rewrite source activities');
});
test('SW3 per-activity exceptions are explicitly reversible without reassigning the common role',()=>{
 const p=sample(),before=original(p);
 let c=C.withCategory(C.empty(),'design','Design');
 c=C.withCategory(c,'lead','Lead coordination');
 c=C.assignRole(c,'Architect','design');
 c=C.assignNode(c,'a','lead');
 const out=C.createResolver(c,F.activityDetails);
 assert.equal(out.resolve(p.nodes[1]).categoryId,'lead');
 const undo=C.unassignNode(c,'a');
 assert.equal(C.createResolver(undo,F.activityDetails).resolve(p.nodes[1]).categoryId,'design');
 assert.equal(original(p),before);
});
test('SW3 large unclassified category wraps within bounded width and retains connector semantics',()=>{
  const nodes=Array.from({length:120},(_,i)=>({id:'task-'+i,shape:'process',label:'Task '+i,
    outlineParentId:null,collapsed:false,x:i*200,y:0,w:180,h:70,
    flowActivity:{responsible:'Distinct role '+i}}));
  const edges=[{id:'same-group',from:'task-0',to:'task-70',kind:'flow',arrowEnd:'filled'}];
  const p={mode:'flow',nodes,edges},before=original(p);
  const resolver=C.createResolver(C.empty(),F.activityDetails);
  const view=S.project(p,H.plan(p),F.activityDetails,{
    groupMode:'categories',resolveCategory:resolver.resolve
  });
  assert.equal(view.visibleCount,120);
  assert.equal(view.lanes.length,1);
  assert.equal(view.links.length,1);
  assert.equal(view.unclassifiedCount,120);
  assert.ok(view.width<2000,'Reviewed categories must not create an unbounded 120-card horizontal lane');
  assert.ok(view.height>2000,'Cards wrap to additional display rows');
  assert.equal(view.links[0].crossLane,false,'A link between wrapped rows in one lane is not a cross-lane handoff');
  assert.equal(original(p),before);
});

test('SW3 source-empty activity cannot receive a misleading reviewed category',()=>{
 const p=sample(),c=C.withCategory(C.empty(),'owner','Owner'),host=new Element('div');
 const errors=[],chosen=p.nodes.find(n=>n.id==='c');
 UI.render(host,C.audit(p,F.activityDetails,c),c,{
   selectedNode:chosen,assignable:C.assignable,
   originalRole:n=>n.flowActivity.responsible,
   resolver:C.createResolver(c,F.activityDetails),
   onAssignNode:(id,category)=>errors.push({id,category})
 });
 const select=host.querySelector('.sw3-selected-review')?.querySelector('select');
 assert.ok(select);
 assert.equal(select.disabled,true);
 assert.ok(host.querySelector('.sw3-selected-review')?.textContent!==undefined);
 assert.equal(errors.length,0);
});
test('SW3 visible undo/redo controls are enabled only by transaction history',()=>{
 const p=sample(),plan=S.scopedProjection(p,H,F,'stage','next');
 const model=S.project(p,plan,F.activityDetails,{groupMode:'categories',
   resolveCategory:C.createResolver(C.empty(),F.activityDetails).resolve});
 const root=new Element('div'),history=[];
 SVG.render(root,model,{canUndo:true,canRedo:false,
   onUndo:()=>history.push('undo'),onRedo:()=>history.push('redo')});
 const undo=root.querySelector('.sw3-undo'),redo=root.querySelector('.sw3-redo');
 assert.ok(undo);assert.ok(redo);
 assert.equal(undo.disabled,false);
 assert.equal(redo.disabled,true);
 undo.listeners.click();
 assert.deepEqual(history,['undo']);
});

test('SW3 review warns about inactive mappings without applying them to blank owners',()=>{
 const page=sample(),before=original(page);
 let catalog=C.withCategory(C.empty(),'owner','Owners');
 catalog=C.assignNode(catalog,'c','owner');
 const audit=C.audit(page,F.activityDetails,catalog);
 assert.deepEqual(Array.from(audit.inactiveNodeAssignments),['c']);
 const host=new Element('div');
 UI.render(host,audit,catalog,{});
 const messages=host.querySelectorAll('.sw3-review-message');
 assert.ok(messages.some(el=>el.textContent.includes('currently inactive')));
 assert.equal(original(page),before);
});

test('SW3 review retains expanded result count through repeat renders',()=>{
 const nodes=Array.from({length:115},(_,i)=>({id:'role-'+i,shape:'process',label:'Review role '+i,
   flowActivity:{responsible:'Independent role '+i}}));
 const p={mode:'flow',nodes,edges:[]},audit=C.audit(p,F.activityDetails,C.empty());
 const root=new Element('div'),limits=[];
 UI.render(root,audit,C.empty(),{onVisibleLimit:count=>limits.push(count)});
 assert.equal(root.querySelectorAll('.sw3-role-row').length,50);
 const more=root.querySelector('.sw3-show-more');
 assert.ok(more);more.listeners.click();
 assert.equal(root.querySelectorAll('.sw3-role-row').length,100);
 assert.deepEqual(limits,[100]);
 UI.render(root,audit,C.empty(),{initialLimit:100});
 assert.equal(root.querySelectorAll('.sw3-role-row').length,100);
 assert.equal(root.querySelector('.sw3-results-count').textContent,'Showing 100 of 115 matching role labels');
});
test('SW3 reviewer scroll, expanded category list and active role input survive redraw',()=>{
 const p=sample(),catalog=C.withCategory(C.empty(),'design','Architectural services');
 const audit=C.audit(p,F.activityDetails,catalog);
 const panel=new Element('section');
 const review=new Element('section');review.className='sw3-review';panel.appendChild(review);
 UI.render(review,audit,catalog,{});
 review.scrollTop=620;
 const inventory=review.querySelector('.sw3-catalog-list');
 assert.ok(inventory);inventory.open=true;
 const target=review.querySelectorAll('.sw3-role-row').find(
   row=>row.querySelector('.sw3-role-text')?.textContent==='Architect / Project manager');
 assert.ok(target);
 const originalSelect=target.querySelector('.sw3-category-select');
 originalSelect.focus();
 const state=UI.captureState(panel);
 assert.equal(state.scrollTop,620);
 assert.equal(state.catalogOpen,true);
 assert.deepEqual(structuredClone(state.focus),{kind:'role',role:'Architect / Project manager'});
 const replacement=new Element('section');replacement.className='sw3-review';
 panel.replaceChildren(replacement);
 UI.render(replacement,audit,catalog,{});
 UI.restoreState(panel,state);
 assert.equal(replacement.scrollTop,620);
 assert.equal(replacement.querySelector('.sw3-catalog-list').open,true);
 const newRow=replacement.querySelectorAll('.sw3-role-row').find(
   row=>row.querySelector('.sw3-role-text')?.textContent==='Architect / Project manager');
 assert.equal(dom.activeElement,newRow.querySelector('.sw3-category-select'));
});

test('SW3 exact-role batch control requires visible explicit selection and category choice',()=>{
 const p=sample(),before=original(p);
 const catalog=C.withCategory(C.empty(),'design','Architectural services');
 const audit=C.audit(p,F.activityDetails,catalog);
 const host=new Element('div'),selected=new Set(),applied=[];
 UI.render(host,audit,catalog,{
  selectedRoles:selected,
  onSelectionChange:(role,checked)=>checked?selected.add(role):selected.delete(role),
  onAssignRoles:(roles,id)=>applied.push({roles,id})
 });
 const apply=host.querySelector('.sw3-batch-apply');
 assert.ok(apply);
 assert.equal(apply.disabled,true,'Nothing may be assigned before explicit selection');
 const rows=host.querySelectorAll('.sw3-role-row');
 const exact=rows.find(row=>row.querySelector('.sw3-role-text')?.textContent==='Architect');
 const compound=rows.find(row=>row.querySelector('.sw3-role-text')?.textContent==='Architect / Project manager');
 assert.ok(exact&&compound);
 for(const row of [exact,compound]){
  const check=row.querySelector('.sw3-role-check');
  check.checked=true;check.listeners.change();
 }
 assert.equal(selected.size,2);
 assert.equal(apply.disabled,true,'Reviewers must choose a category before applying');
 const target=host.querySelector('.sw3-batch-controls').querySelector('.sw3-category-select');
 target.value='design';target.listeners.change();
 assert.equal(apply.disabled,false);
 apply.listeners.click();
 assert.equal(applied.length,1,'One explicit click makes one grouped transaction request');
 assert.deepEqual(new Set(applied[0].roles),new Set(['Architect','Architect / Project manager']));
 assert.equal(applied[0].id,'design');
 assert.equal(original(p),before);
 UI.render(host,audit,catalog,{selectedRoles:selected,onSelectionChange:(role,on)=>on?selected.add(role):selected.delete(role)});
 assert.equal(host.querySelectorAll('.sw3-role-check').filter(c=>c.checked).length,2,
   'Explicit selections survive redraw without becoming saved responsibility changes');
 const clear=host.querySelector('.sw3-batch-clear');
 clear.listeners.click();
 assert.equal(selected.size,0);
 assert.equal(host.querySelector('.sw3-batch-apply').disabled,true);
 assert.equal(original(p),before);
});
test('SW3 batch selection excludes unassigned and no-longer-present role labels',()=>{
 const p=sample(),catalog=C.withCategory(C.empty(),'design','Design'),
  audit=C.audit(p,F.activityDetails,catalog);
 const host=new Element('div'),applied=[];
 UI.render(host,audit,catalog,{
  selectedRoles:new Set(['Invented absent role','Architect']),
  onAssignRoles:(roles,id)=>applied.push({roles,id})
 });
 const checks=host.querySelectorAll('.sw3-role-check');
 assert.equal(checks.filter(x=>x.checked).length,1);
 const emptyRow=host.querySelectorAll('.sw3-role-row').find(
  x=>x.querySelector('.sw3-role-text')?.textContent==='Unassigned / needs review');
 assert.ok(emptyRow);
 assert.equal(emptyRow.querySelector('.sw3-role-check').disabled,true);
 const target=host.querySelector('.sw3-batch-controls').querySelector('.sw3-category-select');
 target.value='design';target.listeners.change();
 host.querySelector('.sw3-batch-apply').listeners.click();
 assert.deepEqual(structuredClone(applied),[{roles:['Architect'],id:'design'}]);
});

test('SW3 source wiring and portable import validation remain guarded',()=>{
 const html=fs.readFileSync(path.join(root,'thinkit/index.html'),'utf8');
 const editor=fs.readFileSync(path.join(root,'thinkit/assets/thinkit-2.js'),'utf8');
 for(const name of ['responsibility-catalog.js','role-review.js','role-review.css'])assert.ok(html.includes(name));
 assert.ok(html.indexOf('responsibility-catalog.js')<html.indexOf('swimlane-view.js'));
 assert.ok(html.indexOf('role-review.js')<html.indexOf('thinkit-2.js'));
 assert.ok(editor.includes('window.ThinkItResponsibilityCatalog.validate(p.responsibilityCatalog,p)'));
 assert.ok(editor.includes('page.responsibilityCatalog=roleAPI.validate(next,page)'));
 assert.ok(editor.includes('onAssignNode:(id,categoryId)=>{'));
 assert.ok(editor.includes('if(categoryId&&!resolver.responsible(node))'));
 assert.ok(editor.includes('onUndo:()=>undo(),onRedo:()=>redo()'));
 assert.ok(editor.includes('onAssignRole:(role,id)=>applyCatalog('));
 assert.ok(editor.includes('onAssignRoles:(roles,id)=>{'));
 assert.ok(editor.includes('const next=roleAPI.assignRoles(catalog,roles,id)'));
 assert.ok(editor.includes('sw3SelectedRolesByPage.delete(roleSelectionKey)'));
 assert.ok(editor.includes('reviewUI.captureState?.(panel)'));
 assert.ok(editor.includes('reviewUI.restoreState?.(panel,transientReview)'));
 assert.ok(editor.includes('const liveFocus=requestedFocus&&byId(requestedFocus)?requestedFocus:null'));
 assert.ok(editor.includes('initialLimit:sw3LimitByPage.get(page.id)||50'));

});

test('SW3 role dropdown never represents a single-activity exception as role-wide approval',()=>{
 const p=sample();
 p.nodes.find(n=>n.id==='b').flowActivity.responsible='Architect';
 const before=original(p);
 let catalog=C.withCategory(C.empty(),'design','Design');
 catalog=C.withCategory(catalog,'lead','Lead coordination');
 catalog=C.assignNode(catalog,'a','lead');
 const audit=C.audit(p,F.activityDetails,catalog);
 const role=audit.roles.find(x=>x.role==='Architect');
 assert.equal(role.count,2);
 assert.equal(role.reviewedCount,1);
 assert.equal(role.exceptionCount,1);
 assert.equal(role.categoryId,null,'An activity exception is not a shared role-wide mapping');
 const host=new Element('div');
 UI.render(host,audit,catalog,{});
 const row=host.querySelectorAll('.sw3-role-row').find(
  x=>x.querySelector('.sw3-role-text')?.textContent==='Architect');
 assert.ok(row);
 assert.equal(row.querySelector('.sw3-category-select').value,'');
 assert.ok(row.querySelector('.sw3-mixed-warning').textContent.includes('Activity-specific exceptions'));
 const mapped=C.assignRole(catalog,'Architect','design');
 const mappedRole=C.audit(p,F.activityDetails,mapped).roles.find(x=>x.role==='Architect');
 assert.equal(mappedRole.categoryId,'design');
 assert.equal(mappedRole.reviewedCount,2);
 assert.equal(mappedRole.exceptionCount,1);
 UI.render(host,C.audit(p,F.activityDetails,mapped),mapped,{});
 const newRow=host.querySelectorAll('.sw3-role-row').find(
  x=>x.querySelector('.sw3-role-text')?.textContent==='Architect');
 assert.equal(newRow.querySelector('.sw3-category-select').value,'design');
 const resolver=C.createResolver(mapped,F.activityDetails);
 assert.equal(resolver.resolve(p.nodes.find(x=>x.id==='a')).categoryId,'lead');
 assert.equal(resolver.resolve(p.nodes.find(x=>x.id==='b')).categoryId,'design');
 assert.equal(original(p),before,'Category review must not rewrite source responsibility records');
});
