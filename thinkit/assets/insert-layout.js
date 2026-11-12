/* ThinkIt · isolated insertion geometry (A1)
 * Auto-placement applies only to the newly created shape. Existing coordinates,
 * pinned objects, WBS/dependencies, connector IDs and user-made layout stay put.
 * H3 will handle full branch reflow and connector corridor optimization.
 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.ThinkItInsertLayout=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const finite=n=>typeof n==='number'&&Number.isFinite(n);
 const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
 function inheritedSize(source,fallback){
   const w=source?.w,h=source?.h;
   return {w:finite(w)&&w>=50&&w<20000?w:fallback?.[0]??168,
     h:finite(h)&&h>=40&&h<20000?h:fallback?.[1]??68};
 }
 function overlaps(a,b,clearance){
   return a.x<b.x+b.w+clearance&&a.x+a.w+clearance>b.x&&
     a.y<b.y+b.h+clearance&&a.y+a.h+clearance>b.y;
 }
 function place(nodes,nodeId,{preferred,direction='down',clearance=18,maxLanes=18,maxSteps=24}={}){
   if(!Array.isArray(nodes)||!nodeId)throw Error('Invalid insertion model');
   const target=nodes.find(n=>n.id===nodeId);
   if(!target||!finite(target.w)||!finite(target.h)||target.w<1||target.h<1)
     throw Error('Inserted shape must have valid dimensions');
   if(!preferred||!finite(preferred.x)||!finite(preferred.y))throw Error('Insertion position unavailable');
   if(!['down','up','left','right'].includes(direction))throw Error('Invalid insertion direction');
   const existing=nodes.filter(n=>n!==target&&finite(n.x)&&finite(n.y)&&finite(n.w)&&finite(n.h));
   const clear=p=>!existing.some(n=>overlaps({x:p.x,y:p.y,w:target.w,h:target.h},n,clearance));
   const origin={x:preferred.x,y:preferred.y};
   if(clear(origin))return origin;
   const vertical=direction==='down'||direction==='up';
   const sign=direction==='left'||direction==='up'?-1:1;
   const crossStep=(vertical?target.w:target.h)+clearance+8;
   const forwardStep=(vertical?target.h:target.w)+clearance+12;
   const candidates=[];
   // Explore nearby lanes before progressively lengthening the process chain.
   // No random offsets: reopening and inserting the same content is repeatable.
   for(let d=0;d<=maxSteps;d++)for(let l=0;l<=maxLanes;l++){
     if(d===0&&l===0)continue;
     for(const lane of l===0?[0]:[l,-l]){
       const cross=lane*crossStep,forward=sign*d*forwardStep;
       candidates.push({d,lane,score:d*1.1+Math.abs(lane)*0.95,
         x:origin.x+(vertical?cross:forward),
         y:origin.y+(vertical?forward:cross)});
     }
   }
   candidates.sort((a,b)=>a.score-b.score||Math.abs(a.lane)-Math.abs(b.lane)||a.d-b.d||b.lane-a.lane);
   for(const candidate of candidates)if(clear(candidate))return {x:candidate.x,y:candidate.y};
   // Preserve existing geometry even if a very dense imported map needs more
   // canvas space. Never move or overwrite another node to force placement.
   const ext=existing.reduce((m,n)=>Math.max(m,n.x+n.w),origin.x);
   return {x:ext+clearance+32,y:origin.y};
 }
 return Object.freeze({inheritedSize,place});
});