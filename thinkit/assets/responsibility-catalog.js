/* ThinkIt SW3 - reviewed responsibility categories.
 * Pure, additive, opt-in model. Original flowActivity/legacy role statements
 * and every canonical node/edge/WBS field remain authoritative.
 * No automatic splitting, fuzzy role matching, or responsibility inference.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports) module.exports=api;
 else root.ThinkItResponsibilityCatalog=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const MAX_CATEGORIES=120, MAX_ROLE_MAP=5000, MAX_NODES=25000;
 const roleLabel=value=>typeof value==='string'?value.trim().replace(/\s+/g,' '):'';
 const roleKey=value=>roleLabel(value).toLocaleLowerCase('en');
 const empty=()=>({version:1,categories:[],roleAssignments:[],nodeAssignments:[]});
 const assignable=n=>!!n&&!['subprocess','terminator','decision'].includes(n.shape);
 const string=(value,name,max)=>{if(typeof value!=='string'||!value.trim()||value.length>max)throw Error('Invalid '+name);return value.trim();};
 function validate(catalog,page){
  if(catalog===undefined)return empty();
  // Missing catalogs are valid legacy files. Explicit null or malformed
  // present catalogs must fail closed rather than silently losing mappings.
  if(!catalog||typeof catalog!=='object'||Array.isArray(catalog)||catalog.version!==1||
   !Array.isArray(catalog.categories)||!Array.isArray(catalog.roleAssignments)||!Array.isArray(catalog.nodeAssignments))
   throw Error('Invalid responsibility catalog v1');
  if(Object.keys(catalog).some(k=>!['version','categories','roleAssignments','nodeAssignments'].includes(k)))
   throw Error('Unsupported responsibility catalog field');
  if(catalog.categories.length>MAX_CATEGORIES||catalog.roleAssignments.length>MAX_ROLE_MAP||
     catalog.nodeAssignments.length>MAX_NODES)throw Error('Responsibility catalog exceeds safety limit');
  const ids=new Set(),names=new Set(),roles=new Set(),nodes=new Set();
  for(const c of catalog.categories){
   if(!c||typeof c!=='object'||Array.isArray(c)||Object.keys(c).some(k=>!['id','name'].includes(k)))
     throw Error('Invalid responsibility category record');
   const id=string(c.id,'category ID',80),name=string(c.name,'category name',100);
   if(!/^[A-Za-z][A-Za-z0-9_-]*$/.test(id)||ids.has(id))throw Error('Duplicate or malformed responsibility category ID');
   const nameKey=roleKey(name);
   if(names.has(nameKey))throw Error('Duplicate responsibility category name');
   names.add(nameKey);ids.add(id);
  }
  for(const m of catalog.roleAssignments){
   if(!m||typeof m!=='object'||Array.isArray(m)||Object.keys(m).some(k=>!['role','categoryId'].includes(k)))
     throw Error('Invalid responsibility role mapping');
   const role=string(m.role,'source role',6000),category=string(m.categoryId,'mapped category',80),key=roleKey(role);
   if(!key||roles.has(key)||!ids.has(category))throw Error('Invalid, duplicate, or orphaned responsibility role mapping');
   roles.add(key);
  }
  for(const m of catalog.nodeAssignments){
   if(!m||typeof m!=='object'||Array.isArray(m)||Object.keys(m).some(k=>!['nodeId','categoryId'].includes(k)))
     throw Error('Invalid responsibility node mapping');
   const id=string(m.nodeId,'node ID',256),category=string(m.categoryId,'mapped category',80);
   if(nodes.has(id)||!ids.has(category))throw Error('Duplicate or orphaned responsibility node mapping');
   nodes.add(id);
  }
  // A deleted activity's old ID may remain in the portable catalog. Ignore it
  // when displaying; never attach that assignment to a replacement activity.
  if(page&&page.mode!=='flow')throw Error('Responsibility catalogs belong to Flowcharts only');
  return catalog;
 }
 function withCategory(catalog,id,name){
  const c=validate(catalog),next={...c,categories:[...c.categories,{id,name}]};
  validate(next);return next;
 }
 function renameCategory(catalog,id,name){
  const c=validate(catalog);string(id,'category ID',80);string(name,'category name',100);
  if(!c.categories.some(x=>x.id===id))throw Error('Unknown responsibility category');
  const next={...c,categories:c.categories.map(x=>x.id===id?{...x,name:name.trim()}:x)};
  validate(next);return next;
 }
 function removeCategory(catalog,id){
  const c=validate(catalog);string(id,'category ID',80);
  if(!c.categories.some(x=>x.id===id))throw Error('Unknown responsibility category');
  if(c.roleAssignments.some(x=>x.categoryId===id)||c.nodeAssignments.some(x=>x.categoryId===id))
    throw Error('Category has reviewed mappings; unassign them before deletion');
  const next={...c,categories:c.categories.filter(x=>x.id!==id)};
  validate(next);return next;
 }
 function assignRole(catalog,role,categoryId){
  const c=validate(catalog),normalizedRole=roleLabel(role);
  string(normalizedRole,'source role',6000);string(categoryId,'category ID',80);
  if(!c.categories.some(x=>x.id===categoryId))throw Error('Unknown responsibility category');
  const key=roleKey(normalizedRole);
  const next={...c,roleAssignments:[
   ...c.roleAssignments.filter(x=>roleKey(x.role)!==key),
   {role:normalizedRole,categoryId}
  ]};
  validate(next);return next;
 }
 function assignRoles(catalog,roles,categoryId){
  const c=validate(catalog);
  if(!Array.isArray(roles)||!roles.length||roles.length>MAX_ROLE_MAP)
   throw Error('Select at least one and no more than 5000 explicit role labels');
  string(categoryId,'category ID',80);
  if(!c.categories.some(x=>x.id===categoryId))throw Error('Unknown responsibility category');
  const selected=new Map();
  for(const label of roles){
   const role=roleLabel(label);
   string(role,'source role',6000);
   const key=roleKey(role);
   // Repeated selections never create duplicate role mappings.
   if(!selected.has(key))selected.set(key,role);
  }
  const next={...c,roleAssignments:[
   ...c.roleAssignments.filter(x=>!selected.has(roleKey(x.role))),
   ...[...selected.values()].map(role=>({role,categoryId}))
  ]};
  validate(next);
  return next;
 }
 function unassignRole(catalog,role){
  const c=validate(catalog),key=roleKey(role);
  return {...c,roleAssignments:c.roleAssignments.filter(x=>roleKey(x.role)!==key)};
 }
 function assignNode(catalog,nodeId,categoryId){
  const c=validate(catalog);string(nodeId,'node ID',256);
  if(!c.categories.some(x=>x.id===categoryId))throw Error('Unknown responsibility category');
  const next={...c,nodeAssignments:[
    ...c.nodeAssignments.filter(x=>x.nodeId!==nodeId),{nodeId,categoryId}
  ]};
  validate(next);return next;
 }
 function unassignNode(catalog,nodeId){
  const c=validate(catalog);
  return {...c,nodeAssignments:c.nodeAssignments.filter(x=>x.nodeId!==nodeId)};
 }
 function createResolver(catalog,details){
  const c=validate(catalog),categories=new Map(c.categories.map(x=>[x.id,x])),
   byRole=new Map(c.roleAssignments.map(x=>[roleKey(x.role),x.categoryId])),
   byNode=new Map(c.nodeAssignments.map(x=>[x.nodeId,x.categoryId]));
  const responsible=n=>{
   const d=typeof details==='function'?details(n):n?.flowActivity;
   // Explicit empty responsible overrides legacy role, as in H4.
   if(typeof d?.responsible==='string')return roleLabel(d.responsible);
   if(typeof n?.flowActivity?.responsible==='string')return roleLabel(n.flowActivity.responsible);
   return roleLabel(n?.data?.role);
  };
  function resolve(node){
   const originalRole=responsible(node);
   if(node.shape==='subprocess')return {
     key:'meta:subprocess',label:'Process summaries / variable responsibility',
     status:'summary',originalRole,categoryId:null};
   if(node.shape==='terminator')return {
     key:'meta:terminator',label:'Start and end events',
     status:'endpoint',originalRole,categoryId:null};
   if(node.shape==='decision')return {
     key:'meta:decision',label:'Approval / decision gates',
     status:'decision',originalRole,categoryId:null};
   if(!originalRole)return {key:'meta:unassigned',label:'Unassigned / needs review',
     status:'unassigned',originalRole,categoryId:null};
   const id=byNode.get(node.id)||byRole.get(roleKey(originalRole))||null;
   const category=id?categories.get(id):null;
   return category?{key:'cat:'+category.id,label:category.name,status:'reviewed',originalRole,categoryId:category.id}:
    {key:'meta:unclassified',label:'Unclassified / needs review',
     status:'unclassified',originalRole,categoryId:null};
  }
  return Object.freeze({resolve,responsible});
 }
 function audit(page,details,catalog){
  if(!page||page.mode!=='flow'||!Array.isArray(page.nodes))throw Error('Flowchart required for responsibility audit');
  const c=validate(catalog,page),resolver=createResolver(c,details),roles=new Map();
  let activities=0,reviewed=0,unassigned=0,nonActivities=0;
  const mappedNodeIds=new Set(c.nodeAssignments.map(m=>m.nodeId));
  const explicitByRole=new Map(c.roleAssignments.map(m=>[roleKey(m.role),m.categoryId]));
  const stale=new Set(mappedNodeIds),inactive=[];
  for(const node of page.nodes){
   if(!node||typeof node.id!=='string')throw Error('Invalid Flowchart activity');
   stale.delete(node.id);
   if(mappedNodeIds.has(node.id)&&(!assignable(node)||!resolver.responsible(node)))inactive.push(node.id);
   if(!assignable(node)){nonActivities++;continue;}
   activities++;
   const role=resolver.responsible(node),key=roleKey(role);
   const resolution=resolver.resolve(node);
   if(resolution.status==='reviewed')reviewed++;
   if(resolution.status==='unassigned')unassigned++;
   if(!roles.has(key))roles.set(key,{role,key,nodeIds:[],count:0,reviewedCount:0,
    // Role-wide mapping is distinct from any per-activity category overrides.
    categoryId:explicitByRole.get(key)||null,exceptionCount:0});
   const row=roles.get(key);
   row.nodeIds.push(node.id);row.count++;
   if(mappedNodeIds.has(node.id)&&role)row.exceptionCount++;
   if(resolution.status==='reviewed')row.reviewedCount++;
  }
  const entries=[...roles.values()].sort((a,b)=>b.count-a.count||a.role.localeCompare(b.role));
  const unmapped=entries.filter(row=>row.reviewedCount<row.count);
  return {activities,nonActivities,reviewed,unclassified:activities-reviewed-unassigned,
   unassigned,uniqueRoles:entries.length,reviewedRoles:entries.filter(row=>row.reviewedCount===row.count).length,
   roles:entries,unmappedRoles:unmapped.length,staleNodeAssignments:[...stale],inactiveNodeAssignments:inactive,
   categories:c.categories.map(x=>({...x}))};
 }
 return Object.freeze({empty,validate,withCategory,renameCategory,removeCategory,assignRole,assignRoles,unassignRole,assignNode,unassignNode,
   createResolver,audit,roleKey,roleLabel,assignable});
});
