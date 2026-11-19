/* ThinkIt H3b: rigid hierarchical subtree layout.
 * Pure, deterministic. Canonical nodes, edges and dependencies are read-only.
 * Legacy/manually positioned/pinned activities are immutable constraints.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.ThinkItSubtreeLayout=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const validRect=n=>n&&typeof n.id==='string'&&n.id&&
   ['x','y','w','h'].every(k=>typeof n[k]==='number'&&Number.isFinite(n[k]))&&n.w>0&&n.h>0;
 const overlap=(a,b,gap)=>a.x<b.x+b.w+gap&&a.x+a.w+gap>b.x&&
   a.y<b.y+b.h+gap&&a.y+a.h+gap>b.y;
 const hierarchyKey=page=>page.mode==='mind'?'parentId':'outlineParentId';
 const fixed=n=>n.layoutManaged!==true||!!n.pinned;
 function model(page){
   if(!page||!['flow','mind'].includes(page.mode)||!Array.isArray(page.nodes)||!Array.isArray(page.edges))
     throw Error('H3b supports Mind Map and Flowchart pages only');
   const byId=new Map(),kids=new Map(),key=hierarchyKey(page);
   for(const n of page.nodes){
     if(!validRect(n)||byId.has(n.id))throw Error('Invalid or duplicate hierarchy node');
     byId.set(n.id,n);kids.set(n.id,[]);
   }
   for(const n of page.nodes){
     const p=n[key]??null;
     if(p!==null){if(!byId.has(p))throw Error('Missing hierarchy parent: '+p);kids.get(p).push(n.id);}
   }
   // Validate all ancestry chains, including disconnected imported components.
   const states=new Map();
   for(const n of page.nodes){
     if(states.get(n.id)===2)continue;
     const path=[];let cur=n.id;
     while(cur!==null&&states.get(cur)!==2){
       if(states.get(cur)===1)throw Error('Circular hierarchy');
       states.set(cur,1);path.push(cur);cur=byId.get(cur)[key]??null;
     }
     for(const id of path)states.set(id,2);
   }
   function descendants(id){
     const result=[],stack=[id];
     while(stack.length){const curr=stack.pop();result.push(curr);
       const children=kids.get(curr)||[];
       for(let i=children.length-1;i>=0;i--)stack.push(children[i]);
     }
     return result;
   }
   function ancestor(candidate,id){
     let cur=byId.get(id)?.[key]??null;
     while(cur!==null){if(cur===candidate)return true;cur=byId.get(cur)?.[key]??null;}
     return false;
   }
   return {byId,kids,key,descendants,ancestor};
 }
 function bounds(nodes){
   if(!nodes.length)throw Error('Empty subtree bounds');
   const x=Math.min(...nodes.map(n=>n.x)),y=Math.min(...nodes.map(n=>n.y));
   return {x,y,w:Math.max(...nodes.map(n=>n.x+n.w))-x,h:Math.max(...nodes.map(n=>n.y+n.h))-y};
 }
 function directChildren(page,m,anchorId){
   let ids=page.mode==='mind'?[...(m.kids.get(anchorId)||[])]:[...(m.kids.get(anchorId)||[])];
   if(page.mode==='flow'){
     for(const e of page.edges){
       if(e.from===anchorId&&typeof e.to==='string'&&m.byId.has(e.to)&&
           !['reference','annotation'].includes(e.kind))ids.push(e.to);
     }
   }
   ids=[...new Set(ids)].filter(id=>id!==anchorId);
   // An arrow to a nested activity does not create a second movable unit.
   return ids.filter(id=>!ids.some(other=>other!==id&&m.ancestor(other,id)));
 }
 function grouped(page,m,ids,visible){
   return ids.map(id=>{
     const members=m.descendants(id).map(child=>m.byId.get(child));
     const shown=members.filter(n=>visible.has(n.id));
     const envelope=shown.length?bounds(shown):bounds([m.byId.get(id)]);
     const blocking=members.find(fixed);
     const internal=shown.some((a,i)=>shown.slice(i+1).some(b=>overlap(a,b,0)));
     const incoming=page.mode==='flow'?page.edges.filter(e=>e.to===id&&typeof e.from==='string'&&
       !members.some(n=>n.id===e.from)):[]; // multiple unrelated predecessors are not ownership
     return {id,members,shown,envelope,blocking,internal,shared:incoming.length>1};
   });
 }
 function candidateClear(group,dx,dy,occupied,gap){
   return group.shown.every(n=>{
     const p={...n,x:n.x+dx,y:n.y+dy};
     return occupied.every(o=>!overlap(p,o,gap));
   });
 }
 function shifted(group,desired,occupied,direction,gap){
   const startDx=desired.x-group.envelope.x,startDy=desired.y-group.envelope.y;
   if(candidateClear(group,startDx,startDy,occupied,gap))return {dx:startDx,dy:startDy};
   const vertical=direction==='down'||direction==='up',sign=direction==='down'||direction==='right'?1:-1;
   const pitchForward=(vertical?group.envelope.h:group.envelope.w)+gap+20;
   const pitchCross=(vertical?group.envelope.w:group.envelope.h)+gap+12;
   for(let level=0;level<=18;level++)for(let lane=0;lane<=12;lane++){
     for(const side of lane===0?[0]:[lane,-lane]){
       if(level===0&&side===0)continue;
       const forward=sign*level*pitchForward,cross=side*pitchCross;
       const dx=startDx+(vertical?cross:forward),dy=startDy+(vertical?forward:cross);
       if(candidateClear(group,dx,dy,occupied,gap))return {dx,dy};
     }
   }
   return null;
 }
 function layoutGroups(page,m,groups,anchor,{direction,gap,visible,protect}){
   const conflicts=[],positions={},movedSubtrees=[];
   // A unit with any fixed descendant is fixed as a whole.
   const canMove=g=>!g.blocking&&!g.internal&&!g.shared&&!g.members.some(n=>protect.has(n.id));
   const movable=groups.filter(canMove);
   const movableIds=new Set(movable.flatMap(g=>g.members.map(n=>n.id)));
   const occupied=page.nodes.filter(n=>visible.has(n.id)&&!movableIds.has(n.id)).map(n=>({...n}));
   const vertical=direction==='down'||direction==='up';
   const partitions=page.mode==='mind'?[
     groups.filter(g=>g.rootSide==='left'),groups.filter(g=>g.rootSide==='right')
   ]:[groups];
   for(const part of partitions){
     const total=part.reduce((t,g)=>t+(vertical?g.envelope.w:g.envelope.h),0)+
       Math.max(0,part.length-1)*gap;
     let cursor=(vertical?anchor.x+anchor.w/2:anchor.y+anchor.h/2)-total/2;
     for(const g of part){
       const span=vertical?g.envelope.w:g.envelope.h,current=cursor;cursor+=span+gap;
       if(!canMove(g)){
         if(g.blocking)conflicts.push({code:'FIXED_DESCENDANT',rootId:g.id,nodeId:g.blocking.id,
           reason:g.blocking.pinned?'pinned':'manual_or_legacy'});
         else if(g.internal)conflicts.push({code:'INTERNAL_OVERLAP',rootId:g.id});
         else if(g.shared)conflicts.push({code:'SHARED_PREDECESSORS',rootId:g.id});
         else conflicts.push({code:'PROTECTED_BRANCH',rootId:g.id});
         continue;
       }
       const side=page.mode==='mind'?g.rootSide:direction;
       const desired=vertical?{
         x:current,y:direction==='up'?anchor.y-g.envelope.h-gap:anchor.y+anchor.h+gap
       }:{
         x:side==='left'?anchor.x-g.envelope.w-gap:anchor.x+anchor.w+gap,y:current
       };
       const shift=shifted(g,desired,occupied,side,gap);
       if(!shift){conflicts.push({code:'NO_FREE_CORRIDOR',rootId:g.id});for(const n of g.shown)occupied.push({...n});continue;}
       const actual=g.members.map(n=>({...n,x:n.x+shift.dx,y:n.y+shift.dy}));
       for(const n of actual)if(n.x!==m.byId.get(n.id).x||n.y!==m.byId.get(n.id).y)
         positions[n.id]={x:n.x,y:n.y};
       for(const n of actual)if(visible.has(n.id))occupied.push(n);
       if(shift.dx||shift.dy)movedSubtrees.push({rootId:g.id,ids:g.members.map(n=>n.id)});
     }
   }
   return {positions,conflicts,movedSubtrees};
 }
 function planBranch(page,anchorId,{direction='down',gap=32,visibleIds,protectIds=[]}={}){
   const m=model(page),anchor=m.byId.get(anchorId);
   if(!anchor)throw Error('Unknown subtree anchor');
   if(!['down','up','left','right'].includes(direction))throw Error('Unsupported subtree direction');
   const visible=new Set(visibleIds??page.nodes.map(n=>n.id)),protect=new Set(protectIds);
   // Hidden nested children have no active canvas footprint. Their positions
   // change only when their visible parent moves rigidly as part of a unit.
   const ids=directChildren(page,m,anchorId).filter(id=>visible.has(id));
   if(!ids.length)return {positions:{},conflicts:[],movedSubtrees:[]};
   const groups=grouped(page,m,ids,visible);
   for(const g of groups){
     const n=m.byId.get(g.id);
     g.rootSide=page.mode==='mind'?(n.mindSide==='left'||n.mindSide==='right'?n.mindSide:
       n.x+n.w/2<anchor.x+anchor.w/2?'left':'right'):direction;
   }
   return layoutGroups(page,m,groups,anchor,{direction:page.mode==='mind'?'right':direction,
     gap:Math.max(16,Math.min(160,Number(gap)||32)),visible,protect});
 }
 function repairVisible(page,visibleIds,{protectIds=[],gap=18}={}){
   const m=model(page),visible=new Set(visibleIds),protect=new Set(protectIds);
   const key=m.key,unitRoots=[];
   for(const n of page.nodes){
     if(fixed(n)||protect.has(n.id))continue;
     const p=m.byId.get(n[key]);
     // A managed ancestor owns the complete rigid subtree. Never move one
     // nested activity independently of its managed subprocess.
     if(p?.layoutManaged===true&&!p.pinned)continue;
     unitRoots.push(n.id);
   }
   const groups=grouped(page,m,unitRoots,visible);
   const movable=groups.filter(g=>!g.blocking&&!g.internal&&!g.shared&&!g.members.some(n=>protect.has(n.id)));
   const ids=new Set(movable.flatMap(g=>g.members.map(n=>n.id)));
   const occupied=page.nodes.filter(n=>visible.has(n.id)&&!ids.has(n.id)).map(n=>({...n}));
   const positions={},conflicts=[],movedSubtrees=[];
   for(const g of groups){
     if(!movable.includes(g)){if(g.blocking)conflicts.push({code:'FIXED_DESCENDANT',rootId:g.id,nodeId:g.blocking.id,
       reason:g.blocking.pinned?'pinned':'manual_or_legacy'});continue;}
     const moved=shifted(g,{x:g.envelope.x,y:g.envelope.y},occupied,'down',gap);
     if(!moved){conflicts.push({code:'NO_FREE_CORRIDOR',rootId:g.id});occupied.push(...g.shown);continue;}
     for(const n of g.members){const x=n.x+moved.dx,y=n.y+moved.dy;
       if(x!==n.x||y!==n.y)positions[n.id]={x,y};
       if(visible.has(n.id))occupied.push({...n,x,y});
     }
     if(moved.dx||moved.dy)movedSubtrees.push({rootId:g.id,ids:g.members.map(n=>n.id)});
   }
   return {positions,conflicts,movedSubtrees};
 }
 return Object.freeze({planBranch,repairVisible});
});