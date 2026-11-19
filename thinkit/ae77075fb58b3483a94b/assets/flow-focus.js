/* ThinkIt H4 — read-only Flowchart focus/level projection and safe WBS wrapping.
 * Uses outlineParentId as the only ownership relation. Never rewrites
 * canonical connectors, dependencies, existing IDs or node annotations.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.ThinkItFlowFocus=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function index(page){
  if(page?.mode!=='flow'||!Array.isArray(page.nodes)||!Array.isArray(page.edges))
   throw Error('Flowchart focus requires Flowchart nodes and edges');
  const byId=new Map(),children=new Map(),roots=[];
  for(const n of page.nodes){
   if(!n||typeof n.id!=='string'||!n.id||byId.has(n.id))throw Error('Invalid Flowchart node ID');
   byId.set(n.id,n);children.set(n.id,[]);
  }
  for(const n of page.nodes){
   const parent=n.outlineParentId??null;
   if(parent===null)roots.push(n.id);
   else if(!children.has(parent))throw Error('Missing Flowchart WBS parent');
   else children.get(parent).push(n.id);
  }
  const ordered=[],depth=new Map(),state=new Map(),queue=roots.map(id=>({id,depth:0}));
  // Root-first traversal. If the graph has a cycle, not every node is reachable.
  for(let i=0;i<queue.length;i++){
   const {id,depth:d}=queue[i];
   if(state.has(id))throw Error('Circular Flowchart WBS hierarchy');
   state.set(id,true);ordered.push(id);depth.set(id,d);
   for(const child of children.get(id))queue.push({id:child,depth:d+1});
  }
  if(ordered.length!==page.nodes.length)throw Error('Circular Flowchart WBS hierarchy');
  function descendants(id){
   if(!byId.has(id))throw Error('Unknown Flowchart focus node');
   const found=new Set(),stack=[id];
   while(stack.length){const next=stack.pop();if(found.has(next))continue;
     found.add(next);stack.push(...children.get(next));
   }
   return found;
  }
  function path(id){
   if(!byId.has(id))throw Error('Unknown Flowchart focus node');
   const result=[],seen=new Set();let current=id;
   while(current!==null){
    if(seen.has(current))throw Error('Circular Flowchart WBS hierarchy');
    seen.add(current);const n=byId.get(current);result.push({id:n.id,label:n.label||'Untitled activity'});
    current=n.outlineParentId??null;
   }
   return result.reverse();
  }
  return {byId,children,roots,ordered,depth,descendants,path};
 }
 function scope(page,projection,focusId=null){
  if(!projection||!Array.isArray(projection.edgeViews)||!Array.isArray(projection.visibleNodeIds))
    throw Error('Flowchart visible projection required');
  if(!focusId)return {...projection,focusId:null,scopeNodeIds:null,hiddenOutsideScope:0};
  const m=index(page),members=m.descendants(focusId);
  const allVisible=projection.visibleNodeIds.filter(id=>members.has(id));
  const shown=new Set(allVisible);
  // Cross-boundary links cannot be shown with false visual endpoints.
  // They are omitted from focused view but retained in page.edges/JSON.
  const edges=projection.edgeViews.filter(e=>e.from&&e.to&&shown.has(e.from)&&shown.has(e.to));
  return {...projection,visibleNodeIds:allVisible,edgeViews:edges,focusId,
    scopeNodeIds:members,hiddenOutsideScope:page.nodes.length-members.size};
 }
 function breadcrumbs(page,focusId){
  return focusId?index(page).path(focusId):[];
 }
 function scopedRows(page,rows,focusId){
  if(!focusId)return rows;
  const m=index(page),members=m.descendants(focusId),base=m.depth.get(focusId);
  return rows.filter(row=>members.has(row.id)).map(row=>({...row,
   depth:Math.max(0,(row.depth??m.depth.get(row.id))-base),
   parentId:row.id===focusId?null:row.parentId
  }));
 }
 function collapseAtLevel(page,focusId,level){
  if(level!=='all'&&(!Number.isSafeInteger(level)||level<1||level>100))
   throw Error('Level must be 1–100 or all');
  const m=index(page),roots=focusId?[focusId]:m.roots;
  if(focusId&&!m.byId.has(focusId))throw Error('Unknown Flowchart focus node');
  const changes={},queue=roots.map(id=>({id,depth:1}));
  for(let i=0;i<queue.length;i++){
   const {id,depth}=queue[i],kids=m.children.get(id);
   if(kids.length)changes[id]=level==='all'?false:depth>=level;
   if(level!=='all'&&depth>=level){/* Still walk all nodes to clear deeper stale collapsed flags. */}
   for(const child of kids)queue.push({id:child,depth:depth+1});
  }
  return changes;
 }
 function wrapSelection(page,selection,containerId,{label='New subprocess',width=178,height=68}={}){
  const m=index(page);
  if(!Array.isArray(selection)||selection.length<2)throw Error('Select two or more Flowchart activities');
  if(typeof containerId!=='string'||!containerId||m.byId.has(containerId))throw Error('New subprocess requires a unique ID');
  const ids=[...new Set(selection)];
  if(ids.length<2||ids.some(id=>!m.byId.has(id)))throw Error('Unknown or duplicate Flowchart selection');
  const parentIds=ids.map(id=>m.byId.get(id).outlineParentId??null);
  const parentId=parentIds[0];
  if(parentIds.some(id=>id!==parentId))
   throw Error('Select activities from the same WBS parent to make a subprocess');
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<35||height<35)
   throw Error('Invalid subprocess dimensions');
  const nodes=ids.map(id=>m.byId.get(id));
  const minX=Math.min(...nodes.map(n=>n.x)),maxX=Math.max(...nodes.map(n=>n.x+n.w));
  const minY=Math.min(...nodes.map(n=>n.y));
  const target={x:(minX+maxX)/2-width/2,y:minY-height-85,w:width,h:height};
  const clear=(x,y)=>page.nodes.every(n=>x>=n.x+n.w+18||x+width+18<=n.x||y>=n.y+n.h+18||y+height+18<=n.y);
  // New container is a visible header, not a bounding rectangle over activities.
  let x=target.x,y=target.y,placed=false;
  for(let row=0;row<32&&!placed;row++){
   y=target.y-row*(height+28);
   for(let lane=0;lane<=12;lane++){
    for(const sign of lane===0?[0]:[-1,1]){
     x=target.x+sign*lane*(width+28);
     if(clear(x,y)){placed=true;break;}
    }
    if(placed)break;
   }
  }
  if(!placed)throw Error('No clear location for subprocess heading');
  const order=Math.min(...nodes.map(n=>Number.isFinite(n.outlineOrder)?n.outlineOrder:1));
  return {id:containerId,label,parentId,childIds:ids,
   x:Math.round(x),y:Math.round(y),w:width,h:height,
   outlineOrder:order,
   // Edges, dependencies and all previous node records stay canonical.
   affectedNodeIds:ids};
 }
 // Older DiagramIt project-delivery files retain structured activityInfo.
 // Present those details without migrating or overwriting the imported record.
 function activityDetails(node){
  const old=node?.activityInfo||{},current=node?.flowActivity||{};
  const text=v=>typeof v==='string'?v.slice(0,6000):Array.isArray(v)?v.filter(x=>typeof x==='string').join('; ').slice(0,6000):'';
  const defaults={responsible:text(node?.data?.role),
   participants:text(old.participating_stakeholders),inputs:text(old.trigger_and_inputs),
   outputs:text(old.specific_deliverable),approvals:text(old.decision_owner),
   remarks:[text(old.timing),text(old.must_happen_before)].filter(Boolean).join('\n').slice(0,6000)};
  for(const key of Object.keys(defaults))if(typeof current[key]==='string')defaults[key]=text(current[key]);
  return defaults;
 }
 return Object.freeze({index,scope,breadcrumbs,scopedRows,collapseAtLevel,wrapSelection,activityDetails});
});
