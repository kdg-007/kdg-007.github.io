import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','..');
const code=fs.readFileSync(path.join(root,'thinkit/assets/responsibility-catalog.js'),'utf8');
const module={exports:{}};
vm.runInNewContext(code,{module,globalThis:{}},{filename:'responsibility-catalog.js'});
const C=module.exports;
const page={mode:'flow',nodes:[
  {id:'a',shape:'process',label:'Make plans',flowActivity:{responsible:'Architect'}},
  {id:'b',shape:'process',label:'Check plans',flowActivity:{responsible:' ARCHITECT '}},
  {id:'c',shape:'process',label:'Review',flowActivity:{responsible:'Architect / Project manager'}},
  {id:'d',shape:'process',label:'Unknown',flowActivity:{responsible:''},data:{role:'Owners'}},
  {id:'e',shape:'subprocess',label:'Multi-party stage',flowActivity:{responsible:'Lead(s) vary by activity'}},
  {id:'f',shape:'decision',label:'Gate',flowActivity:{responsible:'Owners / Authority'}}
],edges:[{id:'edge',from:'a',to:'b'}]};
const details=n=>n.flowActivity;
const json=x=>JSON.stringify(x);
test('SW3 catalog starts empty, preserves exact original responsibility and excludes summary nodes from review',()=>{
  const before=json(page),empty=C.empty(),r=C.audit(page,details,empty);
  assert.equal(r.activities,4);
  assert.equal(r.nonActivities,2);
  assert.equal(r.uniqueRoles,3);
  assert.equal(r.unassigned,1);
  assert.equal(r.reviewed,0);
  assert.equal(r.unmappedRoles,3);
  assert.equal(json(page),before);
});
test('SW3 exact role mapping works but does not split combined responsibilities',()=>{
  let c=C.withCategory(C.empty(),'architect','Architectural');
  c=C.assignRole(c,'Architect','architect');
  const before=json(page),r=C.audit(page,details,c);
  assert.equal(r.reviewed,2);
  assert.equal(r.unclassified,1);
  assert.equal(r.unassigned,1);
  const resolver=C.createResolver(c,details);
  assert.equal(resolver.resolve(page.nodes[0]).label,'Architectural');
  assert.equal(resolver.resolve(page.nodes[1]).label,'Architectural');
  assert.equal(resolver.resolve(page.nodes[2]).status,'unclassified');
  assert.equal(resolver.resolve(page.nodes[3]).status,'unassigned');
  assert.equal(resolver.resolve(page.nodes[4]).status,'summary');
  assert.equal(resolver.resolve(page.nodes[5]).status,'decision');
  assert.equal(json(page),before);
});
test('SW3 explicit per-activity override wins without changing other activities or source',()=>{
  const before=json(page);
  let c=C.withCategory(C.empty(),'design','Design');
  c=C.withCategory(c,'coord','Project coordination');
  c=C.assignRole(c,'Architect','design');
  c=C.assignNode(c,'b','coord');
  assert.equal(C.createResolver(c,details).resolve(page.nodes[0]).categoryId,'design');
  assert.equal(C.createResolver(c,details).resolve(page.nodes[1]).categoryId,'coord');
  assert.equal(C.audit(page,details,c).reviewed,2);
  assert.equal(json(page),before);
  const after=C.unassignNode(c,'b');
  assert.equal(C.createResolver(after,details).resolve(page.nodes[1]).categoryId,'design');
  assert.equal(json(after.roleAssignments),json(c.roleAssignments));
});
test('SW3 full role statements are not truncated or conflated by shared long prefix',()=>{
  const start='Design consultant responsible for coordination with appointed authorities and delegated vendors. '.repeat(3);
  const r1=start+'Validation',r2=start+'Approval';
  assert.notEqual(C.roleKey(r1),C.roleKey(r2));
  const cat=C.withCategory(C.empty(),'technical','Technical review');
  const selected=C.assignRole(cat,r1,'technical');
  const f=C.createResolver(selected,n=>n.flowActivity);
  assert.equal(f.resolve({id:'one',shape:'process',flowActivity:{responsible:r1}}).status,'reviewed');
  assert.equal(f.resolve({id:'two',shape:'process',flowActivity:{responsible:r2}}).status,'unclassified');
});
test('SW3 validation rejects duplicate mapping, stale categories and prototype-like role ambiguity',()=>{
  assert.throws(()=>C.validate({version:1,categories:[{id:'x',name:'A'},{id:'x',name:'B'}],roleAssignments:[],nodeAssignments:[]}),/duplicate/i);
  assert.throws(()=>C.validate({version:1,categories:[],roleAssignments:[{role:'Owners',categoryId:'missing'}],nodeAssignments:[]}),/orphan/i);
  assert.throws(()=>C.validate({version:1,categories:[{id:'__proto__',name:'Bad'}],roleAssignments:[],nodeAssignments:[]}),/malformed/i);
  const base=C.withCategory(C.empty(),'group','Group');
  assert.throws(()=>C.validate({...base,roleAssignments:[{role:'Owner',categoryId:'group'},{role:' OWNER ',categoryId:'group'}]}),/duplicate/i);
  assert.throws(()=>C.validate({...base,nodeAssignments:[{nodeId:'a',categoryId:'group'},{nodeId:'a',categoryId:'group'}]}),/Duplicate/i);
  assert.throws(()=>C.validate({...base,unknownField:'unsafe'}),/Unsupported/i);
  assert.throws(()=>C.validate(base,{mode:'mind'}),/Flowcharts/i);
});
test('SW3 audit identifies stale node overrides, without resurrecting deleted activity IDs',()=>{
  let c=C.withCategory(C.empty(),'owner','Owner');
  c=C.assignNode(c,'deleted-task','owner');
  const r=C.audit(page,details,c);
  assert.deepEqual([...r.staleNodeAssignments],['deleted-task']);
  assert.equal(r.reviewed,0);
});
test('SW3 batch assignment is atomic, case-normalized and preserves independent combined roles',()=>{
 const before=json(page);
 let catalog=C.withCategory(C.empty(),'design','Architectural services');
 catalog=C.assignRoles(catalog,['Architect',' ARCHITECT ','Architect'],'design');
 assert.equal(catalog.roleAssignments.length,1);
 assert.equal(catalog.roleAssignments[0].role,'Architect');
 const resolved=C.createResolver(catalog,details);
 assert.equal(resolved.resolve(page.nodes[0]).categoryId,'design');
 assert.equal(resolved.resolve(page.nodes[1]).categoryId,'design');
 assert.equal(resolved.resolve(page.nodes[2]).status,'unclassified');
 assert.equal(C.audit(page,details,catalog).reviewed,2);
 assert.equal(json(page),before);
});
test('SW3 selected roles apply once while respecting an explicit activity exception',()=>{
 let catalog=C.withCategory(C.empty(),'design','Architectural services');
 catalog=C.withCategory(catalog,'coord','Project coordination');
 catalog=C.assignNode(catalog,'b','coord');
 const snapshot=json(catalog);
 const updated=C.assignRoles(catalog,['Architect','Architect / Project manager'],'design');
 assert.equal(json(catalog),snapshot,'Batch must return a new catalog');
 assert.equal(updated.roleAssignments.length,2);
 assert.equal(C.createResolver(updated,details).resolve(page.nodes[0]).categoryId,'design');
 assert.equal(C.createResolver(updated,details).resolve(page.nodes[1]).categoryId,'coord');
 assert.equal(C.createResolver(updated,details).resolve(page.nodes[2]).categoryId,'design');
});
test('SW3 malformed or excessive batch selections fail without partial changes',()=>{
 const original=C.withCategory(C.empty(),'design','Design');
 const before=json(original);
 assert.throws(()=>C.assignRoles(original,[],'design'),/Select at least one/);
 assert.throws(()=>C.assignRoles(original,['Architect'],'missing'),/Unknown responsibility category/);
 assert.throws(()=>C.assignRoles(original,['Architect',''],'design'),/Invalid source role/);
 assert.throws(()=>C.assignRoles(original,Array.from({length:5001},(_,i)=>'Role '+i),'design'),/5000/);
 assert.equal(json(original),before);
});

test('SW3 category rename retains identity and mapped activity; mapped deletion is forbidden',()=>{
  let c=C.withCategory(C.empty(),'architect','Architect');
  c=C.assignRole(c,'Architect','architect');
  const before=json(page);
  const renamed=C.renameCategory(c,'architect','Architectural services');
  assert.equal(renamed.categories[0].id,'architect');
  assert.equal(C.createResolver(renamed,details).resolve(page.nodes[0]).label,'Architectural services');
  assert.throws(()=>C.removeCategory(renamed,'architect'),/unassign/i);
  const clear=C.unassignRole(renamed,'Architect');
  const removed=C.removeCategory(clear,'architect');
  assert.equal(removed.categories.length,0);
  assert.equal(json(page),before);
  assert.equal(c.categories[0].name,'Architect');
});
test('SW3 duplicate category names are rejected even with different IDs or whitespace',()=>{
  let c=C.withCategory(C.empty(),'design','Architectural Services');
  assert.throws(()=>C.withCategory(c,'design2',' architectural    services '),/Duplicate/);
  assert.throws(()=>C.renameCategory(C.withCategory(c,'owner','Owners'),'owner','ARCHITECTURAL SERVICES'),/Duplicate/);
});

test('SW3 rejects an explicit null catalog on import without rejecting legacy absence',()=>{
  assert.equal(C.validate(undefined,page).version,1);
  assert.throws(()=>C.validate(null,page),/Invalid responsibility catalog/);
  assert.equal(C.validate(C.empty(),page).version,1);
});
test('SW3 audits ineffective category overrides for blank responsibilities and summary nodes',()=>{
  const before=json(page);
  let c=C.withCategory(C.empty(),'owner','Owners');
  c=C.assignNode(c,'d','owner');
  c=C.assignNode(c,'e','owner');
  const result=C.audit(page,details,c);
  assert.deepEqual(Array.from(result.inactiveNodeAssignments).sort(),['d','e']);
  assert.equal(result.reviewed,0);
  assert.equal(C.createResolver(c,details).resolve(page.nodes[3]).status,'unassigned');
  assert.equal(C.createResolver(c,details).resolve(page.nodes[4]).status,'summary');
  assert.equal(json(page),before);
});

test('SW3 catalog remains an opt-in serializable addon compatible with DIAGRAMIT v3',()=>{
  const original=json(page);
  let c=C.withCategory(C.empty(),'owner','Owners');
  c=C.assignRole(c,'Architect','owner');
  const updated=JSON.parse(original);
  updated.responsibilityCatalog=JSON.parse(json(c));
  assert.equal(C.validate(updated.responsibilityCatalog,updated).version,1);
  assert.equal(json(page),original);
  assert.equal(C.audit(updated,details,updated.responsibilityCatalog).reviewed,2);
});
