/* ThinkIt Constraint Review Engine v0.1 — bundled offline, optional feature. */
const ThinkItConstraints=(()=>{
/**
 * ThinkIt Constraint Review Engine — independent, read-only architecture prototype.
 * Does NOT replace the production ThinkIt v0.9.15 editor or the production radius() routine.
 * It interprets AEIOUX review bands as schematic drawing-unit preferences, not code limits.
 * All suggestions are preview-only until explicitly applied to a COPY of the input document.
 */
const SCHEMA = 'thinkit-constraint-review-v1';
const DEFAULTS = Object.freeze({
  bands: {A: {max:45, weight:5}, E: {max:105, weight:3}, I: {max:190, weight:1.5}, X: {min:95, weight:5}},
  width:1100, height:790, maxMove:65, collisionGap:-10,
  allowedWorsening:1.5, requiredImprovement:1.5, maxPlanMoves:3,
  radiusScale:5, padding:12,
});
const cp = o => JSON.parse(JSON.stringify(o));
const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const numeric = x => Number.isFinite(Number(x)) ? Number(x) : NaN;
const round = (x, n=2) => Number(x.toFixed(n));
const relationKey = (a,b) => [String(a),String(b)].sort().join('|');
const between = (v,a,b) => Math.max(a,Math.min(b,v));
const title = s => String(s?.name || s?.id || 'Untitled');
function signatureOf(document,opts={}) {
  // Non-cryptographic stale-preview guard. The production editor must still use
  // its ordinary transaction/Undo mechanism when committing an approved move.
  const {bubble}=locateBubbleData(document);
  const normalized=JSON.stringify({generated:bubble.generated,spaces:bubble.spaces.map(s=>[s.id,s.x,s.y,s.area,s.parentId,s.pinned,s.scale,s.stretchX,s.stretchY,s.shape,s.rotation]),relations:Object.entries(bubble.relations||{}).sort(),config:[opts.width,opts.height,opts.radiusScale,opts.collisionGap,opts.maxMove,opts.bands]});
  let hash=2166136261;
  for(let i=0;i<normalized.length;i++){hash^=normalized.charCodeAt(i);hash=Math.imul(hash,16777619);}
  return (hash>>>0).toString(16)+':'+normalized.length;
}
function getId(s){return String(s?.id||'');}

function locateBubbleData(document) {
  if (!isObject(document)) throw new Error('Expected a JSON project object.');
  if (Array.isArray(document.spaces) && isObject(document.relations)) return {bubble:document, pageIndex:null, wrapped:false};
  if (isObject(document.bubbleData) && Array.isArray(document.bubbleData.spaces)) return {bubble:document.bubbleData,pageIndex:null,wrapped:'bubbleData'};
  if (Array.isArray(document.pages)) {
    const index=document.pages.findIndex(p=>isObject(p?.bubbleData)&&Array.isArray(p.bubbleData.spaces));
    if(index>=0)return {bubble:document.pages[index].bubbleData,pageIndex:index,wrapped:'pages'};
  }
  throw new Error('No Bubble Diagram found. The source remains unchanged. Supported: Bubble model or DIAGRAMIT project pages[].bubbleData.');
}
function validateBubble(bubble){
  const errors=[];
  if(!Array.isArray(bubble?.spaces)) return ['Missing spaces array'];
  if(!isObject(bubble?.relations)) errors.push('Missing adjacency relations object');
  const ids=new Set();const byId=new Map();
  for(const s of bubble.spaces){
    const id=getId(s);
    if(!id||ids.has(id))errors.push(`Missing or duplicate space ID: ${id||'(blank)'}`);
    ids.add(id);byId.set(id,s);
    if(!Number.isFinite(numeric(s.x))||!Number.isFinite(numeric(s.y)))errors.push(`Invalid position: ${id}`);
    if(!(numeric(s.area)>0))errors.push(`Invalid target area: ${id}`);
  }
  for(const s of bubble.spaces){
    const id=getId(s),p=String(s.parentId||'');
    if(p&&!byId.has(p))errors.push(`Orphan parent for ${id}: ${p}`);
    const seen=new Set([id]);let q=p;
    while(q){if(seen.has(q)){errors.push(`Circular parent relationship at ${id}`);break;}
      seen.add(q);q=String(byId.get(q)?.parentId||'');if(q&&!byId.has(q))break;
    }
  }
  for(const [key,val] of Object.entries(bubble.relations||{})){
    const parts=key.split('|');if(parts.length!==2||!parts.every(p=>byId.has(p)))errors.push(`Orphan relation: ${key}`);
    if(!'AEIOUX'.includes(val?.rating||'U')||(val?.rating||'U').length!==1)errors.push(`Invalid AEIOUX rating: ${key}`);
  }
  return [...new Set(errors)];
}
/** Radius proxy is deliberately replaceable. The real app must inject its own radius(). */
function defaultRadius(space,config=DEFAULTS){
  const area=numeric(space.area);
  const scale=numeric(space.scale);
  return Math.sqrt(Math.max(1,area)/Math.PI)*(config.radiusScale||5)*(scale>0?scale:1);
}
function context(input, opts={}) {
  const model=locateBubbleData(input).bubble;
  const config={...DEFAULTS,...opts,bands:{...DEFAULTS.bands,...(opts.bands||{})}};
  const errors=validateBubble(model);
  const spaces=model.spaces;
  const byId=new Map(spaces.map(s=>[getId(s),s]));
  const children=new Map(spaces.map(s=>[getId(s),[]]));
  for(const s of spaces)if(s.parentId&&children.has(s.parentId))children.get(s.parentId).push(getId(s));
  const descendants=new Map();
  for(const s of spaces){const root=getId(s),stack=[...(children.get(root)||[])],visited=new Set(),result=[];
    while(stack.length){const item=stack.pop();if(visited.has(item))continue;visited.add(item);result.push(item);stack.push(...(children.get(item)||[]));}
    descendants.set(root,result);
  }
  const rootOf=id=>{let cur=byId.get(id),seen=new Set();while(cur?.parentId&&!seen.has(cur.parentId)&&byId.has(cur.parentId)){seen.add(getId(cur));cur=byId.get(cur.parentId);}return getId(cur)||id;};
  const nested=(a,b)=>descendants.get(a)?.includes(b)||descendants.get(b)?.includes(a);
  const radius=new Map(spaces.map(s=>[getId(s),Number.isFinite(opts.radius?.(s))?opts.radius(s):defaultRadius(s,config)]));
  const roots=spaces.filter(s=>!s.parentId).map(getId);
  const rel=[];
  for(const [key,val] of Object.entries(model.relations||{})){
    const ids=key.split('|'),rating=String(val?.rating||'U');
    if(ids.length!==2||!byId.has(ids[0])||!byId.has(ids[1])||!config.bands[rating]||nested(ids[0],ids[1]))continue;
    rel.push({key:relationKey(ids[0],ids[1]),a:ids[0],b:ids[1],rating,...config.bands[rating]});
  }
  const gap=(a,b,moveId,dx=0,dy=0)=>{
    const A=byId.get(a),B=byId.get(b);
    const aa=(moveId?.has(a)?{x:numeric(A.x)+dx,y:numeric(A.y)+dy}:A);
    const bb=(moveId?.has(b)?{x:numeric(B.x)+dx,y:numeric(B.y)+dy}:B);
    return Math.hypot(aa.x-bb.x,aa.y-bb.y)-radius.get(a)-radius.get(b);
  };
  const err=(rel,g)=>rel.max!==undefined?Math.max(0,g-rel.max):Math.max(0,rel.min-g);
  const errorsFor=new Map();
  for(const relObj of rel){const e=err(relObj,gap(relObj.a,relObj.b));errorsFor.set(relObj.key,e);}
  return {model,config,errors,spaces,byId,children,descendants,rootOf,nested,radius,roots,rel,gap,err,errorsFor};
}
function collisionPairs(C){
  const groups=new Map();for(const s of C.spaces){const key=String(s.parentId||'');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(getId(s));}
  const all=[];
  for(const group of groups.values())for(let i=0;i<group.length;i++)for(let j=i+1;j<group.length;j++){
    const a=group[i],b=group[j];if(C.nested(a,b))continue;
    all.push([a,b]);
  }
  return all;
}
function movementCollisions(C,root){
  // Only sibling comparisons crossing the moving subtree boundary can change.
  // This avoids scanning unrelated n² overlap pairs for every proposal.
  const moved=involved(root,C),siblings=new Map();
  for(const s of C.spaces){const p=String(s.parentId||'');if(!siblings.has(p))siblings.set(p,[]);siblings.get(p).push(getId(s));}
  const pairs=[];
  for(const id of moved){const p=String(C.byId.get(id)?.parentId||'');for(const other of siblings.get(p)||[]){
    if(!moved.has(other)&&!C.nested(id,other))pairs.push([id,other]);
  }}
  return pairs;
}
function auditProject(document,opts={}){
  const C=context(document,opts),out=[];
  if(C.errors.length){for(const message of C.errors)out.push({type:'integrity',severity:'error',message});}
  if(C.model.generated===false){return {schema:SCHEMA,issues:out,summary:{spaces:C.spaces.length,requirements:C.rel.length,attention:0,errors:C.errors.length,weightedPenalty:0,overlaps:0,notEvaluated:C.rel.length},warnings:['This diagram has not been generated. AEIOUX distances cannot be evaluated yet.']};}
  for(const rel of C.rel){const g=C.gap(rel.a,rel.b),e=C.err(rel,g);
    if(e>1e-6)out.push({type:'rating',severity:'attention',id:rel.key,ids:[rel.a,rel.b],rating:rel.rating,message:`${title(C.byId.get(rel.a))} ↔ ${title(C.byId.get(rel.b))}`,gap:round(g),error:round(e),priority:round(rel.weight*e),target:rel.max!==undefined?`≤ ${rel.max}`:`≥ ${rel.min}`});
  }
  for(const [a,b] of collisionPairs(C)){const gap=C.gap(a,b);if(gap<C.config.collisionGap)out.push({type:'overlap',severity:'attention',id:relationKey(a,b),ids:[a,b],message:`Possible overlap: ${title(C.byId.get(a))} ↔ ${title(C.byId.get(b))}`,gap:round(gap),error:round(C.config.collisionGap-gap),priority:round((C.config.collisionGap-gap)*7)});}
  out.sort((a,b)=>(b.priority??Infinity)-(a.priority??Infinity)||String(a.id||a.message).localeCompare(String(b.id||b.message)));
  const ratedPenalty=out.filter(x=>x.type==='rating'||x.type==='overlap').reduce((n,x)=>n+(x.priority||0),0);
  return {schema:SCHEMA,issues:out,summary:{spaces:C.spaces.length,requirements:C.rel.length,attention:out.filter(x=>x.severity==='attention').length,errors:C.errors.length,weightedPenalty:round(ratedPenalty),overlaps:out.filter(x=>x.type==='overlap').length},warnings:['AEIOUX review bands are heuristic drawing-unit thresholds, not architectural compliance limits.','Bubble radii are provisional unless the production app supplies its exact radius() implementation.']};
}
function involved(root,C){return new Set([root,...(C.descendants.get(root)||[])]);}
function assessCandidate(C,issue,root,dx,dy,collisions){
  const group=involved(root,C);
  if([...group].some(id=>C.byId.get(id)?.pinned))return null;
  let changed=false;for(const id of group){const s=C.byId.get(id),r=C.radius.get(id);const nx=numeric(s.x)+dx,ny=numeric(s.y)+dy;
    const loX=C.config.padding+r,hiX=C.config.width-C.config.padding-r,loY=C.config.padding+r,hiY=C.config.height-C.config.padding-r;
    const wasOutside=s.x<loX||s.x>hiX||s.y<loY||s.y>hiY;
    if((nx<loX||nx>hiX||ny<loY||ny>hiY)&&(!wasOutside || Math.max(loX-nx,nx-hiX,loY-ny,ny-hiY)>Math.max(loX-s.x,s.x-hiX,loY-s.y,s.y-hiY)+.01))return null;
    changed ||= Math.abs(dx)+Math.abs(dy)>0;
  }
  if(!changed)return null;
  let weightedDelta=0,targetImprovement=0,affected=0,newBad=0,blocked=null;
  for(const rel of C.rel){if(!group.has(rel.a)&&!group.has(rel.b))continue;
    const prev=C.errorsFor.get(rel.key),next=C.err(rel,C.gap(rel.a,rel.b,group,dx,dy));
    const isTarget=issue.type==='rating'&&issue.id===rel.key;
    if(!isTarget&&next>prev+C.config.allowedWorsening){blocked=`Worsens ${rel.rating} relationship ${rel.key}`;break;}
    if(!isTarget&&prev<.01&&next>1.5){blocked=`Creates a new unsatisfied ${rel.rating} relationship`;break;}
    weightedDelta+=(next-prev)*rel.weight;
    if(isTarget)targetImprovement=prev-next;
    affected++;
    if(next>prev)newBad++;
  }
  if(blocked)return null;
  for(const [a,b] of collisions){if(group.has(a)===group.has(b))continue;
    const g0=C.gap(a,b),g1=C.gap(a,b,group,dx,dy),v0=Math.max(0,C.config.collisionGap-g0),v1=Math.max(0,C.config.collisionGap-g1);
    if(v1>v0+C.config.allowedWorsening)return null;
    if(v0<.1&&v1>1.0)return null;
    weightedDelta+=(v1-v0)*7;
    if(issue.type==='overlap'&&issue.id===relationKey(a,b))targetImprovement=v0-v1;
  }
  if(targetImprovement<C.config.requiredImprovement)return null;
  const dist=Math.hypot(dx,dy),score=-(weightedDelta+dist*.015);
  if(score<.2)return null;
  return {root,delta:{x:round(dx,6),y:round(dy,6)},distance:round(dist),score:round(score),targetImprovement:round(targetImprovement),affectedRelationships:affected,otherRegressions:newBad};
}
function proposeForIssue(document,issue,opts={}){
  const C=context(document,opts);
  if(C.errors.length)return {available:false,reason:'Invalid source project; correct integrity errors before suggesting changes.',issue};
  if(C.model.generated===false)return {available:false,reason:'Generate the diagram before attempting geometric adjustments.',issue};
  if(!issue||!['rating','overlap'].includes(issue.type)||!Array.isArray(issue.ids))return {available:false,reason:'Choose an AEIOUX conflict or potential overlap.',issue};
  const [a,b]=issue.ids;if(!C.byId.has(a)||!C.byId.has(b)||C.nested(a,b))return {available:false,reason:'Missing spaces or nested containment; edit manually.',issue};
  const targetRel=C.rel.find(r=>r.key===issue.id);
  if(issue.type==='rating'&&!targetRel)return {available:false,reason:'No supported A/E/I/X relationship for this pair.',issue};
  const roots=[...new Set([C.rootOf(a),C.rootOf(b)])];
  const results=[];
  for(const root of roots){const collisions=movementCollisions(C,root);const moving=C.rootOf(a)===root?a:b,other=moving===a?b:a;
    const m=C.byId.get(moving),o=C.byId.get(other);
    let vx=o.x-m.x,vy=o.y-m.y;let len=Math.hypot(vx,vy);
    if(len<1e-5){vx=1;vy=0;len=1;}
    vx/=len;vy/=len;
    if(issue.type==='overlap'||issue.rating==='X'){vx=-vx;vy=-vy;}
    const desired=Math.max(C.config.requiredImprovement*2,Math.min(C.config.maxMove,issue.error||C.config.maxMove));
    for(const angle of [0,-15,15,-30,30,-45,45,-60,60,-75,75]){
      const th=angle*Math.PI/180,ux=vx*Math.cos(th)-vy*Math.sin(th),uy=vx*Math.sin(th)+vy*Math.cos(th);
      for(const frac of [1,.75,.5,.25]){
        const d=between(desired*frac,4,C.config.maxMove),res=assessCandidate(C,issue,root,ux*d,uy*d,collisions);
        if(res)results.push({...res,angle,issueId:issue.id,issueType:issue.type,rating:issue.rating||null});
      }
    }
  }
  results.sort((a,b)=>b.score-a.score||a.distance-b.distance||a.root.localeCompare(b.root)||a.angle-b.angle);
  if(!results.length)return {available:false,issue,reason:'No safe bounded move was found. Locked branches, other relationships, overlap or canvas boundaries may constrain this pair.'};
  return {available:true,issue,candidate:results[0],alternatives:results.slice(1,4),inspected:results.length,sourceFingerprint:signatureOf(document,opts),sourceOptions:opts};
}
function applyMoveToCopy(document,proposal){
  if(!proposal?.available||!proposal.candidate)throw new Error('No accepted candidate to apply.');
  if(proposal.sourceFingerprint!==signatureOf(document,proposal.sourceOptions||{}))throw new Error('The project changed after preview. Request another proposal before applying.');
  const src=cp(document),C=context(src,proposal.sourceOptions||{});
  if(C.errors.length)throw new Error('Project contains integrity errors.');
  const root=proposal.candidate.root;
  if(!C.byId.has(root))throw new Error('Proposal references a missing space.');
  const group=involved(root,C);
  if([...group].some(id=>C.byId.get(id)?.pinned))throw new Error('Selected group contains a position lock.');
  const {x,y}=proposal.candidate.delta;
  for(const id of group){const s=C.byId.get(id);s.x=round(numeric(s.x)+x,6);s.y=round(numeric(s.y)+y,6);}
  // This is only a portable offline preview; production should use its own
  // moveWithChildren() and checkpoint() to move attached annotations correctly.
  for(const note of C.model.notes||[]){if(group.has(String(note.attachedTo||''))&&Number.isFinite(numeric(note.x))&&Number.isFinite(numeric(note.y))){
    note.x=round(note.x+x,6);note.y=round(note.y+y,6);
  }}
  return src;
}
function proposePlan(document,opts={}){
  let working=cp(document);const steps=[],max=between(Number(opts.maxPlanMoves)||DEFAULTS.maxPlanMoves,1,8),used=new Set();
  const initial=auditProject(working,opts);if(initial.summary.errors)return {initial,steps,final:initial,previewDocument:working,warning:'Repair model integrity first.'};
  for(let n=0;n<max;n++){
    const audit=auditProject(working,opts);
    let chosen=null;
    for(const issue of audit.issues.filter(x=>x.type!=='integrity').slice(0,30)){
      const prop=proposeForIssue(working,issue,opts);
      if(prop.available&&!used.has(prop.candidate.root)&&(!chosen||prop.candidate.score>chosen.candidate.score))chosen=prop;
    }
    if(!chosen)break;
    working=applyMoveToCopy(working,chosen);steps.push(chosen);used.add(chosen.candidate.root);
  }
  return {schema:SCHEMA,initial,steps,final:auditProject(working,opts),previewDocument:working,warning:'Not a global solver. Do not commit without checking the diagram.'};
}

return {SCHEMA,DEFAULTS,locateBubbleData,validateBubble,defaultRadius,auditProject,proposeForIssue,proposePlan,applyMoveToCopy,signatureOf};})();
