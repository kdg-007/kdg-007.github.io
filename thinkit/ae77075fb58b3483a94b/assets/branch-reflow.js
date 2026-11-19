/* ThinkIt H3a — conservative branch reflow and visible-collision repair.
 * Only newly auto-managed, unpinned leaf shapes may move. Legacy shapes and
 * user-placed objects are immutable obstacles. No persistence or DOM writes.
 * H3b may add nested subtree envelopes and route optimization separately.
 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.ThinkItBranchReflow=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const validRect=n=>n&&typeof n.id==='string'&&
   ['x','y','w','h'].every(k=>Number.isFinite(n[k]))&&n.w>0&&n.h>0;
 const collides=(a,b,gap=18)=>a.x<b.x+b.w+gap&&a.x+a.w+gap>b.x&&
   a.y<b.y+b.h+gap&&a.y+a.h+gap>b.y;
 function valid(page){
   if(!page||!['flow','mind'].includes(page.mode)||!Array.isArray(page.nodes)||!Array.isArray(page.edges))throw Error('Unsupported reflow page');
   if(page.nodes.some(n=>!validRect(n)))throw Error('Malformed geometry in reflow page');
   const ids=new Set(page.nodes.map(n=>n.id));
   if(ids.size!==page.nodes.length)throw Error('Duplicate reflow node IDs');
 }
 function place(nodes,anchor,preferred,direction,gap=18){
   if(!['down','right','up','left'].includes(direction))throw Error('Invalid reflow direction');
   const obstacles=nodes.filter(n=>n.id!==anchor.id);
   const clear=p=>obstacles.every(o=>!collides({...anchor,x:p.x,y:p.y},o,gap));
   if(clear(preferred))return preferred;
   const vertical=direction==='down'||direction==='up';
   const sign=direction==='down'||direction==='right'?1:-1;
   // First try alternate lanes close to preferred, then advance along flow.
   const pitchCross=(vertical?anchor.w:anchor.h)+gap+8;
   const pitchForward=(vertical?anchor.h:anchor.w)+gap+12;
   for(let level=0;level<=50;level++)for(let lane=0;lane<=25;lane++){
     for(const side of lane===0?[0]:[lane,-lane]){
       const forward=sign*level*pitchForward,cross=side*pitchCross;
       const next={x:preferred.x+(vertical?cross:forward),y:preferred.y+(vertical?forward:cross)};
       if(clear(next))return next;
     }
   }
   // If every searched lane is blocked, overflow to a verified free rectangle.
   const right=Math.max(preferred.x,...obstacles.map(n=>n.x+n.w))+gap+anchor.w;
   return {x:right,y:preferred.y};
 }
 function childIds(page,anchorId){
   if(page.mode==='mind')return page.nodes.filter(n=>n.parentId===anchorId).map(n=>n.id);
   const set=new Set();
   for(const e of page.edges)if(e.from===anchorId&&typeof e.to==='string'&&e.to!==anchorId)set.add(e.to);
   // Outline-only Flowchart items have no visual flow arrow yet.
   for(const n of page.nodes)if(n.outlineParentId===anchorId)set.add(n.id);
   return [...set];
 }
 function planBranch(page,anchorId,{direction='down',gap=24}={}){
   valid(page);
   const index=new Map(page.nodes.map(n=>[n.id,n])),anchor=index.get(anchorId);
   if(!anchor)throw Error('Unknown reflow anchor');
   const children=childIds(page,anchorId).map(id=>index.get(id)).filter(Boolean);
   if(children.length===0)return {};
   const movable=children.filter(n=>n.layoutManaged===true&&!n.pinned&&
     (page.mode==='mind'?!page.nodes.some(k=>k.parentId===n.id):
       !page.nodes.some(k=>k.outlineParentId===n.id)&&!page.edges.some(e=>e.from===n.id)&&
       page.edges.filter(e=>e.to===n.id).length<=1));
   if(!movable.length)return {};
   const movableIds=new Set(movable.map(n=>n.id));
   // Keep all legacy/manual/pinned shapes and external connected branches fixed.
   const occupied=page.nodes.filter(n=>!movableIds.has(n.id)).map(n=>({...n}));
   const changes={},space=Math.max(12,Math.min(120,Number(gap)||24)),vertical=direction==='down'||direction==='up';
   const sideOf=n=>page.mode==='mind'?(n.mindSide==='left'||n.mindSide==='right'?n.mindSide:n.x+n.w/2<anchor.x+anchor.w/2?'left':'right'):'all';
   const groups=page.mode==='mind'?[children.filter(n=>sideOf(n)==='left'),children.filter(n=>sideOf(n)!=='left')]:[children];
   for(let groupIndex=0;groupIndex<groups.length;groupIndex++){
     const group=groups[groupIndex];
     if(!group.length)continue;
     const mind=page.mode==='mind',horizontal=mind||!vertical;
     const sizes=group.map(n=>horizontal?n.h:n.w);
     const total=sizes.reduce((a,b)=>a+b,0)+space*(group.length-1);
     let cursor=(horizontal?anchor.y+anchor.h/2:anchor.x+anchor.w/2)-total/2;
     for(let i=0;i<group.length;i++){
       const n=group[i],dim=sizes[i],current=cursor;cursor+=dim+space;
       if(!movableIds.has(n.id))continue;
       const side=mind?(groupIndex===0?'left':'right'):direction;
       const preferred=mind?{x:side==='left'?anchor.x-96-n.w:anchor.x+anchor.w+96,y:current}:
         vertical?{x:current,y:direction==='up'?anchor.y-94-n.h:anchor.y+anchor.h+94}:
           {x:direction==='left'?anchor.x-94-n.w:anchor.x+anchor.w+94,y:current};
       const candidate=place([...occupied,n],n,preferred,side);
       if(candidate.x!==n.x||candidate.y!==n.y)changes[n.id]=candidate;
       occupied.push({...n,x:candidate.x,y:candidate.y});
     }
   }
   return changes;
 }
 function repairVisible(page,visibleIds,{protectIds=[],gap=18}={}){
   valid(page);
   const visible=new Set(visibleIds),protectedIds=new Set(protectIds);
   const nodes=page.nodes.filter(n=>visible.has(n.id));
   const moving=nodes.filter(n=>n.layoutManaged===true&&!n.pinned&&!protectedIds.has(n.id));
   const movingIds=new Set(moving.map(n=>n.id));
   const occupied=nodes.filter(n=>!movingIds.has(n.id)).map(n=>({...n}));
   const changes={};
   for(const n of moving){
     const candidate=place([...occupied,n],n,{x:n.x,y:n.y},'down',gap);
     if(candidate.x!==n.x||candidate.y!==n.y)changes[n.id]=candidate;
     occupied.push({...n,x:candidate.x,y:candidate.y});
   }
   return changes;
 }
 return Object.freeze({planBranch,repairVisible});
});