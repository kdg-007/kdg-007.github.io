/* ThinkIt H3b — bounded obstacle-aware routing lanes.
 * Pure display helper. Scans all visible obstacles, not an arbitrary first 30.
 * Only suggests automatic candidate corridors; manual bend coordinates win.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.ThinkItFlowRouteLanes=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function candidates(nodes,from,to,axis,{clearance=26,limit=32}={}){
   if(!['x','y'].includes(axis)||![from?.x,from?.y,to?.x,to?.y].every(Number.isFinite))
     throw Error('Invalid orthogonal routing corridor');
   const min=(axis==='x'?Math.min(from.y,to.y):Math.min(from.x,to.x))-80;
   const max=(axis==='x'?Math.max(from.y,to.y):Math.max(from.x,to.x))+80;
   const mid=axis==='x'?(from.x+to.x)/2:(from.y+to.y)/2;
   const options=[];
   for(const n of nodes){
     if(!n||!Number.isFinite(n.x)||!Number.isFinite(n.y)||
       !Number.isFinite(n.w)||!Number.isFinite(n.h))continue;
     const a=axis==='x'?n.y:n.x,b=a+(axis==='x'?n.h:n.w);
     // Only obstacles capable of affecting the route's transverse corridor.
     if(b<min||a>max)continue;
     const v=axis==='x'?[n.x-clearance,n.x+n.w+clearance]:
       [n.y-clearance,n.y+n.h+clearance];
     for(const lane of v)options.push({lane,score:Math.abs(lane-mid)});
   }
   options.sort((a,b)=>a.score-b.score||a.lane-b.lane);
   const out=[],used=new Set();
   for(const o of options){
     const key=Math.round(o.lane*2)/2;
     if(used.has(key))continue;
     used.add(key);out.push(o.lane);
     if(out.length>=limit)break;
   }
   return out;
 }
 // Index both transverse axes once per route. Every relevant obstacle remains
 // eligible; spatial buckets only avoid rescanning distant shapes for every
 // candidate segment. The exact open-boundary collision rule is unchanged.
 function obstacleCounter(nodes,{clearance=9,cellSize=256}={}){
   if(!Number.isFinite(clearance)||clearance<0||!Number.isFinite(cellSize)||cellSize<=0)
     throw Error('Invalid routing obstacle index');
   const xs=new Map(),ys=new Map(),all=[];
   const add=(map,lo,hi,box)=>{
     for(let k=Math.floor(lo/cellSize);k<=Math.floor(hi/cellSize);k++){
       if(!map.has(k))map.set(k,[]);map.get(k).push(box);
     }
   };
   for(const n of nodes){
     if(!n||![n.x,n.y,n.w,n.h].every(Number.isFinite))continue;
     const box={id:n.id,x1:n.x-clearance,x2:n.x+n.w+clearance,
       y1:n.y-clearance,y2:n.y+n.h+clearance};
     all.push(box);add(xs,box.x1,box.x2,box);add(ys,box.y1,box.y2,box);
   }
   return function count(p,q,skipSource,skipTarget){
     const horizontal=Math.abs(p.y-q.y)<.001,vertical=Math.abs(p.x-q.x)<.001;
     const boxes=horizontal?(ys.get(Math.floor(p.y/cellSize))||[]):
       vertical?(xs.get(Math.floor(p.x/cellSize))||[]):all;
     let hits=0;
     for(const n of boxes){
       if(n.id===skipSource||n.id===skipTarget)continue;
       if(horizontal?p.y>n.y1&&p.y<n.y2&&Math.max(Math.min(p.x,q.x),n.x1)<Math.min(Math.max(p.x,q.x),n.x2):
          vertical?p.x>n.x1&&p.x<n.x2&&Math.max(Math.min(p.y,q.y),n.y1)<Math.min(Math.max(p.y,q.y),n.y2):true)hits++;
     }
     return hits;
   };
 }
 return Object.freeze({candidates,obstacleCounter});
});
