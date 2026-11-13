/* DiagramIt — offline-first, standalone diagram editor.
   Graph data is the single source of truth. DOM nodes are never persisted. */
(()=>{'use strict';
const SVG='http://www.w3.org/2000/svg';
const $=id=>document.getElementById(id);
const el=(tag,attrs={},parent)=>{const o=document.createElementNS(SVG,tag);for(const [k,v] of Object.entries(attrs))if(v!==undefined&&v!==null)o.setAttribute(k,String(v));if(parent)parent.appendChild(o);return o;};
const dom=(tag,cls,text,parent)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;if(parent)parent.appendChild(e);return e;};
const uid=()=>`${Date.now().toString(36)}_${Math.random().toString(36).slice(2,9)}`;
const clone=o=>JSON.parse(JSON.stringify(o));
// A duplicated topic is a second pointer to the SAME native KeepIt note, not
// an independent document. Never create a shared note reference silently.
function confirmSharedKeepItCopy(nodes, action='duplicate') {
  if(page?.mode!=='mind')return true;
  const linked=(nodes||[]).filter(n=>n?.keepitLink?.provider==='keepit'&&typeof n.keepitLink.itemId==='string'&&n.keepitLink.itemId.length>0);
  if(!linked.length)return true;
  const distinct=new Set(linked.map(n=>`${n.keepitLink.scope||''}:${n.keepitLink.itemId}`)).size;
  const label=distinct===1?'1 KeepIt note':`${distinct} KeepIt notes`;
  return window.confirm(`This ${action} will share ${label} with the original topic(s).\n\nEditing a shared note from either topic changes the SAME KeepIt document. No independent note copy will be created.\n\nOK: duplicate as shared reference. Cancel: keep the diagram unchanged.`);
}
// The graph's destructive branch operations include descendants. The same set
// must be used when preparing the clipboard, otherwise Cut can lose children.
function affectedSelectionIds() {
  const ids=new Set(selected);
  if(page.mode!=='flow')for(const id of selected)for(const child of descendants(id))ids.add(child);
  return ids;
}
// Removing a topic association does NOT delete its authoritative KeepIt note.
// Require explicit consent before losing a map-side entry point to a note.
function confirmKeepItReferenceRemoval(nodes, action='delete') {
  const linked=(nodes||[]).filter(n=>n?.keepitLink?.provider==='keepit'&&n.keepitLink.itemId);
  if(!linked.length)return true;
  const distinct=new Set(linked.map(n=>`${n.keepitLink.scope||''}:${n.keepitLink.itemId}`)).size;
  const label=distinct===1?'1 linked KeepIt note':`${distinct} linked KeepIt notes`;
  const effect=action==='cut'
    ? 'The selected branch will be removed from this map until pasted.'
    : 'The selected topic references will be removed from this ThinkIt map.';
  return window.confirm(`You are about to ${action} ${linked.length} topic(s) referencing ${label}.\n\n${effect} The KeepIt note documents themselves will NOT be deleted. You may need to find or relink them in KeepIt if no topic still references them.\n\nOK: continue. Cancel: keep the map unchanged.`);
}
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const short=s=>String(s??'').length>64?String(s).slice(0,61)+'…':String(s??'');
const MODES={flow:{name:'Flowchart',symbol:'◇',desc:'Process flows & decisions'},org:{name:'Org Chart',symbol:'♧',desc:'People & reporting lines'},mind:{name:'Mind Map',symbol:'✳',desc:'Ideas & concepts'},bubble:{name:'Bubble Diagram',symbol:'◯',desc:'Architectural program, adjacency matrix & concept layout'},bmc:{name:'Business Model Canvas',symbol:'▦',desc:'Nine blocks for mapping how a business works'}};
const COLORS=[['plain','#FFFFFF'],['teal','#D9ECE9'],['blue','#E6EFF7'],['amber','#F8EBCB'],['rose','#F6E2E4'],['slate','#DDE3E8']];
const SHAPES={flow:[['terminator','Start / End'],['process','Process'],['decision','Decision'],['data','Input / Output'],['document','Document'],['subprocess','Subprocess'],['database','Database'],['note','Annotation']],org:[['person','Person / Role'],['department','Department'],['team','Team'],['vacancy','Vacancy']],mind:[['topic','Topic'],['subtopic','Subtopic'],['idea','Idea / Note'],['milestone','Milestone']],bubble:[],bmc:[]};
const STYLE_KEYS=['fill','stroke','strokeWidth','strokeStyle','fontSize','fontFamily','fontWeight','italic','textColor','textAlign'];
let paintStyle=null,paintActive=false,paintRepeat=false;
let selectedAnnotation=null,orgPreviewSizes={},annotationDrag=null;
const DEFAULT_ORG_LAYOUT={style:'standard',siblingGap:44,levelGap:86,branchGap:94,cardWidth:200,cardHeight:82,uniform:true,scope:'all',parentAlign:'center',order:'manual'};
const orgSettings=()=>({...DEFAULT_ORG_LAYOUT,...(page?.orgLayout||{})});
const DEFAULT_MIND_LAYOUT={style:'balanced',siblingGap:38,levelGap:96,branchGap:90,side:'right',scope:'all',order:'manual'};
const mindSettings=()=>({...DEFAULT_MIND_LAYOUT,...(page?.mindLayout||{})});

const allAnnotations=()=>page.annotations||(page.annotations=[]);
const annoById=id=>allAnnotations().find(a=>a.id===id)||null;
function annotation(label='Add annotation',parentId=null){return{id:uid(),label,html:esc(label),parentId,side:'bottom',dx:0,dy:16,x:190,y:190,w:208,h:82,fontFamily:'sans',fontSize:14,fontWeight:400,italic:false,underline:false,strike:false,textColor:'#173B50',highlight:'none',textAlign:'left',vAlign:'middle',fill:'transparent',stroke:'#0D7475',strokeWidth:0,strokeStyle:'solid',padding:12,opacity:1,autoTextColor:true};}
function annoPosition(a,lookup=byId){const n=a.parentId?lookup(a.parentId):null;if(!n)return{x:a.x,y:a.y};const p=nodePos(n),cx=p.x+p.w/2,cy=p.y+p.h/2;const side=a.side||'bottom';let x=cx-a.w/2,y=p.y+p.h+16;if(side==='top')y=p.y-a.h-16;else if(side==='left'){x=p.x-a.w-20;y=cy-a.h/2;}else if(side==='right'){x=p.x+p.w+20;y=cy-a.h/2;}return{x:x+(a.dx||0),y:y+(a.dy||0)};}
function plainOfHtml(html){const d=document.createElement('div');d.innerHTML=html;return d.innerText||d.textContent||'';}

const DEFAULT_SIZE={terminator:[156,58],process:[168,68],decision:[176,104],data:[168,68],document:[172,73],subprocess:[178,68],database:[165,72],note:[165,74],person:[176,82],department:[183,75],team:[172,72],vacancy:[166,75],topic:[167,65],subtopic:[155,57],idea:[152,63],milestone:[145,59]};
let doc,page,view={x:0,y:0,k:1},tool='select',connectSource=null,selected=new Set(),edgeSelected=null,hoverNode=null,preview=null,gesture=null,history={undo:[],redo:[]},lastSaved='',saveTimer=null,toastTimer=null,spacePressed=false,editing=null,reparentPick=null,layoutDirection='down',showGrid=true,theme='light',activeModal=null,storageMode='pending',projectIsReady=false,framePending=false,inspectorBinding='';
const canvas=$('diagramSvg'),camera=$('camera'),nodeLayer=$('nodeLayer'),edgeLayer=$('edgeLayer'),gridLayer=$('gridLayer'),overlayLayer=$('overlayLayer'),previewLayer=$('previewLayer');
function node(shape,x,y,label,extra={}){const sz=DEFAULT_SIZE[shape]||[160,70];return {id:uid(),shape,x,y,w:sz[0],h:sz[1],label:label||SHAPES[page?.mode||'flow']?.find(s=>s[0]===shape)?.[1]||'New node',parentId:null,collapsed:false,pinned:false,groupId:null,fill:extra.fill||'plain',fontSize:13,stroke:'',strokeWidth:1.7,strokeStyle:'solid',fontFamily:'sans',fontWeight:600,italic:false,textColor:'#173B50',textAlign:'center',data:{role:'',department:''},...extra};}
function edge(from,to,kind='flow',opt={}){return {id:uid(),from,to,kind,fromPort:'auto',toPort:'auto',route:'orthogonal',label:'',arrowStart:'none',arrowEnd:kind==='primary'?'none':'filled',parallelOffset:0,bendOffset:null,bendAxis:null,fromFraction:.5,toFraction:.5,...opt};}
function isFreeEdge(e){return !!e&&!e.from&&!e.to&&e.start&&e.end;}
function edgeHeads(e){if(e.kind==='primary')return{start:'none',end:'none'};return{start:e.arrowStart||'none',end:e.arrowEnd===undefined?'filled':e.arrowEnd};}
function freeArrow(start,end){return edge(null,null,'annotation',{start:{...start},end:{...end},route:'straight',arrowEnd:'filled'});}
function focusCanvas(){if(!activeModal&&!editing){try{canvas.focus({preventScroll:true});}catch{}}}
function selectCanvasTool(k){setTool(k);focusCanvas();}

function makeSample(){const p1={id:uid(),name:'Process overview',mode:'flow',nodes:[],edges:[]};const n1=node('terminator',190,45,'START',{fill:'teal'}),n2=node('process',185,165,'Receive request'),n3=node('decision',180,289,'Approved?',{fill:'amber'}),n4=node('process',-43,489,'Revise and resubmit',{fill:'blue'}),n5=node('process',400,489,'Proceed to execution',{fill:'teal'}),n6=node('terminator',402,634,'COMPLETE',{fill:'teal'});p1.nodes=[n1,n2,n3,n4,n5,n6];p1.edges=[edge(n1.id,n2.id),edge(n2.id,n3.id),edge(n3.id,n4.id,'flow',{label:'No',fromPort:'left',toPort:'top'}),edge(n3.id,n5.id,'flow',{label:'Yes',fromPort:'right',toPort:'top'}),edge(n4.id,n2.id,'flow',{fromPort:'top',toPort:'left'}),edge(n5.id,n6.id)];
const p2={id:uid(),name:'Team structure',mode:'org',nodes:[],edges:[]};const d=node('person',290,50,'Project Director',{data:{role:'Project Director',department:'Management'},fill:'teal'}),a=node('person',10,225,'Planning Lead',{parentId:d.id,data:{role:'Planning',department:'Planning'}}),b=node('person',290,225,'Design Lead',{parentId:d.id,data:{role:'Architecture',department:'Design'}}),c=node('person',570,225,'Delivery Lead',{parentId:d.id,data:{role:'Construction',department:'Delivery'}}),aa=node('person',-80,420,'Airport Planner',{parentId:a.id,data:{role:'Airside',department:'Planning'}}),ab=node('person',92,420,'Terminal Planner',{parentId:a.id,data:{role:'Landside',department:'Planning'}}),bb=node('person',290,420,'Design Coordinator',{parentId:b.id,data:{role:'Technical coordination',department:'Design'}}),cc=node('person',570,420,'Package Lead',{parentId:c.id,data:{role:'Work packages',department:'Delivery'}});p2.nodes=[d,a,b,c,aa,ab,bb,cc];
p2.orgLayout={...DEFAULT_ORG_LAYOUT};const p3={id:uid(),name:'Project ideas',mode:'mind',nodes:[],edges:[]};const root=node('topic',300,280,'PROJECT STRATEGY',{fill:'teal',w:200,h:72}),m1=node('subtopic',570,110,'Objectives',{parentId:root.id,fill:'blue'}),m2=node('subtopic',570,290,'Deliverables',{parentId:root.id,fill:'blue'}),m3=node('subtopic',570,470,'Risks',{parentId:root.id,fill:'amber'}),m4=node('subtopic',45,200,'Resources',{parentId:root.id,fill:'blue'}),m5=node('subtopic',45,390,'Stakeholders',{parentId:root.id,fill:'blue'});p3.mindLayout={...DEFAULT_MIND_LAYOUT};p3.nodes=[root,m1,m2,m3,m4,m5,node('idea',810,75,'Key results',{parentId:m1.id}),node('idea',810,170,'Success measures',{parentId:m1.id})];
return {format:'DIAGRAMIT',version:3,id:uid(),name:'DiagramIt Workspace',pages:[p1,p2,p3],activePageId:p1.id,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};}
function getPage(){return doc.pages.find(p=>p.id===doc.activePageId)||doc.pages[0];}
const byId=id=>page?.nodes.find(n=>n.id===id)||null;
// H2: a disposable visual graph. Original node IDs, edges, and WBS dependencies
// remain the sole source of truth for every edit, export and cloud transaction.
let flowRenderPlan=null;
// Focus is intentionally transient view state; JSON retains every node/edge.
const flowFocusByPage=new Map();
function flowFocusId(){
 if(page?.mode!=='flow')return null;
 const id=flowFocusByPage.get(page.id);
 return id&&byId(id)?id:null;
}
function flowGraphPlan(){
 if(page?.mode!=='flow')return null;
 if(!window.ThinkItFlowHierarchy?.plan)throw Error('Flowchart hierarchy module unavailable');
 const complete=window.ThinkItFlowHierarchy.plan(page);
 const id=flowFocusId();
 return id?window.ThinkItFlowFocus.scope(page,complete,id):complete;
}
function flowSetFocus(id){
 if(page.mode!=='flow')return;
 if(id!==null&&!byId(id)){toast('Unknown subprocess');return;}
 if(id&&!page.nodes.some(n=>n.outlineParentId===id)){toast('Focus requires a subprocess with activities.');return;}
 flowFocusByPage.set(page.id,id);
 flowRenderPlan=null;t22VisibleCache=null;
 if(id){
  const ancestors=[id,...flowHiddenAncestorIds(id)],toOpen=ancestors.filter(k=>byId(k)?.collapsed);
  if(toOpen.length)transact(()=>{for(const key of toOpen)byId(key).collapsed=false;});
  else render();
  selected=new Set([id]);edgeSelected=null;selectedAnnotation=null;
 }else{render();}
 render(); // Update Outline and inspector after selection/focus settle.
 if(!t22IsOutline()){fitView();focusCanvas();}
}
function flowSetLevel(level){
 if(page.mode!=='flow')return;
 const edits=window.ThinkItFlowFocus.collapseAtLevel(page,flowFocusId(),level);
 if(!Object.keys(edits).length)return;
 transact(()=>{for(const [id,collapsed]of Object.entries(edits))byId(id).collapsed=collapsed;
  flowRenderPlan=null;t22VisibleCache=null;
  // Repair newly displayed managed subtrees in the same undoable operation.
  h3Repair(flowFocusId());
  const shown=new Set(flowGraphPlan().visibleNodeIds);
  if(selected.size&&!Array.from(selected).some(id=>shown.has(id))){
   let current=byId([...selected][0]);
   while(current&&!shown.has(current.id))current=byId(current.outlineParentId);
   selected=new Set(current?[current.id]:[]);
  }
 });
}
function flowWrapSelected(){
 if(page.mode!=='flow'||selected.size<2){toast('Select at least two activities to create a subprocess.');return;}
 let plan,newShape;
 try{
  newShape=node('subprocess',0,0,'New subprocess',{fill:'teal'});
  plan=window.ThinkItFlowFocus.wrapSelection(page,[...selected],newShape.id);
  newShape.x=plan.x;newShape.y=plan.y;newShape.w=plan.w;newShape.h=plan.h;
  newShape.outlineParentId=plan.parentId;newShape.outlineOrder=plan.outlineOrder;
  newShape.wbsCodeOverride=null;newShape.dependencies=[];
  const moving=new Set(plan.childIds),shadow={...page,nodes:[
   ...page.nodes.map(n=>moving.has(n.id)?{...n,outlineParentId:newShape.id}:n),newShape
  ]};
  // Preflight before any real mutation: transact() does not roll back exceptions.
  window.ThinkItOutline.auditPage(shadow);
 }catch(err){toast('Cannot make subprocess: '+err.message);return;}
 transact(()=>{
  const moving=new Set(plan.childIds);
  page.nodes.push(newShape);
  for(const n of page.nodes)if(moving.has(n.id))n.outlineParentId=newShape.id;
  selected=new Set([newShape.id]);edgeSelected=null;selectedAnnotation=null;
  flowRenderPlan=null;t22VisibleCache=null;
 });
 toast('Subprocess created. All original activities, arrows and predecessors are retained.');
}
function flowRenderFocusBar(){
 const bar=$('flowFocusBar');if(!bar)return;
 bar.hidden=page.mode!=='flow';if(bar.hidden)return;
 const crumbs=$('flowFocusCrumbs');crumbs.replaceChildren();
 const make=(id,label,last=false)=>{
  const b=dom('button','',label,crumbs);b.type='button';
  b.title=label;b.setAttribute('aria-label',id===null?'Show all Flowchart activities':'Focus on '+label);
  if(last)b.setAttribute('aria-current','location');
  b.onclick=()=>flowSetFocus(id);
 };
 const id=flowFocusId(),chain=id?window.ThinkItFlowFocus.breadcrumbs(page,id):[];
 make(null,'All activities',!id);
 for(let i=0;i<chain.length;i++){
  dom('span','flow-focus-separator','›',crumbs).setAttribute('aria-hidden','true');
  make(chain[i].id,chain[i].label,i===chain.length-1);
 }
 const wrap=$('flowWrapSelection');
 wrap.hidden=selected.size<2;wrap.title='Only selected Flowchart activities with the same WBS parent can be grouped';
 const level=$('flowFocusLevel');if(level.value!=='')level.value='';
}
function flowSnapshot(){return flowRenderPlan||flowGraphPlan();}
function flowCollapsedIds(){return new Set(page.nodes.filter(n=>n.collapsed===true).map(n=>n.id));}
function flowHiddenAncestorIds(id){
 if(page?.mode!=='flow')return [];
 const ancestors=[],seen=new Set([id]);let n=byId(id);
 while(n?.outlineParentId){
  const parent=byId(n.outlineParentId);
  if(!parent||seen.has(parent.id))break;
  seen.add(parent.id);if(parent.collapsed)ancestors.push(parent.id);n=parent;
 }
 return ancestors;
}
function flowRevealAncestors(id){
 const ids=flowHiddenAncestorIds(id);
 if(ids.length)transact(()=>{for(const id of ids)byId(id).collapsed=false;t22VisibleCache=null;});
}
function flowOutlineDescendants(id){
 const children=new Map();
 for(const n of page.nodes)if(n.outlineParentId){if(!children.has(n.outlineParentId))children.set(n.outlineParentId,[]);children.get(n.outlineParentId).push(n.id);}
 const out=new Set(),stack=[...(children.get(id)||[])];
 while(stack.length){const next=stack.pop();if(out.has(next))continue;out.add(next);stack.push(...(children.get(next)||[]));}
 return out;
}
function flowProjectedEdge(id){
 return page?.mode==='flow'?flowSnapshot()?.edgeViews.find(e=>e.id===id&&e.displayProjection)||null:null;
}
const findEdge=id=>page?.edges.find(e=>e.id===id)||(id?.startsWith('tree_')?effectiveEdges().find(e=>e.id===id):null)||null;
function treeChildren(parentId){return page.nodes.filter(n=>n.parentId===parentId);}
// TH-L1: Build a per-traversal parent index. Do not cache across transactions:
// reparent/undo/redo edit the same page and must never reuse stale descendants.
function hierarchyIndex(nodes=page.nodes){
  const ids=new Set(nodes.map(n=>n.id)),children=new Map(),roots=[];
  for(const n of nodes){
    if(!n.parentId||!ids.has(n.parentId))roots.push(n);
    if(!children.has(n.parentId))children.set(n.parentId,[]);
    children.get(n.parentId).push(n);
  }
  return {children,roots};
}
function descendants(id,seen=new Set()){
  const {children}=hierarchyIndex(),visited=new Set([id]),stack=[...(children.get(id)||[])].reverse();
  while(stack.length){
    const n=stack.pop();if(visited.has(n.id)||seen.has(n.id))continue;
    visited.add(n.id);seen.add(n.id);
    const kids=children.get(n.id)||[];
    for(let i=kids.length-1;i>=0;i--)stack.push(kids[i]);
  }
  return seen;
}
function ancestors(id){let n=byId(id),a=[];const seen=new Set();while(n?.parentId&&!seen.has(n.parentId)){seen.add(n.parentId);a.push(n.parentId);n=byId(n.parentId);}return a;}
// TH-L2: Visibility is recomputed from the current graph on each request; no
// cached ancestry may outlive a reparent, collapse, undo or redo transaction.
// For valid Mind Maps this is linear, including 5,000-deep hierarchies.
function visibleNodes(){
 if(page.mode==='flow'){const state=flowSnapshot(),visible=new Set(state.visibleNodeIds);return page.nodes.filter(n=>visible.has(n.id));}
 if(page.mode!=='mind')return page.nodes.filter(n=>!ancestors(n.id).some(a=>byId(a)?.collapsed));
 const nodesById=new Map(page.nodes.map(n=>[n.id,n])),memo=new Map();
 for(const start of page.nodes){
  if(memo.has(start.id))continue;
  const path=[],seen=new Set();let cursor=start,cycle=false;
  while(cursor&&!memo.has(cursor.id)){
   if(seen.has(cursor.id)){cycle=true;break;}
   seen.add(cursor.id);path.push(cursor);
   cursor=cursor.parentId?nodesById.get(cursor.parentId):null;
  }
  if(cycle){ // malformed in-memory legacy graphs: preserve old traversal behavior
   for(const n of path)memo.set(n.id,!ancestors(n.id).some(id=>nodesById.get(id)?.collapsed));
   continue;
  }
  for(let i=path.length-1;i>=0;i--){
   const n=path[i],parent=n.parentId?nodesById.get(n.parentId):null;
   memo.set(n.id,!parent||(!parent.collapsed&&memo.get(parent.id)!==false));
  }
 }
 return page.nodes.filter(n=>memo.get(n.id)!==false);
}
function nodePos(n){return preview?.[n.id]||n;}
function getWorldSize(){const r=canvas.getBoundingClientRect();return {w:r.width||800,h:r.height||600};}
function screenPoint(evt){const r=canvas.getBoundingClientRect();return{x:evt.clientX-r.left,y:evt.clientY-r.top};}
function worldPoint(evt){const p=screenPoint(evt);return{x:(p.x-view.x)/view.k,y:(p.y-view.y)/view.k};}
function centroid(ids){const arr=[...ids].map(byId).filter(Boolean);return{x:arr.reduce((a,n)=>a+n.x+n.w/2,0)/(arr.length||1),y:arr.reduce((a,n)=>a+n.y+n.h/2,0)/(arr.length||1)};}
function bounds(nodes=visibleNodes()){
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 const include=(x,y)=>{minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);};
 const visibleIds=new Set(nodes.map(n=>n.id));
 const index=new Map((page?.nodes||[]).map(n=>[n.id,n]));
 for(const n of nodes){const p=nodePos(n);include(p.x,p.y);include(p.x+n.w,p.y+n.h);}
 for(const e of page?.edges||[]){if(!flowFocusId()&&isFreeEdge(e)){include(e.start.x,e.start.y);include(e.end.x,e.end.y);}}
 for(const a of page?.annotations||[]){
  if(page.mode==='flow'&&flowFocusId()&&!a.parentId)continue;
   if(a.parentId&&!visibleIds.has(a.parentId))continue;
  const p=annoPosition(a,id=>index.get(id));include(p.x,p.y);include(p.x+a.w,p.y+a.h);
 }
 if(minX===Infinity)return{x:0,y:0,w:900,h:550};
 return{x:minX,y:minY,w:Math.max(10,maxX-minX),h:Math.max(10,maxY-minY)};
}

function ensureVisibleNode(n){const size=getWorldSize(),m=58,p=nodePos(n);let changed=false;const l=p.x*view.k+view.x,r=(p.x+p.w)*view.k+view.x,t=p.y*view.k+view.y,b=(p.y+p.h)*view.k+view.y;
if(r>size.w-m){view.x-=r-(size.w-m);changed=true;}else if(l<m){view.x+=m-l;changed=true;}
if(b>size.h-m){view.y-=b-(size.h-m);changed=true;}else if(t<m){view.y+=m-t;changed=true;}
if(changed)renderCanvas();}
// P3 initial entry favors legible topics; explicit Fit still shows the entire chart.
// Viewport changes are ephemeral; diagram geometry and KeepIt note records remain intact.
function fitView(options={}){if(page?.mode==='bmc')return;const b=bounds(),c=getWorldSize(),margin=clamp(Math.min(c.w,c.h)*.09,48,110);
 const automatic=options?.initial===true,compact=window.matchMedia('(max-width:850px)').matches;
 const hasContent=!!page&&(page.nodes.length>0||(page.edges||[]).length>0||(page.annotations||[]).length>0);
 const ideal=clamp(Math.min((c.w-margin*2)/Math.max(b.w,1),(c.h-margin*2)/Math.max(b.h,1)),automatic?.22:.005,1.6);
 if(automatic&&!hasContent){view.k=1;view.x=c.w/2-450;view.y=c.h/2-275;}
 else if(automatic&&compact&&ideal<.8&&page.nodes.length){const root=visibleNodes()[0]||page.nodes[0];view.k=.8;view.x=c.w/2-(root.x+root.w/2)*view.k;view.y=c.h/2-(root.y+root.h/2)*view.k;}
 else{view.k=ideal;view.x=(c.w-b.w*ideal)/2-b.x*ideal;view.y=(c.h-b.h*ideal)/2-b.y*ideal;}
 render();diP3UpdateNav();}

function zoomAt(scale,p){const k=clamp(view.k*scale,page?.mode==='flow'?.005:.16,3.6);const wx=(p.x-view.x)/view.k,wy=(p.y-view.y)/view.k;view.x=p.x-wx*k;view.y=p.y-wy*k;view.k=k;render();}
function fillFor(n){return Object.fromEntries(COLORS)[n.fill]||n.fill||'#fff';}
function isDark(){return theme==='dark';}
function styleStroke(n){return n.stroke|| (n.fill==='teal'?'#0D7475':n.fill==='amber'?'#A8792B':'#416077');}
function setText(svg,text){svg.textContent=String(text??'');return svg;}
function pointsFor(n){const p=nodePos(n);return{top:{x:p.x+p.w/2,y:p.y},bottom:{x:p.x+p.w/2,y:p.y+p.h},left:{x:p.x,y:p.y+p.h/2},right:{x:p.x+p.w,y:p.y+p.h/2}};}
function portPoint(n,port,fraction=.5){const p=nodePos(n),t=clamp(Number.isFinite(Number(fraction))?Number(fraction):.5,.12,.88);let pt={x:0,y:0};if(port==='left'){pt={x:p.x,y:p.y+p.h*t};}else if(port==='right'){pt={x:p.x+p.w,y:p.y+p.h*t};}else if(port==='top'){pt={x:p.x+p.w*t,y:p.y};}else{pt={x:p.x+p.w*t,y:p.y+p.h};}
if(n.shape==='decision'){if(port==='left')pt.x=p.x+p.w/2*Math.abs(2*t-1);if(port==='right')pt.x=p.x+p.w-p.w/2*Math.abs(2*t-1);if(port==='top')pt.y=p.y+p.h/2*Math.abs(2*t-1);if(port==='bottom')pt.y=p.y+p.h-p.h/2*Math.abs(2*t-1);}
if(n.shape==='data'||n.shape==='milestone'){if(port==='left')pt.x=p.x+20*(1-t);if(port==='right')pt.x=p.x+p.w-20*t;}
if(n.shape==='terminator'||n.shape==='topic'||n.shape==='subtopic'){const r=Math.min(p.h/2,n.shape==='terminator'?p.h/2:n.shape==='topic'?19:14);if(port==='left')pt.x=p.x+r*(1-Math.sqrt(Math.max(0,1-(2*t-1)**2)));if(port==='right')pt.x=p.x+p.w-r*(1-Math.sqrt(Math.max(0,1-(2*t-1)**2)));}
return pt;}
function closestPort(n,point){let port='left',min=Infinity;for(const side of ['top','right','bottom','left']){const p=nodePos(n),fraction=side==='left'||side==='right'?clamp((point.y-p.y)/p.h,.15,.85):clamp((point.x-p.x)/p.w,.15,.85),loc=portPoint(n,side,fraction),distance=Math.hypot(loc.x-point.x,loc.y-point.y);if(distance<min){min=distance;port=side;}}const p=nodePos(n);return{port,fraction:port==='left'||port==='right'?clamp((point.y-p.y)/p.h,.15,.85):clamp((point.x-p.x)/p.w,.15,.85)};}
function resolvePort(from,to,port,type){if(port&&port!=='auto')return port;const a=nodePos(from),b=nodePos(to),dx=(b.x+b.w/2)-(a.x+a.w/2),dy=(b.y+b.h/2)-(a.y+a.h/2);if(page.mode==='mind')return dx>=0?(type==='start'?'right':'left'):(type==='start'?'left':'right');if(page.mode==='org'&&Math.abs(dy)>Math.abs(dx)*.75)return dy>=0?(type==='start'?'bottom':'top'):(type==='start'?'top':'bottom');return Math.abs(dy)>Math.abs(dx)*.85?(dy>=0?(type==='start'?'bottom':'top'):(type==='start'?'top':'bottom')):(dx>=0?(type==='start'?'right':'left'):(type==='start'?'left':'right'));}
function connAnchors(e,a,b){let fromPort=resolvePort(a,b,e.fromPort,'start'),toPort=resolvePort(a,b,e.toPort,'end');return{a:portPoint(a,fromPort,e.fromFraction??.5),b:portPoint(b,toPort,e.toFraction??.5),fromPort,toPort};}
function roundedPolylinePath(pts,r=11){if(!pts.length)return'';let d=`M${pts[0].x} ${pts[0].y}`;for(let i=1;i<pts.length-1;i++){const pre=pts[i-1],now=pts[i],next=pts[i+1];const len1=Math.hypot(now.x-pre.x,now.y-pre.y)||1,len2=Math.hypot(next.x-now.x,next.y-now.y)||1,rad=Math.min(r,len1/2,len2/2),p1={x:now.x-(now.x-pre.x)/len1*rad,y:now.y-(now.y-pre.y)/len1*rad},p2={x:now.x+(next.x-now.x)/len2*rad,y:now.y+(next.y-now.y)/len2*rad};d+=` L${p1.x} ${p1.y} Q${now.x} ${now.y} ${p2.x} ${p2.y}`;}const end=pts.at(-1);return d+` L${end.x} ${end.y}`;}
function getEdgeGeom(e,source,target){
if(e.kind==='primary'&&page.mode==='org'&&source&&target&&e.route==='orthogonal'&&e.fromPort==='auto'&&e.toPort==='auto'){const pa=nodePos(source),pb=nodePos(target),style=orgBranchStyle(source,orgSettings());let pts;
if(style==='compact'||style==='horizontal'){
const start={x:pa.x+source.w,y:pa.y+source.h/2},end={x:pb.x,y:pb.y+target.h/2},trunkX=Math.min(end.x-20,start.x+Math.max(24,(end.x-start.x)*.48));pts=[start,{x:trunkX,y:start.y},{x:trunkX,y:end.y},end];
}else{const start={x:pa.x+source.w/2,y:pa.y+source.h},end={x:pb.x+target.w/2,y:pb.y},trunkY=Math.min(end.y-18,start.y+Math.max(26,(end.y-start.y)*.45));pts=[start,{x:start.x,y:trunkY},{x:end.x,y:trunkY},end];}
return{d:roundedPolylinePath(pts,7),points:pts,label:{x:(pts[1].x+pts[2].x)/2,y:(pts[1].y+pts[2].y)/2-8},a:pts[0],b:pts.at(-1)};}
if(isFreeEdge(e)){const a=e.start,b=e.end,dx=b.x-a.x,dy=b.y-a.y;if(e.route==='orthogonal'){const mx=(a.x+b.x)/2+(e.bendOffset??e.parallelOffset??0);const pts=[a,{x:mx,y:a.y},{x:mx,y:b.y},b];return{d:roundedPolylinePath(pts),points:pts,trunk:{x:mx,y:(a.y+b.y)/2,axis:'x',base:(a.x+b.x)/2},label:{x:mx+10,y:(a.y+b.y)/2-9},a,b};}if(e.route==='curve'){const o=e.parallelOffset||0,c1={x:a.x+dx*.48,y:a.y+o},c2={x:b.x-dx*.48,y:b.y+o};return{d:`M${a.x} ${a.y} C${c1.x} ${c1.y},${c2.x} ${c2.y},${b.x} ${b.y}`,label:{x:(a.x+b.x)/2,y:(a.y+b.y)/2+o*.75-10},a,b};}return{d:`M${a.x} ${a.y} L${b.x} ${b.y}`,label:{x:(a.x+b.x)/2,y:(a.y+b.y)/2-9},a,b};}
const{a,b,fromPort,toPort}=connAnchors(e,source,target),off=e.bendOffset??e.parallelOffset??0;
// Collapsed Flowchart activities must not act as invisible routing obstacles.
const routingNodes=page.mode==='flow'?visibleNodes():page.nodes;
const countFlowObstacles=page.mode==='flow'&&window.ThinkItFlowRouteLanes?.obstacleCounter?
 window.ThinkItFlowRouteLanes.obstacleCounter(routingNodes.map(nodePos)):null;
const routingLanes=axis=>page.mode==='flow'&&window.ThinkItFlowRouteLanes?.candidates?
 window.ThinkItFlowRouteLanes.candidates(routingNodes,a,b,axis):
 routingNodes.slice(0,30).flatMap(n=>axis==='x'?[n.x-26,n.x+n.w+26]:[n.y-26,n.y+n.h+26]);
if(e.route==='straight')return{d:`M${a.x} ${a.y} L${b.x} ${b.y}`,label:{x:(a.x+b.x)/2,y:(a.y+b.y)/2-9},a,b};
if(e.route==='curve'){const dx=b.x-a.x,dy=b.y-a.y,horizontal=(fromPort==='left'||fromPort==='right'),c1=horizontal?{x:a.x+dx*.48,y:a.y}:{x:a.x,y:a.y+dy*.45},c2=horizontal?{x:b.x-dx*.48,y:b.y}:{x:b.x,y:b.y-dy*.45};return{d:`M${a.x} ${a.y} C${c1.x} ${c1.y},${c2.x} ${c2.y},${b.x} ${b.y}`,label:{x:(a.x+3*c1.x+3*c2.x+b.x)/8,y:(a.y+3*c1.y+3*c2.y+b.y)/8-8},a,b};}
const vectors={right:[1,0],left:[-1,0],top:[0,-1],bottom:[0,1]},sv=vectors[fromPort],tv=vectors[toPort],gap=28,
sa={x:a.x+sv[0]*gap,y:a.y+sv[1]*gap},tb={x:b.x+tv[0]*gap,y:b.y+tv[1]*gap};
const horizontal=sv[0]!==0,finishHorizontal=tv[0]!==0,candidates=[];
const put=(pts,axis,base,pos)=>candidates.push({pts,axis,base,pos});
if(horizontal&&finishHorizontal){const base=(sa.x+tb.x)/2;for(const x of (e.bendOffset!=null?[base+off]:[base+off,Math.max(sa.x,tb.x)+38,Math.min(sa.x,tb.x)-38,...routingLanes('x')]))put([a,sa,{x,y:sa.y},{x,y:tb.y},tb,b],'x',base,x);
// A long row-wrap connector may need to travel between the two rows, not through their nodes.
// This is an additional candidate only: never override a user-specified bend offset.
if(page.mode==='flow'&&e.bendOffset==null&&Math.abs(a.x-b.x)>Math.max(source.w,target.w)*1.5){
 const upper=source.y+source.h<target.y-8?source:target.y+target.h<source.y-8?target:null;
 const lower=upper===source?target:upper===target?source:null;
 if(upper&&lower){
  const laneY=(upper.y+upper.h+lower.y)/2;
  put([a,sa,{x:sa.x,y:laneY},{x:tb.x,y:laneY},tb,b],'y',(sa.y+tb.y)/2,laneY);
 }
}

// Opposing sides can point away from one another; detour over or under both shapes without folding back through them.
if((fromPort==='right'&&toPort==='left'&&sa.x>tb.x)||(fromPort==='left'&&toPort==='right'&&sa.x<tb.x)){
const minY=Math.min(source.y,target.y)-55,maxY=Math.max(source.y+source.h,target.y+target.h)+55;
for(const y of (e.bendOffset!=null&&e.bendAxis==='y'?[(sa.y+tb.y)/2+off]:[minY,maxY]))put([a,sa,{x:sa.x,y},{x:tb.x,y},tb,b],'y',(sa.y+tb.y)/2,y);
}}
else if(!horizontal&&!finishHorizontal){const base=(sa.y+tb.y)/2;for(const y of(e.bendOffset!=null?[base+off]:[base+off,Math.max(sa.y,tb.y)+38,Math.min(sa.y,tb.y)-38,...routingLanes('y')]))put([a,sa,{x:sa.x,y},{x:tb.x,y},tb,b],'y',base,y);
if((fromPort==='bottom'&&toPort==='top'&&sa.y>tb.y)||(fromPort==='top'&&toPort==='bottom'&&sa.y<tb.y)){
const minX=Math.min(source.x,target.x)-55,maxX=Math.max(source.x+source.w,target.x+target.w)+55;
for(const x of (e.bendOffset!=null&&e.bendAxis==='x'?[(sa.x+tb.x)/2+off]:[minX,maxX]))put([a,sa,{x,y:sa.y},{x,y:tb.y},tb,b],'x',(sa.x+tb.x)/2,x);
}}
else{if(horizontal){put([a,sa,{x:tb.x,y:sa.y},tb,b],null,0,0);put([a,sa,{x:sa.x,y:tb.y},tb,b],null,0,0);}else{put([a,sa,{x:sa.x,y:tb.y},tb,b],null,0,0);put([a,sa,{x:tb.x,y:sa.y},tb,b],null,0,0);}
if(e.bendOffset!=null){const base=(sa.x+tb.x)/2,mid=base+off;put([a,sa,{x:mid,y:sa.y},{x:mid,y:tb.y},tb,b],'x',base,mid);}}
const intersects=(p,q,n)=>{const x1=n.x-9,x2=n.x+n.w+9,y1=n.y-9,y2=n.y+n.h+9;if(Math.abs(p.y-q.y)<.001){const y=p.y;return y>y1&&y<y2&&Math.max(Math.min(p.x,q.x),x1)<Math.min(Math.max(p.x,q.x),x2);}if(Math.abs(p.x-q.x)<.001){const x=p.x;return x>x1&&x<x2&&Math.max(Math.min(p.y,q.y),y1)<Math.min(Math.max(p.y,q.y),y2);}return true;};
let best=null,bestScore=Infinity;
for(const candidate of candidates){const pts=candidate.pts.filter((p,i,arr)=>i===0||Math.abs(p.x-arr[i-1].x)+Math.abs(p.y-arr[i-1].y)>.1);let score=0,bends=0;for(let i=1;i<pts.length;i++){const p=pts[i-1],q=pts[i],len=Math.abs(p.x-q.x)+Math.abs(p.y-q.y);score+=len*.2;if(countFlowObstacles)score+=1600*countFlowObstacles(p,q,i===1?source.id:null,i===pts.length-1?target.id:null);else for(const n of routingNodes){if(n.id===source.id&&i===1||n.id===target.id&&i===pts.length-1)continue;if(intersects(p,q,nodePos(n)))score+=1600;}if(i>1){const prev=pts[i-2],prevHorizontal=Math.abs(prev.y-p.y)<.001,currHorizontal=Math.abs(p.y-q.y)<.001;if(prevHorizontal!==currHorizontal)bends++;}}score+=bends*12;if(e.bendOffset!=null&&candidate.axis===e.bendAxis)score-=2500;if(score<bestScore){bestScore=score;best={...candidate,pts};}}
const pts=best?.pts||[a,b],mid=pts[Math.max(0,Math.floor((pts.length-1)/2))],next=pts[Math.min(pts.length-1,Math.floor((pts.length-1)/2)+1)],label={x:(mid.x+next.x)/2+7,y:(mid.y+next.y)/2-9},trunk=best?.axis?{x:best.axis==='x'?best.pos:(mid.x+next.x)/2,y:best.axis==='y'?best.pos:(mid.y+next.y)/2,axis:best.axis,base:best.base}:null;
return{d:roundedPolylinePath(pts),points:pts,label,trunk,a,b,fromPort,toPort};}
function effectiveEdges(){
 if(page.mode==='flow')return flowSnapshot().edgeViews;
 // The Mind Map's previously repeated node/edge scans were quadratic in its size.
 if(page.mode==='mind'){
  const ids=new Set(page.nodes.map(n=>n.id)),saved=new Map();
  for(const e of page.edges)if(e.kind==='primary'&&e.id?.startsWith('tree_')&&!saved.has(e.id))saved.set(e.id,e);
  const tree=[];
  for(const n of page.nodes)if(n.parentId&&ids.has(n.parentId)){
   const prior=saved.get(`tree_${n.id}`);
   tree.push(edge(n.parentId,n.id,'primary',{id:`tree_${n.id}`,route:'curve',...(prior||{}),from:n.parentId,to:n.id}));
  }
  return [...tree,...page.edges.filter(e=>e.kind!=='primary')];
 }
 return [...page.nodes.filter(n=>n.parentId&&byId(n.parentId)).map(n=>{
  const saved=page.edges.find(e=>e.id===`tree_${n.id}`&&e.kind==='primary');
  return edge(byId(n.parentId).id,n.id,'primary',{id:`tree_${n.id}`,route:'orthogonal',...(saved||{}),from:byId(n.parentId).id,to:n.id});
 }),...page.edges.filter(e=>e.kind!=='primary')];
}
function drawEdge(layer,e,exportMode=false){const free=isFreeEdge(e),a=free?null:byId(e.from),b=free?null:byId(e.to);if(!free&&(!a||!b))return;if(!free&&page.mode!=='flow'&&(!visibleIdSet.has(a.id)||!visibleIdSet.has(b.id)))return;
const geom=getEdgeGeom(e,a,b),g=el('g',{'data-edge-id':e.id,class:'edge-g'},layer);const crossed=e.kind==='secondary'||e.kind==='reference',isSel=edgeSelected===e.id&&!exportMode,heads=edgeHeads(e);
if(!exportMode)el('path',{d:geom.d,class:'edge-hit','data-edge-id':e.id},g);
const dashed=crossed?'6 5':null,stroke=crossed?'#7A91A1':'#38586D';
const attributes={d:geom.d,class:'edge-line',stroke,'stroke-width':isSel?2.8:1.8,'stroke-dasharray':dashed};if(heads.start!=='none')attributes['marker-start']=`url(#diagramitArrow_${heads.start})`;if(heads.end!=='none')attributes['marker-end']=`url(#diagramitArrow_${heads.end})`;
const path=el('path',attributes,g);if(exportMode){path.setAttribute('style',`fill:none;stroke:${stroke};stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round`);if(dashed)path.setAttribute('stroke-dasharray',dashed);}if(isSel)el('path',{d:geom.d,fill:'none',stroke:'var(--teal)','stroke-width':2.8,'pointer-events':'none'},g);
if(e.label){const t=el('text',{x:geom.label.x,y:geom.label.y,'text-anchor':'middle',class:'edge-label','data-edge-id':e.id},g);setText(t,e.label);if(exportMode)t.setAttribute('style','font-family:Arial,sans-serif;font-size:11px;fill:#213546;paint-order:stroke;stroke:white;stroke-width:5px');}
/* Editing handles are rendered in overlayLayer, after all nodes, so their hit targets cannot be hidden by shape geometry. */
}

function drawSelectedEdgeHandles(layer){if(!edgeSelected||flowProjectedEdge(edgeSelected))return;if(page.mode==='flow'&&!flowSnapshot().edgeViews.some(e=>e.id===edgeSelected))return;const e=findEdge(edgeSelected);if(!e)return;const free=isFreeEdge(e),a=free?null:byId(e.from),b=free?null:byId(e.to),geom=getEdgeGeom(e,a,b);const group=el('g',{'data-edge-id':e.id,class:'edge-handles'},layer);if(free){for(const which of ['start','end']){const pt=e[which];el('circle',{cx:pt.x,cy:pt.y,r:7,class:'edge-endpoint','data-edge-id':e.id,'data-edge-handle':which},group);}}else{for(const [which,pt] of [['from',geom.a],['to',geom.b]])el('circle',{cx:pt.x,cy:pt.y,r:8,class:'edge-endpoint','data-edge-id':e.id,'data-edge-handle':which},group);}if(geom.trunk)el('rect',{x:geom.trunk.x-6,y:geom.trunk.y-6,width:12,height:12,rx:3,class:'edge-bend-handle','data-edge-id':e.id,'data-edge-handle':'bend'},group);}
function shapeElement(g,n){const p=nodePos(n),x=p.x,y=p.y,w=p.w,h=p.h,common={fill:fillFor(n),stroke:styleStroke(n),'stroke-width':n.strokeWidth??1.7,'stroke-dasharray':n.strokeStyle==='dashed'?'7 5':n.strokeStyle==='dotted'?'2 4':null,class:'node-shape'};
switch(n.shape){case 'terminator':case 'topic':case 'subtopic':el('rect',{x,y,width:w,height:h,rx:n.shape==='terminator'?h/2:n.shape==='topic'?19:14,...common},g);break;
case 'decision':el('polygon',{points:`${x+w/2},${y} ${x+w},${y+h/2} ${x+w/2},${y+h} ${x},${y+h/2}`,...common},g);break;
case 'data':el('polygon',{points:`${x+20},${y} ${x+w},${y} ${x+w-20},${y+h} ${x},${y+h}`,...common},g);break;
case 'document':el('path',{d:`M${x} ${y} H${x+w} V${y+h-11} Q${x+w*.77} ${y+h-22} ${x+w*.54} ${y+h-10} T${x} ${y+h-10} Z`,...common},g);break;
case 'database':el('path',{d:`M${x} ${y+12} C${x} ${y-4} ${x+w} ${y-4} ${x+w} ${y+12} V${y+h-12} C${x+w} ${y+h+5} ${x} ${y+h+5} ${x} ${y+h-12} Z`,...common},g);el('path',{d:`M${x} ${y+12} C${x} ${y+29} ${x+w} ${y+29} ${x+w} ${y+12}`,fill:'none',stroke:styleStroke(n),'stroke-width':1.2},g);break;
case 'note':el('path',{d:`M${x} ${y} H${x+w-16} L${x+w} ${y+16} V${y+h} H${x} Z`,...common},g);el('path',{d:`M${x+w-16} ${y} V${y+16} H${x+w}`,stroke:styleStroke(n),fill:'none'},g);break;
case 'subprocess':el('rect',{x,y,width:w,height:h,rx:5,...common},g);el('path',{d:`M${x+13} ${y} V${y+h} M${x+w-13} ${y} V${y+h}`,stroke:styleStroke(n),'stroke-width':1.25},g);break;
case 'milestone':el('polygon',{points:`${x+19},${y} ${x+w},${y} ${x+w-19},${y+h} ${x},${y+h}`,...common},g);break;
case 'vacancy':el('rect',{x,y,width:w,height:h,rx:7,...common,'stroke-dasharray':'6 4'},g);break;
case 'department':el('rect',{x,y,width:w,height:h,rx:7,...common},g);el('rect',{x,y,width:6,height:h,fill:'#0D7475',rx:3},g);break;
case 'team':el('rect',{x,y,width:w,height:h,rx:6,...common},g);el('rect',{x:x+10,y:y+10,width:w-20,height:7,rx:3,fill:'#0D7475',opacity:.65},g);break;
default:el('rect',{x,y,width:w,height:h,rx:n.shape==='person'?8:6,...common},g);}
if(n.pinned)el('text',{x:x+w-13,y:y+14,fill:'#A87B27','font-size':12},g).textContent='◆';
if(n.groupId)el('rect',{x:x+4,y:y+4,width:6,height:6,rx:2,fill:'#0D7475',opacity:.6},g);
}
function wrapText(text,maxWidth,fontSize=13,maxRows=4){const lines=[];for(const raw of String(text||'').split('\n')){const words=raw.trim().split(/\s+/).filter(Boolean);let line='';const maxChars=Math.max(9,Math.floor(maxWidth/(fontSize*.57)));for(const word of words){if((line+' '+word).trim().length>maxChars&&line){lines.push(line);line=word;}else line=(line+' '+word).trim();}if(line)lines.push(line);if(!words.length)lines.push('');}return lines.slice(0,maxRows).map((s,i)=>i===maxRows-1&&lines.length>maxRows-1&&s.length>8?s.slice(0,-1)+'…':s);}
function drawText(g,n,exportMode=false){const p=nodePos(n),centerX=p.x+p.w/2;const isOrg=page.mode==='org';const sub=isOrg?(n.data?.role||''):'';let text=n.label;const font=Math.max(10,Math.min(n.fontSize||13,22));let w=p.w-(n.shape==='decision'?58:30);if(n.shape==='data')w-=18;const lines=wrapText(text,w,font,3);let labelHeight=lines.length*(font+4);let ty=p.y+p.h/2-(labelHeight/2)+(font*.82);if(sub)ty-=7;
const t=el('text',{x:n.textAlign==='left'?p.x+15:n.textAlign==='right'?p.x+p.w-15:centerX,y:ty,'text-anchor':n.textAlign==='left'?'start':n.textAlign==='right'?'end':'middle',fill:n.textColor||'#173B50','font-size':font,'font-weight':n.fontWeight??600,'font-family':n.fontFamily==='serif'?'Georgia,serif':n.fontFamily==='mono'?'monospace':'Arial,sans-serif','font-style':n.italic?'italic':'normal',class:'node-text'},g);if(exportMode)t.setAttribute('font-family',n.fontFamily==='serif'?'Georgia,serif':n.fontFamily==='mono'?'monospace':'Arial,sans-serif');for(let i=0;i<lines.length;i++){const span=el('tspan',{x:n.textAlign==='left'?p.x+15:n.textAlign==='right'?p.x+p.w-15:centerX,dy:i===0?0:font+4},t);setText(span,lines[i]);}if(sub){const t2=el('text',{x:centerX,y:ty+labelHeight+4,'text-anchor':'middle',fill:'#6D7E87','font-size':10,class:'node-text'},g);setText(t2,short(sub));if(exportMode)t2.setAttribute('font-family','Arial,sans-serif');}
if(n.collapsed&&(page.mode==='flow'?!!flowSnapshot()?.descendantCount.get(n.id):treeChildren(n.id).length)){el('rect',{x:p.x+p.w-22,y:p.y+p.h-5,width:29,height:18,rx:9,fill:'#0D7475'},g);const t3=el('text',{x:p.x+p.w-7.5,y:p.y+p.h+7,'text-anchor':'middle','font-size':10,fill:'#fff','font-weight':700,class:'node-text'},g);setText(t3,'+'+(page.mode==='flow'?flowSnapshot().descendantCount.get(n.id):descendants(n.id).size));}}

/* First-class annotations: visual text boxes, optionally anchored to a shape. */
function annotationTextRuns(a){const root=document.createElement('div');root.innerHTML=a.html||esc(a.label||'');const runs=[];const visit=(n,fmt={})=>{if(n.nodeType===3){if(n.textContent)runs.push({text:n.textContent,...fmt});return;}if(n.nodeType!==1)return;const tag=n.tagName.toLowerCase();if(tag==='script'||tag==='style'||tag==='iframe')return;const f={...fmt};if(['strong','b'].includes(tag))f.bold=true;if(['i','em'].includes(tag))f.italic=true;if(tag==='u')f.underline=true;if(['s','strike','del'].includes(tag))f.strike=true;const css=n.style;if(css.fontWeight&&(css.fontWeight==='bold'||Number(css.fontWeight)>=600))f.bold=true;if(css.fontStyle==='italic')f.italic=true;if(css.textDecorationLine?.includes('underline'))f.underline=true;if(css.textDecorationLine?.includes('line-through'))f.strike=true;if(css.color)f.color=css.color;if(css.backgroundColor&&css.backgroundColor!=='transparent')f.highlight=css.backgroundColor;if(tag==='font'&&n.getAttribute('color'))f.color=n.getAttribute('color');if(tag==='br'){runs.push({text:'\n',...f});return;}if(['div','p'].includes(tag)&&runs.length&&!runs.at(-1).text.endsWith('\n'))runs.push({text:'\n',...f});for(const c of n.childNodes)visit(c,f);};for(const c of root.childNodes)visit(c);return runs.length?runs:[{text:a.label||'',bold:false}];}
const annotationMeasure=document.createElement('canvas').getContext('2d');
function annotationFont(a,fmt,fs){const family=a.fontFamily==='serif'?'Georgia':a.fontFamily==='mono'?'monospace':'Arial';return `${fmt.italic||a.italic?'italic ':''}${fmt.bold?'700':a.fontWeight||400} ${fs}px ${family}`;}
function annotationLines(a){const fs=clamp(Number(a.fontSize)||14,8,70),lineH=fs*1.3,limit=Math.max(24,a.w-2*(a.padding??12)),lines=[[]];let x=0;for(const run of annotationTextRuns(a)){annotationMeasure.font=annotationFont(a,run,fs);for(const ch of run.text){if(ch==='\n'){lines.push([]);x=0;continue;}const cw=annotationMeasure.measureText(ch).width;
if(x+cw>limit&&lines.at(-1).length&&ch!==' '){const row=lines.at(-1);let lastSpace=-1;for(let i=0;i<row.length;i++)if(row[i].ch===' ')lastSpace=i;
if(lastSpace>0){const tail=row.splice(lastSpace+1);row.pop();lines.push(tail);x=tail.reduce((sum,it)=>sum+it.cw,0);}else{lines.push([]);x=0;}}
if(ch===' '&&x===0)continue;lines.at(-1).push({ch,cw,fmt:run});x+=cw;}}
return{lines:lines.slice(0,Math.max(2,Math.floor((a.h-2*(a.padding??12))/lineH)+1)),fs,lineH};}
function drawAnnotation(layer,a,exportMode=false){if(a.parentId&&!visibleIdSet.has(a.parentId))return;const pos=annoPosition(a),g=el('g',{'data-annotation-id':a.id,class:'annotation-g'+(selectedAnnotation===a.id&&!exportMode?' selected':'')},layer),fill=a.fill==='transparent'?'none':(Object.fromEntries(COLORS)[a.fill]||a.fill||'none');const border=Number(a.strokeWidth)||0;
el('rect',{x:pos.x,y:pos.y,width:a.w,height:a.h,rx:3,fill,stroke:border?(a.stroke||'#38586D'):'none','stroke-width':border,'stroke-dasharray':a.strokeStyle==='dashed'?'7 5':a.strokeStyle==='dotted'?'2 4':null,opacity:a.opacity??1,class:'annotation-body'},g);
const {lines,fs,lineH}=annotationLines(a),padding=Number(a.padding??12),contentH=lines.length*lineH,cy=a.vAlign==='top'?pos.y+padding:a.vAlign==='bottom'?pos.y+a.h-padding-contentH:pos.y+(a.h-contentH)/2;
for(let i=0;i<lines.length;i++){const chars=lines[i],parts=[];for(const it of chars){const signature=JSON.stringify({bold:it.fmt.bold,italic:it.fmt.italic,underline:it.fmt.underline,strike:it.fmt.strike,color:it.fmt.color,highlight:it.fmt.highlight});const last=parts.at(-1);if(last&&last.signature===signature)last.text+=it.ch;else parts.push({signature,text:it.ch,fmt:it.fmt});}
for(const part of parts){annotationMeasure.font=annotationFont(a,part.fmt,fs);part.width=annotationMeasure.measureText(part.text).width;}const width=parts.reduce((sum,p)=>sum+p.width,0);let px=a.textAlign==='center'?pos.x+(a.w-width)/2:a.textAlign==='right'?pos.x+a.w-padding-width:pos.x+padding,yy=cy+i*lineH+fs*.87;
for(const part of parts){const o=part.fmt||{},ink=o.color||((isDark()&&!exportMode&&a.autoTextColor&&a.fill==='transparent')?'#DCE5EB':(a.textColor||'#173B50')),high=o.highlight||a.highlight;if(high&&high!=='none'&&high!=='transparent')el('rect',{x:px,y:yy-fs*.95,width:part.width+.5,height:fs*1.18,fill:high},g);
const t=el('text',{x:px,y:yy,'font-family':a.fontFamily==='serif'?'Georgia,serif':a.fontFamily==='mono'?'monospace':'Arial,sans-serif','font-size':fs,'font-weight':o.bold?700:(a.fontWeight||400),'font-style':o.italic||a.italic?'italic':'normal','text-decoration':[o.underline||a.underline?'underline':'',o.strike||a.strike?'line-through':''].filter(Boolean).join(' ')||'none',fill:ink,'pointer-events':'none','xml:space':'preserve'},g);t.textContent=part.text;px+=part.width;}}
if(selectedAnnotation===a.id&&!exportMode){el('rect',{x:pos.x-4,y:pos.y-4,width:a.w+8,height:a.h+8,rx:5,class:'selection-box','pointer-events':'none'},g);el('rect',{x:pos.x+a.w-5,y:pos.y+a.h-5,width:10,height:10,rx:1.5,class:'resize-handle','data-anno-resize':'se','data-annotation-id':a.id},g);}}
function addAnnotation(attached=false){if(attached&&selected.size!==1){toast('Select a shape first, then add attached text.');return;}const parentId=attached?[...selected][0]:null,wh=getWorldSize(),a=annotation(attached?'Caption / note':'Your note',parentId);if(!attached){a.x=(wh.w*.45-view.x)/view.k;a.y=(wh.h*.4-view.y)/view.k;}transact(()=>{allAnnotations().push(a);selected.clear();edgeSelected=null;selectedAnnotation=a.id;});beginAnnotationEdit(a.id);}
function selectAnnotation(id){selectedAnnotation=id;selected.clear();edgeSelected=null;render();}
function annotationColor(v){return /^#[0-9a-f]{6}$/i.test(v)?v:'#173B50';}
function beginAnnotationEdit(id,replaceWith=null){const a=annoById(id);if(!a)return;if(editing)finishEdit();const p=annoPosition(a),editor=dom('div','rich-text-editor',undefined,$('canvasWrap'));
editor.style.left=`${p.x*view.k+view.x}px`;editor.style.top=`${p.y*view.k+view.y}px`;editor.style.width=`${Math.max(245,a.w*view.k)}px`;
const toolbar=dom('div','rich-toolbar',undefined,editor);let range=null;
const field=dom('div','rich-edit-area',undefined,editor);field.contentEditable='true';field.spellcheck=true;field.style.minHeight=`${Math.max(85,a.h*view.k)}px`;field.style.fontSize=`${Math.max(12,a.fontSize*view.k)}px`;field.innerHTML=replaceWith===null?(a.html||esc(a.label)):esc(replaceWith);field.addEventListener('keyup',()=>{const s=window.getSelection();if(s.rangeCount&&field.contains(s.anchorNode))range=s.getRangeAt(0).cloneRange();});field.addEventListener('mouseup',()=>{const s=window.getSelection();if(s.rangeCount&&field.contains(s.anchorNode))range=s.getRangeAt(0).cloneRange();});
const restore=()=>{field.focus();if(range){const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);}};
for(const [text,cmd] of [['B','bold'],['I','italic'],['U','underline'],['S','strikeThrough']]){const btn=dom('button','rich-format-button',text,toolbar);btn.title='Format selected text: '+cmd;btn.onmousedown=e=>e.preventDefault();btn.onclick=()=>{restore();document.execCommand(cmd,false,null);};}
for(const [lbl,cmd,value] of [['Text','foreColor',annotationColor(a.textColor)],['Highlight','hiliteColor','#FFF0A9']]){const lab=dom('label','rich-color-label',lbl,toolbar),inp=dom('input',undefined,undefined,lab);inp.type='color';inp.value=value;inp.title=lbl;inp.addEventListener('input',()=>{restore();document.execCommand(cmd,false,inp.value);});}
const commit=dom('button','rich-action','✓ Save',toolbar),cancel=dom('button','rich-action','Cancel',toolbar);const prev=clone(a);editing={type:'annotation',id,input:field,container:editor};const finish=save=>{if(editing?.container!==editor)return;editing=null;if(save){const sanitized=sanitizeAnnotationMarkup(field);const plain=plainOfHtml(sanitized).trim();if(plain){transact(()=>{a.html=sanitized;a.label=plain;});}}editor.remove();focusCanvas();render();};commit.onclick=()=>finish(true);cancel.onclick=()=>finish(false);field.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();finish(false);}if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();e.stopPropagation();finish(true);}});field.focus();if(replaceWith!==null){const sel=window.getSelection(),r=document.createRange();r.selectNodeContents(field);r.collapse(false);sel.removeAllRanges();sel.addRange(r);}else{const sel=window.getSelection(),r=document.createRange();r.selectNodeContents(field);sel.removeAllRanges();sel.addRange(r);}}
function sanitizeAnnotationMarkup(div){const permitted=new Set(['B','STRONG','I','EM','U','S','STRIKE','DIV','P','BR','SPAN','FONT']);const keep=tag=>{if(tag.nodeType===3)return document.createTextNode(tag.nodeValue);if(tag.nodeType!==1)return document.createTextNode('');if(!permitted.has(tag.tagName)){const fragment=document.createDocumentFragment();for(const c of [...tag.childNodes])fragment.appendChild(keep(c));return fragment;}const t=document.createElement(tag.tagName.toLowerCase());for(const cssKey of ['color','backgroundColor','fontWeight','fontStyle','textDecorationLine']){const val=tag.style[cssKey];if(val&&val.length<80&&!/url|expression|var\(/i.test(val))t.style[cssKey]=val;}if(tag.tagName==='FONT'&&/^#[a-f0-9]{6}$/i.test(tag.getAttribute('color')||''))t.setAttribute('color',tag.getAttribute('color'));for(const c of [...tag.childNodes])t.appendChild(keep(c));return t;};const clean=document.createElement('div');for(const child of [...div.childNodes])clean.appendChild(keep(child));return clean.innerHTML.slice(0,30000);}

function drawNode(layer,n,exportMode=false){const g=el('g',{'data-node-id':n.id,class:'node-g'+(selected.has(n.id)&&!exportMode?' selected':'')},layer);shapeElement(g,n);drawText(g,n,exportMode);const p=nodePos(n);
if((page.mode==='flow'?!!flowSnapshot()?.descendantCount.get(n.id):treeChildren(n.id).length)&&!exportMode){const hidden=page.mode==='flow'?flowSnapshot().descendantCount.get(n.id):descendants(n.id).size;const cx=p.x+p.w+15,cy=p.y+13;const cg=el('g',{'data-collapse-node':n.id,class:'branch-toggle','role':'button','aria-label':n.collapsed?'Expand '+hidden+' descendants':'Collapse branch'},g);el('circle',{cx,cy,r:10.5,fill:n.collapsed?'#0D7475':'var(--surface)',stroke:'#0D7475','stroke-width':1.7,'data-collapse-node':n.id},cg);setText(el('text',{x:cx,y:cy+3.8,'text-anchor':'middle','font-size':14,'font-weight':700,fill:n.collapsed?'#fff':'#0D7475','pointer-events':'none'},cg),n.collapsed?'+':'−');if(n.collapsed){setText(el('text',{x:cx+15,y:cy+3.5,'font-size':10,fill:'var(--ink)','pointer-events':'none'},cg),String(hidden));}}
if(selected.has(n.id)&&!exportMode){el('rect',{x:p.x-4,y:p.y-4,width:p.w+8,height:p.h+8,rx:8,class:'selection-box'},g);for(const [port,v] of Object.entries(pointsFor(n)))el('circle',{cx:v.x,cy:v.y,r:6.5,class:'port','data-node-id':n.id,'data-port':port},g);for(const [corner,cx,cy] of [['nw',p.x-4,p.y-4],['ne',p.x+p.w+4,p.y-4],['sw',p.x-4,p.y+p.h+4],['se',p.x+p.w+4,p.y+p.h+4]])el('rect',{x:cx-4,y:cy-4,width:8,height:8,rx:1.4,class:'resize-handle','data-node-id':n.id,'data-resize':corner},g);
const x=page.mode==='mind'?p.x+p.w+23:p.x+p.w+19,y=page.mode==='mind'?p.y+p.h/2:p.y+p.h+18;el('circle',{cx:x,cy:y,r:11,class:'quick-add','data-action':'quick-child','data-node-id':n.id},g);setText(el('text',{x,y:y+4,'text-anchor':'middle','font-size':16,fill:'var(--teal)','pointer-events':'none'},g),'+');}
return g;}
// TH-L2 viewport culling affects DOM paint only. Full project data, hidden
// notes, selections, exports and print are never trimmed or rewritten.
function mindViewportRect(size=getWorldSize(),paddingPx=180){
 if(page.mode!=='mind'||![view.x,view.y,view.k,size.w,size.h].every(Number.isFinite)||view.k<=0||size.w<=0||size.h<=0)return null;
 return {left:(-view.x-paddingPx)/view.k,right:(size.w-view.x+paddingPx)/view.k,
         top:(-view.y-paddingPx)/view.k,bottom:(size.h-view.y+paddingPx)/view.k};
}
function mindRectIntersects(box,rect){return !rect||box.left<=rect.right&&box.right>=rect.left&&box.top<=rect.bottom&&box.bottom>=rect.top;}
function mindNodeInViewport(n,rect){
 if(!rect)return true;
 const p=nodePos(n);
 if(![p.x,p.y,p.w,p.h].every(Number.isFinite))return true; // don't drop malformed legacy objects silently
 return mindRectIntersects({left:p.x,right:p.x+p.w,top:p.y,bottom:p.y+p.h},rect);
}
function mindAnnotationInViewport(a,rect){
 if(!rect||selectedAnnotation===a.id)return true;
 const p=annoPosition(a);
 if(![p.x,p.y,a.w,a.h].every(Number.isFinite))return true;
 return mindRectIntersects({left:p.x,right:p.x+a.w,top:p.y,bottom:p.y+a.h},rect);
}
function mindEdgeInViewport(e,rect,nodesById){
 if(!rect||edgeSelected===e.id||e.label)return true; // arbitrary-length link labels must not disappear
 const free=isFreeEdge(e),a=free?null:nodesById.get(e.from),b=free?null:nodesById.get(e.to);
 if(!free&&(!a||!b))return false;
 if(!free&&(selected.has(a.id)||selected.has(b.id)))return true;
 // An explicitly routed/orthogonal link may detour far beyond its endpoints;
 // never discard it using an endpoint-only guess.
 if(e.route!=='curve'&&e.route!=='straight')return true;
 let points;
 if(free){
  points=[e.start,e.end];
  if(e.route==='curve'){
   const dx=e.end.x-e.start.x,o=e.parallelOffset||0;
   points.push({x:e.start.x+dx*.48,y:e.start.y+o},{x:e.end.x-dx*.48,y:e.end.y+o});
  }
 }else{
  const {a:start,b:end,fromPort}=connAnchors(e,a,b);
  points=[start,end];
  if(e.route==='curve'){
   const dx=end.x-start.x,dy=end.y-start.y,horizontal=fromPort==='left'||fromPort==='right';
   points.push(horizontal?{x:start.x+dx*.48,y:start.y}:{x:start.x,y:start.y+dy*.45},
               horizontal?{x:end.x-dx*.48,y:end.y}:{x:end.x,y:end.y-dy*.45});
  }
 }
 if(points.some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)))return true;
 const xs=points.map(p=>p.x),ys=points.map(p=>p.y),margin=e.label?36:15;
 // Cubic Bézier curves stay within their control-point convex hull. Include
 // label, strokes and hit targets so crossing links remain accessible.
 return mindRectIntersects({left:Math.min(...xs)-margin,right:Math.max(...xs)+margin,
                            top:Math.min(...ys)-margin,bottom:Math.max(...ys)+margin},rect);
}
let visibleIdSet=new Set();
function renderCanvas(){if(!page||page.mode==='bmc')return;
 flowRenderPlan=page.mode==='flow'?flowGraphPlan():null;
 const allVisible=visibleNodes(),wh=getWorldSize(),viewport=mindViewportRect(wh);
 visibleIdSet=new Set(allVisible.map(n=>n.id));
 const paintedNodes=viewport?allVisible.filter(n=>selected.has(n.id)||mindNodeInViewport(n,viewport)):allVisible;
 const nodesById=viewport?new Map(page.nodes.map(n=>[n.id,n])):null;
 camera.setAttribute('transform',`translate(${view.x} ${view.y}) scale(${view.k})`);$('zoomValue').textContent=Math.round(view.k*100)+'%';gridLayer.replaceChildren();previewLayer.replaceChildren();edgeLayer.replaceChildren();nodeLayer.replaceChildren();overlayLayer.replaceChildren();const x=-view.x/view.k,y=-view.y/view.k; if(showGrid)el('rect',{x,y,width:wh.w/view.k,height:wh.h/view.k,fill:'url(#gridPattern)','pointer-events':'none'},gridLayer);
 if(preview){for(const n of paintedNodes){const p=preview[n.id];if(p&&(Math.abs(p.x-n.x)+Math.abs(p.y-n.y)>1||orgPreviewSizes[n.id]&&(orgPreviewSizes[n.id].w!==n.w||orgPreviewSizes[n.id].h!==n.h)))el('rect',{x:p.x-5,y:p.y-5,width:(orgPreviewSizes[n.id]?.w||n.w)+10,height:(orgPreviewSizes[n.id]?.h||n.h)+10,rx:8,class:'preview-box'},previewLayer);}}
 for(const e of effectiveEdges())if(!viewport||mindEdgeInViewport(e,viewport,nodesById))drawEdge(edgeLayer,e);
 for(const n of paintedNodes)drawNode(nodeLayer,n);
 for(const a of allAnnotations())if((page.mode!=='flow'||(flowFocusId()?!!a.parentId&&visibleIdSet.has(a.parentId):!a.parentId||visibleIdSet.has(a.parentId)))&&(!viewport||mindAnnotationInViewport(a,viewport)))drawAnnotation(nodeLayer,a);
 drawSelectedEdgeHandles(overlayLayer);
if(gesture?.type==='connect'||connectSource){const src=gesture?.source||connectSource?.id,n=byId(src),port=gesture?.port||connectSource?.port||'auto';if(n){const anchor=port!=='auto'?pointsFor(n)[port]:{x:n.x+n.w/2,y:n.y+n.h/2},p=gesture?.current||anchor;el('circle',{cx:anchor.x,cy:anchor.y,r:6,fill:'var(--teal)','pointer-events':'none'},overlayLayer);if(gesture?.type==='connect')el('path',{d:`M${anchor.x} ${anchor.y} L${p.x} ${p.y}`,stroke:'var(--teal)','stroke-width':2,'stroke-dasharray':'5 3','pointer-events':'none'},overlayLayer);}}
if(gesture?.type==='edge-reanchor'){const ed=findEdge(gesture.edgeId),src=byId(ed?.from),dst=byId(ed?.to);if(ed&&src&&dst){const geom=getEdgeGeom(ed,src,dst),p=gesture.current||gesture.start,from=gesture.which==='from'?p:geom.a,to=gesture.which==='to'?p:geom.b;el('path',{d:`M${from.x} ${from.y} L${to.x} ${to.y}`,stroke:'var(--teal)','stroke-width':2.5,'stroke-dasharray':'5 4','pointer-events':'none'},overlayLayer);}}
if(gesture?.type==='arrow-draw'){const a=gesture.startWorld,b=gesture.current||a;el('path',{d:`M${a.x} ${a.y} L${b.x} ${b.y}`,stroke:'var(--teal)','stroke-width':2,'marker-end':'url(#diagramitArrow_filled)','pointer-events':'none'},overlayLayer);}

if(gesture?.type==='marquee'){const a=gesture.startWorld,b=gesture.current||a;el('rect',{x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width:Math.abs(b.x-a.x),height:Math.abs(b.y-a.y),class:'marquee'},overlayLayer);}}
function renderUI(){if(!page)return;updateMindOrderControls();flowRenderFocusBar();$('btnMindNotes').hidden=page.mode!=='mind';$('btnDepartment').hidden=page.mode!=='org';$('docName').value=doc.name;$('modePill').textContent='Diagram: '+MODES[page.mode].name+'  ▾';$('modePill').setAttribute('aria-label','Diagram: '+MODES[page.mode].name+'; click to change or create');renderPageTabs();$('statusCounts').textContent=page.mode==='mind'?`${page.nodes.length} topics · ${page.nodes.filter(n=>n.noteHtml?.trim()||n.keepitLink?.itemId).length} topic notes · ${effectiveEdges().length} links`:`${page.nodes.length} nodes · ${(page.annotations||[]).length} notes · ${effectiveEdges().length} links`;$('statusMode').textContent=`${MODES[page.mode].name} · ${page.name}`;$('modeNote').textContent=connectSource?'Arrow source chosen · Click a second node (Esc cancels)':tool==='arrow'?'Click-drag anywhere to draw a free arrow':page.mode==='flow'?'Tab child · Enter sibling · ⌥Arrow directional child':page.mode==='org'?'Tab child · Enter sibling · ⌥Arrow child · ⌥⇧Arrow parent':'Tab child · Enter sibling · ⌥Arrow directional branch';$('emptyHint').hidden=page.nodes.length!==0;diUpdateMobileStarter();diP3UpdateNav();$('selectionToolbar').hidden=selected.size===0&&edgeSelected===null&&selectedAnnotation===null;$('selectionCount').textContent=selected.size?`${selected.size} selected`:selectedAnnotation?'Text selected':'Link selected';$('floatChild').style.display=selected.size===1?'':'none';$('floatEdit').style.display=selected.size===1||edgeSelected||selectedAnnotation?'':'none';$('btnUndo').disabled=!history.undo.length;$('btnRedo').disabled=!history.redo.length;$('btnGroup').disabled=selected.size<2;$('btnUngroup').disabled=![...selected].some(id=>byId(id)?.groupId);$('btnGrid').style.color=showGrid?'var(--teal)':'';$('btnFormatPainter').classList.toggle('active',paintActive);$('btnFormatPainter').disabled=selected.size!==1&&!paintStyle;updatePanelButtons();canvas.dataset.tool=tool;$('btnConnect').classList.toggle('active',tool==='connect');$('btnArrow').classList.toggle('active',tool==='arrow');renderPages();renderShapeLibrary();renderOutline();renderInspector();}

// T22-B · main-workspace Outline table. Pure Outline/WBS calculations are in
// outline-wbs.js. Only the existing ThinkIt document is mutated via transact().
// KeepIt editor, notes, accounts, outbox and cloud modules are out of scope.
const t22PageView=new Map(),t22Collapsed=new Map(),t22PageSearch=new Map();
// Flowchart Outline and canvas share the stored node.collapsed state; other
// modes keep their existing per-view Outline collapse preferences.
function t22CollapsedForPage(){return page?.mode==='flow'?flowCollapsedIds():new Set(t22Collapsed.get(page.id)||[]);}
let t22Filter='',t22CurrentRows=[],t22Revealing=null,t22LastIssue='';
let t22ActivePageId=null,t22VisibleCache=null;
const T22_ROW_HEIGHT=44;
function t22IsOutline(){return !!page&&!['bubble','bmc'].includes(page.mode)&&!diNoTabs()&&t22PageView.get(page.id)==='outline';}
function t22SyncWorkspace(){
 const available=!!page&&!['bubble','bmc'].includes(page.mode)&&!diNoTabs(),isOutline=available&&t22IsOutline();
 $('t22ViewBar').hidden=!available;$('t22OutlinePanel').hidden=!isOutline;
 $('canvasWrap').hidden=isOutline;
 $('t22DiagramBtn').setAttribute('aria-pressed',String(!isOutline));
 $('t22OutlineBtn').setAttribute('aria-pressed',String(isOutline));
}
function t22SwitchView(which){
 if(!page||['bubble','bmc'].includes(page.mode))return;
 if(which==='outline'&&!window.ThinkItOutline){toast('Outline model unavailable; diagram preserved.');return;}
 t22PageView.set(page.id,which);
 if(which==='outline'){
  t22Revealing=[...selected][0]||null;
  t22Filter=t22PageSearch.get(page.id)||'';$('t22Search').value=t22Filter;
 }
 render();
 if(which==='diagram')focusCanvas();
}
function t22UiIssue(msg){t22LastIssue=msg;const el=$('t22OutlineStatus');el.textContent=msg;el.dataset.severity='warning';toast(msg);}
function t22ClearIssue(){t22LastIssue='';const el=$('t22OutlineStatus');el.dataset.severity='';}
function t22CheckedPlan(p){const a=window.ThinkItOutline.auditPage(p);return a;}
function t22SelectedNode(){return selected.size===1?byId([...selected][0]):null;}
function t22ParentKey(n){return page.mode==='flow'?(n.outlineParentId??null):(n.parentId??null);}
function t22EditNode(id,changes){
 const source=byId(id);if(!source)return false;
 const altered={...source,...changes};
 const shadow={...page,nodes:page.nodes.map(n=>n.id===id?altered:n)};
 try{
  const before=t22CheckedPlan(page),after=t22CheckedPlan(shadow);
  const severe=new Set(['DEPENDENCY_CYCLE','SELF_DEPENDENCY','DUPLICATE_DEPENDENCY','DUPLICATE_WBS_CODE']);
  const prior=new Set(before.warnings.filter(w=>severe.has(w.code)).map(w=>w.code+'|'+w.nodeId+'|'+(w.relatedId||'')));
  const introduced=after.warnings.find(w=>severe.has(w.code)&&!prior.has(w.code+'|'+w.nodeId+'|'+(w.relatedId||'')));
  if(introduced)throw Error('Invalid WBS edit: '+introduced.code);
 }catch(err){t22UiIssue(err.message);return false;}
 transact(()=>{Object.assign(source,changes);
   if(page.mode==='flow'&&flowFocusId()&&Object.prototype.hasOwnProperty.call(changes,'outlineParentId')){
     const stillInside=window.ThinkItFlowFocus.index(page).descendants(flowFocusId()).has(id);
     if(!stillInside){flowFocusByPage.set(page.id,null);flowRenderPlan=null;t22VisibleCache=null;}
   }
  });t22ClearIssue();return true;
}
function t22EditDependencies(id,raw){
 try{
  const planned=window.ThinkItOutline.parseDependencyText(page,id,raw);
  return t22EditNode(id,{dependencies:planned.dependencies});
 }catch(err){t22UiIssue(err.message);return false;}
}
function t22OpenPredecessorPicker(id){
 const activity=byId(id);if(!activity||page.mode==='org')return;
 const openedPage=page.id,items=(activity.dependencies||[]).map(x=>({id:x.id,type:x.type||'FS'}));
 const body=modal('Predecessors · '+(activity.label||'Activity'),'',[
  {text:'Cancel'},
  {text:'Apply predecessors',primary:true,action:()=>{
   if(page?.id!==openedPage){t22UiIssue('Diagram changed. Reopen the predecessor editor.');return false;}
   try{const patch=window.ThinkItOutline.previewDependencies(page,id,items);
    if(!t22EditNode(id,{dependencies:patch.dependencies}))return false;
    return true;
   }catch(err){t22UiIssue(err.message);return false;}
  }}]);
 body.classList.add('t22-picker');
 dom('p','field-note','Add predecessors by stable item ID. Diagram arrows remain independent.',body);
 const search=dom('input','t22-picker-search',undefined,body);search.type='search';search.placeholder='Search code or activity name';search.setAttribute('aria-label','Find predecessor');
 const pickLine=dom('div','t22-picker-controls',undefined,body);
 const choices=dom('select','',undefined,pickLine);choices.setAttribute('aria-label','Predecessor activity');
 const kind=dom('select','',undefined,pickLine);kind.setAttribute('aria-label','Dependency type');
 for(const type of ['FS','SS','FF','SF']){const o=dom('option','',type,kind);o.value=type;}
 const add=dom('button','inspector-btn','Add predecessor',pickLine);add.type='button';
 const selectedList=dom('div','t22-picker-selected',undefined,body);
 const redraw=()=>{
  selectedList.replaceChildren();
  if(!items.length)dom('p','field-note','No predecessors selected.',selectedList);
  const codes=new Map(window.ThinkItOutline.auditPage(page).rows.map(r=>[r.id,r.code+' · '+(r.label||'')]));
  items.forEach((item,i)=>{
   const line=dom('div','t22-picker-entry',undefined,selectedList);
   dom('span','',((codes.get(item.id)||'#'+item.id)+' ['+item.type+']'),line);
   const remove=dom('button','inspector-btn','Remove',line);remove.type='button';
   remove.onclick=()=>{items.splice(i,1);redraw();};
  });
 };
 const refresh=()=>{
  choices.replaceChildren();
  const options=window.ThinkItOutline.dependencyChoices(page,id,search.value,100);
  for(const entry of options){const o=dom('option','',entry.code+' · '+(entry.label||'')+' ('+entry.id+')',choices);o.value=entry.id;}
  add.disabled=!options.length;
 };
 search.addEventListener('input',refresh);
 add.onclick=()=>{
  const target=choices.value;if(!target)return;
  if(items.some(x=>x.id===target)){t22UiIssue('Predecessor already selected');return;}
  try{window.ThinkItOutline.previewDependencies(page,id,[...items,{id:target,type:kind.value}]);
   items.push({id:target,type:kind.value});redraw();
  }catch(err){t22UiIssue(err.message);}
 };
 refresh();redraw();search.focus();
}
function t22OpenFlowGrouping(){
 if(page.mode!=='flow')return;
 const item=t22SelectedNode();if(!item){t22UiIssue('Select an activity first.');return;}
 const openedPage=page.id;
 const body=modal('WBS group · '+(item.label||'Activity'),'',[
  {text:'Cancel'},
  {text:'Apply grouping',primary:true,action:()=>{
   if(page?.id!==openedPage){t22UiIssue('Diagram changed. Reopen WBS grouping.');return false;}
   try{
    const next=select.value||null;
    const patch=window.ThinkItOutline.previewFlowGrouping(page,item.id,next);
    const siblings=page.nodes.filter(n=>n.id!==item.id&&(n.outlineParentId??null)===next);
    const order=1+Math.max(0,...siblings.map(n=>n.outlineOrder||0));
    return t22EditNode(item.id,{outlineParentId:patch.outlineParentId,outlineOrder:order});
   }catch(err){t22UiIssue(err.message);return false;}
  }}]);
 body.classList.add('t22-picker');
 dom('p','field-note','WBS grouping is independent of flowchart arrows. Moving an activity does not reroute connectors.',body);
 const select=dom('select','t22-picker-search',undefined,body);select.setAttribute('aria-label','Choose WBS parent group');
 const root=dom('option','','Top level / ungrouped',select);root.value='';
 const plan=window.ThinkItOutline.auditPage(page);
 for(const row of plan.rows){
  if(row.id===item.id)continue;
  try{window.ThinkItOutline.previewFlowGrouping(page,item.id,row.id);}
  catch{continue;}
  const o=dom('option','',row.code+' · '+(row.label||''),select);o.value=row.id;
 }
 select.value=item.outlineParentId||'';
}

function t22MoveRow(id,dir){
 const audit=t22CheckedPlan(page);const r=audit.rows.find(x=>x.id===id);if(!r)return;
 const siblings=audit.rows.filter(x=>x.parentId===r.parentId);const at=siblings.findIndex(x=>x.id===id),target=at+dir;
 if(target<0||target>=siblings.length)return;
 const reordered=siblings.slice();[reordered[at],reordered[target]]=[reordered[target],reordered[at]];
 transact(()=>reordered.forEach((row,i)=>{byId(row.id).outlineOrder=i+1;}));t22Revealing=id;
}
function t22ChangeDepth(id,dir){
 const audit=t22CheckedPlan(page),rows=audit.rows,r=rows.find(x=>x.id===id);if(!r)return;
 const current=byId(id),prop=page.mode==='flow'?'outlineParentId':'parentId';let next=null;
 if(dir>0){
  const index=rows.findIndex(x=>x.id===id);
  for(let i=index-1;i>=0;i--){if(rows[i].depth===r.depth&&rows[i].parentId===r.parentId){next=rows[i].id;break;}}
  if(!next){t22UiIssue('No earlier sibling to indent beneath.');return;}
 }else{
  if(!r.parentId){t22UiIssue('Item is already at the top level.');return;}
  next=byId(r.parentId)?.[prop]??null;
 }
 const order=Math.max(0,...page.nodes.filter(n=>n.id!==id&&t22ParentKey(n)===next).map(n=>n.outlineOrder||0))+1;
 if(t22EditNode(id,{[prop]:next,outlineOrder:order}))t22Revealing=id;
}
function t22Add(isChild){
 if(page.mode==='flow'&&flowFocusId()&&!isChild){t22UiIssue('Exit focused subprocess before adding a top-level activity.');return;}
 const source=t22SelectedNode(),parent=isChild?source:null;
 if(isChild&&!parent){t22UiIssue('Select one item before adding a subitem.');return;}
 const shape=page.mode==='flow'?'process':page.mode==='org'?'person':'topic',size=initialShapeSize(shape,source);
 const parentId=parent?.id??null,prop=page.mode==='flow'?'outlineParentId':'parentId';
 const order=Math.max(0,...page.nodes.filter(n=>t22ParentKey(n)===parentId).map(n=>n.outlineOrder||0))+1;
 const preferred=page.mode==='org'?{x:(parent?.x??100)+30,y:(parent?.y??100)+75}:parent?defaultChildPosition(parent,false,size):{x:130,y:175};
 const n=node(shape,preferred.x,preferred.y,page.mode==='org'?'New position':page.mode==='mind'?'New topic':'New activity',
    ['mind','flow'].includes(page.mode)?{w:size.w,h:size.h}:{});
 n[prop]=parentId;n.outlineOrder=order;n.dependencies=[];n.wbsCodeOverride=null;
 transact(()=>{page.nodes.push(n);if(['flow','mind'].includes(page.mode)&&parent?.collapsed)parent.collapsed=false;
   arrangeInserted(n,preferred,page.mode==='mind'&&parent&&preferred.x<parent.x?'left':page.mode==='mind'?'right':'down');
   selected=new Set([n.id]);edgeSelected=null;
 if(parent?.id&&['mind','flow'].includes(page.mode)){h3BranchReflow(parent.id);h3Repair(n.id);}
 });t22Revealing=n.id;
}
function t22SetPreset(value){
 const draft={...page.outlineSettings,preset:value};
 // Presets explicitly reset template fields; customization can follow in T22-E.
 for(const field of ['prefix','padding','separator'])delete draft[field];
 try{window.ThinkItOutline.settingsFor(page.mode,draft);window.ThinkItOutline.auditPage({...page,outlineSettings:draft});}
 catch(err){t22UiIssue(err.message);return;}
 transact(()=>{page.outlineSettings=draft;});t22ClearIssue();
}
function t22RenderWorkspace(scrollOnly=false){
 if(!t22IsOutline())return;
 const host=$('t22OutlineScroll'),body=$('t22OutlineRows');
 if(t22ActivePageId!==page.id){
  t22ActivePageId=page.id;t22Filter=t22PageSearch.get(page.id)||'';
  $('t22Search').value=t22Filter;t22VisibleCache=null;
 }
 let audit,all,visible,lookup,hasChildren,collapsed,matchCount=0;
 // Scrolling moves only the DOM window. It must not re-run the entire WBS
 // hierarchy/numbering/dependency validator on every trackpad event.
 if(scrollOnly&&t22VisibleCache?.pageId===page.id){
  ({audit,all,visible,lookup,hasChildren,collapsed,matchCount}=t22VisibleCache);
 }else{
  try{audit=t22CheckedPlan(page);}catch(err){body.replaceChildren();t22UiIssue('Cannot display outline: '+err.message);return;}
  all=page.mode==='flow'&&flowFocusId()?window.ThinkItFlowFocus.scopedRows(page,audit.rows,flowFocusId()):audit.rows;
   lookup=new Map(all.map(r=>[r.id,r]));
  collapsed=t22CollapsedForPage();
  hasChildren=new Set(all.map(r=>r.parentId).filter(x=>x!==null&&x!==undefined));
  // Switching from the canvas to a selected topic must reveal its full path.
  // Search temporarily ignores collapses but never persists that expansion.
  if(page.mode!=='flow'&&t22Revealing&&lookup.has(t22Revealing)&&!t22Filter.trim()){
   collapsed=window.ThinkItOutline.expandedPath(all,t22Revealing,collapsed);
   t22Collapsed.set(page.id,collapsed);
  }
  const visibility=window.ThinkItOutline.visibleRows(all,{query:t22Filter,collapsed});
  visible=visibility.rows;matchCount=visibility.matchCount;
  t22VisibleCache={pageId:page.id,audit,all,visible,lookup,hasChildren,collapsed,matchCount};
 }
 t22CurrentRows=visible;
 const chosen=t22SelectedNode(),beforeScroll=host.scrollTop;
 const selectedIndex=visible.findIndex(r=>r.id===t22Revealing);
 if(t22Revealing&&selectedIndex>=0){
  const y=selectedIndex*T22_ROW_HEIGHT;
  if(y<beforeScroll||y+T22_ROW_HEIGHT>beforeScroll+(host.clientHeight||480))host.scrollTop=y;
  t22Revealing=null;
 }
 const scroll=host.scrollTop,screen=host.clientHeight||480;
 const start=Math.max(0,Math.floor(scroll/T22_ROW_HEIGHT)-8),end=Math.min(visible.length,Math.ceil((scroll+screen)/T22_ROW_HEIGHT)+8);
 body.style.height=(visible.length*T22_ROW_HEIGHT)+'px';body.replaceChildren();
 $('t22GroupFlow').hidden=page.mode!=='flow';
 $('t22CodeHead').textContent=audit.settings.codeLabel;
 $('t22CodeLabel').value=audit.settings.codeLabel;
 $('t22NameHead').textContent=page.mode==='org'?'Position / Unit':'Item / Activity Name';
 $('t22DepsHead').textContent=page.mode==='org'?'Department':'Dependencies';
 $('t22ParentHead').textContent=page.mode==='org'?'Reports to':'Parent / Group';
 $('t22Preset').value=audit.settings.preset;
 $('t22ShowDeps').checked=audit.settings.showDependencies;
 $('t22ShowParent').checked=audit.settings.showParent;
 $('t22OutlinePanel').classList.toggle('t22-hide-deps',!audit.settings.showDependencies);
 $('t22OutlinePanel').classList.toggle('t22-hide-parent',!audit.settings.showParent);
 host.setAttribute('aria-rowcount',String(visible.length));
 for(let i=start;i<end;i++){
  const r=visible[i],n=byId(r.id);
  const row=dom('div','t22-outline-row'+(selected.has(r.id)?' is-selected':''),undefined,body);
  row.id='t22-visible-row-'+i;
  row.dataset.rowId=r.id;row.dataset.index=String(i);row.style.top=(i*T22_ROW_HEIGHT)+'px';
  row.setAttribute('role','row');row.setAttribute('aria-rowindex',String(i+1));row.setAttribute('aria-level',String(r.depth+1));row.setAttribute('aria-selected',String(selected.has(r.id)));
  if(hasChildren.has(r.id))row.setAttribute('aria-expanded',String(!collapsed.has(r.id)||!!t22Filter.trim()));
  const first=dom('div','t22-code',undefined,row);first.setAttribute('role','gridcell');
  first.style.paddingLeft=Math.min(14+r.depth*14,100)+'px';
  const branch=hasChildren.has(r.id);
  const caret=dom(branch?'button':'span','t22-caret',branch?(collapsed.has(r.id)&&!t22Filter.trim()?'▸':'▾'):'•',first);
  if(branch){
   caret.type='button';caret.dataset.collapseId=r.id;
   caret.setAttribute('aria-label',(collapsed.has(r.id)&&!t22Filter.trim()?'Expand ':'Collapse ')+(r.label||r.code));
  }else caret.setAttribute('aria-hidden','true');
  const code=dom('span','',r.code,first);code.title=r.code;
  const editCode=dom('button','t22-code-edit','✎',first);editCode.type='button';editCode.dataset.codeOverride=r.id;
  editCode.title='Edit WBS code · automatic '+r.autoCode;editCode.setAttribute('aria-label','Edit WBS code for '+r.label);
  if(r.manualCode)dom('small','','manual',first);
  const title=dom('div','',undefined,row);title.setAttribute('role','gridcell');
  const input=dom('input','',undefined,title);input.type='text';input.value=n.label||'';input.dataset.field='label';input.dataset.nodeId=r.id;input.setAttribute('aria-label','Item name '+r.code);input.maxLength=500;
  const deps=dom('div','',undefined,row);deps.setAttribute('role','gridcell');
  if(page.mode==='org')dom('span','t22-parent',n.data?.department||'—',deps);
  else{
   deps.classList.add('t22-predecessor-cell');
   const depInput=dom('input','',undefined,deps);depInput.type='text';depInput.dataset.field='dependencies';depInput.dataset.nodeId=r.id;depInput.value=r.dependencies.map(d=>(d.displayCode||'#'+d.id)+(d.type!=='FS'?' ['+d.type+']':'')).join(', ');depInput.placeholder='e.g. 1.1, 1.2';depInput.setAttribute('aria-label','Predecessors for '+r.code);
   const pick=dom('button','t22-pick-predecessor','Choose',deps);pick.type='button';pick.dataset.pickPredecessors=r.id;pick.setAttribute('aria-label','Choose predecessors for '+r.code);
  }
  const parent=dom('div','t22-parent',r.parentId?(lookup.get(r.parentId)?.code||'#'+r.parentId):'—',row);parent.setAttribute('role','gridcell');
 }
 const selectedOnPage=!!chosen,at=selectedOnPage?visible.findIndex(r=>r.id===chosen.id):-1;
 if(at>=start&&at<end)host.setAttribute('aria-activedescendant','t22-visible-row-'+at);
 else host.removeAttribute('aria-activedescendant');
 $('t22AddChild').disabled=!selectedOnPage;
 $('t22Indent').disabled=at<=0;$('t22Outdent').disabled=!selectedOnPage||!lookup.get(chosen.id)?.parentId;
 $('t22MoveUp').disabled=at<=0;$('t22MoveDown').disabled=at<0||at>=visible.length-1;
 $('t22Delete').disabled=!selectedOnPage;
 $('t22OutlineStatus').textContent=t22LastIssue||`${visible.length} of ${all.length} items${t22Filter.trim()?` · ${matchCount} matches with ancestor paths`:''} · ${audit.warnings.length} model warning${audit.warnings.length===1?'':'s'} · ${page.mode==='flow'?'Flow arrows are NOT dependencies':'Diagram and outline share the same node IDs'}`;
 $('t22OutlineStatus').dataset.severity=(t22LastIssue||audit.warnings.length)?'warning':'';
 t22RenderIssues(audit.warnings,lookup);
}
function t22RenderIssues(warnings,lookup){
 const wrap=$('t22Issues'),list=$('t22IssueRows');
 wrap.hidden=!warnings.length;list.replaceChildren();
 $('t22IssuesSummary').textContent=warnings.length+' WBS issue'+(warnings.length===1?'':'s')+' · review';
 const labels={MISSING_PREDECESSOR:'Missing predecessor',SELF_DEPENDENCY:'Self dependency',DUPLICATE_DEPENDENCY:'Repeated predecessor',DEPENDENCY_CYCLE:'Circular predecessors',DUPLICATE_WBS_CODE:'Duplicate WBS code',WBS_DEPTH_ABBREVIATED:'Deep WBS number shortened'};
 for(const w of warnings.slice(0,25)){
  const label=labels[w.code]||w.code;
  const item=dom('button','t22-issue',label+' · '+(lookup.get(w.nodeId)?.code||'#'+w.nodeId)+(w.relatedId?' · '+(lookup.get(w.relatedId)?.code||'#'+w.relatedId):''),list);
  item.type='button';item.setAttribute('aria-label','Show '+label+' at '+w.nodeId);
  item.onclick=()=>t22SelectOutline(w.nodeId);
 }
 if(warnings.length>25)dom('span','field-note','… '+(warnings.length-25)+' additional issues. Export the project to retain all affected IDs.',list);
}
function t22SelectOutline(id){
 if(page.mode==='flow')flowRevealAncestors(id);
 if(!id||!byId(id))return;
 selected=new Set([id]);edgeSelected=null;selectedAnnotation=null;
 t22Revealing=id;render();
 $('t22OutlineScroll').focus({preventScroll:true});
}
function t22ToggleBranch(id,force){
 if(!id)return;
 if(page.mode==='flow'){toggleCollapse(id,force);return;}
 const collapsed=t22CollapsedForPage();
 const collapse=force===undefined?!collapsed.has(id):force;
 if(collapse){
  collapsed.add(id);
  // When closing a branch, return selection to the visible ancestor.
  const audit=t22VisibleCache?.pageId===page.id?t22VisibleCache.audit:t22CheckedPlan(page);
  const parents=new Map(audit.rows.map(r=>[r.id,r.parentId]));
  let cursor=[...selected][0],guard=0;
  while(cursor&&parents.has(cursor)&&guard++<=audit.rows.length){
   if(cursor===id)break;
   cursor=parents.get(cursor);
   if(cursor===id){selected=new Set([id]);t22Revealing=id;break;}
  }
 }else collapsed.delete(id);
 t22Collapsed.set(page.id,collapsed);t22VisibleCache=null;t22RenderWorkspace();
}
function t22CodeOverrideDialog(id){
 const n=byId(id);if(!n)return;
 const audit=t22CheckedPlan(page),row=audit.rows.find(r=>r.id===id);if(!row)return;
 modal('WBS code · '+n.label,`<p class="modal-subtext">Automatic: <strong>${esc(row.autoCode)}</strong>. Leave blank to restore automatic numbering. Other activities and dependencies retain their permanent IDs.</p><label>Manual code <input id="t22ManualCodeDraft" type="text" maxlength="96" autocomplete="off" placeholder="Automatic code" /></label>`,[
  {text:'Cancel',action:()=>{}},
  {text:'Apply code',primary:true,action:()=>{
   const value=$('t22ManualCodeDraft')?.value??'';
   try{const patch=window.ThinkItOutline.previewCodeOverride(page,id,value);t22EditNode(id,{wbsCodeOverride:patch.wbsCodeOverride});}
   catch(err){t22UiIssue(err.message);}
  }}
 ]);
 $('t22ManualCodeDraft').value=n.wbsCodeOverride??'';
}
function t22NumberingDialog(){
 const settings=t22CheckedPlan(page).settings;
 const description='Settings apply to this diagram page. Existing manual codes remain unchanged; automatic codes update without changing activity IDs or dependencies.';
 // Use DOM-created controls so user values cannot be interpreted as HTML.
 modal('Numbering options',`<p class="modal-subtext">${description}</p><div id="t22NumberingForm" class="t22-numbering-form"></div>`,[
  {text:'Cancel',action:()=>{}},
  {text:'Apply numbering',primary:true,action:()=>{
   const get=id=>$('t22opt_'+id)?.value;
   const patch={preset:'custom',prefix:get('prefix'),separator:get('separator'),padding:Number(get('padding')),startAt:Number(get('startAt'))};
   try{const validated=window.ThinkItOutline.previewSettings(page,patch);transact(()=>{page.outlineSettings=validated;});t22ClearIssue();}
   catch(err){t22UiIssue(err.message);}
  }}
 ]);
 const form=$('t22NumberingForm');
 for(const [key,label,type,min,max] of [['prefix','Prefix','text'],['separator','Separator','text'],['padding','Digits per level','number',0,6],['startAt','First top-level number','number',1,999999]]){
  const wrap=dom('label','',label,form),field=dom('input','',undefined,wrap);field.id='t22opt_'+key;field.type=type;field.value=String(settings[key]);
  if(type==='number'){field.min=min;field.max=max;field.step=1;}
  if(key==='separator')field.maxLength=1;if(key==='prefix')field.maxLength=24;
 }
}
function t22ExportWholeCsv(){
 try{const csv=window.ThinkItOutline.exportCsv(page);downloadBlob(new Blob([csv],{type:'text/csv;charset=utf-8'}),baseName()+'-'+page.mode+'-wbs.csv');toast('Full outline exported · '+page.nodes.length+' items');}
 catch(err){t22UiIssue('Export failed: '+err.message);}
}
function t22PrintWholeOutline(){
 let snapshot;
 try{snapshot=window.ThinkItOutline.exportRows(page);}catch(err){t22UiIssue(err.message);return;}
 // Open a dedicated same-origin document, which renders ALL rows rather than
 // only the currently virtualized grid window. No credentials or note bodies.
 const popup=window.open('/thinkit/40791585175d0e8d51c4/outline-print.html','_blank');
 if(!popup){t22UiIssue('Pop-up blocked; allow this site to open a print preview.');return;}
 const origin=location.origin,requestId=crypto.randomUUID();
 const payload={channel:'thinkit-outline-print-v1',type:'data',requestId,title:doc.name+' · '+page.name,mode:page.mode,
  codeLabel:snapshot.settings.codeLabel,rows:snapshot.rows.map(({code,label,dependencies,parent,id})=>({code,label,dependencies,parent,id}))};
 let sent=false;
 const handler=event=>{
  if(event.source!==popup||event.origin!==origin||event.data?.channel!=='thinkit-outline-print-v1'||event.data?.type!=='ready')return;
  if(sent)return;sent=true;window.removeEventListener('message',handler);popup.postMessage(payload,origin);
 };
 window.addEventListener('message',handler);
 // Page may be blocked or closed; fail closed and drop the transient listener.
 setTimeout(()=>window.removeEventListener('message',handler),30000);
}
function t22BindWorkspace(){
 $('t22DiagramBtn').onclick=()=>t22SwitchView('diagram');$('t22OutlineBtn').onclick=()=>t22SwitchView('outline');
 $('flowFocusLevel').onchange=e=>{if(e.target.value){const val=e.target.value==='all'?'all':Number(e.target.value);flowSetLevel(val);e.target.value='';}};
 $('flowWrapSelection').onclick=flowWrapSelected;
 $('t22OutlineScroll').addEventListener('scroll',()=>{if(t22IsOutline())t22RenderWorkspace(true);},{passive:true});
 $('t22OutlineScroll').addEventListener('click',e=>{
  const override=e.target.closest('[data-code-override]');if(override){t22CodeOverrideDialog(override.dataset.codeOverride);return;}
  const pick=e.target.closest('[data-pick-predecessors]');if(pick){t22OpenPredecessorPicker(pick.dataset.pickPredecessors);return;}
  const caret=e.target.closest('[data-collapse-id]');if(caret){t22ToggleBranch(caret.dataset.collapseId);return;}
  if(e.target.closest('input,button'))return;
  const row=e.target.closest('[data-row-id]');if(row)t22SelectOutline(row.dataset.rowId);
 });
 $('t22OutlineScroll').addEventListener('change',e=>{
  const input=e.target.closest('input[data-field][data-node-id]');if(!input)return;
  const id=input.dataset.nodeId;
  if(input.dataset.field==='label'){const value=input.value.trim();if(value)t22EditNode(id,{label:value});else{t22UiIssue('Item name cannot be blank.');t22RenderWorkspace();}}
  else if(input.dataset.field==='dependencies'){if(!t22EditDependencies(id,input.value))t22RenderWorkspace();}
 });
 $('t22OutlineScroll').addEventListener('keydown',e=>{
  // Text fields keep native editing keys; navigation keys operate on the grid.
  if(e.target.closest('input,button'))return;
  const rows=t22CurrentRows,ids=rows.map(r=>r.id),current=ids.indexOf([...selected][0]);
  const at=current<0?0:current;let next=null;
  if(e.key==='ArrowDown')next=Math.min(ids.length-1,at+(current<0?0:1));
  else if(e.key==='ArrowUp')next=Math.max(0,at-1);
  else if(e.key==='Home')next=0;
  else if(e.key==='End')next=ids.length-1;
  else if(e.key==='PageDown'||e.key==='PageUp'){
   const perPage=Math.max(1,Math.floor(($('t22OutlineScroll').clientHeight||480)/T22_ROW_HEIGHT)-1);
   next=Math.max(0,Math.min(ids.length-1,at+(e.key==='PageDown'?perPage:-perPage)));
  }else if(e.key==='ArrowLeft'&&current>=0){
   const collapsed=t22CollapsedForPage();
   const hasChild=t22VisibleCache?.hasChildren.has(ids[current]);
   if(hasChild&&!collapsed.has(ids[current])&&!t22Filter.trim()){e.preventDefault();t22ToggleBranch(ids[current],true);return;}
   const parent=rows[current].parentId;
   next=ids.indexOf(parent);
  }else if(e.key==='ArrowRight'&&current>=0){
   const collapsed=t22CollapsedForPage();
   if(t22VisibleCache?.hasChildren.has(ids[current])&&collapsed.has(ids[current])&&!t22Filter.trim()){
    e.preventDefault();t22ToggleBranch(ids[current],false);return;
   }
   next=rows.findIndex(r=>r.parentId===ids[current]);
  }else if((e.key==='Enter'||e.key==='F2')&&current>=0){
   e.preventDefault();const field=$('t22OutlineRows').querySelector(`[data-node-id="${CSS.escape(ids[current])}"][data-field="label"]`);field?.focus();field?.select();return;
  }
  if(next!==null){e.preventDefault();if(next>=0&&ids[next])t22SelectOutline(ids[next]);}
 });
 $('t22GroupFlow').onclick=t22OpenFlowGrouping;
 $('t22AddRoot').onclick=()=>t22Add(false);$('t22AddChild').onclick=()=>t22Add(true);
 $('t22Indent').onclick=()=>{const n=t22SelectedNode();if(n)t22ChangeDepth(n.id,1);};
 $('t22Outdent').onclick=()=>{const n=t22SelectedNode();if(n)t22ChangeDepth(n.id,-1);};
 $('t22MoveUp').onclick=()=>{const n=t22SelectedNode();if(n)t22MoveRow(n.id,-1);};
 $('t22MoveDown').onclick=()=>{const n=t22SelectedNode();if(n)t22MoveRow(n.id,1);};
 $('t22Delete').onclick=()=>{if(selected.size===1)removeSelection();};
 $('t22Search').addEventListener('input',e=>{t22Filter=e.target.value;t22PageSearch.set(page.id,t22Filter);const sc=$('t22OutlineScroll');sc.scrollTop=0;t22VisibleCache=null;t22RenderWorkspace();});
 $('t22NumberingOptions').onclick=t22NumberingDialog;
 $('t22ExportCsv').onclick=t22ExportWholeCsv;
 $('t22PrintOutline').onclick=t22PrintWholeOutline;
 for(const [id,key] of [['t22ShowDeps','showDependencies'],['t22ShowParent','showParent']])$(id).onchange=e=>{
  try{const validated=window.ThinkItOutline.previewSettings(page,{[key]:e.target.checked});transact(()=>{page.outlineSettings=validated;});t22ClearIssue();}
  catch(err){t22UiIssue(err.message);t22RenderWorkspace();}
 };
 $('t22Preset').onchange=e=>t22SetPreset(e.target.value);
 $('t22CodeLabel').onchange=e=>{
  const next=e.target.value.trim();
  const settings={...page.outlineSettings,codeLabel:next};
  try{window.ThinkItOutline.settingsFor(page.mode,settings);}
  catch(err){t22UiIssue(err.message);$('t22CodeLabel').value=page.outlineSettings?.codeLabel||'WBS';return;}
  transact(()=>{page.outlineSettings=settings;});t22ClearIssue();
 };
}
const businessModel=mountThinkItBusinessModel({getDocument:()=>doc,getPage:()=>page,makeSession:uid,markDirty});
function render(){if(!projectIsReady)return;flowRenderPlan=null;document.body.classList.toggle('bubble-active',page.mode==='bubble'&&!diNoTabs());document.body.classList.toggle('bmc-active',page.mode==='bmc'&&!diNoTabs());t22SyncWorkspace();if(!t22IsOutline())renderCanvas();renderUI();if(t22IsOutline())t22RenderWorkspace();if(page.mode==='bubble')activateBubblePage();businessModel.activate();}
const BUBBLE_HTML=null;
let bubbleReady=false,bubbleActivePageId=null;
function bubbleFrame(){return $('bubbleFrame');}
function activateBubblePage(){if(!bubbleFrame().getAttribute('src')){bubbleFrame().src='/thinkit/40791585175d0e8d51c4/bubble.html';return;}if(bubbleReady&&bubbleActivePageId!==page.id){bubbleActivePageId=page.id;bubbleFrame().contentWindow.postMessage({channel:'diagramit-bubble-v06',type:'load',pageId:page.id,model:page.bubbleData||null},location.origin);}}
function bubbleExport(kind){if(bubbleReady&&page.mode==='bubble')bubbleFrame().contentWindow.postMessage({channel:'diagramit-bubble-v06',type:'export',kind},location.origin);}
window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==bubbleFrame()?.contentWindow||event.data?.channel!=='diagramit-bubble-v06')return;const msg=event.data;if(msg.type==='save'){persist();return;}if(msg.type==='ready'){bubbleReady=true;bubbleActivePageId=null;if(page?.mode==='bubble')activateBubblePage();}else if(msg.type==='changed'){const p=doc?.pages.find(x=>x.id===msg.pageId&&x.mode==='bubble');if(!p||!msg.model||!Array.isArray(msg.model.spaces)||typeof msg.model.relations!=='object')return;p.bubbleData=msg.model;markDirty();}},false);

function renderFast(){if(framePending)return;framePending=true;requestAnimationFrame(()=>{framePending=false;if(projectIsReady&&!t22IsOutline())renderCanvas();});}
let diClosedTabs=new Set(),diTabProjectId='',diHasSavedProject=false;
function diTabKey(){return 'ThinkIt_v094_tabs_'+(doc?.id||'none');}
function diLoadTabState(){if(!doc||diTabProjectId===doc.id)return;diTabProjectId=doc.id;diClosedTabs=new Set();try{const raw=JSON.parse(localStorage.getItem(diTabKey())||'[]');if(Array.isArray(raw))diClosedTabs=new Set(raw.filter(id=>doc.pages.some(p=>p.id===id)));}catch{}}
function diSaveTabState(){try{localStorage.setItem(diTabKey(),JSON.stringify([...diClosedTabs]));}catch{}}
function diNoTabs(){return !!doc&&doc.pages.every(p=>diClosedTabs.has(p.id));}
function diOpenTab(id){if(!doc?.pages.some(p=>p.id===id))return;diClosedTabs.delete(id);diSaveTabState();if(doc.activePageId===id){render();}else selectPage(id);}
function diCloseTab(id){if(!doc?.pages.some(p=>p.id===id))return;diClosedTabs.add(id);diSaveTabState();if(doc.activePageId===id){const next=doc.pages.find(p=>!diClosedTabs.has(p.id));if(next){selectPage(next.id);return;}}render();}
function diShowOpenTabChooser(){if(!doc)return;const options=doc.pages.map(p=>`<button type="button" class="command-item" data-reopen="${esc(p.id)}"><span>${MODES[p.mode].symbol} ${esc(p.name)}</span><span>${diClosedTabs.has(p.id)?'Closed · Reopen':'Open · Switch'}</span></button>`).join('');const body=modal('Open diagram',`<p class="modal-subtext">Closed tabs are not deleted. Choose a diagram to reopen or switch to.</p><div class="di-open-list">${options}</div>`,[{text:'Cancel'},{text:'Create new diagram',primary:true,action:()=>{setTimeout(()=>promptNewPage(),0);}}]);body.querySelectorAll('[data-reopen]').forEach(b=>b.onclick=()=>{const id=b.dataset.reopen;activeModal?.close();diOpenTab(id);});}
function renderPageTabs(){diLoadTabState();const root=$('pageTabs');root.replaceChildren();for(const p of doc.pages.filter(p=>!diClosedTabs.has(p.id))){const wrap=dom('div','di-tab-shell'+(p.id===page.id?' active':''),undefined,root);const b=dom('button','page-tab'+(p.id===page.id?' active':''),`${MODES[p.mode].symbol} ${p.name}`,wrap);b.type='button';b.dataset.pageId=p.id;b.title=`Switch to ${p.name} (${MODES[p.mode].name})`;const x=dom('button','di-tab-close','×',wrap);x.type='button';x.dataset.closePage=p.id;x.title=`Close ${p.name} tab (diagram remains in project)`;x.setAttribute('aria-label',`Close ${p.name} tab`);}
 const reopen=dom('button','di-page-reopen','☷ Open',root);reopen.id='diReopenPage';reopen.title='Find or reopen a diagram';const add=dom('button','page-tab page-tab-add','＋ New diagram',root);add.id='tabNewPage';add.title='Create a diagram page';document.body.classList.toggle('di-no-tabs',diNoTabs());document.body.classList.toggle('bubble-active',page?.mode==='bubble'&&!diNoTabs());}

function diIsMobilePanelLayout(){return window.innerWidth<=850;}
function diMobilePanelState(){return {left:!document.body.classList.contains('sidebar-collapsed'),right:!document.body.classList.contains('inspector-collapsed')};}
function diSyncMobilePanels(){
 const state=diMobilePanelState(),mobile=diIsMobilePanelLayout(),backdrop=$('diMobilePanelBackdrop');
 // Mobile may only present one obstructing drawer; desktop keeps its own layout.
 if(mobile&&state.left&&state.right){document.body.classList.add('inspector-collapsed');pref('inspectorHidden',true);state.right=false;}
 backdrop.hidden=!(mobile&&(state.left||state.right));
 $('mobileMenu').setAttribute('aria-expanded',String(mobile&&state.left));
 $('mobileMenu').setAttribute('aria-label',mobile&&state.left?'Close Pages & Shapes panel':'Open Pages & Shapes panel');
 $('leftSidebar').setAttribute('aria-hidden',String(mobile&&!state.left));
 $('inspector').setAttribute('aria-hidden',String(mobile&&!state.right));
}
function diCloseMobilePanels(restoreFocus=true){
 if(!diIsMobilePanelLayout())return false;
 const state=diMobilePanelState();if(!state.left&&!state.right)return false;
 document.body.classList.add('sidebar-collapsed','inspector-collapsed');
 pref('libraryHidden',true);pref('inspectorHidden',true);updatePanelButtons();
 if(restoreFocus)$('mobileMenu').focus();
 requestAnimationFrame(()=>renderCanvas());return true;
}
function updatePanelButtons(){const left=document.body.classList.contains('sidebar-collapsed'),right=document.body.classList.contains('inspector-collapsed');$('btnLeftToggle').classList.toggle('active',!left);$('btnRightToggle').classList.toggle('active',!right);$('btnLeftToggle').title=left?'Show Pages & Shapes':'Hide Pages & Shapes';$('btnRightToggle').title=right?'Hide Properties':'Show Properties';diSyncMobilePanels();}
function openModeSwitcher(){const body=modal('Choose diagram type',`<p class="modal-subtext">Current page: <strong>${esc(page.name)}</strong> (${MODES[page.mode].name}). Choose a type below. An empty page changes type; a populated page opens a new page without affecting your existing work.</p><div class="diagram-choices">${Object.entries(MODES).map(([k,v])=>`<button class="diagram-choice" data-mode-choice="${k}"><strong>${v.symbol} ${v.name}</strong><span>${v.desc}</span></button>`).join('')}</div><div class="notice">All pages are also available as tabs directly below the toolbar.</div>`,[{text:'Cancel'}]);body.querySelectorAll('[data-mode-choice]').forEach(btn=>btn.onclick=()=>{const mode=btn.dataset.modeChoice;activeModal?.close();if(mode==='bubble'){promptNewPage('bubble');return;}if(!['bubble','bmc'].includes(page.mode)&&page.nodes.length===0&&page.edges.length===0&&!(page.annotations||[]).length){transact(()=>{page.mode=mode;page.name=MODES[mode].name+' 1';if(mode==='bubble')page.bubbleData=null;});toast('Current page changed to '+MODES[mode].name);}else{newPage(mode,MODES[mode].name+' '+(doc.pages.filter(p=>p.mode===mode).length+1),true);toast('New '+MODES[mode].name+' page opened; original page preserved.');}});}
const visualStyle=n=>Object.fromEntries(STYLE_KEYS.map(k=>[k,clone(n[k]??(k==='fill'?'plain':null))]));
function applyVisualStyle(n,s){for(const key of STYLE_KEYS)if(s[key]!==null&&s[key]!==undefined)n[key]=s[key];}
function startPainter(persistent=false){if(selected.size!==1){toast('Select one source shape to copy its appearance.');return;}paintStyle=visualStyle(byId([...selected][0]));paintActive=true;paintRepeat=persistent;renderUI();toast('Format painter active · click a shape to apply style'+(persistent?' · Esc to exit':'.'));}
function paintOnto(id){const n=byId(id);if(!n||!paintStyle)return;transact(()=>applyVisualStyle(n,paintStyle));if(!paintRepeat)paintActive=false;renderUI();toast('Formatting applied; content and connectors unchanged.');}
function renderPages(){const root=$('pageList');root.replaceChildren();for(const p of doc.pages){const btn=dom('button','page-item'+(p.id===page.id?' active':''),undefined,root);btn.type='button';btn.dataset.pageId=p.id;const ic=dom('div','page-icon',MODES[p.mode].symbol,btn),inf=dom('div','page-meta',undefined,btn);dom('div','page-name',short(p.name),inf);dom('div','page-mode',MODES[p.mode].name,inf);if(diClosedTabs.has(p.id))dom('span','di-page-closed-tag','Closed',btn);}}
function shapeIcon(shape){const s=`stroke="#0D7475" fill="#D9ECE9" stroke-width="1.7"`;let item=`<rect x="6" y="7" width="47" height="23" rx="4" ${s}/>`;if(['terminator','topic','subtopic'].includes(shape))item=`<rect x="6" y="7" width="47" height="23" rx="13" ${s}/>`;if(shape==='decision')item=`<polygon points="29,2 54,18 29,34 4,18" ${s}/>`;if(shape==='data'||shape==='milestone')item=`<polygon points="16,7 54,7 43,30 5,30" ${s}/>`;if(shape==='database')item=`<path d="M7 11 C7 3 52 3 52 11 V27 C52 35 7 35 7 27 Z M7 11 C7 19 52 19 52 11" ${s}/>`;if(shape==='document')item=`<path d="M7 7 H52 V27 Q40 20 30 27 T7 27 Z" ${s}/>`;if(shape==='person')item=`<rect x="5" y="3" width="49" height="31" rx="5" ${s}/><circle cx="17" cy="16" r="6" fill="#0D7475"/><path d="M30 15 H47 M30 22 H43" stroke="#0D7475" stroke-width="2"/>`;if(shape==='team'||shape==='department')item=`<rect x="6" y="4" width="47" height="30" rx="5" ${s}/><path d="M15 13 H46 M15 21 H40" stroke="#0D7475" stroke-width="2"/>`;if(shape==='note'||shape==='idea')item=`<path d="M8 5 H42 L52 16 V32 H8 Z" ${s}/>`;return `<svg class="shape-icon" viewBox="0 0 60 38" aria-hidden="true">${item}</svg>`;}
function renderShapeLibrary(){const root=$('shapeLibrary');root.replaceChildren();for(const [shape,label] of SHAPES[page.mode]){const btn=dom('button','shape-card');btn.draggable=true;btn.dataset.shape=shape;btn.title=`Click to insert ${label}, or drag into canvas`;btn.innerHTML=shapeIcon(shape)+`<span>${esc(label)}</span>`;root.append(btn);}}
// TH-L3: Keep a complete, ordered, indexed topic model; window only DOM rows.
// The row planner is independent of the editor, note store and export pipeline.
function mindOutlineWindow(total,scrollTop,clientHeight,rowHeight=38,overscan=6){
  const count=Math.max(0,total),height=Math.max(1,rowHeight),viewport=Math.max(1,Number(clientHeight)||1);
  const top=Math.min(Math.max(0,Number(scrollTop)||0),Math.max(0,count*height-viewport));
  const start=Math.max(0,Math.min(count,Math.floor(top/height)-overscan));
  const end=Math.max(start,Math.min(count,Math.ceil((top+viewport)/height)+overscan));
  return {start,end,top:start*height,bottom:(count-end)*height};
}
function mindNavigationRows(all,query='',textIndex=null){
  const q=String(query).trim().toLocaleLowerCase();
  if(!q){
    const out=[];let blockedDepth=-1;
    for(const entry of all){
      if(blockedDepth>=0&&entry.depth>blockedDepth)continue;
      blockedDepth=-1;out.push(entry);
      if(entry.node.collapsed)blockedDepth=entry.depth;
    }
    return out;
  }
  const byId=new Map(all.map(r=>[r.node.id,r.node]));
  const included=new Set();
  for(const {node} of all){
    const text=textIndex?.get(node.id)??(String(node.label||'')+' '+String(node.noteHtml||'').replace(/<[^>]*>/g,' ')).toLocaleLowerCase();
    if(!text.includes(q))continue;
    let n=node;
    while(n&&!included.has(n.id)){
      included.add(n.id);n=n.parentId?byId.get(n.parentId):null;
    }
  }
  // During search, show matched topics and their ancestor path even under a
  // collapsed branch; do not change the persisted collapsed flags.
  return all.filter(r=>included.has(r.node.id));
}
const DI_OUTLINE_ROW_HEIGHT=34;
function diRenderOutlineWindow(root,rows){
  const range=mindOutlineWindow(rows.length,root.scrollTop,root.clientHeight||350,DI_OUTLINE_ROW_HEIGHT);
  root.replaceChildren();
  if(range.top)dom('div','di-virtual-spacer',undefined,root).style.height=range.top+'px';
  for(let i=range.start;i<range.end;i++){
    const {node:n,depth}=rows[i];
    const row=dom('button','outline-row'+(selected.has(n.id)?' selected':''),undefined,root);
    row.dataset.outlineId=n.id;row.type='button';row.title=n.label;
    row.style.height=DI_OUTLINE_ROW_HEIGHT+'px';row.style.minHeight=DI_OUTLINE_ROW_HEIGHT+'px';row.style.margin='0';
    row.style.paddingLeft=`${5+Math.min(depth,32)*14}px`;
    if(diOutlineHasChildren.has(n.id))dom('span','outline-toggle',n.collapsed?'▸':'▾',row).dataset.collapseId=n.id;
    else dom('span','indent','',row);
    dom('span','outline-icon',n.shape==='person'?'▣':'◦',row);dom('span','outline-label',n.label,row);
    if(page.mode==='mind'&&(n.noteHtml?.trim()||n.keepitLink?.itemId))dom('span','mind-has-note','▤',row).title='Topic has a note';
  }
  if(range.bottom)dom('div','di-virtual-spacer',undefined,root).style.height=range.bottom+'px';
}
let diOutlinePageId=null,diOutlineRows=[],diOutlineHasChildren=new Set(),diOutlineScrollBound=false;
function renderOutline(){const root=$('outlineTree');if(!page.nodes.length){root.classList.remove('is-virtual');root.replaceChildren();dom('p','field-note','No nodes yet. Add one to get started.',root);return;}
  if((page.mode==='mind'||page.mode==='org')&&page.nodes.length>150){
    const oldPage=diOutlinePageId;diOutlinePageId=page.id;
    if(oldPage!==page.id)root.scrollTop=0;
    // Generate complete rows for every model change; scrolling uses this snapshot.
    diOutlineRows=mindNavigationRows(mindOutlineRows());
    diOutlineHasChildren=new Set(page.nodes.map(n=>n.parentId).filter(Boolean));
    root.classList.add('is-virtual');
    if(!diOutlineScrollBound){root.addEventListener('scroll',()=>{if((page?.mode==='mind'||page?.mode==='org')&&root.classList.contains('is-virtual'))diRenderOutlineWindow(root,diOutlineRows);},{passive:true});diOutlineScrollBound=true;}
    diRenderOutlineWindow(root,diOutlineRows);return;
  }
  root.classList.remove('is-virtual');root.replaceChildren();diOutlinePageId=page.id;
  const {children,roots}=hierarchyIndex(),seen=new Set();
  const stack=(page.mode==='flow'?page.nodes:roots).slice().reverse().map(n=>({node:n,depth:0}));
  while(stack.length){
    const {node:n,depth}=stack.pop();if(seen.has(n.id))continue;seen.add(n.id);
    const row=dom('button','outline-row'+(selected.has(n.id)?' selected':''),undefined,root);row.dataset.outlineId=n.id;
    row.style.paddingLeft=`${5+Math.min(depth,32)*14}px`;
    const kids=page.mode==='flow'?[]:children.get(n.id)||[];
    if(page.mode!=='flow'&&kids.length)dom('span','outline-toggle',n.collapsed?'▸':'▾',row).dataset.collapseId=n.id;
    else dom('span','indent','',row);
    dom('span','outline-icon',page.mode==='flow'?'◇':n.shape==='person'?'▣':'◦',row);dom('span','outline-label',n.label,row);
    if(page.mode==='mind'&&(n.noteHtml?.trim()||n.keepitLink?.itemId))dom('span','mind-has-note','▤',row).title='Topic has a note';
    if(page.mode!=='flow'&&!n.collapsed)for(let i=kids.length-1;i>=0;i--)stack.push({node:kids[i],depth:depth+1});
  }
}
function field(label,value,key,type='text',opts={}){const div=dom('div','prop-field');const l=dom('label','',label,div);let inp;if(type==='select'){inp=dom('select','',undefined,div);for(const [v,t] of opts.choices||[]){const o=dom('option','',t,inp);o.value=v;}inp.value=value==null?'':String(value);}else if(type==='textarea'){inp=dom('textarea','',undefined,div);inp.value=value??'';}else{inp=dom('input','',undefined,div);inp.type=type;inp.value=value??'';}inp.dataset.prop=key;return div;}
function propSection(title){const sec=dom('section','prop-section');dom('h3','',title,sec);return sec;}
function renderInspector(){const root=$('inspectorContent');const binding=`${page.id}|${[...selected].sort().join(',')}|${edgeSelected||''}`;if(binding===inspectorBinding&&document.activeElement?.closest('#inspectorContent')&&document.activeElement.matches('input,textarea,select'))return;inspectorBinding=binding;root.replaceChildren();
const nodes=[...selected].map(byId).filter(Boolean),single=nodes.length===1,multiple=nodes.length>1;
const mixed=key=>nodes.every(n=>String(n[key]??'')===String(nodes[0][key]??''))?nodes[0][key]:null;
const addAppearance=(sec,multi=false)=>{dom('div','field-note',multi?'Apply formatting to every selected shape. Mixed values are left unchanged.':'Fill color',sec);const palette=dom('div','prop-grid',undefined,sec);palette.style.margin='9px 0 12px';for(const [key,col] of COLORS){const sw=dom('button','swatch'+(nodes.every(n=>n.fill===key)?' active':''),undefined,palette);sw.style.background=col;sw.dataset.fill=key;sw.title='Fill: '+key;sw.setAttribute('aria-label',sw.title);}
if(!multi)sec.append(field('Shape',nodes[0].shape,'shape','select',{choices:SHAPES[page.mode].map(s=>[s[0],s[1]])}));
const r0=dom('div','prop-two',undefined,sec);r0.append(field('Border color',mixed('stroke')??'', 'stroke','color'));r0.append(field('Border width',mixed('strokeWidth')??'','strokeWidth','number'));
sec.append(field('Border style',mixed('strokeStyle')??'','strokeStyle','select',{choices:[["","— Mixed / default —"],["solid","Solid"],["dashed","Dashed"],["dotted","Dotted"]]}));
const r1=dom('div','prop-two',undefined,sec);r1.append(field('Font size',mixed('fontSize')??'','fontSize','number'),field('Text color',mixed('textColor')??'#173B50','textColor','color'));
sec.append(field('Font family',mixed('fontFamily')??'','fontFamily','select',{choices:[["","— Mixed / default —"],["sans","DiagramIt Sans"],["serif","Serif"],["mono","Monospace"]]}));
const r2=dom('div','prop-two',undefined,sec);r2.append(field('Font weight',mixed('fontWeight')??'','fontWeight','select',{choices:[["","— Mixed —"],["400","Regular"],["600","Semibold"],["700","Bold"]]}),field('Text align',mixed('textAlign')??'','textAlign','select',{choices:[["","— Mixed —"],["left","Left"],["center","Center"],["right","Right"]]}));
const italicRow=dom('label','checkbox-row',undefined,sec),italic=dom('input',undefined,undefined,italicRow);italic.type='checkbox';italic.checked=nodes.every(n=>!!n.italic);italic.indeterminate=nodes.some(n=>!!n.italic)&&!italic.checked;italic.dataset.prop='italic';dom('span','','Italic labels',italicRow);
const paint=dom('button','inspector-btn full','♧ Copy style / Format painter',sec);paint.dataset.action='format-painter';paint.title='Copy appearance, then click another shape (⌘⌥C)';paint.style.marginTop='12px';};
if(selectedAnnotation){const a=annoById(selectedAnnotation);if(a){$('inspectorType').textContent='Annotation · '+short(a.label);let sec=propSection('ANNOTATION');const edit=dom('button','inspector-btn full primary','Edit formatted text',sec);edit.dataset.action='edit-annotation';const attach=dom('button','inspector-btn full',a.parentId?'Detach from shape':'Attach to selected shape',sec);attach.dataset.action=a.parentId?'detach-annotation':'attach-annotation';if(!a.parentId)attach.textContent='Attach to a shape…';sec.append(field('Position relative to shape',a.side||'bottom','anno_side','select',{choices:[['top','Above'],['bottom','Below'],['left','Left'],['right','Right']]}));root.append(sec);sec=propSection('TEXT & TYPOGRAPHY');for(const [label,key,type,opts] of [['Font family','fontFamily','select',{choices:[['sans','DiagramIt Sans'],['serif','Serif'],['mono','Monospace']]}],['Font size','fontSize','number',{}],['Font weight','fontWeight','select',{choices:[['400','Regular'],['600','Semibold'],['700','Bold']]}],['Text align','textAlign','select',{choices:[['left','Left'],['center','Center'],['right','Right']]}],['Vertical align','vAlign','select',{choices:[['top','Top'],['middle','Middle'],['bottom','Bottom']]}],['Text color','textColor','color',{}],['Highlight','highlight','color',{}]])sec.append(field(label,key==='highlight'&&a[key]==='none'?'#fff0a9':a[key],`anno_${key}`,type,opts));for(const [key,title] of [['italic','Italic'],['underline','Underline'],['strike','Strikethrough']]){const row=dom('label','checkbox-row',undefined,sec),chk=dom('input',undefined,undefined,row);chk.type='checkbox';chk.checked=!!a[key];chk.dataset.prop='anno_'+key;dom('span','',title,row);}dom('div','field-note','For mixed formatting, click Edit formatted text, select a word or phrase, then use B / I / U / S, Text or Highlight.',sec);root.append(sec);sec=propSection('TEXT BOX APPEARANCE');for(const [lbl,k,type] of [['Fill','fill','color'],['Border color','stroke','color'],['Border thickness','strokeWidth','number'],['Border style','strokeStyle','select'],['Opacity (0–1)','opacity','number']]){const opt=k==='strokeStyle'?{choices:[['solid','Solid'],['dashed','Dashed'],['dotted','Dotted']]}:{};sec.append(field(lbl,k==='fill'&&a.fill==='transparent'?'#ffffff':a[k],`anno_${k}`,type,opt));}const tr=dom('button','inspector-btn full','Transparent fill',sec);tr.dataset.action='anno-transparent';const br=dom('button','inspector-btn full','No border',sec);br.dataset.action='anno-noborder';root.append(sec);sec=propSection('SIZE & OFFSET');for(const [lbl,k] of [['Width','w'],['Height','h'],[a.parentId?'Horizontal offset':'X','x'],[a.parentId?'Vertical offset':'Y','y']])sec.append(field(lbl,(a.parentId&&k==='x'?(a.dx||0):a.parentId&&k==='y'?(a.dy||0):a[k]),'anno_'+k,'number'));root.append(sec);sec=propSection('ACTIONS');const del=dom('button','inspector-btn full destructive','Delete annotation',sec);del.dataset.action='delete-annotation';root.append(sec);}}else if(single){const n=nodes[0];$('inspectorType').textContent='Shape · '+n.label;let sec=propSection('TEXT');sec.append(field('Label',n.label,'label','textarea'));dom('div','field-note','Tip: Select this shape and start typing to replace the label. Double-click to edit within the text.',sec);if(page.mode==='org'){sec.append(field('Role / subtitle',n.data?.role||'','role'));sec.append(field('Department',n.data?.department||'','department'));}root.append(sec);
if(['mind','flow'].includes(page.mode)&&h3LastConstraints.get(page.id)?.anchorId===n.id){
   const issues=h3LastConstraints.get(page.id).conflicts;
   if(issues.length){
     sec=propSection('AUTO-ARRANGE CONSTRAINTS');
     dom('div','field-note',issues.length+' branch constraint(s): pinned, manually positioned, shared-predecessor or overlapping subprocess activities were retained in place. Existing work was not overwritten.',sec);
     root.append(sec);
   }
 }
 if(page.mode==='flow'){
  const meta=window.ThinkItFlowFocus.activityDetails(n),audit=t22CheckedPlan(page),codes=new Map(audit.rows.map(r=>[r.id,r.code+' · '+r.label]));
  sec=propSection('ACTIVITY DETAILS');
  for(const [label,key,type] of [
   ['Responsible stakeholder','responsible','text'],
   ['Participating stakeholders','participants','textarea'],
   ['Required inputs','inputs','textarea'],
   ['Expected outputs / deliverables','outputs','textarea'],
   ['Approvals / sign-offs','approvals','textarea'],
   ['Handoffs / remarks','remarks','textarea']
  ])sec.append(field(label,meta[key]||'','flowActivity_'+key,type));
  root.append(sec);
  sec=propSection('WORKFLOW DEPENDENCIES');
  const prior=(n.dependencies||[]).map(d=>(codes.get(d.id)||'#'+d.id)+(d.type&&d.type!=='FS'?' ['+d.type+']':''));
  const following=page.nodes.filter(x=>Array.isArray(x.dependencies)&&x.dependencies.some(d=>d.id===n.id)).map(x=>codes.get(x.id)||'#'+x.id);
  dom('div','field-note','Predecessors: '+(prior.join('; ')||'None'),sec);
  dom('div','field-note','Successors: '+(following.join('; ')||'None'),sec);
  dom('div','field-note','WBS dependencies are not the same as graphical flow arrows. Editing predecessors preserves permanent activity IDs.',sec);
  const pick=dom('button','inspector-btn full','Edit predecessors…',sec);pick.dataset.action='flow-predecessors';
  root.append(sec);
  if(page.nodes.some(child=>child.outlineParentId===n.id)){
   sec=propSection('SUBPROCESS');
   dom('div','field-note',String(flowSnapshot().descendantCount.get(n.id))+' subordinate activities · collapse hides detail, not records.',sec);
   const b=dom('button','inspector-btn full',n.collapsed?'Expand subprocess':'Collapse subprocess',sec);b.dataset.action='toggle-collapse';
   const focus=dom('button','inspector-btn full','Focus inside this subprocess',sec);focus.dataset.action='flow-focus';
   root.append(sec);
  }
  sec=propSection('WBS GROUPING');
  const wbs=dom('button','inspector-btn full','Set parent / WBS group…',sec);wbs.dataset.action='flow-group';
  root.append(sec);
}
 if(page.mode!=='flow'){sec=propSection('HIERARCHY');sec.append(field('Primary parent',n.parentId||'','parentId','select',{choices:[['','Root / top level'],...page.nodes.filter(a=>a.id!==n.id&&!descendants(n.id).has(a.id)).map(a=>[a.id,a.label])]}));if(treeChildren(n.id).length){const b=dom('button','inspector-btn full',n.collapsed?'Expand branch':'Collapse branch',sec);b.dataset.action='toggle-collapse';}root.append(sec);}
if(page.mode==='mind'){
  sec=propSection('TOPIC NOTES & FILES');const editNote=dom('button','inspector-btn full primary',n.keepitLink?.itemId?'Manage linked note and files':'Open note options for this topic',sec);editNote.dataset.action='mind-notes';
  const addFile=dom('button','inspector-btn full','+ Add KeepIt file reference',sec);addFile.dataset.action='mind-add-keepit-reference';
  addFile.title='Choose a PDF, image or other saved KeepIt file. This does not change the topic note.';
  const refs=Array.isArray(n.keepitFiles)?n.keepitFiles:[];
  dom('div','field-note',refs.length===1?'1 KeepIt file reference':refs.length+' KeepIt file references',sec);
  for(const ref of refs.slice(0,12))dom('div','field-note','• '+String(ref.label||'Referenced item').slice(0,160),sec);
  if(refs.length>12)dom('div','field-note','…and '+(refs.length-12)+' more. Open note options to view all.',sec);
  const saved=(n.noteHtml||'').trim();dom('div','field-note',n.keepitLink?.itemId?'Current note is in KeepIt. Linked files are managed independently.':saved?'Local ThinkIt note retained; link a native note when ready.':'No primary note yet. You can link an existing note or create a new one.',sec);
  if(saved&&!n.keepitLink?.itemId){const prev=dom('div','mind-note-preview',undefined,sec);prev.innerHTML=sanitizeMindNote(saved);}
  root.append(sec);
}
if(page.mode==='mind'){sec=propSection('BRANCH ARRANGEMENT');const b=dom('button','inspector-btn full','Organize this branch',sec);b.dataset.action='mind-layout-branch';root.append(sec);}
if(page.mode==='org'){sec=propSection('BRANCH ARRANGEMENT');sec.append(field('Children layout',n.layoutStyle||'inherit','branchStyle','select',{choices:[['inherit','Use chart default'],['standard','Standard · children below'],['compact','Compact · stacked to right'],['horizontal','Horizontal · to right']]}));const branch=dom('button','inspector-btn full','Arrange this branch',sec);branch.dataset.action='layout-branch';root.append(sec);}
sec=propSection('APPEARANCE');addAppearance(sec);root.append(sec);
sec=propSection('SIZE & POSITION');const r1=dom('div','prop-two',undefined,sec);r1.append(field('X',Math.round(n.x),'x','number'),field('Y',Math.round(n.y),'y','number'));const r2=dom('div','prop-two',undefined,sec);r2.append(field('Width',Math.round(n.w),'w','number'),field('Height',Math.round(n.h),'h','number'));const pin=dom('label','checkbox-row',undefined,sec),cb=dom('input',undefined,undefined,pin);cb.type='checkbox';cb.checked=!!n.pinned;cb.dataset.prop='pinned';dom('span','','Lock position for auto-layout',pin);root.append(sec);
sec=propSection('QUICK ACTIONS');for(const [title,action] of [...(page.mode==='org'?[['＋ Add department under this','add-department']]:[]),['＋ Add connected child','add-child'],['Duplicate shape','duplicate'],['Delete shape','delete']]){const b=dom('button','inspector-btn full'+(action==='delete'?' destructive':''),title,sec);b.dataset.action=action;b.style.marginTop='6px';}root.append(sec);
}else if(multiple){$('inspectorType').textContent=`${nodes.length} shapes selected`;let sec=propSection('FORMAT ALL SELECTED SHAPES');addAppearance(sec,true);root.append(sec);sec=propSection('SELECTION ACTIONS');if(page.mode==='flow'){const create=dom('button','inspector-btn full primary','Convert selection to subprocess',sec);create.dataset.action='flow-wrap';}for(const [title,action] of [['Group selection','group'],['Duplicate selection','duplicate'],['Delete selected shapes','delete']]){const b=dom('button','inspector-btn full',title,sec);b.dataset.action=action;b.style.marginTop='7px';}root.append(sec);
}else if(edgeSelected){const e=findEdge(edgeSelected);$('inspectorType').textContent='Arrow / Connector';if(e){let sec=propSection('CONNECTOR');if(flowProjectedEdge(edgeSelected))dom('div','field-note','Boundary projection only: the actual connector remains attached to its original hidden activities. Expand the subprocess to inspect or adjust its endpoints.',sec);sec.append(field('Label',e.label||'','edgeLabel'));if(e.kind!=='primary')sec.append(field('Relationship',e.kind,'kind','select',{choices:[['flow','Process flow'],['secondary','Dotted-line relationship'],['reference','Reference link'],['annotation','Annotation arrow']]}));sec.append(field('Route',e.route,'route','select',{choices:[['orthogonal','Right-angle / elbow'],['straight','Straight'],['curve','Curved']]}));
if(!isFreeEdge(e)){const sides=[['auto','Automatic'],['top','Top'],['right','Right'],['bottom','Bottom'],['left','Left']];dom('div','field-note','Connection sides can follow shape movement automatically, or be locked individually.',sec);const row=dom('div','prop-two',undefined,sec);row.append(field('From side',e.fromPort||'auto','fromPort','select',{choices:sides}),field('To side',e.toPort||'auto','toPort','select',{choices:sides}));const row2=dom('div','prop-two',undefined,sec);row2.append(field('From position %',Math.round((e.fromFraction??.5)*100),'fromFraction','number'),field('To position %',Math.round((e.toFraction??.5)*100),'toFraction','number'));const reset=dom('button','inspector-btn full','↻ Reset route to automatic',sec);reset.dataset.action='reset-route';}
sec.append(field('Arrowhead at start',edgeHeads(e).start,'arrowStart','select',{choices:[['none','None'],['filled','Filled'],['open','Open'],['diamond','Diamond']]}));sec.append(field('Arrowhead at end',edgeHeads(e).end,'arrowEnd','select',{choices:[['none','None'],['filled','Filled'],['open','Open'],['diamond','Diamond']]}));
if(e.route==='orthogonal'){sec.append(field('Manual bend offset',e.bendOffset??'','bendOffset','number'));dom('div','field-note','Select the connector and drag its square bend handle directly on the diagram.',sec);}
if(isFreeEdge(e)){sec.append(field('Start X',Math.round(e.start.x),'startX','number'));sec.append(field('Start Y',Math.round(e.start.y),'startY','number'));sec.append(field('End X',Math.round(e.end.x),'endX','number'));sec.append(field('End Y',Math.round(e.end.y),'endY','number'));}root.append(sec);
sec=propSection('ACTIONS');for(const [text,action] of [...(e.kind==='primary'?[]:[['⇄ Reverse arrow direction','reverse-edge']]),['＋ Additional / parallel arrow','duplicate-edge'],...(e.kind==='primary'?[]:[['Delete arrow','delete']])]){const b=dom('button','inspector-btn full'+(action==='delete'?' destructive':''),text,sec);b.dataset.action=action;b.style.marginTop='7px';}root.append(sec);}
}else{$('inspectorType').textContent='Page settings';let sec=propSection('PAGE');sec.append(field('Page name',page.name,'pageName'));dom('div','field-note','Use the Diagram selector in the top toolbar to choose Flowchart, Org Chart or Mind Map.',sec);root.append(sec);sec=propSection('LAYOUT');sec.append(field('Layout direction',layoutDirection,'layoutDirection','select',{choices:[['down','Top to bottom'],['right','Left to right']]}));if(page.mode==='org'){const op=orgSettings();sec.append(field('Arrangement',op.style,'org_style','select',{choices:[['standard','Standard hierarchy'],['compact','Compact stacked'],['horizontal','Horizontal hierarchy'],['mixed','Mixed by branch']]}));for(const [lbl,k] of [['Sibling spacing','siblingGap'],['Level spacing','levelGap'],['Department spacing','branchGap'],['Card width','cardWidth'],['Card height','cardHeight']])sec.append(field(lbl,op[k],'org_'+k,'number'));sec.append(field('Align managers',op.parentAlign,'org_parentAlign','select',{choices:[['center','Centered'],['left','Start aligned'],['right','End aligned']]}));sec.append(field('Sibling order',op.order,'org_order','select',{choices:[['manual','Original / manual'],['alphabetical','Alphabetical']]}));const row=dom('label','checkbox-row',undefined,sec),cb=dom('input',undefined,undefined,row);cb.type='checkbox';cb.checked=op.uniform;cb.dataset.prop='org_uniform';dom('span','','Use standard card dimensions',row);}
const l=dom('button','inspector-btn full primary','Arrange / Preview layout',sec);l.dataset.action='layout';l.style.marginTop='5px';const fit=dom('button','inspector-btn full','Fit all objects',sec);fit.dataset.action='fit';fit.style.marginTop='7px';root.append(sec);sec=propSection('WORKSPACE');const g=dom('label','checkbox-row',undefined,sec),c=dom('input',undefined,undefined,g);c.type='checkbox';c.checked=showGrid;c.dataset.prop='grid';dom('span','','Show grid',g);dom('div','field-note','Saved locally in this browser. Export JSON for a portable backup.',sec);root.append(sec);}}

function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),3100);}
function setSaveState(state,msg){const s=$('saveStatus');s.dataset.state=state;s.lastChild.textContent=msg;}
// Each tab keeps its own emergency snapshot; a stale tab must never replace another tab's shadow.
const diWriterId='tab_'+(window.crypto?.randomUUID?.()||Math.random().toString(36).slice(2));
const diShadowKey='ThinkIt_v094_shadow_'+diWriterId;
let diExpectedRaw=null,diExpectedRevision=0,diSaveConflict=false;
// T25: large documents exceed the emergency localStorage shadow threshold.
// Stage an independent, per-tab draft in the EXISTING device-local IndexedDB;
// never let these drafts silently replace the canonical 'current' project.
const DI_EMERGENCY_SHADOW_LIMIT=1200000;
let diEditSequence=0,diDraftQueue=Promise.resolve(),diPendingEmergencyDraft=null,diDraftPumpActive=false;
function diSaveConflictError(){const e=new Error('Another tab saved a newer project version');e.code='THINKIT_CONCURRENT_EDIT';return e;}
function diWriteEmergencyShadow(serial){try{if(serial.length<DI_EMERGENCY_SHADOW_LIMIT)localStorage.setItem(diShadowKey,serial);}catch{}}
function diStageEmergencyDraft(serial){
 const sequence=++diEditSequence;
 if(serial.length<DI_EMERGENCY_SHADOW_LIMIT){diWriteEmergencyShadow(serial);return sequence;}
 if(storageMode==='indexeddb'&&idb){
   // Coalesce bursts of large document edits: preserve the newest full draft
   // without queuing a multi-megabyte write for every keystroke.
   diPendingEmergencyDraft={raw:serial,sequence,projectId:doc.id};
   if(!diDraftPumpActive){
     diDraftPumpActive=true;
     diDraftQueue=diDraftQueue.catch(()=>{}).then(async()=>{
       while(diPendingEmergencyDraft){
         const pending=diPendingEmergencyDraft;diPendingEmergencyDraft=null;
         try{await dbWriteEmergencyDraft(pending.raw,pending.sequence,pending.projectId);}
         catch(err){console.warn('Large project emergency draft was not secured',err);setSaveState('error','Large-project recovery draft unavailable · Save or Export JSON');}
       }
     }).finally(()=>{diDraftPumpActive=false;});
   }
 }
 return sequence;
}
function markDirty(){doc.updatedAt=new Date().toISOString();diStageEmergencyDraft(JSON.stringify(doc));setSaveState(diSaveConflict?'error':'unsaved',diSaveConflict?'Editing conflict · Export JSON':'Unsaved local changes');clearTimeout(saveTimer);saveTimer=setTimeout(persist,350);}
function recordHistory(snapshot){if(snapshot===JSON.stringify(doc))return false;history.undo.push(snapshot);if(history.undo.length>65)history.undo.shift();history.redo=[];markDirty();return true;}
function transact(fn){cancelPreview(false);const before=JSON.stringify(doc);try{fn();}catch(err){console.error(err);toast(`Edit failed: ${err.message}`);return;}if(recordHistory(before))render();}
function undo(){if(!history.undo.length)return;const s=history.undo.pop();history.redo.push(JSON.stringify(doc));doc=JSON.parse(s);page=getPage();selected=new Set([...selected].filter(id=>byId(id)));edgeSelected=null;preview=null;markDirty();render();}
function redo(){if(!history.redo.length)return;history.undo.push(JSON.stringify(doc));doc=JSON.parse(history.redo.pop());page=getPage();selected.clear();edgeSelected=null;preview=null;markDirty();render();}
let idb;
function openStorage(){return new Promise((resolve,reject)=>{if(!('indexedDB'in window))return reject(new Error('IndexedDB unavailable'));const req=indexedDB.open('ThinkIt_v094',1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('documents'))req.result.createObjectStore('documents');};req.onsuccess=()=>{idb=req.result;resolve();};req.onerror=()=>reject(req.error);});}
function dbReadKey(key='current'){return new Promise((resolve,reject)=>{const tx=idb.transaction('documents','readonly');const req=tx.objectStore('documents').get(key);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
function dbRead(){return dbReadKey('current');}
// T28: A separate, stable, device-local entry per project ID. The legacy
// 'current' slot remains authoritative for the active tab until KeepIt's
// reviewed revision interface exists. No cloud or file-system binding implied.
const DI_PROJECT_RECORD_PREFIX='pm_project_';
const DI_LOCAL_PROJECT_PREFIX='ThinkIt_v094_pm_project_';
function diProjectRecordKey(id){
 if(typeof id!=='string'||!id.trim()||id.length>160)throw Error('Invalid project ID');
 return DI_PROJECT_RECORD_PREFIX+encodeURIComponent(id);
}
function diLocalProjectKey(id){return DI_LOCAL_PROJECT_PREFIX+diProjectRecordKey(id).slice(DI_PROJECT_RECORD_PREFIX.length);}
function diProjectRecord(raw){
 if(typeof raw!=='string'||raw.length>48*1024*1024)throw Error('Project too large for local catalogue');
 const value=JSON.parse(raw);
 if(value?.format!=='DIAGRAMIT'||typeof value.id!=='string'||!Array.isArray(value.pages)||!value.pages.length)throw Error('Invalid project catalogue entry');
 diProjectRecordKey(value.id);
 return {projectId:value.id,name:String(value.name||'Untitled project').slice(0,180),updatedAt:value.updatedAt||null,savedAt:Date.now(),raw};
}
function dbWriteProjectRecord(raw,{guardCurrent=false}={}){return new Promise((resolve,reject)=>{
 const record=diProjectRecord(raw),key=diProjectRecordKey(record.projectId);
 const tx=idb.transaction('documents','readwrite'),store=tx.objectStore('documents');let conflict=false;
 if(guardCurrent){
  const current=store.get('current');current.onsuccess=()=>{
   const meta=store.get('current_meta');meta.onsuccess=()=>{
    if((current.result??null)!==diExpectedRaw||(Number(meta.result?.revision)||0)!==diExpectedRevision){conflict=true;tx.abort();return;}
    store.put(record,key);
   };
  };
 }else store.put(record,key);
 tx.oncomplete=()=>resolve(record);tx.onerror=()=>reject(tx.error);
 tx.onabort=()=>reject(conflict?diSaveConflictError():(tx.error||Error('Catalogue write aborted')));
});}
function dbListProjectRecords(){return new Promise((resolve,reject)=>{
 const items=[],tx=idb.transaction('documents','readonly'),req=tx.objectStore('documents').openCursor();
 req.onsuccess=()=>{const cur=req.result;if(!cur)return;
  if(String(cur.key).startsWith(DI_PROJECT_RECORD_PREFIX)&&typeof cur.value?.raw==='string')items.push({...cur.value,key:String(cur.key)});
  cur.continue();};
 tx.oncomplete=()=>resolve(items);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
});}
async function diReadSavedProject(id){
 const key=diProjectRecordKey(id);
 let result=null;
 if(storageMode==='indexeddb'&&idb)result=await dbReadKey(key);
 else if(storageMode==='localstorage'){
  const raw=localStorage.getItem(diLocalProjectKey(id));
  if(raw)result=diProjectRecord(raw);
 }
 if(!result)return null;
 const parsed=validatedSnapshot(result.raw);
 if(!parsed||parsed.id!==id)throw Error('Saved project failed integrity validation');
 return {...result,projectId:id};
}
async function diWriteProjectRecord(raw,{guardCurrent=false}={}){
 const record=diProjectRecord(raw),id=record.projectId;
 if(storageMode==='indexeddb'&&idb)await dbWriteProjectRecord(raw,{guardCurrent});
 else if(storageMode==='localstorage'){
  const write=()=>{
   if(guardCurrent&&localStorage.getItem('ThinkIt_v094_document')!==diExpectedRaw)throw diSaveConflictError();
   localStorage.setItem(diLocalProjectKey(id),raw);
   if(localStorage.getItem(diLocalProjectKey(id))!==raw)throw Error('Project catalogue readback mismatch');
  };
  if(guardCurrent){
   if(!window.navigator?.locks?.request)throw Error('Exclusive local project lock unavailable');
   await window.navigator.locks.request('thinkit-v094-current',{mode:'exclusive'},write);
  }else write();
 }else throw Error('Project catalogue unavailable: use Export JSON');
 const verified=await diReadSavedProject(id);
 if(!verified||verified.raw!==raw)throw Error('Project catalogue readback mismatch');
 return verified;
}
async function diListSavedProjects(){
 let entries=[];
 if(storageMode==='indexeddb'&&idb)entries=await dbListProjectRecords();
 else if(storageMode==='localstorage'){
  for(let i=0;i<localStorage.length&&i<10000;i++){
   const key=localStorage.key(i);
   if(!key?.startsWith(DI_LOCAL_PROJECT_PREFIX))continue;
   const raw=localStorage.getItem(key);
   try{entries.push({...diProjectRecord(raw),key});}catch{}
  }
 }
 // Do not list entries whose bytes cannot be safely reopened.
 const valid=[];for(const item of entries){const parsed=validatedSnapshot(item.raw);
  if(parsed&&parsed.id===item.projectId)valid.push(item);
 }
 return valid.sort((a,b)=>(b.savedAt||0)-(a.savedAt||0)||a.name.localeCompare(b.name));
}

// Reads current and revision in one snapshot so initial load never pairs unrelated versions.
function dbReadState(){return new Promise((resolve,reject)=>{const tx=idb.transaction('documents','readonly'),store=tx.objectStore('documents'),current=store.get('current'),meta=store.get('current_meta');tx.oncomplete=()=>resolve({raw:current.result??null,revision:Number(meta.result?.revision)||0});tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
// The read/compare/write is inside ONE readwrite IndexedDB transaction, not separate awaits.
// The old `current` string remains unchanged for portable JSON and recovery compatibility.
function dbWrite(data,{manual=false}={}){return new Promise((resolve,reject)=>{const entry=diProjectRecord(data),tx=idb.transaction('documents','readwrite'),store=tx.objectStore('documents');let conflict=false;
 const old=store.get('current');old.onsuccess=()=>{const meta=store.get('current_meta');meta.onsuccess=()=>{
   const current=old.result??null,revision=Number(meta.result?.revision)||0;
   if(current!==diExpectedRaw||revision!==diExpectedRevision){conflict=true;tx.abort();return;}
   const stamp=store.get('checkpoint_meta');stamp.onsuccess=()=>{
     const validPrevious=typeof current==='string'&&current!==data&&isRecoverableSnapshot(current);
     if(validPrevious){store.put(current,'previous');if(!stamp.result||Date.now()-Number(stamp.result)>120000||manual){store.put(current,'checkpoint');store.put(Date.now(),'checkpoint_meta');}}
     store.put(data,'current');store.put(entry,diProjectRecordKey(entry.projectId));store.put({revision:revision+1,writerId:diWriterId,saveId:Math.random().toString(36).slice(2),at:Date.now()},'current_meta');
   };
 };};tx.oncomplete=()=>{diExpectedRaw=data;diExpectedRevision++;resolve(true);};tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(conflict?diSaveConflictError():(tx.error||new Error('Save aborted')));});}
function dbWriteConflictDraft(serial){return new Promise((resolve,reject)=>{const tx=idb.transaction('documents','readwrite');tx.objectStore('documents').put(serial,'conflict_'+diWriterId);tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
function dbReadConflictDrafts(){return new Promise((resolve,reject)=>{const tx=idb.transaction('documents','readonly'),store=tx.objectStore('documents');const out=[];const req=store.openCursor();req.onsuccess=()=>{const cursor=req.result;if(!cursor)return;if(String(cursor.key).startsWith('conflict_')&&typeof cursor.value==='string')out.push({key:String(cursor.key),raw:cursor.value});cursor.continue();};tx.oncomplete=()=>resolve(out.slice(-12));tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
// A large-document draft is durable only after the IDB transaction completes.
// Its key is unique to this tab; an older queued write may not replace a newer edit.
function dbWriteEmergencyDraft(raw,sequence,projectId){return new Promise((resolve,reject)=>{
 const tx=idb.transaction('documents','readwrite'),store=tx.objectStore('documents'),key='emergency_'+diWriterId;
 const previous=store.get(key);
 previous.onsuccess=()=>{
   if(Number(previous.result?.sequence||0)>sequence)return;
   store.put({raw,sequence,projectId,at:Date.now()},key);
 };
 tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
});}
// Delete ONLY the draft saved in this tab and at or before the verified
// canonical snapshot; a later in-flight edit must remain recoverable.
function dbClearEmergencyDraft(sequence,projectId){return new Promise((resolve,reject)=>{
 const tx=idb.transaction('documents','readwrite'),store=tx.objectStore('documents'),key='emergency_'+diWriterId;
 const previous=store.get(key);
 previous.onsuccess=()=>{
   const entry=previous.result;
   if(entry&&entry.projectId===projectId&&Number(entry.sequence)<=sequence)store.delete(key);
 };
 tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
});}
// T27: Each explicit project replacement must preserve an independently
// readable snapshot of the outgoing project. This is NOT a multi-project cloud
// library: these versions live only in this browser's recovery store.
function dbArchiveProject(raw,projectId,reason){return new Promise((resolve,reject)=>{
 const key='project_archive_'+uid(),tx=idb.transaction('documents','readwrite');
 tx.objectStore('documents').put({raw,projectId,reason,at:Date.now()},key);
 tx.oncomplete=()=>resolve(key);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
});}
function dbReadProjectArchives(){return new Promise((resolve,reject)=>{
 const out=[],tx=idb.transaction('documents','readonly'),req=tx.objectStore('documents').openCursor();
 req.onsuccess=()=>{const cur=req.result;if(!cur)return;
  if(String(cur.key).startsWith('project_archive_')&&typeof cur.value?.raw==='string')out.push({key:String(cur.key),...cur.value});
  cur.continue();
 };
 tx.oncomplete=()=>resolve(out.sort((a,b)=>(b.at||0)-(a.at||0)).slice(0,30));
 tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
});}
async function diArchiveOutgoingProject(raw,reason){
 const projectId=JSON.parse(raw).id;
 if(storageMode==='indexeddb'&&idb){
  const key=await dbArchiveProject(raw,projectId,reason);
  const verified=await dbReadKey(key);
  if(verified?.raw!==raw||verified?.projectId!==projectId)throw Error('Project protection could not be verified.');
  return key;
 }
 if(storageMode==='localstorage'){
  // A distinct key avoids overwriting the single previous-save slot.
  const key='ThinkIt_v094_project_archive_'+uid();
  localStorage.setItem(key,raw);
  if(localStorage.getItem(key)!==raw)throw Error('Project protection could not be verified.');
  return key;
 }
 throw Error('Local storage unavailable: cannot protect the outgoing project. Export JSON before switching.');
}
function dbReadEmergencyDrafts(){return new Promise((resolve,reject)=>{
 const tx=idb.transaction('documents','readonly'),store=tx.objectStore('documents'),out=[];
 const req=store.openCursor();req.onsuccess=()=>{
   const cursor=req.result;if(!cursor)return;
   const value=cursor.value;
   if(String(cursor.key).startsWith('emergency_')&&value&&typeof value.raw==='string')out.push({key:String(cursor.key),raw:value.raw,at:value.at});
   cursor.continue();
 };
 tx.oncomplete=()=>resolve(out.sort((a,b)=>(b.at||0)-(a.at||0)).slice(0,12));
 tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
});}
// Web Locks provide the exclusivity missing from localStorage's multiple independent keys.
// Fail closed if unavailable: do not silently enable last-writer-wins writes.
async function diFallbackWrite(data){const locks=window.navigator?.locks;
 if(!locks?.request){const e=new Error('Exclusive storage lock unavailable');e.code='THINKIT_NO_LOCK';throw e;}
 return locks.request('thinkit-v094-current',{mode:'exclusive'},()=>{
   const previous=localStorage.getItem('ThinkIt_v094_document');
   if(previous!==diExpectedRaw)throw diSaveConflictError();
   localStorage.setItem('ThinkIt_v094_document',data);
   // A storage API accepting setItem is not a verified receipt. Read back the
   // exact bytes while the exclusive lock is still held, before advancing the
   // tab's expected version or rotating its prior recovery snapshot.
   if(localStorage.getItem('ThinkIt_v094_document')!==data){
     const err=new Error('Browser storage did not return the saved project');
     err.code='THINKIT_READBACK_MISMATCH';throw err;
   }
   if(typeof diProjectRecord==='function'){
     const record=diProjectRecord(data);
     localStorage.setItem(diLocalProjectKey(record.projectId),data);
     if(localStorage.getItem(diLocalProjectKey(record.projectId))!==data){
       const err=new Error('Project catalogue readback mismatch');err.code='THINKIT_READBACK_MISMATCH';throw err;
     }
   }
   diExpectedRaw=data;diExpectedRevision++;
   if(isRecoverableSnapshot(previous)&&previous!==data){try{localStorage.setItem('ThinkIt_v094_previous',previous);}catch(err){console.warn('Previous local recovery snapshot could not rotate',err);}}
   return true;
 });}
function isRecoverableSnapshot(raw){try{const d=JSON.parse(raw);return !!d&&d.format==='DIAGRAMIT'&&[2,3].includes(d.version)&&Array.isArray(d.pages)&&d.pages.length>0;}catch{return false;}}
let saveQueue=Promise.resolve(),saveRequestId=0;
function persist({manual=false}={}){
 if(!doc||storageMode==='pending')return Promise.resolve(false);
 const serial=JSON.stringify(doc),seq=++saveRequestId,draftSequence=diEditSequence,projectId=doc.id;
 setSaveState('unsaved','Saving on this device…');
 // Serialized commits: the newest save can never be overwritten by a slower, older save.
 saveQueue=saveQueue.catch(()=>{}).then(async()=>{
   if(diSaveConflict){setSaveState('error','Editing conflict · Export JSON');return false;}
   if(storageMode==='indexeddb'){
     // The pending emergency journal is independent of the canonical save.
     await diDraftQueue;
     await dbWrite(serial,{manual});
     // A completed transaction alone is not a cold-storage readback. Verify the
     // exact current bytes and revision before claiming a saved receipt.
     const verified=await dbReadState();
     if(verified.raw!==serial||verified.revision!==diExpectedRevision)throw diSaveConflictError();
     if(typeof diReadSavedProject==='function'&&(await diReadSavedProject(projectId))?.raw!==serial)throw Error('Project catalogue readback mismatch');
     try{await dbClearEmergencyDraft(draftSequence,projectId);}catch(err){console.warn('Saved project; emergency draft cleanup postponed',err);}
   }
   else if(storageMode==='localstorage')await diFallbackWrite(serial);
   else{setSaveState('error','Local storage unavailable · export JSON');return false;}
   lastSaved=serial;
   if(JSON.stringify(doc)===serial)try{localStorage.removeItem(diShadowKey);}catch{}
   if(seq===saveRequestId&&JSON.stringify(doc)===serial)setSaveState('saved','Saved on this device');
   return true;
 }).catch(async err=>{
   if(err?.code==='THINKIT_CONCURRENT_EDIT'){
     diSaveConflict=true;
     if(storageMode==='indexeddb')try{await dbWriteConflictDraft(serial);}catch(e){console.warn('Conflict draft could not be stored',e);}
     // The editable in-memory copy remains intact and can always be exported as JSON.
     setSaveState('error','Another tab saved · Export JSON');
     toast('Editing conflict: another tab saved first. This tab has NOT saved. Export JSON before reloading.');
   }else if(err?.code==='THINKIT_NO_LOCK'){
     if(seq===saveRequestId)setSaveState('error','Storage lock unavailable · Export JSON');
     toast('Safe local saving unavailable in this browser. Export JSON.');
   }else if(err?.code==='THINKIT_READBACK_MISMATCH'){
     if(seq===saveRequestId)setSaveState('error','Local save could not be verified · Export JSON');
     toast('Browser storage did not verify this project save. Export JSON before closing.');
   }else{console.error(err);if(seq===saveRequestId)setSaveState('error','Save failed · export JSON');toast('Local save failed. Export JSON to protect your work.');}
   return false;
 });
 return saveQueue;
}
function diHideStart(){$('diStartScreen').hidden=true;}
function diShowStart(hasSaved=false){diHasSavedProject=!!hasSaved;const screen=$('diStartScreen');screen.hidden=false;$('diStartResume').hidden=!diHasSavedProject;requestAnimationFrame(()=>$('diStartOpen')?.focus({preventScroll:true}));}
let freshInstall=false,recoveryNotice='';
function validatedSnapshot(raw){if(typeof raw!=='string'||!raw)return null;try{return validateDocument(JSON.parse(raw));}catch(err){console.warn('Invalid local project snapshot',err.message);return null;}}
async function getLocalRecoveryEntries(){const found=[];if(storageMode==='indexeddb'){
 for(const key of ['previous','checkpoint']){try{found.push({key,raw:await dbReadKey(key)});}catch(e){console.warn('Recovery read failed',key,e);}}
 try{found.push(...await dbReadConflictDrafts());}catch(e){console.warn('Conflict recovery scan failed',e);}
 try{found.push(...await dbReadEmergencyDrafts());}catch(e){console.warn('Large-project emergency recovery scan failed',e);}
 try{found.push(...await dbReadProjectArchives());}catch(e){console.warn('Archived-project recovery scan failed',e);}
 // Legacy global shadow is never used to silently overwrite a valid canonical save.
 try{found.push({key:'shadow',raw:localStorage.getItem('ThinkIt_v094_shadow')});}catch{}
 }else if(storageMode==='localstorage'){
 for(const [key,item] of [['previous','ThinkIt_v094_previous'],['shadow','ThinkIt_v094_shadow']])try{found.push({key,raw:localStorage.getItem(item)});}catch{}
 try{for(let i=0;i<localStorage.length&&i<10000;i++){const key=localStorage.key(i);if(key?.startsWith('ThinkIt_v094_project_archive_'))found.push({key,raw:localStorage.getItem(key)});}}catch{}
 }
 // Per-tab emergency copies also remain available when IDB storage fails.
 try{for(let i=0;i<localStorage.length&&i<10000;i++){const key=localStorage.key(i);if(key?.startsWith('ThinkIt_v094_shadow_tab_'))found.push({key,raw:localStorage.getItem(key)});}}catch{}
 return found.filter(e=>validatedSnapshot(e.raw));}
async function openLocalRecovery(){const candidates=await getLocalRecoveryEntries();
 const unique=[],used=new Set();for(const e of candidates){if(used.has(e.raw))continue;used.add(e.raw);unique.push(e);}
 if(!unique.length){modal('Restore local version','<p>No earlier valid local version is available in this browser. Use <strong>File → Open Project</strong> to import a portable JSON backup.</p>',[{text:'Close'}]);return;}
 const body=modal('Restore local version',`<p class="modal-subtext">Choose an earlier locally saved version. This restores the <strong>entire project</strong>, not only the active diagram. Export your current project as JSON first if you may need it later.</p><div id="diRecoveryVersions"></div><p class="modal-subtext">These browser copies are not independent backups and can be lost if site data is cleared.</p>`,[{text:'Cancel'}]);
 const parent=body.querySelector('#diRecoveryVersions');for(const candidate of unique){const parsed=validatedSnapshot(candidate.raw);if(!parsed)continue;
  const btn=dom('button','di-recovery-row',undefined,parent);const heading=dom('strong','',`${candidate.key==='previous'?'Previous save':candidate.key==='checkpoint'?'Older checkpoint':candidate.key.startsWith('conflict_')?'Unsaved editing conflict':candidate.key.startsWith('emergency_')?'Large-project emergency draft':candidate.key.startsWith('project_archive_')||candidate.key.startsWith('ThinkIt_v094_project_archive_')?'Protected previous project':'Emergency tab draft'} · ${parsed.name||'Untitled'}`,btn);dom('span','',`${parsed.pages.length} diagram(s) · ${parsed.updatedAt?new Date(parsed.updatedAt).toLocaleString():'Date unknown'}`,btn);
  btn.onclick=()=>{const current=activeModal;current?.close();modal('Confirm project restore',`<p>Restore <strong>${esc(parsed.name||'Untitled')}</strong> from the selected local version? The active project will first receive an independently verified local recovery archive. These copies are device-local; export a JSON backup for independent protection.</p>`,[{text:'Cancel'},{text:'Restore version',primary:true,action:()=>{
    const dialog=activeModal;
    for(const button of $('modalRoot').querySelectorAll('button'))button.disabled=true;
    diCommitProjectSwitch(validatedSnapshot(candidate.raw),'Restore local version').then(ok=>{
      if(ok){
        if(candidate.key.startsWith('conflict_')||candidate.key.startsWith('ThinkIt_v094_shadow_tab_')){
          diSaveConflict=true;setSaveState('error','Conflict draft opened · Export JSON before saving');
          clearTimeout(saveTimer);
        }
        toast(diSaveConflict?'Conflict draft opened for review. Export JSON and resolve the conflict.':'Local project restored. The previous active project is in Restore Local Version.');
      }
      if(activeModal===dialog)dialog.close();
    });
    return false;
   }}]);};
 }
}
let recoverySource=null;
// Project imports and switches must wait for the authoritative local storage
// target to finish opening; the HTML and file picker become interactive first.
let diStorageReady=Promise.resolve();
async function initStorage(){let saved=null;try{await openStorage();storageMode='indexeddb';const state=await dbReadState();saved=state.raw;diExpectedRaw=saved;diExpectedRevision=state.revision;}catch(err){try{localStorage.setItem('DiagramIt_storage_probe','ok');localStorage.removeItem('DiagramIt_storage_probe');storageMode='localstorage';saved=localStorage.getItem('ThinkIt_v094_document');diExpectedRaw=saved;}catch{storageMode='none';}}
 let loaded=validatedSnapshot(saved),shadow=null;try{shadow=validatedSnapshot(localStorage.getItem('ThinkIt_v094_shadow'));}catch{}
 // An emergency shadow cannot automatically supersede an otherwise valid authoritative save:
 // another tab may have created it from an older project snapshot.
 if(shadow&&!loaded){loaded=shadow;recoverySource='shadow';}
 if(!loaded){for(const entry of await getLocalRecoveryEntries()){
  // Conflicting/other-tab drafts require explicit recovery and must never silently become current.
  if(entry.key.startsWith('conflict_')||entry.key.startsWith('ThinkIt_v094_shadow_tab_')||entry.key.startsWith('emergency_')||entry.key.startsWith('project_archive_')||entry.key.startsWith('ThinkIt_v094_project_archive_'))continue;
  const candidate=validatedSnapshot(entry.raw);if(candidate){loaded=candidate;recoverySource=entry.key;break;}}}
 if(loaded){doc=loaded;recoveryNotice=recoverySource?`Recovered from ${recoverySource} · Export JSON backup`:'Restored from this device';}
 else {doc=blankDiagramIt('flow');freshInstall=true;recoveryNotice=saved?'Saved project invalid · Open JSON backup':'Ready · create a project';}
 page=getPage();projectIsReady=true;lastSaved=JSON.stringify(doc);$('docName').value=doc.name;loadPreferences();render();requestAnimationFrame(()=>fitView({initial:true}));
 if(storageMode==='none')setSaveState('error','Storage blocked · export JSON');else setSaveState(recoverySource?'unsaved':saved&&!loaded?'error':'saved',recoveryNotice);
 diLoadTabState();diShowStart(!!loaded);
 if(recoverySource){toast('A recoverable local version was found. Export a JSON backup before editing.');}
}
function pref(key,v){try{localStorage.setItem('diagramit_pref_'+key,JSON.stringify(v));}catch{}}
function loadPreferences(){const read=(k,f)=>{try{const v=localStorage.getItem('diagramit_pref_'+k);return v===null?f:JSON.parse(v);}catch{return f;}};theme=read('theme','light');showGrid=read('grid',true);layoutDirection=read('layout','down');document.body.dataset.theme=theme;const leftWidth=read('leftWidth',null),rightWidth=read('rightWidth',null);if(leftWidth)document.documentElement.style.setProperty('--panel-width',`${leftWidth}px`);if(rightWidth)document.documentElement.style.setProperty('--inspector-width',`${rightWidth}px`);document.body.classList.toggle('sidebar-collapsed',read('libraryHidden',window.innerWidth<850));document.body.classList.toggle('inspector-collapsed',read('inspectorHidden',window.innerWidth<850));}
function addNode(shape,x,y,label,extra={}){const n=node(shape,x,y,label,extra);
 if(page.mode!=='bubble'){n.outlineOrder=page.nodes.length+1;n.wbsCodeOverride=null;n.dependencies=[];if(page.mode==='flow')n.outlineParentId=null;}
 page.nodes.push(n);selected=new Set([n.id]);edgeSelected=null;return n;}
function initialShapeSize(shape,source=null){const fallback=DEFAULT_SIZE[shape]||[160,70];return window.ThinkItInsertLayout?.inheritedSize(source,fallback)||{w:fallback[0],h:fallback[1]};}
// H3a: auto-managed objects may be rearranged by later insertions. Historical,
// pinned and manually moved objects are held fixed. All changes happen inside
// the caller's existing transaction, preserving one-step undo/redo.
function h3ApplyPositions(positions){
 for(const [id,p] of Object.entries(positions||{})){
  const n=byId(id);if(n?.layoutManaged===true&&!n.pinned&&Number.isFinite(p.x)&&Number.isFinite(p.y)){
   n.x=Math.round(p.x);n.y=Math.round(p.y);
  }
 }
}
const h3LastConstraints=new Map();
function h3RememberConstraints(anchorId,conflicts){
 if(conflicts.length)h3LastConstraints.set(page.id,{anchorId,conflicts});
 else if(h3LastConstraints.get(page.id)?.anchorId===anchorId)h3LastConstraints.delete(page.id);
}
function h3BranchReflow(anchorId){
 if(!anchorId||!['mind','flow'].includes(page.mode))return;
 const direction=page.mode==='mind'?'right':layoutDirection==='right'?'right':'down';
 const visibleIds=page.mode==='flow'?flowGraphPlan().visibleNodeIds:visibleNodes().map(n=>n.id);
 const nested=window.ThinkItSubtreeLayout;
 if(nested?.planBranch){
  const plan=nested.planBranch(page,anchorId,{direction,
   gap:page.mode==='mind'?mindSettings().siblingGap:32,visibleIds});
  h3ApplyPositions(plan.positions);h3RememberConstraints(anchorId,plan.conflicts);
  return;
 }
 const planner=window.ThinkItBranchReflow;
 if(planner?.planBranch)h3ApplyPositions(planner.planBranch(page,anchorId,{direction,
   gap:page.mode==='mind'?mindSettings().siblingGap:32}));
}
function h3Repair(protectedId=null){
 if(!['mind','flow'].includes(page.mode))return;
 const visibleIds=page.mode==='flow'?flowGraphPlan().visibleNodeIds:visibleNodes().map(n=>n.id);
 const nested=window.ThinkItSubtreeLayout;
 if(nested?.repairVisible){
  const plan=nested.repairVisible(page,visibleIds,{protectIds:protectedId?[protectedId]:[]});
  h3ApplyPositions(plan.positions);return;
 }
 const planner=window.ThinkItBranchReflow;
 if(planner?.repairVisible)h3ApplyPositions(planner.repairVisible(page,visibleIds,
   {protectIds:protectedId?[protectedId]:[]}));
}
// Auto-placement is local; its new node is eligible for later scoped reflows.
function arrangeInserted(n,preferred,direction='down'){
 if(!n||!['mind','flow'].includes(page.mode))return n;
 const engine=window.ThinkItInsertLayout;
 if(!engine?.place)throw Error('Insertion layout module unavailable');
 const next=engine.place(page.nodes,n.id,{preferred,direction});
 n.x=Math.round(next.x);n.y=Math.round(next.y);n.layoutManaged=true;return n;
}
function addAtCenter(shape){if(selected.size===1&&byId([...selected][0])){addChild([...selected][0],false,shape);return;}const size=initialShapeSize(shape),wh=getWorldSize();let wx=(wh.w/2-view.x)/view.k-size.w/2,wy=(wh.h/2-view.y)/view.k-size.h/2;transact(()=>{const n=addNode(shape,Math.round(wx/12)*12,Math.round(wy/12)*12,undefined,{w:size.w,h:size.h});if(page.mode==='flow'&&flowFocusId())n.outlineParentId=flowFocusId();arrangeInserted(n,{x:n.x,y:n.y});});}
function startEdit(id,type='node',replaceWith=null){if(editing)finishEdit();const n=type==='node'?byId(id):findEdge(id);if(!n)return;if(type==='edge'&&flowProjectedEdge(id)){toast('Expand the subprocess before editing this connector on the canvas.');return;}const p=type==='node'?nodePos(n):null;const input=dom('textarea','editing-text',undefined,$('canvasWrap'));input.value=replaceWith!==null?replaceWith:(n.label||'');const rect=canvas.getBoundingClientRect();if(type==='node'){input.style.left=`${p.x*view.k+view.x+Math.max(7,p.w*view.k*.09)}px`;input.style.top=`${p.y*view.k+view.y+Math.max(5,p.h*view.k*.19)}px`;input.style.width=`${Math.max(110,p.w*view.k*.83)}px`;input.style.height=`${Math.max(51,p.h*view.k*.65)}px`;input.style.fontSize=`${clamp((n.fontSize||13)*view.k,12,21)}px`;}else{const a=byId(n.from),b=byId(n.to);if(!isFreeEdge(n)&&(!a||!b))return;const pt=getEdgeGeom(n,a,b).label;input.style.left=`${pt.x*view.k+view.x-80}px`;input.style.top=`${pt.y*view.k+view.y-24}px`;input.style.width='160px';input.style.height='52px';}editing={input,id,type};input.focus();if(replaceWith===null)input.select();else input.setSelectionRange(input.value.length,input.value.length);input.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();finishEdit(false);}else if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();e.stopPropagation();finishEdit(true);}});input.addEventListener('blur',()=>{if(editing?.input===input)finishEdit(true);});}
function finishEdit(commit=true){if(!editing)return;if(editing.type==='annotation'){editing.container?.remove();editing=null;return;}const {input,id,type}=editing;editing=null;const value=input.value.trim();input.remove();canvas.focus({preventScroll:true});if(commit&&value){if(type==='node'){const n=byId(id);if(n&&n.label!==value)transact(()=>n.label=value);}else{const e=findEdge(id);if(e&&e.label!==value)transact(()=>e.label=value);}}}
function chooseNonOverlapping(x,y,shape){const [w,h]=DEFAULT_SIZE[shape]||[160,70],stepX=w+42,stepY=h+47;const collision=(cx,cy)=>page.nodes.some(n=>cx<n.x+n.w+13&&cx+w+13>n.x&&cy<n.y+n.h+13&&cy+h+13>n.y);if(!collision(x,y))return{x,y};for(const by of [0,1,-1,2,-2]){for(let a=1;a<15;a++){for(const sx of [-1,1]){const cx=x+sx*a*stepX*.75,cy=y+by*stepY;if(!collision(cx,cy))return{x:cx,y:cy};}}}return{x:x+stepX*2,y:y+stepY*2};}
function defaultChildPosition(parent,sibling=false,size=null){const sibs=treeChildren(parent.id),w=size?.w||168,h=size?.h||68;if(page.mode==='mind'){const direction=parent.parentId?Math.sign((parent.x+parent.w/2)-(byId(parent.parentId).x+byId(parent.parentId).w/2))||1:1;return{x:parent.x+(direction>0?parent.w+92:-w-92),y:parent.y+sibs.length*Math.max(85,h+24)-9};}if(page.mode==='org')return{x:parent.x+(sibs.length-1)*190,y:parent.y+160};return{x:parent.x+parent.w/2-w/2,y:parent.y+parent.h+87};}
function edgeSourceFor(n){return page.edges.find(e=>e.to===n.id&&!isFreeEdge(e))?.from||null;}
function placeRelative(reference,shape,direction,space=85,size=null){const [fallbackW,fallbackH]=DEFAULT_SIZE[shape]||[160,70],w=size?.w||fallbackW,h=size?.h||fallbackH;const refX=reference.x+reference.w/2,refY=reference.y+reference.h/2;
return direction==='left'?{x:reference.x-w-space,y:refY-h/2}:direction==='right'?{x:reference.x+reference.w+space,y:refY-h/2}:direction==='up'?{x:refX-w/2,y:reference.y-h-space}:{x:refX-w/2,y:reference.y+reference.h+space};}
function chooseDirectionalSlot(reference,shape,rough,direction){const [w,h]=DEFAULT_SIZE[shape]||[160,70];const touches=(x,y)=>page.nodes.some(n=>x<n.x+n.w+13&&x+w+13>n.x&&y<n.y+n.h+13&&y+h+13>n.y);
if(!touches(rough.x,rough.y))return rough;
const primary=direction==='left'||direction==='right'?'x':'y';
for(let tier=0;tier<20;tier++)for(let step=1;step<=25;step++)for(const sign of [1,-1]){
const x=rough.x+(primary==='x'?(direction==='right'?tier:-tier)*45:sign*step*(w+32)*.6),y=rough.y+(primary==='y'?(direction==='down'?tier:-tier)*45:sign*step*(h+34)*.65);
if(!touches(x,y))return{x,y};}
return rough;}
function addChild(parentId,sibling=false,customShape,direction=null,makeParent=false){let created=null;transact(()=>{const selectedNode=byId(parentId);if(!selectedNode)return;const existingFlowParent=sibling&&page.mode==='flow'?byId(edgeSourceFor(selectedNode)):null;
const base=sibling?(page.mode==='flow'?(existingFlowParent||selectedNode):(byId(selectedNode.parentId)||selectedNode)):selectedNode;if(!base)return;
const shape=customShape||(page.mode==='org'?'person':page.mode==='mind'?'subtopic':'process');const size=initialShapeSize(shape,['flow','mind'].includes(page.mode)?selectedNode:null);let roughPos;
if(direction){roughPos=placeRelative(selectedNode,shape,direction,makeParent?90:100,size);}else if(sibling){const siblings=page.mode==='flow'?page.edges.filter(e=>e.from===base.id).map(e=>byId(e.to)).filter(Boolean):treeChildren(base.id);const i=siblings.length;roughPos=page.mode==='mind'?{x:selectedNode.x,y:selectedNode.y+Math.max(i?88:95,size.h+24)}:page.mode==='org'?{x:selectedNode.x+205,y:selectedNode.y}:{x:selectedNode.x+selectedNode.w+95,y:selectedNode.y};}else{roughPos=defaultChildPosition(base,false,size);}
const auto=['mind','flow'].includes(page.mode),pos=auto?roughPos:(direction?chooseDirectionalSlot(selectedNode,shape,roughPos,direction):chooseNonOverlapping(roughPos.x,roughPos.y,shape));const label=page.mode==='org'?(makeParent?'New manager':'New role'):page.mode==='mind'?(makeParent?'New parent topic':'New topic'):(makeParent?'New preceding step':'New step');
const oldParent=selectedNode.parentId;
created=addNode(shape,pos.x,pos.y,label,{parentId:page.mode==='flow'?null:(makeParent?oldParent:base.id),fill:page.mode==='flow'?'plain':page.mode==='mind'?'blue':'plain',...(auto?{w:size.w,h:size.h}:{})});
if(page.mode==='flow'&&flowFocusId()){
 const focus=flowFocusId();
 // Graph arrows describe sequence; WBS ownership comes from focused scope.
 const owner=base.shape==='subprocess'&&window.ThinkItFlowFocus.index(page).descendants(focus).has(base.id)?base.id:focus;
 created.outlineParentId=owner;
}
if(auto)arrangeInserted(created,pos,direction||(page.mode==='mind'&&pos.x<base.x?'left':page.mode==='mind'?'right':'down'));
if(makeParent){if(page.mode==='flow')page.edges.push(edge(created.id,selectedNode.id));else selectedNode.parentId=created.id;}
else if(page.mode==='flow')page.edges.push(edge(base.id,created.id));
if(base.collapsed)base.collapsed=false;
if(auto){h3BranchReflow(base.id);h3Repair(created.id);}
});if(created){ensureVisibleNode(created);startEdit(created.id);}}
function directionalCreation(direction,makeParent=false){if(selected.size!==1){toast('Select one node first, then use Option + an arrow key.');return;}const current=[...selected][0];addChild(current,false,null,direction,makeParent);}

function addRoot(){if(page.mode==='flow'&&flowFocusId()){toast('Exit focused subprocess before adding a top-level activity.');return;}const shape=page.mode==='flow'?'process':page.mode==='org'?'person':'topic';addAtCenter(shape);if(selected.size===1)startEdit([...selected][0]);}
function duplicateSelection(){if(!selected.size)return;const source=[...selected].map(byId).filter(Boolean);if(!source.length||!confirmSharedKeepItCopy(source,'duplicate'))return;transact(()=>{const orig=source,map=new Map(),newIds=[];for(const old of orig){const n=clone(old);n.id=uid();n.x+=36;n.y+=34;n.groupId=null;
 // A duplicated work item receives a new generated code and order. Stable IDs
 // are remapped only where the predecessor or outline parent was also copied.
 if(page.mode!=='bubble'){n.wbsCodeOverride=null;n.outlineOrder=page.nodes.length+1;}
 map.set(old.id,n.id);page.nodes.push(n);newIds.push(n.id);}for(const n of page.nodes.slice(-orig.length)){if(n.parentId&&map.has(n.parentId))n.parentId=map.get(n.parentId);else if(page.mode!=='flow'&&!byId(n.parentId))n.parentId=null;
 if(page.mode==='flow'&&n.outlineParentId&&map.has(n.outlineParentId))n.outlineParentId=map.get(n.outlineParentId);
 if(Array.isArray(n.dependencies))n.dependencies=n.dependencies.map(dep=>map.has(dep.id)?{...dep,id:map.get(dep.id)}:dep);
 }for(const e of page.edges.slice()){if(map.has(e.from)&&map.has(e.to))page.edges.push({...clone(e),id:uid(),from:map.get(e.from),to:map.get(e.to)});}for(const a of (page.annotations||[]).slice()){if(a.parentId&&map.has(a.parentId)){const cp=clone(a);cp.id=uid();cp.parentId=map.get(a.parentId);allAnnotations().push(cp);}}selected=new Set(newIds);edgeSelected=null;});}
function removeSelection(options) {
  if(!selected.size&&!edgeSelected&&!selectedAnnotation)return false;
  const doomed=!selectedAnnotation&&!edgeSelected?affectedSelectionIds():new Set();
  if(doomed.size&&!options?.alreadyConfirmed&&!confirmKeepItReferenceRemoval(page.nodes.filter(n=>doomed.has(n.id))))return false;
  transact(()=>{
    if(selectedAnnotation){page.annotations=allAnnotations().filter(a=>a.id!==selectedAnnotation);selectedAnnotation=null;}
    else if(edgeSelected){page.edges=page.edges.filter(e=>e.id!==edgeSelected);edgeSelected=null;}
    else{
      // Flowchart WBS parenting is separate from graph arrows. Reparent
      // surviving children to the nearest retained ancestor (or root) when an
      // outline parent is deleted; keep predecessor references for audit.
      if(page.mode==='flow'&&doomed.size){const indexed=new Map(page.nodes.map(n=>[n.id,n]));for(const n of page.nodes){if(doomed.has(n.id))continue;let parent=n.outlineParentId??null;while(parent&&doomed.has(parent))parent=indexed.get(parent)?.outlineParentId??null;if(parent!==n.outlineParentId)n.outlineParentId=parent;}}
      page.nodes=page.nodes.filter(n=>!doomed.has(n.id));
      page.annotations=allAnnotations().filter(a=>!a.parentId||!doomed.has(a.parentId));
      page.edges=page.edges.filter(e=>!doomed.has(e.from)&&!doomed.has(e.to));
      selected.clear();
    }
  });
  return true;
}
function groupSelection(){if(selected.size<2)return;transact(()=>{const g=uid();for(const id of selected){const n=byId(id);if(n)n.groupId=g;}});toast(`${selected.size} objects grouped; group membership does not change hierarchy.`);}
function ungroupSelection(){transact(()=>{for(const id of selected){const n=byId(id);if(n)n.groupId=null;}});}
function toggleCollapse(id,force){
 const n=byId(id);if(!n)return;
 // The Mind Map / Org Chart action is intentionally unchanged.
 if(page.mode!=='flow'){transact(()=>{n.collapsed=!n.collapsed;selected=new Set([id]);
  if(page.mode==='mind')h3Repair(id);
 });return;}
 if(!page.nodes.some(child=>child.outlineParentId===id))return;
 const collapse=force===undefined?!n.collapsed:!!force;
 if(!!n.collapsed===collapse)return;
 transact(()=>{n.collapsed=collapse;selected=new Set([id]);edgeSelected=null;selectedAnnotation=null;
  flowRenderPlan=null;t22VisibleCache=null;
  const source=n.outlineParentId||edgeSourceFor(n);if(source)h3BranchReflow(source);
  h3Repair(id);
 });
}
function changeParent(id,parentId){const n=byId(id);if(!n||page.mode==='flow')return;if(parentId===id||descendants(id).has(parentId)){toast('Cannot assign a subordinate as their manager or parent.');renderInspector();return;}transact(()=>{n.parentId=parentId||null;n.collapsed=false;});toast(parentId?'Parent updated. Use Auto-layout to arrange the branch.':'Node moved to top level.');}
function selectNode(id,extend=false){if(page.mode==='flow'){
  const scope=flowFocusId()?window.ThinkItFlowFocus.index(page).descendants(flowFocusId()):null;
  if(scope&&!scope.has(id)){flowFocusByPage.set(page.id,null);t22VisibleCache=null;}
  flowRevealAncestors(id);
 }selectedAnnotation=null;if(!extend)selected.clear();if(extend&&selected.has(id))selected.delete(id);else selected.add(id);edgeSelected=null;render();}
function selectEdge(id){selectedAnnotation=null;edgeSelected=id;selected.clear();render();}
function clearSelection(){selectedAnnotation=null;selected.clear();edgeSelected=null;reparentPick=null;render();}
function selectPage(id){diClosedTabs.delete(id);diSaveTabState();if(doc.activePageId===id){render();return;}selectedAnnotation=null;finishEdit();cancelPreview(false);doc.activePageId=id;page=getPage();selected.clear();edgeSelected=null;selectedAnnotation=null;history={undo:[],redo:[]};markDirty();render();if(page.mode!=='bubble')requestAnimationFrame(()=>fitView({initial:true}));}
function newPage(mode,name,starter=false,zoneTemplate='CUSTOM'){transact(()=>{const p={id:uid(),name:name||`New ${MODES[mode].name}`,mode,nodes:[],edges:[],annotations:[],orgLayout:mode==='org'?{...DEFAULT_ORG_LAYOUT}:undefined,mindLayout:mode==='mind'?{...DEFAULT_MIND_LAYOUT}:undefined,bubbleData:mode==='bubble'?(starter?null:{format:'diagramit-bubble-template',schema:1,spaces:[],relations:{},flows:[],title:name||'New bubble study',zoneTemplate}):undefined};if(window.ThinkItOutline&&!['bubble','bmc'].includes(mode))window.ThinkItOutline.migrateDocument({pages:[p]});doc.pages.push(p);diClosedTabs.delete(p.id);diSaveTabState();doc.activePageId=p.id;page=p;selected.clear();edgeSelected=null;if(starter&&!['bubble','bmc'].includes(mode)){const sz=DEFAULT_SIZE[mode==='flow'?'terminator':mode==='org'?'person':'topic'];addNode(mode==='flow'?'terminator':mode==='org'?'person':'topic',100,120,mode==='flow'?'Start':mode==='org'?'Department Head':'Central topic',{fill:'teal'});}});if(page.mode!=='bubble')fitView({initial:true});else render();}
function blankDiagramIt(mode='flow',name='Untitled workspace',zoneTemplate='CUSTOM'){
 const p={id:uid(),name:MODES[mode].name+' 1',mode,nodes:[],edges:[],annotations:[],orgLayout:mode==='org'?{...DEFAULT_ORG_LAYOUT}:undefined,mindLayout:mode==='mind'?{...DEFAULT_MIND_LAYOUT}:undefined,bubbleData:mode==='bubble'?{format:'diagramit-bubble-template',schema:2,title:name,spaces:[],relations:{},flows:[],generated:false,zoneTemplate}:undefined};
 if(window.ThinkItOutline&&!['bubble','bmc'].includes(mode))window.ThinkItOutline.migrateDocument({pages:[p]});
 return {format:'DIAGRAMIT',version:3,id:uid(),name,pages:[p],activePageId:p.id,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
}
// T27: Switching projects replaces the one active local save slot. Prepare a
// verified, independently selectable recovery copy BEFORE changing `doc`.
let diProjectSwitchBusy=false;
function diHasWorkToProtect(current){return !!current&&(!freshInstall||
 current.pages?.length>1||!['Untitled workspace','Untitled project'].includes(current.name)||
 current.pages?.some(p=>p.nodes?.length||p.edges?.length||p.annotations?.length||p.bubbleData?.spaces?.length||(p.bmcData?.blocks&&Object.values(p.bmcData.blocks).some(Boolean)))
);}
// Compare actual project values, not transient object identity or top-level
// JSON key insertion order. Arrays, node geometry, notes and dependencies must
// still match byte-for-byte when serialized individually.
function diProjectSameValues(raw,current){
 if(raw===null)return current==null;
 if(typeof raw!=='string'||!current||typeof current!=='object')return false;
 let before;try{before=JSON.parse(raw);}catch{return false;}
 const keys=Object.keys(before);
 return keys.length===Object.keys(current).length&&keys.every(key=>
  Object.prototype.hasOwnProperty.call(current,key)&&JSON.stringify(before[key])===JSON.stringify(current[key]));
}
async function diCommitProjectSwitch(incoming,reason){
 if(diProjectSwitchBusy){toast('A project change is already in progress.');return false;}
 diProjectSwitchBusy=true;
 let switchCommitStarted=false;
 try{
  const checkedIncoming=validatedSnapshot(JSON.stringify(incoming));
  if(!checkedIncoming)throw Error('The incoming project failed validation; no local project was replaced.');
  incoming=checkedIncoming;incoming.version=3;
  let outgoing=doc;
  clearTimeout(saveTimer);
  // Drain outstanding writes before freezing the departing document. During
  // this await, pending edits and first-launch layout can still legitimately
  // modify the in-memory project. They must be INCLUDED in the protected copy,
  // never silently discarded or mistaken for a later conflicting edit.
  await saveQueue;await diDraftQueue;
  if(storageMode==='indexeddb'){const live=await dbReadState();if(live.raw!==diExpectedRaw||live.revision!==diExpectedRevision)throw diSaveConflictError();}
  else if(storageMode==='localstorage'&&localStorage.getItem('ThinkIt_v094_document')!==diExpectedRaw)throw diSaveConflictError();
  if(diSaveConflict)throw Error('Another tab has changed this project. Export JSON and resolve the conflict before switching.');
  if(outgoing?.id!==doc?.id)throw Error('The active project identity changed during the switch. Retry after saving.');
  // Capture the latest stable in-memory object after draining outgoing writes.
  outgoing=doc;
  // The protection boundary begins here: subsequent content edits still
  // abort the switch rather than overwrite unsaved work with the incoming project.
  const raw=outgoing?JSON.stringify(outgoing):null;
  clearTimeout(saveTimer);
  if(diHasWorkToProtect(outgoing))await diArchiveOutgoingProject(raw,reason);
  // One active slot is kept for compatibility; independent named entries let
  // Open Recent reopen a real project instead of scavenging recovery archives.
  if(diHasWorkToProtect(outgoing)&&typeof diWriteProjectRecord==='function')await diWriteProjectRecord(raw,{guardCurrent:true});
  const incomingRaw=JSON.stringify(incoming);
  if(reason==='Open project file'&&typeof diReadSavedProject==='function'){
    const previous=await diReadSavedProject(incoming.id);
    if(previous&&previous.raw!==incomingRaw&&incoming.id!==outgoing?.id)
      throw Error('A different saved project already uses this project ID. Open its saved version or import a separately identified copy.');
  }
  // T29: Switch the canonical active slot BEFORE changing the in-memory project.
  // The previous T28 path wrote a named record here but only changed `current`
  // through a delayed markDirty/autosave. Closing during that gap reopened the
  // outgoing project, even after Project Manager displayed the incoming one.
  if(!diProjectSameValues(raw,doc))throw Error('The current project changed during protection. Retry.');
  if(storageMode==='indexeddb'){
    // dbWrite performs a single transaction: current + revision + incoming
    // named project. It fails closed if a second tab altered current meanwhile.
    switchCommitStarted=true;
    await dbWrite(incomingRaw,{manual:true});
    const live=await dbReadState(),stored=await diReadSavedProject(incoming.id);
    if(live.raw!==incomingRaw||live.revision!==diExpectedRevision||stored?.raw!==incomingRaw){
      diSaveConflict=true;
      throw Error('Project switch save could not be verified. Export JSON before further edits.');
    }
  }else if(storageMode==='localstorage'){
    // Use the same exclusive lock and exact readback as an ordinary Save.
    switchCommitStarted=true;
    await diFallbackWrite(incomingRaw);
    const stored=await diReadSavedProject(incoming.id);
    if(localStorage.getItem('ThinkIt_v094_document')!==incomingRaw||stored?.raw!==incomingRaw){
      diSaveConflict=true;
      throw Error('Project switch save could not be verified. Export JSON before further edits.');
    }
  }else throw Error('Verified local saving is unavailable. Export JSON before switching.');
  if(!diProjectSameValues(raw,doc)){
    diSaveConflict=true;
    throw Error('The outgoing project changed during the switch; export JSON to preserve the new edits.');
  }
  doc=incoming;diTabProjectId='';diLoadTabState();diClosedTabs.clear();diSaveTabState();
  page=getPage();history={undo:[],redo:[]};selected.clear();edgeSelected=null;selectedAnnotation=null;preview=null;
  bubbleActivePageId=null;freshInstall=false;lastSaved=incomingRaw;
  setSaveState('saved','Saved on this device');render();if(page.mode!=='bubble')requestAnimationFrame(()=>fitView({initial:true}));
  diHideStart();toast('Project opened and verified on this device. Previous work remains recoverable.');
  return true;
 }catch(err){
  // A write may have committed even when its readback or response failed.
  // Never let an old-project retry replace an ambiguous incoming commit.
  if(switchCommitStarted){diSaveConflict=true;setSaveState('error','Project switch not verified · Export JSON');}
  console.error('Project switch aborted',err);toast('Project switch blocked: '+String(err?.message||err||'Storage unavailable'));
  if(!diSaveConflict&&doc){clearTimeout(saveTimer);saveTimer=setTimeout(persist,350);}return false;}
 finally{diProjectSwitchBusy=false;}
}
function diRequestProjectSwitch(incoming,reason,{confirm=true}={}){
 if(storageMode==='pending')return diStorageReady.then(()=>diRequestProjectSwitch(incoming,reason,{confirm}));
 if(!incoming||typeof incoming.id!=='string'||!incoming.id.trim())return Promise.resolve(false);
 if(JSON.stringify(incoming)===JSON.stringify(doc)){toast('That project is already open.');return Promise.resolve(true);}
 if(!confirm||!diHasWorkToProtect(doc))return diCommitProjectSwitch(incoming,reason);
 return new Promise(resolve=>{
  const same=doc?.id===incoming.id;
  let settled=false;const finish=ok=>{if(!settled){settled=true;resolve(ok);}};
  modal('Protect current project before switching',`<p><strong>${esc(doc.name||'Current project')}</strong> will leave the active workspace. A verified device-local recovery copy is required before opening <strong>${esc(incoming.name||'New project')}</strong>.</p><p class="modal-subtext">${same?'Both files have the SAME project ID. They are treated as competing revisions, not automatically merged.':'This application retains one active project at a time.'} Recovery copies are stored in this browser, not synced to KeepIt or OneDrive. For an independent backup, export your current project as JSON before continuing.</p>`,[
   {text:'Cancel',action:()=>finish(false)},
   {text:same?'Open incoming revision':'Protect and continue',primary:true,action:()=>{
     const dialog=activeModal;
     // The user cannot dismiss the confirmation halfway through the archive
     // and accidentally trigger a second competing project change.
     for(const button of $('modalRoot').querySelectorAll('button'))button.disabled=true;
     diCommitProjectSwitch(incoming,reason).then(ok=>{finish(ok);if(activeModal===dialog)dialog.close();});
     return false;
   }}
  ],()=>finish(false));
 });
}
// The Project Manager shows verified local project entries, not recovery
// snapshots. The active project is never deleted automatically.
async function diOpenProjectManager(){
 let projects;
 try{projects=await diListSavedProjects();}catch(err){toast('Local project catalogue cannot be read: '+err.message);return;}
 const byId=new Map(projects.map(p=>[p.projectId,p]));
 // Unsaved first-launch/legacy project remains visible as active, never
 // misrepresented as a verified entry in the saved-project catalogue.
 if(doc&&!byId.has(doc.id))projects.unshift({projectId:doc.id,name:doc.name,raw:JSON.stringify(doc),unsaved:true,savedAt:0});
 const body=modal('Project Manager',`<p class="modal-subtext">Open a project saved on this device. Changes are not synchronized to KeepIt or OneDrive. For an independent backup, export JSON.</p><div id="diProjectList" class="di-project-list"></div>`,[
  {text:'Close'},{text:'Open JSON file…',action:()=>diClick('fileInput')},
  {text:'New project…',primary:true,action:()=>setTimeout(()=>openProjectChooser(),0)}
 ]);
 const list=body.querySelector('#diProjectList');
 if(!projects.length)dom('p','modal-subtext','No locally saved projects found.',list);
 for(const entry of projects){
  const button=dom('button','di-recovery-row',undefined,list);
  button.type='button';button.dataset.projectId=entry.projectId;
  dom('strong','',entry.name||'Untitled project',button);
  const date=Number(entry.savedAt)>0?new Date(entry.savedAt).toLocaleString():'Not yet independently saved';
  dom('span','',`${entry.projectId===doc?.id?'Currently open · ':''}${entry.unsaved?'Active only · ':''}${date}`,button);
  button.disabled=entry.projectId===doc?.id;
  button.onclick=async()=>{
    button.disabled=true;
    try{
      // Cold readback at selection time; never trust stale modal snapshots.
      const stored=await diReadSavedProject(entry.projectId);
      if(!stored)throw Error('Project no longer exists on this device');
      const incoming=validatedSnapshot(stored.raw);
      if(!incoming)throw Error('Stored project is invalid');
      const dialog=activeModal;dialog?.close();
      await diRequestProjectSwitch(incoming,'Open recent project',{confirm:true});
    }catch(err){toast('Cannot open saved project: '+err.message);button.disabled=false;}
  };
 }
}
function diSaveAsLocalProject(){
 const body=modal('Save As — New Local Project',`<p class="modal-subtext">Create a separate project with its own identity in this browser. The current project is preserved. This does not create a linked file on your Mac or in KeepIt.</p><div class="prop-field"><label for="diSaveAsName">New project name</label><input id="diSaveAsName" maxlength="180" value="${esc((doc?.name||'Untitled project')+' copy')}"></div><p class="modal-subtext">Embedded note and file references remain references to their original records; copying the project does not duplicate those KeepIt items.</p>`,[
  {text:'Cancel'},
  {text:'Create separate project',primary:true,action:b=>{
    const name=b.querySelector('#diSaveAsName')?.value?.trim();
    if(!name){toast('Enter a project name.');return false;}
    const copy=JSON.parse(JSON.stringify(doc));copy.id=uid();copy.name=name;
    copy.createdAt=new Date().toISOString();copy.updatedAt=copy.createdAt;
    setTimeout(()=>diRequestProjectSwitch(copy,'Save As new local project',{confirm:true}),0);
  }}
 ]);
 return body;
}
function newDocument(mode='flow',name='Untitled workspace',zoneTemplate='CUSTOM'){
 return diRequestProjectSwitch(blankDiagramIt(mode,name,zoneTemplate),'New project',{confirm:true});
}
function openProjectChooser(fromWelcome=false){
 let created=false;const body=modal('Create blank DiagramIt project',`<p class="modal-subtext">Choose the kind of diagram you want to create. Every new project starts blank—no sample shapes, arrows or site images.</p><div class="diagram-choices">${Object.entries(MODES).map(([k,v])=>`<button class="diagram-choice ${k==='flow'?'selected':''}" data-project-mode="${k}" style="border-width:${k==='flow'?'2px':'1px'}"><strong>${v.symbol} ${v.name}</strong><span>${v.desc}</span></button>`).join('')}</div><div class="prop-field"><label>Project name</label><input id="projectStartName" value="Untitled project"></div><div id="projectZoneRow" class="prop-field"><label>Architectural zone template</label><select id="projectZoneTemplate"><option value="RESIDENTIAL">Residential · KDG CAD Studio</option><option value="COMMERCIAL">Commercial · KDG CAD Studio</option><option value="INSTITUTIONAL">Institutional · KDG CAD Studio</option><option value="AIRPORT-PTB">Airport PTB · KDG CAD Studio</option><option value="INDUSTRIAL">Industrial · KDG CAD Studio</option><option value="MIXED-USE">Mixed-Use · KDG CAD Studio</option><option value="CUSTOM">Custom · basic blank zone library</option></select><p class="modal-subtext">Only category names and KDG colors are loaded; no rooms or bubbles are preloaded.</p></div>`,[{text:'Cancel'},{text:'Create blank project',primary:true,action:b=>{const mode=b.querySelector('.diagram-choice.selected')?.dataset.projectMode||'flow',name=b.querySelector('#projectStartName').value.trim()||'Untitled project';created=true;const zone=mode==='bubble'?b.querySelector('#projectZoneTemplate').value:'CUSTOM';
  // Close the chooser before showing the separate replacement confirmation.
  setTimeout(()=>{newDocument(mode,name,zone).then(ok=>{if(!ok&&fromWelcome)diShowStart(diHasSavedProject);});},0);}}],()=>{if(fromWelcome&&!created)diShowStart(diHasSavedProject);});
 body.querySelectorAll('[data-project-mode]').forEach(b=>b.onclick=()=>{body.querySelectorAll('[data-project-mode]').forEach(x=>{x.classList.remove('selected');x.style.borderWidth='1px'});b.classList.add('selected');b.style.borderWidth='2px';body.querySelector('#projectZoneRow').style.display=b.dataset.projectMode==='bubble'?'block':'none';});body.querySelector('#projectZoneRow').style.display='none';
}
/* --------- Layout: always compute separately and preview before committing. --------- */
function proposeLayout(){const pos={};const nodes=visibleNodes();if(!nodes.length)return pos;
if(page.mode==='flow'){
 const ids=new Set(nodes.map(n=>n.id)),incoming=new Map(nodes.map(n=>[n.id,0])),out=new Map(nodes.map(n=>[n.id,[]]));for(const e of page.edges){if(ids.has(e.from)&&ids.has(e.to)){incoming.set(e.to,incoming.get(e.to)+1);out.get(e.from).push(e.to);}}
 const roots=nodes.filter(n=>!incoming.get(n.id));if(!roots.length)roots.push(nodes[0]);const depth=new Map(),q=[];for(const n of roots){depth.set(n.id,0);q.push(n.id);}while(q.length){const id=q.shift(),d=depth.get(id);for(const dest of out.get(id)||[]){if(depth.has(dest))continue;depth.set(dest,d+1);q.push(dest);}}for(const n of nodes)if(!depth.has(n.id))depth.set(n.id,Math.max(0,...depth.values())+1);
 const layers=new Map();for(const n of nodes){const d=depth.get(n.id);if(!layers.has(d))layers.set(d,[]);layers.get(d).push(n);}const spacingPrimary=170,spacingOther=54;for(const [level,arr] of layers){arr.sort((a,b)=>layoutDirection==='down'?a.x-b.x:a.y-b.y);const total=arr.reduce((s,n)=>s+(layoutDirection==='down'?n.w:n.h)+spacingOther,0)-spacingOther;let cursor=-total/2+380;for(const n of arr){if(layoutDirection==='down'){pos[n.id]={x:cursor,y:level*spacingPrimary+80};cursor+=n.w+spacingOther;}else{pos[n.id]={x:level*275+80,y:cursor};cursor+=n.h+spacingOther;}}}
}else if(page.mode==='org'){
 const roots=page.nodes.filter(n=>!n.parentId||!byId(n.parentId));const leafGap=218,gapY=170;let counter=0;const dfs=(n,depth)=>{if(n.collapsed||!treeChildren(n.id).length){pos[n.id]={x:counter*leafGap,y:depth*gapY+80};counter++;return pos[n.id].x+n.w/2;}const centers=treeChildren(n.id).map(c=>dfs(c,depth+1));const cx=(centers[0]+centers.at(-1))/2;pos[n.id]={x:cx-n.w/2,y:depth*gapY+80};return cx;};for(const r of roots){dfs(r,0);counter+=.75;}if(layoutDirection==='right'){for(const n of nodes){const p=pos[n.id];if(p){pos[n.id]={x:p.y,y:p.x*.72};}}}
}else{
 const roots=page.nodes.filter(n=>!n.parentId||!byId(n.parentId));const childH=86,sideGap=240;let rootCursor=0;
 const weight=n=>n.collapsed?1:Math.max(1,treeChildren(n.id).reduce((s,k)=>s+weight(k),0));
 const assign=(n,depth,direction,midY)=>{const xpos=direction===1?390+depth*sideGap:390-depth*sideGap-n.w;pos[n.id]={x:xpos,y:midY-n.h/2};const children=n.collapsed?[]:treeChildren(n.id);if(!children.length)return;const total=children.reduce((s,c)=>s+weight(c),0)*childH;let cy=midY-total/2;for(const c of children){const h=weight(c)*childH;assign(c,depth+1,direction,cy+h/2);cy+=h;}};
 for(const root of roots){const children=treeChildren(root.id);const left=[],right=[];let wl=0,wr=0;for(const c of children){const w=weight(c);if(wr<=wl){right.push(c);wr+=w;}else{left.push(c);wl+=w;}}const mainY=260+rootCursor;pos[root.id]={x:390-root.w/2,y:mainY-root.h/2};for(const [side,group,weightSum] of [[1,right,wr],[-1,left,wl]]){let cy=mainY-weightSum*childH/2;for(const c of group){const h=weight(c)*childH;assign(c,1,side,cy+h/2);cy+=h;}}rootCursor+=(Math.max(wr,wl)+2)*childH;}}
// Prevent pinned nodes from being moved in proposal, and translate new layout toward old center.
 const arr=nodes.filter(n=>pos[n.id]&&!n.pinned);if(arr.length){const oldCX=arr.reduce((a,n)=>a+n.x+n.w/2,0)/arr.length,oldCY=arr.reduce((a,n)=>a+n.y+n.h/2,0)/arr.length;const newCX=arr.reduce((a,n)=>a+pos[n.id].x+n.w/2,0)/arr.length,newCY=arr.reduce((a,n)=>a+pos[n.id].y+n.h/2,0)/arr.length;for(const n of arr){pos[n.id].x+=oldCX-newCX;pos[n.id].y+=oldCY-newCY;}}for(const n of nodes)if(n.pinned)delete pos[n.id];return pos;}

/* Subtree-aware organization chart layout v0.4. Layout sizes and coordinates are preview-only until acceptance. */
function orgBranchStyle(n,settings){const own=n?.layoutStyle;if(own&&own!=='inherit')return own;return settings.style==='mixed'?(n?.parentId?'compact':'standard'):settings.style;}
function proposeOrgLayout(settings=orgSettings(),scopeRoot=null){const sizes={},pos={},lookup=new Map(page.nodes.map(n=>[n.id,n]));const included=new Set();const owner=scopeRoot?byId(scopeRoot):null;
const size=n=>({w:settings.uniform?settings.cardWidth:n.w,h:settings.uniform?Math.max(settings.cardHeight,Math.ceil((n.label||'').length/28)*18+36):n.h});
const orderKids=n=>{let children=treeChildren(n.id);if(settings.order==='alphabetical')children=children.slice().sort((a,b)=>a.label.localeCompare(b.label));return children;};
const build=(n,depth=0)=>{included.add(n.id);const sz=size(n);sizes[n.id]=sz;const kids=n.collapsed?[]:orderKids(n);const subs=kids.map(c=>build(c,depth+1));if(!subs.length)return{w:sz.w,h:sz.h,positions:{[n.id]:{x:0,y:0}},depth};
const style=orgBranchStyle(n,settings),compact=style==='compact'||style==='horizontal';const places={};
if(compact){const gap=style==='compact'?Math.max(16,settings.siblingGap*.6):settings.siblingGap,level=Math.max(42,settings.levelGap),totalHeight=subs.reduce((s,ch)=>s+ch.h,0)+Math.max(0,subs.length-1)*gap;
const width=sz.w+level+Math.max(...subs.map(c=>c.w));const height=Math.max(sz.h,totalHeight);Object.assign(places,{[n.id]:{x:0,y:(height-sz.h)/2}});let cy=(height-totalHeight)/2;for(const sub of subs){for(const [id,p] of Object.entries(sub.positions))places[id]={x:sz.w+level+p.x,y:cy+p.y};cy+=sub.h+gap;}return{w:width,h:height,positions:places};}
const gap=settings.siblingGap,level=settings.levelGap,childrenWidth=subs.reduce((s,c)=>s+c.w,0)+Math.max(0,subs.length-1)*gap,maxChildHeight=Math.max(...subs.map(c=>c.h)),width=Math.max(sz.w,childrenWidth),height=sz.h+level+maxChildHeight,childX=(width-childrenWidth)/2;let nx=childX;
for(const sub of subs){for(const [id,p] of Object.entries(sub.positions))places[id]={x:nx+p.x,y:sz.h+level+p.y};nx+=sub.w+gap;}
let px=settings.parentAlign==='left'?Math.max(0,childX):settings.parentAlign==='right'?Math.min(width-sz.w,childX+childrenWidth-sz.w):(width-sz.w)/2;places[n.id]={x:px,y:0};return{w:width,h:height,positions:places};};
const roots=owner?[owner]:page.nodes.filter(n=>!n.parentId||!lookup.has(n.parentId));const groups=roots.map(r=>build(r));let cursor=0;const mx=page.nodes.length?Math.min(...page.nodes.map(n=>n.x)):100,my=page.nodes.length?Math.min(...page.nodes.map(n=>n.y)):100;
for(let i=0;i<groups.length;i++){const grp=groups[i],anchor=owner?{x:owner.x-grp.positions[owner.id].x,y:owner.y-grp.positions[owner.id].y}:{x:mx+cursor,y:my};for(const [id,p] of Object.entries(grp.positions))pos[id]={x:anchor.x+p.x,y:anchor.y+p.y};cursor+=grp.w+settings.branchGap;}
if(!owner){const movable=page.nodes.filter(n=>pos[n.id]&&!n.pinned);if(movable.length){const oldCX=movable.reduce((s,n)=>s+n.x+n.w/2,0)/movable.length,oldCY=movable.reduce((s,n)=>s+n.y+n.h/2,0)/movable.length,newCX=movable.reduce((s,n)=>s+pos[n.id].x+(sizes[n.id]?.w||n.w)/2,0)/movable.length,newCY=movable.reduce((s,n)=>s+pos[n.id].y+(sizes[n.id]?.h||n.h)/2,0)/movable.length;for(const n of movable){pos[n.id].x+=oldCX-newCX;pos[n.id].y+=oldCY-newCY;}}}
for(const n of page.nodes)if(n.pinned){delete pos[n.id];delete sizes[n.id];}return{pos,sizes};}
function openOrgLayoutDialog(initialScope='all'){if(page.mode!=='org'){showLayoutPreview();return;}const selectedRoot=selected.size===1?[...selected][0]:null,initial=orgSettings(),scope=initialScope==='branch'&&selectedRoot?'branch':'all';
const dialog=modal('Organize team structure',`<p class="modal-subtext">Choose an arrangement, then preview. Layout respects the reporting hierarchy, subtree boundaries, sibling order and pinned shapes. The arrangement does not change who reports to whom.</p><div class="org-layout-grid"><label>Arrangement<select id="olStyle"><option value="standard">Standard · children below</option><option value="compact">Compact · stacked to right</option><option value="horizontal">Horizontal · to right</option><option value="mixed">Mixed · branch overrides</option></select></label><label>Scope<select id="olScope"><option value="all">Entire chart</option>${selectedRoot?'<option value="branch">Selected manager + descendants</option>':''}</select></label><label>Sibling spacing<input id="olSiblingGap" type="number" min="16" max="420"></label><label>Level spacing<input id="olLevelGap" type="number" min="16" max="420"></label><label>Department spacing<input id="olBranchGap" type="number" min="16" max="420"></label><label>Card width<input id="olCardWidth" type="number" min="120" max="520"></label><label>Card height<input id="olCardHeight" type="number" min="50" max="250"></label><label>Manager alignment<select id="olParentAlign"><option value="center">Centered</option><option value="left">Start aligned</option><option value="right">End aligned</option></select></label><label>Sibling order<select id="olOrder"><option value="manual">Keep existing order</option><option value="alphabetical">Alphabetical</option></select></label><label class="layout-checkbox"><input id="olUniform" type="checkbox"> Standardize card sizes</label></div><div id="olSummary" class="notice">Adjust parameters to preview.</div>`,[{text:'Cancel',action:()=>cancelPreview(false)},{text:'Apply layout',primary:true,action:()=>{const settings=read(),which=settings.scope==='branch'?selectedRoot:null;const result=proposeOrgLayout(settings,which);const hits=collisionPairs(result.pos,result.sizes);if(hits.length){toast(`${hits.length} collision(s) detected: unlock pinned cards or use a different spacing/arrangement.`);return false;}preview=null;orgPreviewSizes={};transact(()=>{page.orgLayout={...settings,scope:'all'};for(const n of page.nodes){if(result.pos[n.id]){n.x=Math.round(result.pos[n.id].x);n.y=Math.round(result.pos[n.id].y);}if(result.sizes[n.id]){n.w=Math.round(result.sizes[n.id].w);n.h=Math.round(result.sizes[n.id].h);}}});fitView();toast('Org-chart layout applied. ⌘Z restores the previous arrangement.');}}],()=>{preview=null;orgPreviewSizes={};renderCanvas();});
const names=['Style','Scope','SiblingGap','LevelGap','BranchGap','CardWidth','CardHeight','ParentAlign','Order','Uniform'];for(const k of names){const target=dialog.querySelector('#ol'+k),name=k.charAt(0).toLowerCase()+k.slice(1);target.type==='checkbox'?target.checked=!!initial[name]:target.value=k==='Scope'?scope:initial[name];}
function read(){const s={...initial};for(const k of names){const target=dialog.querySelector('#ol'+k),name=k.charAt(0).toLowerCase()+k.slice(1);s[name]=target.type==='checkbox'?target.checked:target.type==='number'?clamp(Number(target.value)||DEFAULT_ORG_LAYOUT[name],k==='CardWidth'?120:k==='CardHeight'?50:16,k==='CardWidth'?520:k==='CardHeight'?250:420):target.value;}return s;}
function rePreview(){const sett=read(),root=sett.scope==='branch'?selectedRoot:null,result=proposeOrgLayout(sett,root);preview=result.pos;orgPreviewSizes=result.sizes;const overlaps=collisionPairs(preview,orgPreviewSizes);dialog.querySelector('#olSummary').classList.toggle('layout-warning',overlaps.length>0);dialog.querySelector('#olSummary').textContent=`${overlaps.length?overlaps.length+' collision(s) · Unlock pinned shapes or adjust spacing. · ':''}Preview · ${Object.keys(preview).length} node(s) · ${sett.style} arrangement · ${Object.keys(result.sizes).length} size(s) · pinned nodes untouched. Teal dashed boxes show the proposed locations.`;renderCanvas();}
for(const input of dialog.querySelectorAll('input,select'))input.addEventListener('input',rePreview);rePreview();}

/* DiagramIt mind-map layout: subtree extent + branch-side balancing. */
function proposeMindLayout(settings=mindSettings(),scopeRoot=null){
 const pos={},roots=scopeRoot?[byId(scopeRoot)].filter(Boolean):page.nodes.filter(n=>!n.parentId||!byId(n.parentId));
 const kids=n=>(n.collapsed?[]:treeChildren(n.id)).slice().sort(settings.order==='alphabetical'?(a,b)=>a.label.localeCompare(b.label):()=>0);
 const space=clamp(settings.siblingGap,12,260),depthSpace=clamp(settings.levelGap,25,380),groupSpace=clamp(settings.branchGap,18,360);
 const spanCache=new Map();const span=n=>{if(spanCache.has(n.id))return spanCache.get(n.id);const cc=kids(n),childSpan=cc.reduce((t,c)=>t+span(c),0)+Math.max(0,cc.length-1)*space;const h=Math.max(n.h+space*.35,childSpan);spanCache.set(n.id,h);return h;};
 const assign=(n,depth,side,centerY,root)=>{const rootW=root.w,dir=side==='left'?-1:1;const x=dir>0?root.x+rootW+depthSpace+(depth-1)*(180+depthSpace):root.x-(depthSpace+ n.w)-(depth-1)*(180+depthSpace);
 pos[n.id]={x,y:centerY-n.h/2};const cc=kids(n),total=cc.reduce((t,c)=>t+span(c),0)+Math.max(0,cc.length-1)*space;let y=centerY-total/2;
 for(const c of cc){const h=span(c);assign(c,depth+1,side,y+h/2,root);y+=h+space;}};
 let top=scopeRoot?byId(scopeRoot)?.y||0:Math.min(...page.nodes.map(n=>n.y),120);
 for(const root of roots){const cc=kids(root);span(root);if(settings.style==='vertical'){ // Delegated to explicit orthogonal tree layout with natural node sizes.
  continue;}
 const centerY=top+Math.max(root.h,span(root))/2,rx=scopeRoot?root.x:Math.min(...page.nodes.map(n=>n.x),180)+370;
 pos[root.id]={x:rx,y:centerY-root.h/2};const rootPlace={...root,x:rx};
 if(settings.style==='radial'){
  // Spread the first-level subtrees around the root: each branch receives a polar sector.
  const count=Math.max(1,cc.length),weights=cc.map(c=>Math.max(1,Math.ceil(span(c)/(c.h+space))));const sum=weights.reduce((a,b)=>a+b,0),radius=Math.max(280,sum*25);
  let current=-Math.PI;for(let i=0;i<cc.length;i++){const c=cc[i],step=2*Math.PI*weights[i]/sum,theta=current+step/2;current+=step;
   const side=Math.cos(theta)<0?'left':'right',targetY=centerY+Math.sin(theta)*radius*.85;
   assign(c,1,side,targetY,rootPlace);
   // Move the complete branch outward along its own direction to retain radial balance.
   const nodes=[c.id,...descendants(c.id)];const desiredX=rx+root.w/2+Math.cos(theta)*radius;
   const delta=desiredX-(pos[c.id].x+c.w/2);for(const id of nodes)if(pos[id])pos[id].x+=delta;
  }
 }else{
  const left=[],right=[];let leftH=0,rightH=0;
  for(const c of cc){let side;
   if(settings.style==='one-sided')side=settings.side;
   else if(c.mindSide==='left'||c.mindSide==='right')side=c.mindSide;
   else side=rightH<=leftH?'right':'left';
   if(side==='left'){left.push(c);leftH+=span(c)+space;}else{right.push(c);rightH+=span(c)+space;}}
  for(const [group,dir] of [[left,'left'],[right,'right']]){const sum=group.reduce((t,c)=>t+span(c),0)+Math.max(0,group.length-1)*space;let y=centerY-sum/2;
   for(const c of group){const h=span(c);assign(c,1,dir,y+h/2,rootPlace);y+=h+space;}}
 }
 top+=Math.max(span(root),root.h)+groupSpace;
 }
 if(settings.style==='vertical'){
  const proxy={style:'standard',uniform:false,siblingGap:space,levelGap:depthSpace,branchGap:groupSpace,order:settings.order,parentAlign:'center',cardWidth:180,cardHeight:70};
  return proposeOrgLayout(proxy,scopeRoot).pos;
 }
 for(const n of page.nodes)if(n.pinned)delete pos[n.id];return pos;
}
function collisionPairs(pos,sizes={}){const visible=visibleNodes().filter(n=>pos[n.id]||n.pinned);const pairs=[];
 for(let i=0;i<visible.length;i++)for(let j=i+1;j<visible.length;j++){const a=visible[i],b=visible[j],ap=pos[a.id]||a,bp=pos[b.id]||b,as=sizes[a.id]||a,bs=sizes[b.id]||b;
 const w=Math.min(ap.x+as.w,bp.x+bs.w)-Math.max(ap.x,bp.x),h=Math.min(ap.y+as.h,bp.y+bs.h)-Math.max(ap.y,bp.y);
 if(w>3&&h>3)pairs.push([a.id,b.id]);}return pairs;}
function openMindLayoutDialog(initialScope='all'){if(page.mode!=='mind')return;
 const current=mindSettings(),chosen=selected.size===1?[...selected][0]:null;
 const d=modal('Organize mind map',`<p class="modal-subtext">Arrange ideas by hierarchy and available space. The dashed preview is reversible, and parent-child relationships remain unchanged.</p>
 <div class="mind-layout-presets"><label><input type="radio" name="mindStyle" value="balanced"> Balanced · two sides</label><label><input type="radio" name="mindStyle" value="radial"> Radial · branches around topic</label><label><input type="radio" name="mindStyle" value="one-sided"> One-sided · outline</label><label><input type="radio" name="mindStyle" value="vertical"> Vertical · tree</label></div>
 <div class="org-layout-grid"><label>Scope<select id="mlScope"><option value="all">Entire mind map</option>${chosen?'<option value="branch">Selected topic and descendants</option>':''}</select></label><label>One-sided direction<select id="mlSide"><option value="right">Branch right</option><option value="left">Branch left</option></select></label><label>Sibling spacing<input id="mlSiblingGap" type="number" min="12" max="260"></label><label>Hierarchy / depth spacing<input id="mlLevelGap" type="number" min="25" max="380"></label><label>Root / branch spacing<input id="mlBranchGap" type="number" min="18" max="360"></label><label>Ordering<select id="mlOrder"><option value="manual">Keep branch order</option><option value="alphabetical">Alphabetical</option></select></label></div>
 <div id="mlSummary" class="notice">Preparing preview…</div>`,[
 {text:'Cancel',action:()=>cancelPreview(false)},
 {text:'Apply arrangement',primary:true,action:()=>{const settings=read(),which=settings.scope==='branch'?chosen:null,next=proposeMindLayout(settings,which),hits=collisionPairs(next);if(hits.length){toast(`Layout has ${hits.length} collision(s); reduce spacing constraints or unpin nodes.`);return false;}preview=null;transact(()=>{page.mindLayout={...settings,scope:'all'};for(const n of page.nodes){if(next[n.id]){n.x=Math.round(next[n.id].x);n.y=Math.round(next[n.id].y);}}});fitView();toast('Mind-map arrangement applied. ⌘Z restores the previous positions.');}}
 ],()=>{preview=null;renderCanvas();});
 for(const radio of d.querySelectorAll('input[name=mindStyle]'))radio.checked=radio.value===current.style;
 for(const [field,val] of [['mlScope',initialScope==='branch'&&chosen?'branch':'all'],['mlSide',current.side],['mlSiblingGap',current.siblingGap],['mlLevelGap',current.levelGap],['mlBranchGap',current.branchGap],['mlOrder',current.order]])d.querySelector('#'+field).value=val;
 function read(){return{style:d.querySelector('input[name=mindStyle]:checked')?.value||'balanced',scope:d.querySelector('#mlScope').value,side:d.querySelector('#mlSide').value,siblingGap:clamp(Number(d.querySelector('#mlSiblingGap').value)||38,12,260),levelGap:clamp(Number(d.querySelector('#mlLevelGap').value)||96,25,380),branchGap:clamp(Number(d.querySelector('#mlBranchGap').value)||90,18,360),order:d.querySelector('#mlOrder').value};}
 function update(){const st=read(),positions=proposeMindLayout(st,st.scope==='branch'?chosen:null),hits=collisionPairs(positions);preview=positions;const msg=d.querySelector('#mlSummary');msg.textContent=`${Object.keys(positions).length} shape(s) · ${st.style} · ${hits.length} collision(s) · ${page.nodes.filter(n=>n.pinned).length} pinned`;
 msg.classList.toggle('layout-warning',hits.length>0);renderCanvas();}
 for(const inp of d.querySelectorAll('input,select'))inp.addEventListener('input',update);update();
}
function showLayoutPreview(){if(page.mode==='flow'&&[...flowSnapshot().effectiveCollapsed].length){toast('Expand subprocesses before automatic layout. Hierarchy-aware rearrangement follows in H3.');return;}if(!page.nodes.length){toast('Add shapes before arranging.');return;}if(page.mode==='org'){openOrgLayoutDialog();return;}preview=proposeLayout();renderCanvas();modal('Preview automatic layout',`<p class="modal-subtext">A dashed teal outline shows each proposed position. <strong>Accept layout</strong> moves eligible nodes in one undoable operation. Pinned nodes remain fixed. This first version uses a lightweight algorithm; crowded flows and loops may need manual adjustment.</p><div class="notice">Scope: entire current page · Direction: ${layoutDirection==='down'?'Top to bottom':'Left to right'} · Affected nodes: ${Object.keys(preview).length}</div>`,[{text:'Cancel',action:()=>cancelPreview()},{text:'Accept layout',primary:true,action:()=>{const next=preview;preview=null;transact(()=>{for(const n of page.nodes){if(next?.[n.id]){n.x=Math.round(next[n.id].x);n.y=Math.round(next[n.id].y);}}});fitView();toast('Layout applied. Use ⌘Z to restore previous positions.');}}],()=>cancelPreview(false));}
function cancelPreview(draw=true){preview=null;orgPreviewSizes={};if(draw)renderCanvas();}
/* -------- File validation, export and import -------- */
function validateDocument(d){if(!d||!((d.format==='DIAGRAMIT'&&(d.version===2||d.version===3))||(d.format==='SIMA-DIAGRAM'&&d.version===1))||!Array.isArray(d.pages)||!d.pages.length)throw Error('Unsupported diagram file. Open a DiagramIt v2/v3 or legacy SIMA Diagram v1 JSON project.');if(d.pages.length>100)throw Error('Too many pages.');
 // Outline structural preflight runs before existing note/annotation sanitizers.
 // Invalid outline metadata must not partially rewrite imported rich content.
 if(window.ThinkItOutline){for(const p of d.pages){if(p&&['mind','flow','org'].includes(p.mode))window.ThinkItOutline.auditPage(p);}}
 else if(d.pages.some(p=>p?.outlineSettings!==undefined||p?.nodes?.some(n=>n.dependencies!==undefined||n.outlineParentId!==undefined)))throw Error('Outline/WBS module unavailable: cannot safely open this project.');
 const pageIds=new Set();let count=0;for(const p of d.pages){if(!p?.id||!MODES[p.mode]||!Array.isArray(p.nodes)||!Array.isArray(p.edges))throw Error('Invalid page structure.');if(pageIds.has(p.id))throw Error('Duplicate page ID.');pageIds.add(p.id);if(p.mode==='bmc'&&(typeof p.id!=='string'||p.id.length>256||(p.bmcData!==undefined&&!businessModel.validModel(p.bmcData))))throw Error('Invalid Business Model Canvas page.');if(p.mode==='bubble'&&p.bubbleData){const b=p.bubbleData;if(!Array.isArray(b.spaces)||b.spaces.length>750||!b.relations||typeof b.relations!=='object'||!Array.isArray(b.flows)||b.flows.length>5000)throw Error('Invalid Bubble Diagram page.');}const ids=new Set();for(const n of p.nodes){if(!n.id||ids.has(n.id)||!Number.isFinite(n.x)||!Number.isFinite(n.y)||!(n.w>5&&n.w<20000)||!(n.h>5&&n.h<20000)||typeof n.label!=='string')throw Error('Invalid or duplicate node in '+p.name+'.');if(p.mode==='flow'&&n.flowActivity!==undefined){
 const v=n.flowActivity,fields=['responsible','participants','inputs','outputs','approvals','remarks'];
 if(!v||typeof v!=='object'||Array.isArray(v)||
    Object.keys(v).some(k=>!fields.includes(k)||typeof v[k]!=='string'||v[k].length>6000))
  throw Error('Invalid Flowchart activity details in '+p.name+'.');
}
ids.add(n.id);count++;}if(count>25000)throw Error('Project exceeds 25,000 node safety limit.');if(p.annotations!==undefined){if(!Array.isArray(p.annotations)||p.annotations.length>10000)throw Error('Invalid annotations');for(const a of p.annotations){if(!a.id||typeof a.label!=='string'||(a.html&&typeof a.html!=='string')||(a.html&&a.html.length>30000)||!(a.w>8&&a.w<20000)||!(a.h>8&&a.h<20000)||(a.parentId&&!ids.has(a.parentId)))throw Error('Invalid or orphaned annotation.');if(a.html){const tpl=document.createElement('template');tpl.innerHTML=a.html;a.html=sanitizeAnnotationMarkup(tpl.content);}else a.html=esc(a.label);}}const edgeIds=new Set();for(const e of p.edges){if(!e.id||edgeIds.has(e.id)||!(isFreeEdge(e)?['start','end'].every(k=>Number.isFinite(e[k]?.x)&&Number.isFinite(e[k]?.y)):ids.has(e.from)&&ids.has(e.to)))throw Error(`Connector ${e.id||'?'} in ${p.name} has a missing endpoint or duplicate ID.`);edgeIds.add(e.id);}for(const n of p.nodes){if(n.keepitFiles!==undefined){if(!Array.isArray(n.keepitFiles)||n.keepitFiles.length>100||n.keepitFiles.some(r=>!r||r.provider!=='keepit'||r.version!==1||!/^sha256:[a-f0-9]{64}$/.test(r.scope)||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(r.itemId)||!Number.isSafeInteger(r.revision)||r.revision<0||typeof r.label!=='string'||!r.label||r.label.length>160||!['file','note'].includes(r.kind)))throw Error('Invalid KeepIt file references in the project.');} }for(const n of p.nodes){if(p.mode==='mind'&&n.noteHtml!==undefined){if(typeof n.noteHtml!=='string'||n.noteHtml.length>MIND_NOTE_MAX_HTML)throw Error('Invalid or oversized mind topic note.');n.noteHtml=sanitizeMindNote(n.noteHtml);}}const nm=new Map(p.nodes.map(n=>[n.id,n]));const checked=new Set();for(const n of p.nodes){if(n.parentId&&!ids.has(n.parentId))throw Error(`Missing parent ${n.parentId} for ${n.id}`);}for(const n of p.nodes){if(checked.has(n.id))continue;if(!n.parentId||checked.has(n.parentId)){checked.add(n.id);continue;}const chain=[];const active=new Set();let a=n;while(a&&!checked.has(a.id)){if(active.has(a.id))throw Error('Circular parent hierarchy involving '+n.id);active.add(a.id);chain.push(a.id);a=a.parentId?nm.get(a.parentId):null;}for(const id of chain)checked.add(id);}}// T22-A: reject invalid outline data before accepting imported documents.
  // The dedicated browser module is loaded before this script in index.html.
  if(window.ThinkItOutline)window.ThinkItOutline.migrateDocument(d);

  if(!pageIds.has(d.activePageId))d.activePageId=d.pages[0].id;if(d.format==='SIMA-DIAGRAM'){d.format='DIAGRAMIT';d.version=2;d.migratedFrom='SIMA-DIAGRAM v1';}return d;}
function downloadBlob(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),12000);}
function baseName(){return(doc.name||'DiagramIt').replace(/[^\w-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,90)||'DiagramIt';}
// T24: a portable export must be acceptable to our own importer. Preflight a
// detached copy, never mutate an active document or imply a cloud file binding.
const DI_PORTABLE_MAX_BYTES=24*1024*1024;
function diPortableSnapshot(){
 if(!doc)throw Error('No open project to export.');
 const copy=JSON.parse(JSON.stringify({...doc,version:3,updatedAt:new Date().toISOString()}));
 const validated=validateDocument(copy);
 const blob=new Blob([JSON.stringify(validated)],{type:'application/json'});
 if(blob.size>DI_PORTABLE_MAX_BYTES)throw Error('Portable project exceeds the 24 MiB import limit. Your device-local work remains unchanged.');
 return {blob,filename:`${baseName()}.diagramit.json`};
}
function exportJson(){
 try{const output=diPortableSnapshot();downloadBlob(output.blob,output.filename);toast('Portable DiagramIt JSON copy downloaded.');return true;}
 catch(err){console.error('Portable project export rejected',err);toast('Project export blocked: '+err.message);return false;}
}
function staticSVG(){flowRenderPlan=page.mode==='flow'?flowGraphPlan():null;const ns=document.createElementNS.bind(document,SVG),b=bounds(),pad=58;const output=ns('svg');output.setAttribute('xmlns',SVG);output.setAttribute('width',String(Math.ceil(b.w+pad*2)));output.setAttribute('height',String(Math.ceil(b.h+pad*2)));output.setAttribute('viewBox',`${b.x-pad} ${b.y-pad} ${Math.max(20,b.w+pad*2)} ${Math.max(20,b.h+pad*2)}`);const defs=ns('defs'),marker=ns('marker'),mPath=ns('path');marker.setAttribute('id','arrowMarker');marker.setAttribute('viewBox','0 0 10 10');marker.setAttribute('refX','9');marker.setAttribute('refY','5');marker.setAttribute('markerWidth','7');marker.setAttribute('markerHeight','7');marker.setAttribute('orient','auto-start-reverse');mPath.setAttribute('d','M0 0 L10 5 L0 10 Z');mPath.setAttribute('fill','#38586D');marker.append(mPath);defs.append(marker);for(const kind of ['filled','open','diamond']){const m=ns('marker'),path=ns('path');m.setAttribute('id','diagramitArrow_'+kind);m.setAttribute('viewBox','0 0 12 12');m.setAttribute('refX',kind==='diamond'?'10':'11');m.setAttribute('refY','6');m.setAttribute('markerWidth','8');m.setAttribute('markerHeight','8');m.setAttribute('orient','auto-start-reverse');path.setAttribute('d',kind==='diamond'?'M1 6 L6 1 L11 6 L6 11 Z':'M1 1 L11 6 L1 11');path.setAttribute('fill',kind==='open'?'none':'#38586D');path.setAttribute('stroke','#38586D');path.setAttribute('stroke-width',kind==='open'?'1.7':'1');m.append(path);defs.append(m);}output.append(defs);const background=ns('rect');background.setAttribute('x',b.x-pad);background.setAttribute('y',b.y-pad);background.setAttribute('width',Math.max(20,b.w+pad*2));background.setAttribute('height',Math.max(20,b.h+pad*2));background.setAttribute('fill','#FFFFFF');output.append(background);const outEdges=ns('g'),outNodes=ns('g');output.append(outEdges,outNodes);visibleIdSet=new Set(visibleNodes().map(n=>n.id));for(const e of effectiveEdges())drawEdge(outEdges,e,true);for(const n of visibleNodes())drawNode(outNodes,n,true);for(const a of allAnnotations())if(page.mode!=='flow'||(flowFocusId()?!!a.parentId&&visibleIdSet.has(a.parentId):!a.parentId||visibleIdSet.has(a.parentId)))drawAnnotation(outNodes,a,true);return new XMLSerializer().serializeToString(output);}
function exportSvg(){if(page.mode==='bmc'){toast('Use Print / PDF to export this canvas.');return;}if(page.mode==='bubble'){bubbleExport('svg');return;}const data=staticSVG();downloadBlob(new Blob([data],{type:'image/svg+xml;charset=utf-8'}),`${baseName()}_${page.name.replace(/\W+/g,'_')}.svg`);toast('Current page exported as vector SVG.');}
async function exportPNG(){if(page.mode==='bmc'){toast('Use Print / PDF to export this canvas.');return;}if(page.mode==='bubble'){bubbleExport('png');return;}const data=staticSVG(),blob=new Blob([data],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob);try{const image=new Image();await new Promise((ok,fail)=>{image.onload=ok;image.onerror=fail;image.src=url;});const scale=2,w=Math.min(Math.ceil(image.width*scale),12000),h=Math.min(Math.ceil(image.height*scale),12000),c=document.createElement('canvas');c.width=w;c.height=h;const context=c.getContext('2d');context.drawImage(image,0,0,w,h);const png=await new Promise(resolve=>c.toBlob(resolve,'image/png'));if(!png)throw Error('Image encoding failed');downloadBlob(png,`${baseName()}_${page.name.replace(/\W+/g,'_')}.png`);toast('Current page exported as 2× PNG.');}catch(e){console.error(e);toast('PNG export failed. Use SVG export instead.');}finally{URL.revokeObjectURL(url);}}
function printPage(){if(page.mode==='bmc'){businessModel.print();return;}if(page.mode==='bubble'){bubbleExport('print');return;}const svg=staticSVG();const win=window.open('','_blank');if(!win){toast('Allow pop-ups to print or save as PDF.');return;}win.document.open();win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(page.name)} | DiagramIt</title><style>html,body{margin:0;padding:0;background:#fff}svg{width:100%;height:auto;max-height:96vh}body{display:flex;align-items:center;justify-content:center}@page{size:landscape;margin:9mm}@media print{svg{max-height:none;page-break-inside:avoid}}</style></head><body>${svg}</body></html>`);win.document.close();setTimeout(()=>{win.focus();win.print();},200);}
// An externally supplied project may share an ID with a different saved
// local revision. Never overwrite that record without a deliberate choice.
async function diResolveImportedProjectIdentity(incoming){
 const stored=typeof diReadSavedProject==='function'?await diReadSavedProject(incoming.id):null;
 if(!stored||stored.raw===JSON.stringify(incoming)||incoming.id===doc?.id)return incoming;
 return new Promise(resolve=>{
  let settled=false;const finish=value=>{if(!settled){settled=true;resolve(value);}};
  modal('Project identity already exists',`<p>Another local project already uses this project's internal ID: <strong>${esc(incoming.name||'Untitled project')}</strong>.</p><p class="modal-subtext">The incoming file and the saved project are different revisions. You may reopen the saved version or import this file as a separate project. A separate project keeps existing topic and note references; it does NOT duplicate linked KeepIt files.</p>`,[
   {text:'Cancel import',action:()=>finish(null)},
   {text:'Open saved version',action:()=>finish(validatedSnapshot(stored.raw))},
   {text:'Import as new project',primary:true,action:()=>{
     const copy=JSON.parse(JSON.stringify(incoming));copy.id=uid();copy.createdAt=new Date().toISOString();
     finish(copy);
   }}
  ],()=>finish(null));
 });
}
async function importFile(f,{confirm=false}={}){
 if(!f)return false;
 try{
  await diStorageReady;
  if(f.size>DI_PORTABLE_MAX_BYTES)throw Error('The selected project is over the 24 MB import limit.');
  const raw=await f.text(),incoming=validateDocument(JSON.parse(raw));
  // Some legacy SIMA files had no project-level ID. Assign one once, while
  // preserving all existing page, topic, dependency and KeepIt link IDs.
  if(!incoming.id)incoming.id=uid();
  const safe=await diResolveImportedProjectIdentity(incoming);
  if(!safe)return false;
  return await diRequestProjectSwitch(safe,'Open project file',{confirm});
 }catch(err){console.error(err);toast('Import rejected: '+err.message);return false;}
}
/* -------- Dialogs and palette -------- */
/* Mind Map long-form topic notes; this data is saved on nodes, never as map shapes.
   No cloud link is fabricated; exporting HTML/TXT is supported for external reuse. */
/* Mind Map note media + spreadsheet table core. No eval, no remote image loading. */
const MIND_NOTE_MAX_HTML=2200000;
const MIND_NOTE_MAX_IMAGE_URL=300000;
const MIND_NOTE_IMAGE_INPUT_MAX=15*1024*1024;
function mindCellAddress(row,col){let letters='',k=col+1;while(k>0){k--;letters=String.fromCharCode(65+k%26)+letters;k=Math.floor(k/26);}return letters+(row+1)}
function mindAddressIndex(address){const m=/^([A-Z]+)([1-9][0-9]*)$/.exec(String(address).toUpperCase());if(!m)return null;let c=0;for(const l of m[1])c=c*26+l.charCodeAt(0)-64;const r=Number(m[2]);if(c>16384||r>10000)return null;return [r-1,c-1]}
function mindReadFormulaTable(table){
  const rows=[...table.rows];const cache=new Map(),active=new Set();
  function cell(address){const idx=mindAddressIndex(address);return idx?rows[idx[0]]?.cells[idx[1]]:null}
  function fail(msg){throw Error(msg)}
  function numeric(value){if(typeof value==='number')return Number.isFinite(value)?value:fail('#NUM!');const s=String(value||'').trim();if(!s)return 0;const n=Number(s.replace(/,/g,''));if(!Number.isFinite(n))fail('#VALUE!');return n}
  function read(address){const norm=String(address).toUpperCase(),el=cell(norm);if(!el)fail('#REF!');if(cache.has(norm))return cache.get(norm);if(active.has(norm))fail('#CYCLE!');active.add(norm);let val;try{
    let f=el.getAttribute('data-formula');const text=el.textContent.trim();if(!f&&text.startsWith('='))f=text;
    val=f?expr(f.slice(1)):numeric(text);cache.set(norm,val);return val;
  }finally{active.delete(norm)}}
  function expr(raw){const source=String(raw||'');if(source.length>240)fail('#FORMULA!');const tokens=source.match(/\s*(?:[A-Za-z]+[0-9]+|[A-Za-z]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[+*\-/^():,])\s*/g)||[];
    if(tokens.join('').replace(/\s+/g,'')!==source.replace(/\s+/g,''))fail('#FORMULA!');const ts=tokens.map(x=>x.trim()),len=ts.length;let i=0;function take(){return ts[i++]};function peek(){return ts[i]};
    function atom(){const v=take();if(v===undefined)fail('#FORMULA!');if(v==='+'||v==='-')return (v==='-'?-1:1)*parse(35);
      if(v==='('){const n=parse(0);if(take()!==')')fail('#FORMULA!');return n;}
      if(/^\d/.test(v))return numeric(v);
      if(/^[A-Za-z]+[0-9]+$/.test(v))return read(v);
      if(/^[A-Za-z]+$/.test(v)){const name=v.toUpperCase();if(take()!=='(')fail('#FORMULA!');const values=[];
        if(peek()!==')')while(true){if(/^[A-Za-z]+[0-9]+$/.test(peek()||'')&&ts[i+1]===':'){
          const a=mindAddressIndex(take());take();const b=mindAddressIndex(take());if(!a||!b)fail('#REF!');const numCells=(Math.abs(b[0]-a[0])+1)*(Math.abs(b[1]-a[1])+1);if(numCells>500)fail('#RANGE!');
          for(let r=Math.min(a[0],b[0]);r<=Math.max(a[0],b[0]);r++)for(let c=Math.min(a[1],b[1]);c<=Math.max(a[1],b[1]);c++)values.push(read(mindCellAddress(r,c)));
        }else values.push(parse(0));if(peek()!==',')break;take();}
        if(take()!==')')fail('#FORMULA!');
        if(name==='SUM')return values.reduce((a,b)=>a+b,0);
        if(name==='AVERAGE'||name==='AVG')return values.length?values.reduce((a,b)=>a+b,0)/values.length:0;
        if(name==='MIN')return Math.min(...values);
        if(name==='MAX')return Math.max(...values);
        if(name==='COUNT')return values.length;
        if(name==='SQRT'&&values.length===1){if(values[0]<0)fail('#NUM!');return Math.sqrt(values[0])}
        fail('#FUNCTION!');}
      fail('#FORMULA!');}
    function parse(min){let x=atom();while(true){const op=peek(),prior={'+' : 10,'-':10,'*':20,'/':20,'^':40}[op];if(!prior||prior<min)break;take();const y=parse(prior+(op==='^'?0:1));if(op==='+')x+=y;else if(op==='-')x-=y;else if(op==='*')x*=y;else if(op==='/'){if(y===0)fail('#DIV/0!');x/=y}else x=Math.pow(x,y);if(!Number.isFinite(x))fail('#NUM!')}return x}
    const result=parse(0);if(i!==len)fail('#FORMULA!');return result;
  }
  const results=[];for(let r=0;r<rows.length;r++)for(let c=0;c<rows[r].cells.length;c++){
    const el=rows[r].cells[c],raw=el.getAttribute('data-formula')||(el.textContent.trim().startsWith('=')?el.textContent.trim():'');if(!raw)continue;
    const address=mindCellAddress(r,c);let result;try{result=read(address);if(Number.isFinite(result))result=Number(result.toPrecision(12)).toString()}catch(error){result=String(error.message||'#ERROR!')};results.push({el,address,result,formula:raw});
  }return results;
}
function mindRecalculateTables(root){for(const t of (root.matches?.('table')?[root,...root.querySelectorAll('table')]:root.querySelectorAll('table')))for(const row of mindReadFormulaTable(t)){row.el.setAttribute('data-formula',row.formula);if(row.el.textContent.trim()!==row.result)row.el.textContent=row.result;}}
async function mindCompressImage(file){
 if(!file||!/^image\/(jpeg|png|webp)$/i.test(file.type||''))throw Error('Use JPEG, PNG or WebP images.');
 if(file.size>MIND_NOTE_IMAGE_INPUT_MAX)throw Error('Image is over 15 MB. Please reduce its size.');
 const url=URL.createObjectURL(file);try{
  const im=new Image();await new Promise((ok,fail)=>{im.onload=ok;im.onerror=()=>fail(Error('Image could not be decoded'));im.src=url;});
  if(im.width*im.height>70e6)throw Error('Image dimensions are too large');
  const canvas=document.createElement('canvas'),scale=Math.min(1,1100/Math.max(im.width,im.height));canvas.width=Math.max(1,Math.round(im.width*scale));canvas.height=Math.max(1,Math.round(im.height*scale));
  canvas.getContext('2d').drawImage(im,0,0,canvas.width,canvas.height);
  for(const q of [.86,.74,.62,.48,.36]){const data=canvas.toDataURL('image/jpeg',q);if(data.length<=MIND_NOTE_MAX_IMAGE_URL)return data;}
  throw Error('Image remains too large after compression. Reduce it before inserting.');
 }finally{URL.revokeObjectURL(url)}
}

function sanitizeMindNote(input){
  const raw=String(input||'');if(raw.length>MIND_NOTE_MAX_HTML*1.3)throw Error('Topic note exceeds its safe 2.2 MB limit. Split it into smaller topics.');
  const tpl=document.createElement('template');tpl.innerHTML=raw;
  const allowed=new Set(['P','DIV','BR','H1','H2','H3','H4','B','STRONG','I','EM','U','S','STRIKE','UL','OL','LI','BLOCKQUOTE','CODE','PRE','A','SPAN','TABLE','THEAD','TBODY','TFOOT','TR','TD','TH','CAPTION','FIGURE','FIGCAPTION','IMG','FONT']);
  const blocked=new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','FORM','INPUT','BUTTON','SVG','MATH','VIDEO','AUDIO','CANVAS']);
  function walk(x){
    if(x.nodeType===3)return document.createTextNode(x.nodeValue);
    if(x.nodeType!==1)return document.createDocumentFragment();
    const tag=x.tagName;if(blocked.has(tag))return document.createDocumentFragment();
    if(!allowed.has(tag)){const f=document.createDocumentFragment();for(const child of x.childNodes)f.append(walk(child));return f;}
    const el=document.createElement(tag==='FONT'?'span':tag.toLowerCase());
    if(tag==='FONT'){const color=x.getAttribute('color');if(/^#[0-9a-f]{3,8}$/i.test(color||''))el.style.color=color;const family=x.getAttribute('face');if(['Arial','Georgia','Courier New','Verdana','Times New Roman'].includes(family))el.style.fontFamily=family;const size=Number(x.getAttribute('size'));if(size>=1&&size<=7)el.style.fontSize=({1:11,2:12,3:14,4:16,5:18,6:24,7:32}[size])+'px';}
    if(tag==='A'){const href=x.getAttribute('href')||'';if(/^(https?:\/\/|mailto:)/i.test(href)){el.setAttribute('href',href.slice(0,2048));el.setAttribute('rel','noopener noreferrer');}}
    if(tag==='IMG'){const src=x.getAttribute('src')||'';if(!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(src))return document.createDocumentFragment();if(src.length>MIND_NOTE_MAX_IMAGE_URL)throw Error('Oversized embedded image in note');el.setAttribute('src',src);el.setAttribute('alt',String(x.getAttribute('alt')||'').slice(0,300));}
    if(tag==='TD'||tag==='TH'){
      for(const attr of ['colspan','rowspan']){const n=Number(x.getAttribute(attr));if(Number.isInteger(n)&&n>=2&&n<=8)el.setAttribute(attr,String(n));}
      const formula=x.getAttribute('data-formula');if(formula){if(!formula.startsWith('=')||formula.length>240)throw Error('Invalid table formula');el.setAttribute('data-formula',formula);}
    }
    if(tag==='FIGURE'){
      const w=x.style.width;if(/^\d+(?:\.\d+)?%$/.test(w)&&+w.slice(0,-1)>=20&&+w.slice(0,-1)<=100)el.style.width=w;
      const align=x.style.textAlign;if(['left','center','right'].includes(align))el.style.textAlign=align;
    }
    if(['SPAN','P','DIV','H1','H2','H3','H4','BLOCKQUOTE'].includes(tag)){
      const st=x.style;for(const key of ['color','backgroundColor']){const v=st[key];if(/^#[0-9a-f]{3,8}$/i.test(v||'')||/^rgb\([\d\s,]+\)$/i.test(v||''))el.style[key]=v;}
      if(['left','right','center','justify'].includes(st.textAlign))el.style.textAlign=st.textAlign;
      if(/^(1[0123456789]|2[0-9]|3[0-2])px$/.test(st.fontSize))el.style.fontSize=st.fontSize;
      if(['Arial','Georgia','Courier New','Times New Roman','Verdana'].includes(st.fontFamily))el.style.fontFamily=st.fontFamily;
    }
    for(const child of x.childNodes)el.append(walk(child));return el;
  }
  const clean=document.createElement('div');for(const child of tpl.content.childNodes)clean.append(walk(child));
  if(clean.innerHTML.length>MIND_NOTE_MAX_HTML)throw Error('Topic note exceeds 2.2 MB. Please split it into smaller topics.');return clean.innerHTML;
}
function mindOutlineRows(){
  const rows=[],seen=new Set(),{children,roots}=hierarchyIndex();
  function append(start){
    const stack=[{node:start,depth:0}];
    while(stack.length){
      const {node,depth}=stack.pop();if(seen.has(node.id))continue;
      seen.add(node.id);rows.push({node,depth});
      const kids=children.get(node.id)||[];
      for(let i=kids.length-1;i>=0;i--)stack.push({node:kids[i],depth:depth+1});
    }
  }
  for(const root of roots)append(root);
  // Preserve export of disconnected/cyclic legacy components without recursion.
  for(const n of page.nodes)if(!seen.has(n.id))append(n);
  return rows;
}
function mindExportNotes(kind){if(page.mode!=='mind')return;const all=mindOutlineRows();const title=doc.name+' — '+page.name;
  if(kind==='html'){
    const contents=all.map(({node,depth})=>`<section style="margin-left:${Math.min(depth,12)*18}px"><h${Math.min(depth+1,6)}>${esc(node.label)}</h${Math.min(depth+1,6)}>${sanitizeMindNote(node.noteHtml||'')}</section>`).join('\n');
    const html=`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font:15px/1.55 Arial,sans-serif;max-width:850px;margin:40px auto;padding:16px;color:#173b50}section{margin-bottom:15px}a{color:#0d7475}h1,h2,h3{color:#0d2f4f}table{border-collapse:collapse;width:100%}th,td{border:1px solid #b5c8c8;padding:6px}figure{margin:14px auto}figure img{max-width:100%;height:auto}figcaption{text-align:center;color:#586e79;font-size:12px}table{border-collapse:collapse;width:100%;margin:14px 0;table-layout:fixed}th,td{border:1px solid #9bb6bb;padding:8px 10px;vertical-align:top;overflow-wrap:anywhere}th{background:#edf4f3}</style></head><body><h1>${esc(title)}</h1>${contents}</body></html>`;
    downloadBlob(new Blob([html],{type:'text/html;charset=utf-8'}),`${baseName()}_MindNotes.html`);
  }else{
    const plain=all.map(({node,depth})=>`${'  '.repeat(depth)}${node.label}\n${(node.noteHtml?(()=>{const d=document.createElement('div');d.innerHTML=sanitizeMindNote(node.noteHtml);return d.innerText||d.textContent||''})():'').trim()}`).join('\n\n');
    downloadBlob(new Blob([title+'\n\n'+plain],{type:'text/plain;charset=utf-8'}),`${baseName()}_MindNotes.txt`);
  }
  toast('Notes exported; project JSON retains the complete editable structure.');
}
function openMindNotes(initialId){
  const addReference=arguments[1]?.addReference===true;
  if(page.mode!=='mind'){toast('Outline & Notes is available for Mind Map pages.');return;}
  let nodes=mindOutlineRows();if(!nodes.length){toast('Add a Mind Map topic first.');return;}
  let active=nodes.some(x=>x.node.id===initialId)?initialId:(selected.size===1&&byId([...selected][0])?[...selected][0]:nodes[0].node.id);
  let dirty=false,saveTimer=null,closed=false,initialFileRequest=!!addReference;
  // Until a verified KeepIt service is connected, the original in-project
  // note is retained AND a separate durable device-local copy is queued.
  // No backend sync is claimed, and no note content is stripped from JSON.
  const localRevisions=new Map();let localWriteQueue=Promise.resolve(),loadGeneration=0,noteLock=false,syncRun=null;
  function hostConnection(){
    // The host must install this adapter after an owner-authorized connection
    // and guarantee its transport is a trusted same-origin/verified service.
    // A standalone file does not supply an adapter or silently reuse browser
    // credentials from the separate KeepIt origin.
    const host=window.ThinkItKeepItHost;
    return host&&host.authorized===true&&host.transport==='verified-keepit-host'&&host.adapter&&host.binding?host:null;
  }
  function refreshQueue(){
    const badge=body?.querySelector('#mindSyncBadge');if(!badge||closed)return;
    ThinkItLocalNotes.status(doc.id).then(count=>{
      if(closed)return;
      if(hosted&&byId(active)?.keepitLink?.itemId){badge.dataset.state='connected';badge.textContent='Native KeepIt note · original source retained';return;}
      const host=hostConnection();badge.dataset.state=count.attention?'attention':host?'connected':'';
      badge.textContent=(host?'KeepIt legacy sync linked':hosted?'Native KeepIt available via Edit with KeepIt · legacy local':'KeepIt not connected')+' · '+count.pending+' pending'+(count.claimed?' · '+count.claimed+' sending':'')+(count.attention?' · '+count.attention+' conflicts':'');
    }).catch(e=>{badge.dataset.state='attention';badge.textContent='Local queue status unavailable';});
  }
  function attemptSync(){
    const host=hostConnection();if(!host||closed||syncRun)return syncRun||Promise.resolve(null);
    syncRun=localWriteQueue.then(()=>ThinkItKeepItSync.synchronize({projectId:doc.id,binding:host.binding,adapter:host.adapter,
      vault:ThinkItLocalNotes,migration:ThinkItKeepItMigration,
      onVerified:({scope,ref,html})=>{
        // Do not retroactively link a topic that changed while the save ran.
        if(doc.id!==scope.projectId)return;
        const pg=doc.pages.find(p=>p.id===scope.pageId),n=pg?.nodes.find(x=>x.id===scope.topicId);
        if(!n||String(n.noteHtml||'')!==html)return;
        if(!n.keepitNote||n.keepitNote.revision<ref.revision)transact(()=>{n.keepitNote={...ref};});
        if(active===scope.topicId&&!dirty)setStatus('Saved on this device · verified in KeepIt');
      }})).then(result=>{refreshQueue();return result;}).catch(err=>{
      if(!closed&&!dirty)setStatus('KeepIt unavailable · local notes remain saved: '+err.message,true);
      refreshQueue();return null;
    }).finally(()=>{syncRun=null;});return syncRun;
  }
  function onReconnect(){refreshQueue();attemptSync();}

  function currentScope(topicId){return {projectId:doc.id,pageId:page.id,topicId};}
  function localBackup(){
    if(dirty&&!flush())return;
    localWriteQueue.then(()=>ThinkItLocalNotes.exportRecovery(doc.id)).then(blob=>{downloadBlob(blob,`${baseName()}_UNSYNCED_NOTES.json`);setStatus('Local recovery bundle downloaded · not a KeepIt cloud backup');})
    .catch(e=>setStatus('Cannot export local notes: '+e.message+' · export complete project JSON',true));
  }
  function stageLocal(n,html){
    const scope=currentScope(n.id),projectId=doc.id,id=n.id;
    // Queue writes in order even when the user switches topics rapidly.
    const task=()=>ThinkItLocalNotes.stage({...scope,html,subject:n.label,keepitNote:n.keepitNote||null},localRevisions.has(id)?localRevisions.get(id):null);
    const result=localWriteQueue.then(task).then(receipt=>{
      if(receipt.status==='conflict'){
        if(active===id&&!dirty)setStatus('Another local revision exists. This edit was retained as a recovery copy; export a backup.',true);
      }else{
        localRevisions.set(id,receipt.record.localRevision);
        if(active===id&&!dirty)setStatus('Saved on this device · awaiting KeepIt connection');
        refreshQueue();Promise.resolve().then(attemptSync);
      }
      return receipt;
    }).catch(err=>{if(active===id)setStatus('Device-local copy NOT verified: '+err.message+' · export full project JSON',true);return null;});
    localWriteQueue=result;
    return result;
  }

  const onProjectExport=event=>{event.detail.jobs.push(flush()?localWriteQueue:Promise.reject(Error('Resolve the current local note before project export.')));};
  window.addEventListener('thinkit-project-export',onProjectExport);
  const dispose=()=>{window.removeEventListener('thinkit-project-export',onProjectExport);window.removeEventListener('message',nativeMessage);window.removeEventListener('online',nativeOnline);closed=true;clearTimeout(saveTimer);document.removeEventListener('visibilitychange',onVisibility);window.removeEventListener('beforeunload',onBeforeUnload);window.removeEventListener('online',onReconnect);window.removeEventListener('thinkit-keepit-connected',onReconnect);};
  const body=modal('Mind Map · Outline & Notes',`<div class="mind-notes"><aside class="mind-notes-nav"><label class="field-note" for="mindSearch">FIND TOPIC OR NOTE</label><input id="mindSearch" placeholder="Search all topics and note text…" style="width:100%;margin:7px 0 10px"><div id="mindTopicCount" class="mind-topic-count" aria-live="polite"></div><div class="mind-topic-order" aria-label="Selected topic sequence"><button type="button" id="mindTopicEarlier" title="Move selected topic earlier among its siblings (⌘⇧↑)">↑ Earlier</button><button type="button" id="mindTopicLater" title="Move selected topic later among its siblings (⌘⇧↓)">↓ Later</button></div><div id="mindTopicList" role="tree" tabindex="0" aria-label="Mind Map topic outline"></div></aside><section class="mind-notes-editor"><div><strong id="mindTopicHeading"></strong><div class="field-note">Notes belong to the selected topic, not to an additional diagram shape. Changes autosave to the local project.</div></div><div class="mind-notes-tools"><button type="button" data-fmt="bold"><b>B</b></button><button type="button" data-fmt="italic"><i>I</i></button><button type="button" data-fmt="underline"><u>U</u></button><button type="button" data-fmt="strikeThrough"><s>S</s></button><select id="mindFont" aria-label="Font family"><option value="Arial">Arial</option><option value="Georgia">Georgia</option><option value="Verdana">Verdana</option><option value="Courier New">Mono</option></select><select id="mindSize" aria-label="Font size"><option value="12">12</option><option value="14" selected>14</option><option value="16">16</option><option value="18">18</option><option value="24">24</option></select><input id="mindTextColor" aria-label="Text color" title="Text color" type="color" value="#0d2f4f"><input id="mindHighlightColor" aria-label="Highlight color" title="Highlight color" type="color" value="#f0e49d"><button type="button" data-fmt="justifyLeft">Left</button><button type="button" data-fmt="justifyCenter">Center</button><button type="button" data-fmt="justifyRight">Right</button><button type="button" data-block="blockquote">Quote</button><button type="button" data-fmt="insertUnorderedList">• List</button><button type="button" data-fmt="insertOrderedList">1. List</button><button type="button" data-block="h2">Heading</button><button type="button" data-block="p">Paragraph</button><button type="button" data-fmt="createLink">Link</button><button type="button" id="mindInsertTable" class="mind-note-table-action">+ Table 3×3</button><button type="button" id="mindAddTableRow" class="mind-note-table-action" title="Add row after current table row">+ Row</button><button type="button" id="mindAddTableCol" class="mind-note-table-action" title="Add column after current table column">+ Column</button><button type="button" id="mindInsertImage">+ Image</button><input type="file" id="mindImageFile" accept="image/png,image/jpeg,image/webp" hidden></div><div id="mindFormulaBar" class="mind-formula-bar"><span id="mindCellAddress" class="mind-cell-address">—</span><input id="mindFormulaInput" aria-label="Cell value or formula" placeholder="Select a table cell · =A2*B2 or =SUM(C2:C8)"><button type="button" id="mindFormulaApply">Apply</button></div><div id="mindFigureBar" class="mind-figure-tools" hidden><label>Image width % <input id="mindFigureWidth" type="number" min="20" max="100" value="75"></label><button type="button" id="mindFigureAlt">Alt text</button><span>Click a picture to resize; edit caption below it</span></div><div id="mindLocalRecovery" class="mind-local-recovery" hidden><span id="mindLocalRecoveryMessage">A different local note was found.</span><button type="button" id="mindUseLocal">Restore local note</button><button type="button" id="mindUseProject">Keep project note</button></div><div id="mindNoteEditor" class="mind-notes-area" contenteditable="true" role="textbox" aria-multiline="true" spellcheck="true" data-placeholder="Write detailed notes for this topic..."></div><div class="mind-notes-footer"><span class="mind-notes-status" id="mindNoteStatus" role="status" aria-live="polite">Ready</span><span class="mind-sync-badge" id="mindSyncBadge" title="Durable device-local note queue and KeepIt connection status">KeepIt: checking local queue…</span><button type="button" class="mind-notes-action" id="mindLocalBackup" title="Save unsynced local notes including embedded images to a separate recovery file">Local backup</button><button type="button" class="mind-notes-action" id="mindExportHtml">Export HTML</button><button type="button" class="mind-notes-action" id="mindExportTxt">Export TXT</button><button type="button" class="mind-notes-action" id="mindDiscard">Revert draft</button><button type="button" class="mind-notes-action primary-note" id="mindSave">Save now</button></div></section></div>`,[{text:'Close'}],dispose);
  const editor=body.querySelector('#mindNoteEditor'),topicList=body.querySelector('#mindTopicList'),search=body.querySelector('#mindSearch'),status=body.querySelector('#mindNoteStatus');
  const setStatus=(t,error=false)=>{status.textContent=t;status.dataset.error=error?'true':'false';status.dataset.state=t.startsWith('Saved on this device')?'pending':'';};
  // Only a same-origin parent may host native KeepIt messages. Private QA is
  // served over 127.0.0.1 HTTP; it is a trustworthy local origin in Chrome,
  // just like localhost. Non-loopback HTTP and cross-origin frames fail closed.
  function isTrustedEmbeddedKeepItHost(){
    if(window.parent===window)return false;
    const secure=location.protocol==='https:';
    const loopback=location.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(location.hostname);
    if(!secure&&!loopback)return false;
    try{return window.parent.location.origin===location.origin;}catch{return false;}
  }
  // Trusted same-origin KeepIt host. An edit intent is not a remote save receipt.
  const nativeRequests=new Map();
  const nativeButton=document.createElement('button');nativeButton.type='button';nativeButton.id='mindOpenKeepItNative';nativeButton.className='mind-notes-action';nativeButton.textContent='Edit with KeepIt';
  nativeButton.title='Open the actual KeepIt Notes editor without switching applications. Existing embedded ThinkIt notes remain available for safe migration.';
  const existingButton=document.createElement('button');existingButton.type='button';existingButton.id='mindLinkExistingKeepItNote';existingButton.className='mind-notes-action';existingButton.textContent='Link existing KeepIt note';
  existingButton.title='Choose a note already saved in this KeepIt library. Its content will not be changed or copied.';
  const fileButton=document.createElement('button');fileButton.type='button';fileButton.id='mindReferenceKeepItFile';fileButton.className='mind-notes-action';fileButton.textContent='+ KeepIt file reference';
  fileButton.title='Link a saved KeepIt file to this topic without copying its bytes.';
  const fileSection=document.createElement('section');fileSection.className='mind-native-file-references';fileSection.id='mindKeepItFileReferences';
  const fileHeading=document.createElement('strong');fileHeading.textContent='Referenced KeepIt files';
  const fileList=document.createElement('div');fileList.className='mind-native-file-list';
  fileSection.append(fileHeading,fileList);
  body.querySelector('.mind-notes-footer').before(fileSection);
  const fileRefValid=ref=>!!ref&&ref.provider==='keepit'&&ref.version===1&&/^sha256:[a-f0-9]{64}$/.test(ref.scope)&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(ref.itemId)&&Number.isSafeInteger(ref.revision)&&ref.revision>=0&&typeof ref.label==='string'&&ref.label.length>0&&ref.label.length<=160&&['note','file'].includes(ref.kind);
  // This operation is pure: never changes the original KeepIt file or the
  // primary note, and never mutates the input references.
  function changeMapFileReference(refs,reference,action,label){
    if(!Array.isArray(refs)||refs.length>100||refs.some(r=>!fileRefValid(r))||!fileRefValid(reference))throw Error('Invalid KeepIt file references; original links retained.');
    const same=r=>r.itemId===reference.itemId&&r.scope===reference.scope;
    if(refs.filter(same).length!==1)throw Error('Missing or duplicated file link identity requires review.');
    if(action==='remove')return refs.filter(r=>!same(r)).map(r=>({...r}));
    if(action==='rename'){
      if(typeof label!=='string'||!label.trim()||label.trim().length>160||/[\u0000-\u001f\u007f]/.test(label))throw Error('Use a display label of 1–160 printable characters.');
      return refs.map(r=>same(r)?{...r,label:label.trim()}:{...r});
    }
    throw Error('Unsupported reference operation.');
  }
  // File-link management alters only the ThinkIt map pointer. KeepIt originals
  // and the primary native note are never deleted or renamed by these actions.
  function editFileRef(reference,action){
    const n=byId(active);
    if(!n||!Array.isArray(n.keepitFiles)||!fileRefValid(reference))return setStatus('The selected file reference is unavailable; nothing was changed.',true);
    const live=n.keepitFiles.find(r=>r.itemId===reference.itemId&&r.scope===reference.scope);
    if(!live)return setStatus('The file reference changed. Reopen topic notes to review it.',true);
    let label;
    if(action==='rename'){
      label=window.prompt('Display label in ThinkIt only (the original KeepIt filename stays unchanged):',live.label);
      if(label===null)return;
      label=label.trim();
      if(!label||label.length>160||/[\u0000-\u001f\u007f]/.test(label))return setStatus('Use a display label of 1–160 printable characters.',true);
    }else if(action==='remove'){
      if(!window.confirm('Remove this reference from the Mind Map topic? The original KeepIt file is NOT deleted.'))return;
    }else return;
    try{
      const updated=changeMapFileReference(n.keepitFiles,reference,action,label);
      transact(()=>{n.keepitFiles=updated;});
      redrawFileRefs();
      Promise.resolve(persist({manual:true})).then(saved=>{
        if(saved===true)setStatus(action==='remove'?'Topic reference removed. Original KeepIt file retained.':'ThinkIt display label saved. Original KeepIt filename unchanged.');
        else setStatus('Change is not confirmed saved. Keep the project open and export a local backup.',true);
      }).catch(error=>setStatus('Change is not confirmed saved: '+error.message,true));
    }catch(error){setStatus(error.message,true);}
  }
  function redrawFileRefs(){
    const node=byId(active),refs=Array.isArray(node?.keepitFiles)?node.keepitFiles:[];
    fileList.replaceChildren();fileSection.hidden=!hosted;
    for(const ref of refs){const line=document.createElement('div');line.className='mind-native-file-row';
      const button=document.createElement('button');button.type='button';button.className='mind-notes-action';button.textContent='Open · '+String(ref.label||'Unlabeled');
      button.disabled=!fileRefValid(ref);
      button.title='Open this reference in the original KeepIt library; no file copy is stored in ThinkIt.';
      button.onclick=()=>requestNativeAction('open-file',{reference:ref},'Opening referenced KeepIt file…');
      line.append(button);
      const rename=document.createElement('button');rename.type='button';rename.className='mind-notes-action';rename.textContent='Rename label';rename.disabled=!fileRefValid(ref);
      rename.title='Changes only the display label in ThinkIt; KeepIt is not modified.';
      rename.onclick=()=>editFileRef(ref,'rename');line.append(rename);
      const remove=document.createElement('button');remove.type='button';remove.className='mind-notes-action';remove.textContent='Remove link';remove.disabled=!fileRefValid(ref);
      remove.title='Unlink this topic; the original KeepIt file is retained.';
      remove.onclick=()=>editFileRef(ref,'remove');line.append(remove);
      fileList.append(line);
    }
    if(!refs.length){const empty=document.createElement('p');empty.className='field-note';empty.textContent='No KeepIt files linked to this topic.';fileList.append(empty);}
  }
  const hosted=isTrustedEmbeddedKeepItHost();
  if(hosted){body.querySelector('#mindSave').before(nativeButton,existingButton,fileButton);}
  // A linked topic has ONE editable note: the native KeepIt record. ThinkIt's
  // noteHtml remains a recoverable pre-link snapshot, not a second live editor.
  const linkedView=document.createElement('section');linkedView.id='mindNativeLinkedView';
  linkedView.className='mind-native-linked-view';linkedView.hidden=true;
  const linkedHeading=document.createElement('strong');linkedHeading.textContent='Current note is in KeepIt';
  const linkedDescription=document.createElement('p');linkedDescription.textContent='Open KeepIt to view or change the current note. This ThinkIt panel is not a synchronized copy.';
  const legacyToggle=document.createElement('button');legacyToggle.type='button';legacyToggle.className='mind-notes-action';
  legacyToggle.textContent='View retained original (read-only)';
  const legacyDescription=document.createElement('p');legacyDescription.className='field-note';
  legacyDescription.textContent='Original ThinkIt content is preserved for recovery. It is not updated when the KeepIt note changes.';
  linkedView.append(linkedHeading,linkedDescription,legacyToggle,legacyDescription);
  body.querySelector('.mind-notes-tools').before(linkedView);
  let legacyVisible=false;
  legacyToggle.onclick=()=>{legacyVisible=!legacyVisible;nativeAuthority();};
  function nativeAuthority(){
    const n=byId(active),linked=hosted&&!!n?.keepitLink?.itemId;
    const hasLegacy=!!String(n?.noteHtml||'').trim();
    if(linked){noteLock=true;editor.contentEditable='false';}
    linkedView.hidden=!linked;
    legacyToggle.hidden=!linked||!hasLegacy;
    legacyDescription.hidden=!linked||!hasLegacy||!legacyVisible;
    legacyToggle.textContent=legacyVisible?'Hide retained original':'View retained original (read-only)';
    editor.hidden=linked&&!(legacyVisible&&hasLegacy);
    body.querySelector('.mind-notes-tools').hidden=linked;
    body.querySelector('#mindFormulaBar').hidden=linked;
    body.querySelector('#mindFigureBar').hidden=linked||body.querySelector('#mindFigureBar').hidden;
    body.querySelector('#mindDiscard').hidden=linked;
    body.querySelector('#mindExportHtml').hidden=linked;
    body.querySelector('#mindExportTxt').hidden=linked;
    if(linked){linkedView.append(nativeButton);nativeButton.textContent='Open current note in KeepIt';}
    else if(hosted){body.querySelector('#mindSave').before(nativeButton,existingButton);nativeButton.textContent='Create note in KeepIt';}
    if(hosted)body.querySelector('#mindSave').before(fileButton);
    existingButton.hidden=!hosted||linked;
    fileButton.hidden=!hosted;
    redrawFileRefs();
    for(const control of body.querySelectorAll('[data-fmt],[data-block],#mindFont,#mindSize,#mindTextColor,#mindHighlightColor,#mindInsertTable,#mindAddTableRow,#mindAddTableCol,#mindInsertImage,#mindFormulaInput,#mindFormulaApply,#mindSave'))control.disabled=linked;
    if(linked)setStatus('Current note is in KeepIt · original ThinkIt content retained for recovery');
    refreshQueue();
  }
  let nativeReconnectNeeded=false;
  const nativeOnline=()=>{if(nativeReconnectNeeded&&!closed&&!nativeButton.disabled){nativeReconnectNeeded=false;nativeButton.click();}};
  window.addEventListener('online',nativeOnline);
  async function nativeMessage(event){
    if(!hosted||event.source!==window.parent||event.origin!==location.origin||event.data?.channel!=='thinkit-native-note-v1')return;
    const data=event.data;
    if(data.type==='library-ready'){nativeOnline();return;}
    if(data.type==='link-file'&&typeof data.requestId==='string'){
      const r=data.record,ref=r?.reference;
      const topic=doc.pages.find(p=>p.id===r?.pageId)?.nodes.find(n=>n.id===r?.topicId);
      const valid=r?.projectId===doc.id&&topic&&fileRefValid(ref)&&
        (!topic.keepitLink?.scope||topic.keepitLink.scope===ref.scope)&&
        (topic.keepitFiles===undefined||Array.isArray(topic.keepitFiles));
      if(!valid){window.parent.postMessage({channel:'thinkit-native-note-v1',type:'link-failed',requestId:data.requestId,message:'The topic, file reference, or library changed; nothing was linked.'},location.origin);return;}
      try{
        const refs=topic.keepitFiles||[];
        if(refs.length>=100)throw Error('This topic has reached the 100-file-reference limit.');
        if(!refs.some(x=>x.itemId===ref.itemId&&x.scope===ref.scope))transact(()=>{topic.keepitFiles=[...refs,{...ref}];});
        const saved=await persist({manual:true});
        if(saved!==true)throw Error('The ThinkIt file reference could not be saved on this device.');
        window.parent.postMessage({channel:'thinkit-native-note-v1',type:'file-link-stored',requestId:data.requestId,noteId:ref.itemId,scope:ref.scope},location.origin);
        if(topic.id===active)redrawFileRefs();
      }catch(error){window.parent.postMessage({channel:'thinkit-native-note-v1',type:'link-failed',requestId:data.requestId,message:String(error.message||error)},location.origin);}
      return;
    }
    if(data.type==='link-note'&&typeof data.requestId==='string'){
      const r=data.record;
      const valid=r&&r.projectId===doc.id&&doc.pages.some(p=>p.id===r.pageId&&p.nodes.some(n=>n.id===r.topicId))&&/^[a-f0-9-]{36}$/i.test(r.noteId||'')&&r.reference?.provider==='keepit'&&r.reference.version===1&&r.reference.itemId===r.noteId&&/^sha256:[a-f0-9]{64}$/.test(r.reference.scope)&&Number.isSafeInteger(r.reference.revision)&&r.reference.revision>=0;
      if(!valid){window.parent.postMessage({channel:'thinkit-native-note-v1',type:'link-failed',requestId:data.requestId,message:'The project/topic changed; the native note draft remains in KeepIt.'},location.origin);return;}
      try{
        const n=doc.pages.find(p=>p.id===r.pageId).nodes.find(n=>n.id===r.topicId);
        if(r.migration){
          const source=String(n.noteHtml||''),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source)))].map(b=>b.toString(16).padStart(2,'0')).join('');
          if(r.migration.state!=='verified'||hash!==r.migration.sourceHash||source!==String(n.noteHtml||'')||doc.id!==r.projectId||doc.pages.find(p=>p.id===r.pageId)?.nodes.find(x=>x.id===r.topicId)!==n)throw Error('The source topic changed during migration; both sources and the native note were retained for review.');
        }
        // Only the stable identity is linked; no claim of synchronized note content.
        if(n.keepitLink?.itemId&&(n.keepitLink.itemId!==r.noteId||n.keepitLink.scope!==r.reference.scope))throw Error('Topic already linked to a different KeepIt note or library');
        transact(()=>{n.keepitLink={provider:'keepit',version:1,scope:r.reference.scope,itemId:r.noteId,revision:r.reference.revision,linkedAt:new Date().toISOString()};});
        Promise.resolve(persist({manual:true})).then(saved=>{
          if(saved!==true)throw Error('ThinkIt project link could not be saved on this device');
          window.parent.postMessage({channel:'thinkit-native-note-v1',type:'link-stored',requestId:data.requestId,noteId:r.noteId,scope:r.reference.scope},location.origin);
        }).catch(error=>window.parent.postMessage({channel:'thinkit-native-note-v1',type:'link-failed',requestId:data.requestId,message:String(error.message||error)},location.origin));
      }catch(error){window.parent.postMessage({channel:'thinkit-native-note-v1',type:'link-failed',requestId:data.requestId,message:String(error.message||error)},location.origin);}
    }
    if(data.type==='note-linked'&&nativeRequests.has(data.requestId)){
      nativeRequests.delete(data.requestId);nativeButton.disabled=false;existingButton.disabled=false;fileButton.disabled=false;
      nativeAuthority();
      setStatus('Existing KeepIt note linked. You can add supporting PDFs or other KeepIt files without opening the note editor.');
      return;
    }
    if(['file-reference-added','selection-cancelled','file-opened'].includes(data.type)&&nativeRequests.has(data.requestId)){
      nativeRequests.delete(data.requestId);
      fileButton.disabled=false;existingButton.disabled=false;nativeButton.disabled=false;
      if(data.type==='file-reference-added'){redrawFileRefs();setStatus('KeepIt file reference saved with this Mind Map topic.');}
      else if(data.type==='selection-cancelled')setStatus('No selection made; existing notes and files are unchanged.');
      else setStatus('Opened the file in KeepIt.');
      return;
    }
    if((data.type==='note-opened'||data.type==='error')&&nativeRequests.has(data.requestId)){
      const requestType=nativeRequests.get(data.requestId);nativeRequests.delete(data.requestId);nativeButton.disabled=false;existingButton.disabled=false;fileButton.disabled=false;
      if(data.type==='error'&&requestType==='open-file'){setStatus('Referenced KeepIt file cannot be opened. The link is preserved for review: '+data.message,true);}
      else if(data.type==='error'){nativeReconnectNeeded=/library unavailable|synchronization|connection|reconnect/i.test(data.message);setStatus('KeepIt editor unavailable · original note kept locally: '+data.message,true);}
      else{
        nativeAuthority();
        // KeepIt's native editor is now visible. Do not leave a second,
        // non-updating ThinkIt notes dialog layered behind it.
        if(activeModal?.body===body)activeModal.close();
      }
    }
  }
  window.addEventListener('message',nativeMessage);
  async function requestNativeAction(type,additional={},description='Opening KeepIt…'){
    if(!flush())return;
    const button=type==='link-existing-note'?existingButton:type==='link-file'||type==='open-file'?fileButton:nativeButton;
    button.disabled=true;setStatus(description);
    try{
      await localWriteQueue;
      const n=byId(active);if(!n)throw Error('Selected topic missing');
      if(type==='link-existing-note'&&n.keepitLink?.itemId)throw Error('This topic already has a KeepIt note. It was not replaced.');
      const requestId=crypto.randomUUID();nativeRequests.set(requestId,type);
      window.parent.postMessage({channel:'thinkit-native-note-v1',type,requestId,projectId:doc.id,pageId:page.id,topicId:n.id,
        ...(type==='open-note'?{title:n.label,noteId:n.keepitLink?.itemId||null,reference:n.keepitLink?.version===1?n.keepitLink:null,sourceHTML:n.keepitLink?undefined:String(n.noteHtml||'')}:{...additional})},location.origin);
      setTimeout(()=>{if(nativeRequests.has(requestId)){nativeRequests.delete(requestId);button.disabled=false;setStatus('KeepIt request timed out; existing project content is retained.',true);}},30000);
    }catch(error){button.disabled=false;setStatus('Cannot use KeepIt: '+error.message,true);}
  }
  nativeButton.onclick=()=>requestNativeAction('open-note',{},'Opening the native KeepIt editor…');
  existingButton.onclick=()=>requestNativeAction('link-existing-note',{},'Choose an existing note in KeepIt…');
  fileButton.onclick=()=>requestNativeAction('link-file',{},'Choose a KeepIt file reference…');

  // TH-L3: Build text search once, update the edited topic after a save.
  // The source objects and KeepIt references remain unchanged.
  const topicIndex=new Map(nodes.map(({node})=>[node.id,(String(node.label||'')+' '+String(node.noteHtml||'').replace(/<[^>]*>/g,' ')).toLocaleLowerCase()]));
  const topicById=new Map(nodes.map(({node})=>[node.id,node]));
  const hasTopicChildren=new Set(nodes.map(({node})=>node.parentId).filter(Boolean));
  const siblingCounts=new Map(),topicPositions=new Map();
  function refreshTopicOrder(){
    nodes=mindOutlineRows();siblingCounts.clear();topicPositions.clear();
    for(const {node} of nodes){const parent=node.parentId||'';const position=(siblingCounts.get(parent)||0)+1;siblingCounts.set(parent,position);topicPositions.set(node.id,{parent,position});}
  }
  refreshTopicOrder();
  function reorderTopic(delta,id=active){
    if(search.value.trim()){setStatus('Clear the search before changing topic sequence.');return;}
    if(!flush())return;
    if(!moveMindTopic(id,delta))return;
    refreshTopicOrder();focusedTopicId=id;
    if(active!==id)loadNote(id);else showList({reveal:true});
    revealTopic(id);setStatus('Topic sequence updated · saving on this device');
  }
  body.querySelector('#mindTopicEarlier').onclick=()=>reorderTopic(-1);
  body.querySelector('#mindTopicLater').onclick=()=>reorderTopic(1);
  const topicCount=body.querySelector('#mindTopicCount');
  let filteredTopics=[],filteredPositions=new Map(),focusedTopicId=active,topicTyped="",topicTypedAt=0;
  function topicWindow(){
    const range=mindOutlineWindow(filteredTopics.length,topicList.scrollTop,topicList.clientHeight||340,38,7);
    topicList.replaceChildren();
    if(range.top)dom('div','mind-virtual-spacer',undefined,topicList).style.height=range.top+'px';
    for(let i=range.start;i<range.end;i++){
      const {node,depth}=filteredTopics[i];
      const row=dom('div','mind-notes-row'+(node.id===active?' active':''),undefined,topicList);
      row.dataset.mindNode=node.id;row.dataset.topicIndex=String(i);
      row.setAttribute('role','treeitem');row.setAttribute('aria-level',String(depth+1));
      row.setAttribute('aria-selected',String(node.id===active));
      row.setAttribute('aria-posinset',String(topicPositions.get(node.id)?.position||1));
      row.setAttribute('aria-setsize',String(siblingCounts.get(topicPositions.get(node.id)?.parent)||1));
      if(hasTopicChildren.has(node.id))row.setAttribute('aria-expanded',String(!node.collapsed));
      row.tabIndex=node.id===focusedTopicId?0:-1;
      row.style.paddingLeft=(8+Math.min(depth,12)*14)+'px';
      if(hasTopicChildren.has(node.id)){
        const tog=dom('button','mind-topic-toggle',node.collapsed?'▸':'▾',row);tog.type='button';
        tog.dataset.mindCollapse=node.id;tog.tabIndex=-1;
        tog.setAttribute('aria-label',node.collapsed?'Expand '+node.label:'Collapse '+node.label);
        tog.setAttribute('aria-expanded',String(!node.collapsed));
      }else dom('span','indent-marker','·',row);
      dom('span','mind-topic-label',node.label,row).title=node.label;
      if(node.noteHtml?.trim()||node.keepitLink?.itemId)dom('span','node-note-icon','▤',row).setAttribute('aria-label','Has linked note');
    }
    if(range.bottom)dom('div','mind-virtual-spacer',undefined,topicList).style.height=range.bottom+'px';
  }
  function showList({reveal=false}={}){
    const q=search.value.trim();
    body.querySelector('#mindTopicEarlier').disabled=!!q||!canMoveMindTopic(active,-1);
    body.querySelector('#mindTopicLater').disabled=!!q||!canMoveMindTopic(active,1);
    filteredTopics=mindNavigationRows(nodes,q,topicIndex);
    filteredPositions=new Map(filteredTopics.map((r,i)=>[r.node.id,i]));
    topicCount.textContent=q?`${filteredTopics.length} topics in search paths · ${nodes.length} total`:`${filteredTopics.length} displayed · ${nodes.length} topics`;
    topicCount.dataset.empty=String(filteredTopics.length===0);
    if(!filteredPositions.has(focusedTopicId))focusedTopicId=filteredPositions.has(active)?active:filteredTopics[0]?.node.id||null;
    if(reveal&&focusedTopicId)revealTopic(focusedTopicId,false);
    else topicWindow();
  }
  function revealTopic(id,focus=true){
    const ix=filteredPositions.get(id)??-1;
    if(ix<0)return false;
    focusedTopicId=id;
    const rowTop=ix*38,rowBottom=rowTop+38,viewTop=topicList.scrollTop,viewBottom=viewTop+(topicList.clientHeight||340);
    if(rowTop<viewTop)topicList.scrollTop=rowTop;
    else if(rowBottom>viewBottom)topicList.scrollTop=Math.max(0,rowBottom-(topicList.clientHeight||340));
    topicWindow();
    if(focus)topicList.querySelector(`[data-topic-index="${ix}"]`)?.focus({preventScroll:true});
    return true;
  }
  function topicCollapse(id,expand){
    const n=topicById.get(id);if(!n||!hasTopicChildren.has(id)||n.collapsed===!expand)return;
    if(!flush())return;
    transact(()=>{n.collapsed=!expand;});
    // A collapsed topic remains reachable; its note and child records remain unchanged.
    focusedTopicId=id;showList({reveal:true});
  }
  topicList.addEventListener('scroll',topicWindow,{passive:true});
  function loadNote(id){
    clearTimeout(saveTimer);active=id;const gen=++loadGeneration,n=byId(id);if(!n)return;
    const recoveryBar=body.querySelector('#mindLocalRecovery');recoveryBar.hidden=true;
    legacyVisible=false;
    noteLock=true;editor.contentEditable='false';body.querySelector('#mindTopicHeading').textContent=n.label;
    editor.innerHTML=sanitizeMindNote(n.noteHtml||'');mindRecalculateTables(editor);dirty=false;
    setStatus('Checking device-local draft…');showList();
    ThinkItLocalNotes.read(currentScope(id)).then(local=>{
      if(closed||gen!==loadGeneration||active!==id)return;
      const current=String(n.noteHtml||'');
      if(local)localRevisions.set(id,local.localRevision);
      if(local&&local.html!==current){
        recoveryBar.hidden=false;
        body.querySelector('#mindLocalRecoveryMessage').textContent=n.keepitLink?.itemId?'Two older ThinkIt drafts exist. Neither replaces the current KeepIt note. Choose which old copy to retain, or make a local backup.':'A different unsynced local note exists for this topic. Choose which version to continue editing; neither is deleted silently.';
        setStatus('Two note versions found · choose the local or project version',true);
        // Even during a legacy draft conflict, the verified native note stays
        // the only editable current version; recovery controls remain available.
        nativeAuthority();
        const restore=body.querySelector('#mindUseLocal'),keep=body.querySelector('#mindUseProject');
        restore.onclick=()=>{try{const html=sanitizeMindNote(local.html);transact(()=>{n.noteHtml=html;});editor.innerHTML=html;mindRecalculateTables(editor);recoveryBar.hidden=true;noteLock=false;editor.contentEditable='true';setStatus('Recovered local note · still awaiting KeepIt');topicIndex.set(n.id,(String(n.label||'')+' '+html.replace(/<[^>]*>/g,' ')).toLocaleLowerCase());nativeAuthority();showList();}catch(e){setStatus(e.message,true);}};
        keep.onclick=()=>{ThinkItLocalNotes.archive(local).then(()=>{if(closed||gen!==loadGeneration)return;recoveryBar.hidden=true;noteLock=false;editor.contentEditable='true';stageLocal(n,sanitizeMindNote(n.noteHtml||''));setStatus('Project version chosen · replacing pending local copy; older draft archived');nativeAuthority();}).catch(e=>setStatus('Could not preserve older local draft: '+e.message,true));};
        return;
      }
      noteLock=false;editor.contentEditable='true';setStatus(local?(local.state==='synced-to-keepit'?'Saved on this device · verified in KeepIt':'Saved on this device · awaiting KeepIt connection'):(n.noteHtml?'Project note loaded · device backup on next edit':'New note · device backup on next edit'));
      nativeAuthority();
      // Do not launch KeepIt's editor just because an already-linked topic was
      // selected. The reference controls must remain available in ThinkIt.
      if(initialFileRequest){initialFileRequest=false;
        if(hosted)fileButton.click();else setStatus('Open this Mind Map through KeepIt to add a library reference.',true);
      }
    }).catch(e=>{if(closed||gen!==loadGeneration)return;noteLock=false;editor.contentEditable='true';setStatus('Local vault unavailable: '+e.message+' · project JSON backup advised',true);nativeAuthority();});
  }
  function save({manual=false}={}){
    clearTimeout(saveTimer);if(closed)return false;
    if(noteLock){setStatus('Choose local or project note version before saving',true);return false;}
    const n=byId(active);if(!n){setStatus('Topic unavailable; keep this note open and export a backup',true);return false;}
    let safe;try{mindRecalculateTables(editor);safe=sanitizeMindNote(editor.innerHTML);}catch(err){setStatus(err.message,true);return false;}
    if(safe!==String(n.noteHtml||'')){transact(()=>{n.noteHtml=safe;});if(byId(active)?.noteHtml!==safe){setStatus('Could not commit note; try Save now',true);return false;}}
    dirty=false;setStatus('Saving on this device…');stageLocal(n,safe);topicIndex.set(n.id,(String(n.label||'')+' '+safe.replace(/<[^>]*>/g,' ')).toLocaleLowerCase());showList();return true;
  }
  function flush(){if(!dirty)return true;return save();}
  function changed(){if(noteLock)return;dirty=true;setStatus('Editing… autosave shortly');clearTimeout(saveTimer);saveTimer=setTimeout(()=>{if(!closed)save();},650);}
  topicList.onclick=e=>{
    const collapse=e.target.closest('[data-mind-collapse]');
    if(collapse){e.preventDefault();e.stopPropagation();topicCollapse(collapse.dataset.mindCollapse,topicById.get(collapse.dataset.mindCollapse)?.collapsed);return;}
    const row=e.target.closest('[data-mind-node]');if(!row)return;
    focusedTopicId=row.dataset.mindNode;
    if(row.dataset.mindNode===active){revealTopic(focusedTopicId);return;}
    if(!flush())return;loadNote(row.dataset.mindNode);revealTopic(focusedTopicId);
  };
  topicList.addEventListener('keydown',e=>{
    if((e.metaKey||e.ctrlKey)&&e.shiftKey&&!e.altKey&&['ArrowUp','ArrowDown'].includes(e.key)){
      e.preventDefault();e.stopPropagation();if(!e.repeat)reorderTopic(e.key==='ArrowUp'?-1:1,e.target.closest('[data-mind-node]')?.dataset.mindNode||active);return;
    }
    if(e.altKey||e.ctrlKey||e.metaKey||!filteredTopics.length)return;
    const row=e.target.closest('[data-mind-node]');
    const i=Math.max(0,filteredPositions.get(row?.dataset.mindNode||focusedTopicId)??0);
    let target=null;
    if(e.key==='ArrowDown')target=Math.min(filteredTopics.length-1,i+1);
    else if(e.key==='ArrowUp')target=Math.max(0,i-1);
    else if(e.key==='Home')target=0;
    else if(e.key==='End')target=filteredTopics.length-1;
    else if(e.key==='PageDown')target=Math.min(filteredTopics.length-1,i+Math.max(1,Math.floor((topicList.clientHeight||340)/38)));
    else if(e.key==='PageUp')target=Math.max(0,i-Math.max(1,Math.floor((topicList.clientHeight||340)/38)));
    else if(e.key==='ArrowLeft'){
      const n=filteredTopics[i].node;if(hasTopicChildren.has(n.id)&&!n.collapsed)topicCollapse(n.id,false);
      else if(n.parentId&&filteredTopics.some(r=>r.node.id===n.parentId))revealTopic(n.parentId);
    }else if(e.key==='ArrowRight'){
      const n=filteredTopics[i].node;if(hasTopicChildren.has(n.id)&&n.collapsed)topicCollapse(n.id,true);
      else if(hasTopicChildren.has(n.id)){const child=filteredTopics.find(r=>r.node.parentId===n.id);if(child)revealTopic(child.node.id);}
    }else if(e.key==='Enter'||e.key===' '){
      if(!row)return;
      if(!flush())return;
      loadNote(row.dataset.mindNode);
    }else if(e.key==='/'){search.focus();search.select();}
    else if(e.key.length===1&&e.key.trim()){
      const now=Date.now(),letter=e.key.toLocaleLowerCase();
      topicTyped=now-topicTypedAt>900?letter:topicTyped+letter;topicTypedAt=now;
      let match=-1;
      for(let step=1;step<=filteredTopics.length;step++){
        const k=(i+step)%filteredTopics.length;
        if(String(filteredTopics[k].node.label||'').toLocaleLowerCase().startsWith(topicTyped)){match=k;break;}
      }
      if(match<0){topicTyped=letter;for(let step=1;step<=filteredTopics.length;step++){
        const k=(i+step)%filteredTopics.length;
        if(String(filteredTopics[k].node.label||'').toLocaleLowerCase().startsWith(letter)){match=k;break;}
      }}
      if(match>=0)target=match;
    }else return;
    e.preventDefault();
    if(target!==null)revealTopic(filteredTopics[target].node.id);
  });
  editor.addEventListener('input',changed);
  editor.addEventListener('focusout',e=>{const cell=e.target.closest?.('td,th');if(cell){try{mindRecalculateTables(editor);changed();}catch(err){setStatus(err.message,true);}}});
  // Pasted HTML is sanitized *before* being inserted, not just on subsequent save.
  editor.addEventListener('paste',e=>{const html=e.clipboardData?.getData('text/html');if(!html)return;
    let clean;try{clean=sanitizeMindNote(html);}catch(err){e.preventDefault();setStatus(err.message,true);return;}
    e.preventDefault();document.execCommand('insertHTML',false,clean);changed();});
  body.querySelector('#mindSave').onclick=()=>save({manual:true});
  body.querySelector('#mindLocalBackup').onclick=localBackup;
  body.querySelector('#mindDiscard').onclick=()=>loadNote(active);
  body.querySelector('#mindExportHtml').onclick=()=>{if(!flush())return;mindExportNotes('html');};
  body.querySelector('#mindExportTxt').onclick=()=>{if(!flush())return;mindExportNotes('txt');};
  search.addEventListener('input',()=>{topicList.scrollTop=0;showList();});
  search.addEventListener('keydown',e=>{if(e.key==='ArrowDown'&&filteredTopics.length){e.preventDefault();revealTopic(filteredTopics[0].node.id);}});
  const tools=body.querySelectorAll('[data-fmt],[data-block]');
  tools.forEach(btn=>{btn.onmousedown=e=>e.preventDefault();btn.onclick=()=>{editor.focus();if(btn.dataset.block)document.execCommand('formatBlock',false,btn.dataset.block);else if(btn.dataset.fmt==='createLink'){const url=window.prompt('Paste an https:// link');if(url&&/^https?:\/\//i.test(url))document.execCommand('createLink',false,url);}else document.execCommand(btn.dataset.fmt,false,null);changed();};});
  function selectedCell(){const sel=window.getSelection();let x=sel?.anchorNode;if(x?.nodeType===3)x=x.parentElement;else if(x?.nodeType!==1)x=x?.parentElement;const cell=x?.closest?.('td,th');return cell&&editor.contains(cell)?cell:null;}
  function putCaret(cell){cell.focus();const sel=window.getSelection(),range=document.createRange();range.selectNodeContents(cell);range.collapse(true);sel.removeAllRanges();sel.addRange(range);editor.focus();}
  const tableBtns=['mindInsertTable','mindAddTableRow','mindAddTableCol'];tableBtns.forEach(id=>body.querySelector('#'+id).onmousedown=e=>e.preventDefault());
  body.querySelector('#mindInsertTable').onclick=()=>{editor.focus();const html='<table><tbody>'+Array.from({length:3},(_,r)=>'<tr>'+Array.from({length:3},(_,c)=>`<${r===0?'th':'td'}><br></${r===0?'th':'td'}>`).join('')+'</tr>').join('')+'</tbody></table><p><br></p>';
    document.execCommand('insertHTML',false,html);changed();};
  body.querySelector('#mindAddTableRow').onclick=()=>{const cell=selectedCell();if(!cell){setStatus('Place the caret inside a table cell first',true);return;}const row=cell.closest('tr'),tr=document.createElement('tr'),count=row.cells.length;for(let i=0;i<count;i++){const td=document.createElement('td');td.append(document.createElement('br'));tr.append(td);}row.after(tr);putCaret(tr.cells[Math.min(cell.cellIndex,tr.cells.length-1)]);changed();};
  body.querySelector('#mindAddTableCol').onclick=()=>{const cell=selectedCell();if(!cell){setStatus('Place the caret inside a table cell first',true);return;}const table=cell.closest('table'),idx=cell.cellIndex;for(const tr of table.rows){const td=document.createElement(tr===table.rows[0]?'th':'td');td.append(document.createElement('br'));tr.insertBefore(td,tr.cells[idx+1]||null);}putCaret(table.rows[cell.parentElement.rowIndex]?.cells[idx+1]||table.rows[0].cells[idx+1]);changed();};
  // Image insertion: local image bytes only, bounded/compressed into an editable figure.
  const imageInput=body.querySelector('#mindImageFile'),figureBar=body.querySelector('#mindFigureBar');
  body.querySelector('#mindInsertImage').onclick=()=>imageInput.click();
  async function insertImage(file){try{setStatus('Preparing image…');const url=await mindCompressImage(file);if(closed)return;
      const figure=document.createElement('figure');figure.style.width='75%';figure.style.textAlign='center';const img=document.createElement('img');img.src=url;img.alt=file.name.slice(0,200);figure.append(img);const cap=document.createElement('figcaption');cap.textContent='Caption (click to edit)';cap.setAttribute('contenteditable','true');figure.append(cap);
      const insertAt=document.createRange(),sel=window.getSelection();if(sel&&sel.rangeCount&&editor.contains(sel.anchorNode)){const saved=sel.getRangeAt(0).cloneRange();saved.collapse(false);saved.insertNode(figure);}else editor.append(figure);
      const after=document.createElement('p');after.append(document.createElement('br'));figure.after(after);changed();setStatus('Image inserted · edit caption underneath');
    }catch(err){setStatus(err.message,true);}finally{imageInput.value='';}}
  imageInput.onchange=()=>{if(imageInput.files?.[0])insertImage(imageInput.files[0]);};
  editor.addEventListener('paste',e=>{if(e.clipboardData?.files?.length){const file=[...e.clipboardData.files].find(x=>/^image\//.test(x.type));if(file){e.preventDefault();insertImage(file);}}});
  let selectedFigure=null;
  editor.addEventListener('click',e=>{const figure=e.target.closest?.('figure');if(figure&&editor.contains(figure)){selectedFigure=figure;figureBar.hidden=false;body.querySelector('#mindFigureWidth').value=parseInt(figure.style.width,10)||75;}else if(!e.target.closest?.('figcaption')){selectedFigure=null;figureBar.hidden=true;}});
  body.querySelector('#mindFigureWidth').onchange=e=>{if(!selectedFigure||!editor.contains(selectedFigure))return;const w=Math.max(20,Math.min(100,Number(e.target.value)||75));selectedFigure.style.width=w+'%';changed();};
  body.querySelector('#mindFigureAlt').onclick=()=>{if(!selectedFigure)return;const img=selectedFigure.querySelector('img');const value=window.prompt('Image alternative text',img.alt||'');if(value!==null){img.alt=value.slice(0,300);changed();}};
  const formulaInput=body.querySelector('#mindFormulaInput'),cellAddr=body.querySelector('#mindCellAddress');let activeCell=null,formulaClickHandled=false;
  function locateCell(el){const cell=el?.closest?.('td,th');return cell&&editor.contains(cell)?cell:null;}
  function activateCell(cell){activeCell=cell;const r=cell.parentElement.rowIndex,c=cell.cellIndex;cellAddr.textContent=mindCellAddress(r,c);
    formulaInput.value=cell.getAttribute('data-formula')||cell.textContent.trim();}
  editor.addEventListener('click',e=>{const cell=locateCell(e.target);if(!cell)return;
    if(formulaClickHandled){formulaClickHandled=false;return;}
    if(document.activeElement===formulaInput&&activeCell&&cell!==activeCell&&formulaInput.value.trim().startsWith('=')){
      formulaInput.value+=mindCellAddress(cell.parentElement.rowIndex,cell.cellIndex);formulaInput.focus();return;
    }activateCell(cell);});
  // Capture mousedown when formula bar is focused, allowing KeepIt's click-to-reference workflow.
  editor.addEventListener('mousedown',e=>{const cell=locateCell(e.target);if(!cell||!activeCell||document.activeElement!==formulaInput||!formulaInput.value.trim().startsWith('='))return;
    e.preventDefault();formulaClickHandled=true;formulaInput.value+=mindCellAddress(cell.parentElement.rowIndex,cell.cellIndex);formulaInput.focus();});
  function formulaCommit(move=0){if(!activeCell||!editor.contains(activeCell)){setStatus('Select a table cell first',true);return;}
    const raw=formulaInput.value.trim();if(raw.startsWith('=')){if(raw.length>240){setStatus('Formula is too long',true);return;}activeCell.setAttribute('data-formula',raw);}else{activeCell.removeAttribute('data-formula');activeCell.textContent=raw;}
    mindRecalculateTables(editor);changed();if(move){const row=activeCell.parentElement;const next=row.parentElement.rows[row.rowIndex+move];if(next){activateCell(next.cells[Math.min(activeCell.cellIndex,next.cells.length-1)]);}}}
  body.querySelector('#mindFormulaApply').onclick=()=>formulaCommit();
  formulaInput.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();formulaCommit(e.shiftKey?-1:1);}};
  editor.addEventListener('keydown',e=>{const cell=locateCell(e.target);if(cell&&e.key==='Enter'&&!e.shiftKey){e.preventDefault();activateCell(cell);formulaInput.value=cell.getAttribute('data-formula')||cell.textContent.trim();formulaCommit(1);}});
  for(const el of body.querySelectorAll('#mindFont,#mindSize,#mindTextColor,#mindHighlightColor'))el.onmousedown=e=>{if(e.target.tagName==='INPUT')return;};
  body.querySelector('#mindFont').onchange=e=>{editor.focus();document.execCommand('fontName',false,e.target.value);changed();};
  body.querySelector('#mindSize').onchange=e=>{editor.focus();const size={12:'2',14:'3',16:'4',18:'5',24:'6'}[e.target.value]||'3';document.execCommand('fontSize',false,size);changed();};
  body.querySelector('#mindTextColor').onchange=e=>{editor.focus();document.execCommand('foreColor',false,e.target.value);changed();};
  body.querySelector('#mindHighlightColor').onchange=e=>{editor.focus();document.execCommand('hiliteColor',false,e.target.value);changed();};

  editor.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();save({manual:true});}});
  // Commit pending notes on topic switching, editor closing and browser/tab hiding.
  const closeBtn=body.closest('.modal').querySelector('.modal-head button'),closeFooter=body.closest('.modal').querySelector('.modal-footer button');
  for(const btn of [closeBtn,closeFooter]){btn.addEventListener('click',e=>{if(!flush()){e.stopImmediatePropagation();e.preventDefault();}},true);}
  function onVisibility(){if(document.visibilityState==='hidden')flush();}
  function onBeforeUnload(){flush();}
  document.addEventListener('visibilitychange',onVisibility);window.addEventListener('beforeunload',onBeforeUnload);
  window.addEventListener('online',onReconnect);window.addEventListener('thinkit-keepit-connected',onReconnect);
  refreshQueue();attemptSync();loadNote(active);search.focus();
}

function modal(title,html,buttons=[],onClose){const root=$('modalRoot');root.hidden=false;root.replaceChildren();const m=dom('div','modal',undefined,root),head=dom('div','modal-head',undefined,m);dom('strong','',title,head);const close=dom('button','','×',head);close.title='Close dialog';const body=dom('div','modal-body',undefined,m);body.innerHTML=html;const foot=dom('div','modal-footer',undefined,m);const shut=()=>{if(activeModal!==state)return;root.hidden=true;root.replaceChildren();activeModal=null;if(onClose)onClose();};const state={close:shut,body};activeModal=state;close.onclick=shut;root.onclick=e=>{ /* Deliberate close only: dialogs do not vanish on outside clicks. */ };for(const b of buttons){const btn=dom('button',b.primary?'inspector-btn primary':'inspector-btn',b.text,foot);btn.onclick=()=>{const response=b.action?.(body);if(response!==false)shut();};}return body;}
function promptAnnotationAnchor(){if(!selectedAnnotation)return;const options=page.nodes.map(n=>`<option value="${esc(n.id)}">${esc(n.label)}</option>`).join('');if(!options){toast('Create a shape first.');return;}const body=modal('Attach text to a shape',`<p class="modal-subtext">Choose the shape. The annotation will follow it as you move or resize it.</p><div class="prop-field"><label>Attach to</label><select id="attachNodeChoice">${options}</select></div>`,[{text:'Cancel'},{text:'Attach',primary:true,action:b=>{const id=b.querySelector('#attachNodeChoice').value;transact(()=>{const a=annoById(selectedAnnotation);a.parentId=id;a.dx=0;a.dy=16;});}}]);}
function openDepartmentDialog(){if(page.mode!=='org'){toast('Departments are available in Org Chart mode.');return;}
 const chosen=selected.size===1?[...selected][0]:'';
 const options=page.nodes.map(n=>`<option value="${esc(n.id)}" ${n.id===chosen?'selected':''}>${esc(n.label)}</option>`).join('');
 const body=modal('Add department to team structure',`<p class="modal-subtext">Create a department and attach it to an existing manager or parent unit. Its reporting line and Outline position will be created automatically.</p><div class="prop-field"><label>Department name</label><input id="depName" value="New department" autofocus></div><div class="prop-field"><label>Reports to / Parent unit</label><select id="depParent"><option value="">Top-level / Unassigned</option>${options}</select></div><div class="prop-field"><label>Subtitle (optional)</label><input id="depSubtitle" placeholder="e.g., Airside Planning"></div>`,[
 {text:'Cancel'}, {text:'Create department',primary:true,action:b=>{const parentId=b.querySelector('#depParent').value,name=b.querySelector('#depName').value.trim()||'New department',subtitle=b.querySelector('#depSubtitle').value.trim();let created;
 transact(()=>{const parent=byId(parentId);const pos=parent?chooseNonOverlapping(parent.x+parent.w/2-92,parent.y+parent.h+142,'department'):{x:120,y:140};created=addNode('department',pos.x,pos.y,name,{parentId:parentId||null,data:{role:subtitle,department:name},fill:'blue'});if(parent)parent.collapsed=false;});if(created)ensureVisibleNode(created);toast(parentId?'Department attached to reporting hierarchy.':'Unassigned top-level department created; set Reports to in Properties.');}}
 ]);setTimeout(()=>body.querySelector('#depName')?.focus(),20);
}
function promptNewPage(initialMode='flow'){if(!MODES[initialMode])initialMode='flow';const body=modal('New diagram page',`<p class="modal-subtext">Choose the notation that fits your work. Each page retains its own structures and rules.</p><div class="mode-chooser">${Object.entries(MODES).map(([k,v],i)=>`<button class="mode-option ${k===initialMode?'selected':''}" data-choice="${k}"><span class="mode-emoji">${v.symbol}</span><strong>${v.name}</strong></button>`).join('')}</div><div class="prop-field"><label>Page name</label><input id="newPageName" value="New ${MODES[initialMode].name}"></div><div class="prop-field" id="pageZoneRow" style="display:${initialMode==='bubble'?'block':'none'}"><label>Bubble Diagram zone template</label><select id="newPageZoneTemplate"><option value="RESIDENTIAL">Residential</option><option value="COMMERCIAL">Commercial</option><option value="INSTITUTIONAL">Institutional</option><option value="AIRPORT-PTB">Airport PTB</option><option value="INDUSTRIAL">Industrial</option><option value="MIXED-USE">Mixed-Use</option><option value="CUSTOM">Custom</option></select></div><label class="checkbox-row" id="pageStarterRow" ${initialMode==='bmc'?'hidden':''}><input id="pageStarter" type="checkbox"> Include a starter node</label>`,[{text:'Cancel'},{text:'Create page',primary:true,action:b=>{const mode=b.querySelector('.mode-option.selected')?.dataset.choice||'flow',name=b.querySelector('#newPageName').value.trim(),starter=b.querySelector('#pageStarter').checked;newPage(mode,name,starter,mode==='bubble'?b.querySelector('#newPageZoneTemplate').value:'CUSTOM');}}]);body.querySelectorAll('[data-choice]').forEach(btn=>btn.onclick=()=>{body.querySelectorAll('[data-choice]').forEach(x=>x.classList.remove('selected'));btn.classList.add('selected');body.querySelector('#newPageName').value='New '+MODES[btn.dataset.choice].name;body.querySelector('#pageZoneRow').style.display=btn.dataset.choice==='bubble'?'block':'none';body.querySelector('#pageStarterRow').hidden=btn.dataset.choice==='bmc';});}
function confirmNewDoc(){openProjectChooser(false);}
function openExport(){modal('Export diagram',`<p class="modal-subtext">DiagramIt JSON preserves all pages and editing data. ${page.mode==='bmc'?'Print/PDF creates a visual copy of this canvas.':'SVG, PNG and print/PDF export only the active page as a flattened visual.'}</p><div class="export-options"><button class="export-choice" data-export="json"><span><strong>DiagramIt JSON</strong><small>Full editable project · Recommended backup</small></span>↧</button><button class="export-choice" ${page.mode==='bmc'?'hidden':''} data-export="svg"><span><strong>SVG</strong><small>Scalable vector · Current page</small></span>↧</button><button class="export-choice" ${page.mode==='bmc'?'hidden':''} data-export="png"><span><strong>PNG</strong><small>2× raster image · Current page</small></span>↧</button><button class="export-choice" data-export="pdf"><span><strong>Print / Save as PDF</strong><small>Use your browser's Print → Save as PDF</small></span>↗</button></div>`,[{text:'Close'}]);activeModal.body.querySelectorAll('[data-export]').forEach(b=>b.onclick=()=>{const k=b.dataset.export;activeModal.close();if(k==='json')exportJson();if(k==='svg')diExportSvg();if(k==='png')diExportPng();if(k==='pdf')diPrint();});}
const commandEntries=[['Add arrow between nodes','connect','C'],['Draw a free annotation arrow','arrow','A'],['Add child node','child','Tab'],['Add sibling node','sibling','Return'],['Edit selected text','edit','Double-click / F2'],['Create directional child','dir-child','⌥Arrow'],['Create directional parent','dir-parent','⌥⇧Arrow'],['Create a new page','new-page',''],['Add node','add',''],['Add department to org chart','department',''],['Organize diagram (spacing and layout)','layout',''],['Fit entire diagram','fit','⇧1'],['Export project or page','export',''],['Open JSON project','import','⌘O'],['Save locally','save','⌘S'],['Undo','undo','⌘Z'],['Redo','redo','⇧⌘Z'],['Duplicate selection','duplicate','⌘D'],['Group selection','group','⌘G'],['Ungroup selection','ungroup','⇧⌘G'],['Switch to Flowchart page','page-flow',''],['Switch to Org Chart page','page-org',''],['Switch to Mind Map page','page-mind',''],['Toggle inspector','inspector',''],['Toggle shape library','library',''],['Toggle dark mode','theme',''],['Keyboard shortcuts & help','help','']];
function runCommand(k){switch(k){case 'connect':selectCanvasTool('connect');toast('Click or drag from a source node to its destination. V exits.');break;case 'arrow':selectCanvasTool('arrow');toast('Drag from arrow start to arrow end. V exits.');break;case 'child':if(selected.size===1)addChild([...selected][0]);else toast('Select a node first.');break;case 'sibling':if(selected.size===1)addChild([...selected][0],true);else toast('Select a node first.');break;case 'edit':if(selected.size===1)startEdit([...selected][0]);else if(edgeSelected)startEdit(edgeSelected,'edge');break;case 'dir-child':toast('Select a node then Option + ← ↑ → ↓ to add a child in that direction.');break;case 'dir-parent':toast('Select a node then Option + Shift + ← ↑ → ↓ to insert a parent.');break;case 'new-page':promptNewPage();break;case 'add':addRoot();break;case 'department':openDepartmentDialog();break;case 'layout':page.mode==='org'?openOrgLayoutDialog('all'):page.mode==='mind'?openMindLayoutDialog():showLayoutPreview();break;case 'fit':fitView();break;case 'export':openExport();break;case 'import':$('fileInput').click();break;case 'save':persist();toast('Saving locally… check save status. Export JSON for a portable backup.');break;case 'undo':undo();break;case 'redo':redo();break;case 'duplicate':duplicateSelection();break;case 'group':groupSelection();break;case 'ungroup':ungroupSelection();break;case 'page-flow':case 'page-org':case 'page-mind':{const p=doc.pages.find(p=>p.mode===k.slice(5));if(p)selectPage(p.id);else newPage(k.slice(5),`New ${MODES[k.slice(5)].name}`,true);break;}case 'inspector':togglePanel('inspector');break;case 'library':togglePanel('library');break;case 'theme':toggleTheme();break;case 'help':showHelp();break;}}
function openPalette(initial=''){const html=`<input class="command-input" id="commandQuery" placeholder="Find a command, action or node…" autocomplete="off" aria-label="Search commands"><div class="command-results" id="commandResults"></div>`;const body=modal('Command palette',html);const input=body.querySelector('#commandQuery'),list=body.querySelector('#commandResults');const paint=()=>{const q=input.value.toLowerCase().trim();list.replaceChildren();const cmds=commandEntries.filter(([name])=>name.toLowerCase().includes(q)).slice(0,18);for(const [name,k,keys] of cmds){const b=dom('button','command-item',undefined,list);dom('span','',name,b);dom('kbd','',keys,b);b.onclick=()=>{activeModal.close();runCommand(k);};}if(q){for(const n of page.nodes.filter(n=>n.label.toLowerCase().includes(q)).slice(0,8)){const b=dom('button','command-item',undefined,list);dom('span','',`Go to: ${n.label}`,b);b.onclick=()=>{activeModal.close();selectNode(n.id);centerNode(n);};}}if(!list.children.length)dom('div','notice','No matching commands or nodes.',list);};input.value=initial;input.oninput=paint;input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();list.querySelector('button')?.click();}};paint();input.focus();}
function centerNode(n){const c=getWorldSize();view.x=c.w/2-(n.x+n.w/2)*view.k;view.y=c.h/2-(n.y+n.h/2)*view.k;renderCanvas();}
function showHelp(){modal('Keyboard shortcuts & editing guide',`<p class="modal-subtext"><strong>Fast creation:</strong> Select a node (click its shape), then use <strong>Tab</strong> to add a connected child, <strong>Return</strong> for a sibling, or <strong>Option + Arrow</strong> to place a child in a chosen direction. The new node opens directly for naming. <strong>Option + Shift + Arrow</strong> inserts a parent, preserving hierarchy. Select a shape and begin typing to replace its label. Add a free text box with T or the Text box tool, or choose Attach text after selecting a shape. Double-click text to edit and format individual words. Double-click to edit within the existing text. Press Escape to deselect before using single-letter Select/Pan shortcuts.</p><div class="help-shortcuts"><span>Create child / sibling · all modes</span><span>Tab / Return</span><span>Directional child (← ↑ → ↓)</span><span>⌥ + Arrow</span><span>Insert a new parent (directional)</span><span>⌥ ⇧ + Arrow</span><span>Replace label / edit existing text</span><span>Type / Double-click / F2 / ⌘Return</span><span>Select / Pan tool</span><span>Esc then V / H, or Shift+V / Shift+H</span><span>Connect two existing nodes</span><span>C · click source, destination</span><span>Free-standing annotation arrow</span><span>A · drag arrow</span><span>Temporarily pan with any tool</span><span>Space + drag</span><span>Navigate between shapes / move shape</span><span>Arrow / ⇧Arrow</span><span>Undo / Redo</span><span>⌘Z / ⇧⌘Z</span><span>Duplicate node or arrow</span><span>⌘D</span><span>Copy / apply visual style</span><span>⌘⌥C / ⌘⌥V</span><span>Group / Ungroup</span><span>⌘G / ⇧⌘G</span><span>Command palette</span><span>⌘K</span><span>Fit diagram / 100%</span><span>⇧1 / ⇧2</span></div><div class="notice">Logic: process-flow arrows point towards the next step, primary org-chart reporting lines and primary mind-map branches have no arrowheads, and supplementary links are directional by default. Select an arrow to change line type, route, arrowheads or direction. Each page saves locally; export JSON for a portable backup.</div>`,[{text:'Close'}]);}

function toggleTheme(){theme=isDark()?'light':'dark';document.body.dataset.theme=theme;pref('theme',theme);render();}
function togglePanel(which){
 const name=which==='library'?'sidebar-collapsed':'inspector-collapsed';
 const wasClosed=document.body.classList.contains(name),mobile=diIsMobilePanelLayout();
 document.body.classList.toggle(name);
 pref(which==='library'?'libraryHidden':'inspectorHidden',document.body.classList.contains(name));
 if(mobile&&wasClosed){
  const other=which==='library'?'inspector-collapsed':'sidebar-collapsed';
  document.body.classList.add(other);
  pref(which==='library'?'inspectorHidden':'libraryHidden',true);
 }
 updatePanelButtons();
 if(mobile){if(wasClosed)$(which==='library'?'leftCollapse':'rightCollapse').focus();else $('mobileMenu').focus();}
 requestAnimationFrame(()=>renderCanvas());
}
function selectDirectionalNeighbor(direction){
 const visible=visibleNodes();if(!visible.length)return;
 const current=selected.size===1?byId([...selected][0]):null;
 if(!current){const first=visible[0];selectNode(first.id);ensureVisibleNode(first);return;}
 const center=n=>({x:n.x+n.w/2,y:n.y+n.h/2}),a=center(current);
 const choices=visible.filter(n=>n.id!==current.id).map(n=>{const b=center(n),dx=b.x-a.x,dy=b.y-a.y;
 const forward=direction==='left'?-dx:direction==='right'?dx:direction==='up'?-dy:dy;
 const sideways=direction==='left'||direction==='right'?Math.abs(dy):Math.abs(dx);
 if(forward<=3)return null;
 // Alignment dominates distance, but nearby diagonal targets remain reachable.
 return{node:n,score:forward+sideways*2.5+(sideways>forward*1.6?180:0)};
 }).filter(Boolean).sort((a,b)=>a.score-b.score);
 if(choices.length){selectNode(choices[0].node.id);ensureVisibleNode(choices[0].node);}else toast('No shape in that direction.');
}
function nudge(dx,dy){if(!selected.size)return;transact(()=>{const ids=effectiveDragIDs();for(const id of ids){const n=byId(id);if(n){n.x+=dx;n.y+=dy;if(['mind','flow'].includes(page.mode))n.layoutManaged=false;}}h3Repair();});}
function effectiveDragIDs(){const out=new Set(selected);for(const id of selected){const n=byId(id);if(!n)continue;if(n.groupId)for(const nn of page.nodes)if(nn.groupId===n.groupId)out.add(nn.id);if(page.mode==='flow'&&n.collapsed)for(const d of flowOutlineDescendants(id))out.add(d);
 if(page.mode!=='flow')for(const d of descendants(id))out.add(d);}return out;}
function dropShape(shape,pos){if(!SHAPES[page.mode].some(s=>s[0]===shape))return;const source=['flow','mind'].includes(page.mode)&&selected.size===1?byId([...selected][0]):null,size=initialShapeSize(shape,source),preferred={x:Math.round((pos.x-size.w/2)/12)*12,y:Math.round((pos.y-size.h/2)/12)*12};transact(()=>{const n=addNode(shape,preferred.x,preferred.y,undefined,{w:size.w,h:size.h});arrangeInserted(n,preferred,page.mode==='mind'&&source&&preferred.x<source.x?'left':page.mode==='mind'?'right':'down');
if(page.mode==='flow'&&flowFocusId())n.outlineParentId=flowFocusId();
// Palette drop coordinates are an intentional manual choice, not an auto child.
if(['mind','flow'].includes(page.mode))n.layoutManaged=false;});}
function nextParallelOffset(from,to){const count=page.edges.filter(e=>e.from===from&&e.to===to).length;return count===0?0:(count%2===1?1:-1)*Math.ceil(count/2)*32;}
function makeConnection(sourceId,targetId,kind,fromPort='auto',toPort='auto'){if(sourceId===targetId){toast('Choose two different nodes.');return;}if(!byId(sourceId)||!byId(targetId))return;
let created;transact(()=>{const secondary=page.mode!=='flow';created=edge(sourceId,targetId,secondary?'secondary':'flow',{fromPort,toPort,route:'orthogonal',parallelOffset:nextParallelOffset(sourceId,targetId)});page.edges.push(created);edgeSelected=created.id;selected.clear();});
toast(page.mode==='flow'?'Directional arrow added. Select it to change arrowheads and routing.':'Additional directional arrow added; the primary hierarchy is unchanged.');}
function duplicateEdge(){const original=findEdge(edgeSelected);if(!original||original.kind==='primary')return;let next;transact(()=>{next=clone(original);next.id=uid();if(isFreeEdge(original)){next.start.x+=20;next.start.y+=20;next.end.x+=20;next.end.y+=20;}else next.parallelOffset=nextParallelOffset(next.from,next.to);page.edges.push(next);edgeSelected=next.id;});toast('Additional arrow created.');}
function reverseEdge(){const ed=findEdge(edgeSelected);if(!ed)return;transact(()=>{if(isFreeEdge(ed)){const p=ed.start;ed.start=ed.end;ed.end=p;}else{const f=ed.from,fp=ed.fromPort;ed.from=ed.to;ed.fromPort=ed.toPort;ed.to=f;ed.toPort=fp;}});toast('Arrow reversed; the arrowhead now points toward the other node.');}

function pointHitsNode(p,ignoreId){return visibleNodes().slice().reverse().find(n=>n.id!==ignoreId&&p.x>=n.x&&p.x<=n.x+n.w&&p.y>=n.y&&p.y<=n.y+n.h)||null;}
function onDown(e){if(activeModal||editing||e.button!==0&&e.button!==1)return;
// Keyboard commands always go to the canvas after a direct canvas gesture, never to a stale inspector field.
focusCanvas();const collapseTarget=e.target.closest('[data-collapse-node]');if(collapseTarget){e.preventDefault();e.stopPropagation();toggleCollapse(collapseTarget.dataset.collapseNode);return;}const annotationId=e.target.closest('[data-annotation-id]')?.dataset.annotationId,annoResize=e.target.closest('[data-anno-resize]')?.dataset.annoResize;const id=e.target.closest('[data-node-id]')?.dataset.nodeId,edgeId=e.target.closest('[data-edge-id]')?.dataset.edgeId,port=e.target.closest('[data-port]')?.dataset.port,action=e.target.closest('[data-action]')?.dataset.action;
const w=worldPoint(e),s=screenPoint(e),corner=e.target.closest('[data-resize]')?.dataset.resize,edgeHandle=e.target.closest('[data-edge-handle]')?.dataset.edgeHandle;
if(e.button===1||tool==='hand'||spacePressed){gesture={type:'pan',start:s,origin:{x:view.x,y:view.y}};canvas.classList.add('is-panning');canvas.setPointerCapture(e.pointerId);return;}
if(annotationId&&tool==='select'){const a=annoById(annotationId);if(a){selectAnnotation(annotationId);const origin=annoPosition(a);gesture={type:annoResize?'anno-resize':'anno-drag',id:annotationId,start:w,original:{x:a.x,y:a.y,dx:a.dx,dy:a.dy,w:a.w,h:a.h},before:JSON.stringify(doc),moved:false};canvas.setPointerCapture(e.pointerId);return;}}
if(edgeHandle&&edgeId){if(flowProjectedEdge(edgeId)){toast('Expand the subprocess to move the actual connector endpoints.');return;}const ed=findEdge(edgeId);if(ed){selectEdge(edgeId);if(edgeHandle==='bend'){const source=byId(ed.from),target=byId(ed.to),geom=getEdgeGeom(ed,source,target);gesture={type:'edge-bend',edgeId,start:w,axis:geom.trunk?.axis,base:geom.trunk?.base,before:JSON.stringify(doc),moved:false};}else if(isFreeEdge(ed)){gesture={type:'edge-point',edgeId,which:edgeHandle,before:JSON.stringify(doc),moved:false};}else{gesture={type:'edge-reanchor',edgeId,which:edgeHandle,start:w,current:w,before:JSON.stringify(doc),moved:false};}canvas.setPointerCapture(e.pointerId);return;}}
if(corner&&id){const n=byId(id);gesture={type:'resize',nodeId:id,corner,start:w,original:{x:n.x,y:n.y,w:n.w,h:n.h},before:JSON.stringify(doc),moved:false};canvas.setPointerCapture(e.pointerId);return;}
if(action==='quick-child'&&id){e.preventDefault();addChild(id);return;}
if(reparentPick){if(id){const source=reparentPick;reparentPick=null;changeParent(source,id);}else{reparentPick=null;toast('Choose a target parent node.');}return;}
if(tool==='arrow'){gesture={type:'arrow-draw',startWorld:w,current:w};canvas.setPointerCapture(e.pointerId);renderFast();return;}
if(tool==='connect'||port&&id){
if(id){if(connectSource&&connectSource.id!==id){const source=connectSource;connectSource=null;makeConnection(source.id,id,null,source.port,port||'auto');render();return;}
if(connectSource?.id===id){connectSource=null;render();toast('Arrow cancelled. Choose another source.');return;}
const n=byId(id),startPort=port||'auto';gesture={type:'connect',source:id,port:startPort,anchor:startPort==='auto'?{x:n.x+n.w/2,y:n.y+n.h/2}:pointsFor(n)[startPort],current:w};canvas.setPointerCapture(e.pointerId);renderFast();return;}
if(connectSource&&tool==='connect'){toast('Click a destination node, or press Esc to cancel.');return;}
}
if(id&&paintActive){paintOnto(id);focusCanvas();return;}
if(id){if(tool!=='select')setTool('select');if(!selected.has(id)||e.shiftKey)selectNode(id,e.shiftKey);const ids=effectiveDragIDs(),before=JSON.stringify(doc),original={};for(const nid of ids){const n=byId(nid);if(n)original[nid]={x:n.x,y:n.y};}gesture={type:'drag',start:w,current:w,moved:false,original,before,source:id,pointerId:e.pointerId,shiftAtStart:e.shiftKey};canvas.setPointerCapture(e.pointerId);return;}
if(edgeId){selectEdge(edgeId);const ed=findEdge(edgeId);if(isFreeEdge(ed)){gesture={type:'free-arrow-move',edgeId,start:w,before:JSON.stringify(doc),origin:{start:{...ed.start},end:{...ed.end}},moved:false};canvas.setPointerCapture(e.pointerId);}return;}
if(tool==='select'){if(!e.shiftKey){selected.clear();edgeSelected=null;selectedAnnotation=null;render();}gesture={type:'marquee',startWorld:w,current:w,extend:e.shiftKey};canvas.setPointerCapture(e.pointerId);}
}

function onMove(e){if(!gesture)return;const w=worldPoint(e),s=screenPoint(e);
if(gesture.type==='anno-drag'||gesture.type==='anno-resize'){const a=annoById(gesture.id);if(!a)return;const dx=w.x-gesture.start.x,dy=w.y-gesture.start.y;if(gesture.type==='anno-drag'){if(a.parentId){a.dx=gesture.original.dx+dx;a.dy=gesture.original.dy+dy;}else{a.x=gesture.original.x+dx;a.y=gesture.original.y+dy;}}else{a.w=Math.max(60,gesture.original.w+dx);a.h=Math.max(32,gesture.original.h+dy);}gesture.moved=Math.hypot(dx,dy)>1;renderFast();return;}
if(gesture.type==='pan'){view.x=gesture.origin.x+s.x-gesture.start.x;view.y=gesture.origin.y+s.y-gesture.start.y;renderFast();return;}
if(gesture.type==='connect'||gesture.type==='arrow-draw'){gesture.current=w;renderFast();return;}
if(gesture.type==='edge-reanchor'){gesture.current=w;gesture.moved=Math.hypot(w.x-gesture.start.x,w.y-gesture.start.y)>3;renderFast();return;}
if(gesture.type==='edge-bend'){const ed=ensureWritableEdge(gesture.edgeId);if(ed&&gesture.axis){ed.bendAxis=gesture.axis;ed.bendOffset=Math.round((gesture.axis==='x'?w.x:w.y)-gesture.base);gesture.moved=true;renderFast();}return;}
if(gesture.type==='edge-point'){const ed=findEdge(gesture.edgeId);if(isFreeEdge(ed)){ed[gesture.which]={x:Math.round(w.x),y:Math.round(w.y)};gesture.moved=true;renderFast();}return;}
if(gesture.type==='free-arrow-move'){const ed=findEdge(gesture.edgeId),dx=w.x-gesture.start.x,dy=w.y-gesture.start.y;if(isFreeEdge(ed)){ed.start={x:Math.round(gesture.origin.start.x+dx),y:Math.round(gesture.origin.start.y+dy)};ed.end={x:Math.round(gesture.origin.end.x+dx),y:Math.round(gesture.origin.end.y+dy)};gesture.moved=Math.hypot(dx,dy)>1;renderFast();}return;}
if(gesture.type==='resize'){const n=byId(gesture.nodeId),o=gesture.original,dx=w.x-gesture.start.x,dy=w.y-gesture.start.y,c=gesture.corner;if(!n)return;let x=o.x,y=o.y,ww=o.w,hh=o.h;if(c.includes('e'))ww=o.w+dx;if(c.includes('s'))hh=o.h+dy;if(c.includes('w')){x=o.x+dx;ww=o.w-dx;}if(c.includes('n')){y=o.y+dy;hh=o.h-dy;}if(ww<50){if(c.includes('w'))x=o.x+o.w-50;ww=50;}if(hh<40){if(c.includes('n'))y=o.y+o.h-40;hh=40;}n.x=Math.round(x/3)*3;n.y=Math.round(y/3)*3;n.w=Math.round(ww/3)*3;n.h=Math.round(hh/3)*3;gesture.moved=true;renderFast();return;}
if(gesture.type==='marquee'){gesture.current=w;renderFast();return;}
if(gesture.type==='drag'){const dx=w.x-gesture.start.x,dy=w.y-gesture.start.y;if(Math.hypot(dx,dy)<1.5&&!gesture.moved)return;gesture.moved=true;for(const [id,p] of Object.entries(gesture.original)){const n=byId(id);if(n){let x=p.x+dx,y=p.y+dy;if(!e.altKey){x=Math.round(x/6)*6;y=Math.round(y/6)*6;}n.x=x;n.y=y;}}renderFast();}
}

function onUp(e){if(!gesture)return;const g=gesture;gesture=null;canvas.classList.remove('is-panning');try{canvas.releasePointerCapture(e.pointerId);}catch{}
if(g.type==='anno-drag'||g.type==='anno-resize'){if(g.moved)recordHistory(g.before);render();return;}
if(g.type==='edge-reanchor'){if(g.moved){const ed=ensureWritableEdge(g.edgeId),p=worldPoint(e),hit=pointHitsNode(p);if(ed&&hit){const result=closestPort(hit,p);if(g.which==='from'){if(hit.id===ed.to){toast('Start and end must remain on different shapes.');}else{ed.from=hit.id;ed.fromPort=result.port;ed.fromFraction=result.fraction;recordHistory(g.before);}}else{if(hit.id===ed.from){toast('Start and end must remain on different shapes.');}else{ed.to=hit.id;ed.toPort=result.port;ed.toFraction=result.fraction;recordHistory(g.before);}}}else toast('Release over a shape edge to reattach.');}render();return;}
if(g.type==='edge-bend'){if(g.moved)recordHistory(g.before);render();return;}
if(g.type==='edge-point'||g.type==='free-arrow-move'||g.type==='resize'){if(g.moved){if(g.type==='resize'&&['mind','flow'].includes(page.mode)){
  const resized=byId(g.nodeId);if(resized){h3BranchReflow(resized.id);h3Repair(resized.id);}
 }recordHistory(g.before);}render();return;}
if(g.type==='arrow-draw'){const a=g.startWorld,b=g.current||a;const endpoint=Math.hypot(b.x-a.x,b.y-a.y)<12?{x:a.x+190,y:a.y}:b;let created;transact(()=>{created=freeArrow(a,endpoint);page.edges.push(created);selected.clear();edgeSelected=created.id;});toast('Independent arrow added. Drag its endpoint handles to reposition it.');return;}
if(g.type==='drag'){if(!g.moved&&!g.shiftAtStart&&selected.size>1){selectNode(g.source);return;}if(g.moved){if(e.shiftKey&&page.mode!=='flow'&&selected.size===1){const n=byId(g.source),on=pointHitsNode(worldPoint(e),g.source);if(on&&on.id!==n.id&&!descendants(n.id).has(on.id)){n.parentId=on.id;toast(`Reparented ${n.label} under ${on.label}.`);}else if(on)toast('Cannot create a hierarchy cycle.');}if(['mind','flow'].includes(page.mode)){
  // Explicit dragging fixes those objects in place, including group members.
  for(const id of Object.keys(g.original||{})){const n=byId(id);if(n)n.layoutManaged=false;}
  h3Repair(g.source);
 }recordHistory(g.before);}render();return;}
if(g.type==='marquee'){const p1=g.startWorld,p2=g.current,rect={x:Math.min(p1.x,p2.x),y:Math.min(p1.y,p2.y),w:Math.abs(p1.x-p2.x),h:Math.abs(p1.y-p2.y)};if(rect.w>=3&&rect.h>=3){if(!g.extend)selected.clear();for(const n of visibleNodes())if(n.x<rect.x+rect.w&&n.x+n.w>rect.x&&n.y<rect.y+rect.h&&n.y+n.h>rect.y)selected.add(n.id);}render();return;}
if(g.type==='connect'){const target=pointHitsNode(worldPoint(e),g.source);if(target){const point=worldPoint(e),ports=Object.entries(pointsFor(target));ports.sort((aa,bb)=>Math.hypot(aa[1].x-point.x,aa[1].y-point.y)-Math.hypot(bb[1].x-point.x,bb[1].y-point.y));const best=ports[0],nearestPort=Math.hypot(best[1].x-point.x,best[1].y-point.y)<22?best[0]:'auto';connectSource=null;makeConnection(g.source,target.id,null,g.port==='auto'?'auto':g.port,nearestPort);render();return;}
const p=worldPoint(e);if(page.mode==='flow'&&tool!=='connect'&&Math.hypot(p.x-g.anchor.x,p.y-g.anchor.y)>28){let newId;transact(()=>{const source=byId(g.source),size=initialShapeSize('process',source),preferred={x:p.x-size.w/2,y:p.y-size.h/2};const n=addNode('process',preferred.x,preferred.y,'New step',{w:size.w,h:size.h});arrangeInserted(n,preferred,'down');if(flowFocusId())n.outlineParentId=flowFocusId();newId=n.id;page.edges.push(edge(g.source,n.id,'flow',{fromPort:g.port}));h3BranchReflow(g.source);h3Repair(n.id);});if(newId)startEdit(newId);return;}
connectSource={id:g.source,port:g.port};if(tool!=='connect')tool='connect';render();toast('Source selected. Click the destination node. Press Esc to cancel.');return;}
renderCanvas();}

function setTool(k){if(!['select','hand','connect','arrow'].includes(k))return;tool=k;connectSource=null;gesture=null;renderUI();renderCanvas();}

function onCanvasDblClick(e){const aa=e.target.closest('[data-annotation-id]');if(aa){selectAnnotation(aa.dataset.annotationId);beginAnnotationEdit(aa.dataset.annotationId);return;}const n=e.target.closest('[data-node-id]');const ed=e.target.closest('[data-edge-id]');if(n){selectNode(n.dataset.nodeId);startEdit(n.dataset.nodeId);}else if(ed){selectEdge(ed.dataset.edgeId);startEdit(ed.dataset.edgeId,'edge');}else if(page.nodes.length===0)addRoot();}
function onWheel(e){e.preventDefault();const p=screenPoint(e);const z=Math.exp(-e.deltaY*(e.ctrlKey?.008:.0015));zoomAt(z,p);}
/* ----- Property editing; apply only on change, not every keystroke, to avoid focus loss. ----- */
function ensureWritableEdge(id){let ed=page.edges.find(e=>e.id===id);if(ed)return ed;if(id?.startsWith('tree_')){const generated=effectiveEdges().find(e=>e.id===id);if(generated){ed=clone(generated);page.edges.push(ed);return ed;}}return null;}
function onInspectorChange(e){const tgt=e.target,key=tgt.dataset.prop;if(!key)return;const v=tgt.type==='checkbox'?tgt.checked:tgt.value;
if(page.mode==='flow'&&key.startsWith('flowActivity_')&&selected.size===1){
  const n=byId([...selected][0]),fieldName=key.slice('flowActivity_'.length);
  if(!n||!['responsible','participants','inputs','outputs','approvals','remarks'].includes(fieldName))return;
  const text=String(v).slice(0,6000);
  transact(()=>{n.flowActivity={...(n.flowActivity||{}),[fieldName]:text};});return;
 }
 if(key.startsWith('anno_')&&selectedAnnotation){const a=annoById(selectedAnnotation),k=key.slice(5);if(!a)return;let nv=v;if(['w','h','x','y','fontSize','fontWeight','strokeWidth','opacity'].includes(k)){nv=Number(v);if(!Number.isFinite(nv))return;}if(['w','h'].includes(k))nv=Math.max(28,nv);if(k==='fontSize')nv=clamp(nv,8,70);if(k==='strokeWidth')nv=clamp(nv,0,12);if(k==='opacity')nv=clamp(nv,0,1);transact(()=>{if(a.parentId&&k==='x')a.dx=nv;else if(a.parentId&&k==='y')a.dy=nv;else if(k==='highlight'&&v==='#fff0a9')a.highlight=v;else{a[k]=nv;if(k==='textColor')a.autoTextColor=false;}});return;}
if(key==='branchStyle'&&selected.size===1){const n=byId([...selected][0]);transact(()=>{n.layoutStyle=v;});return;}
if(key.startsWith('org_')&&page.mode==='org'){const k=key.slice(4);let nv=['siblingGap','levelGap','branchGap','cardWidth','cardHeight'].includes(k)?Number(v):v;if(typeof nv==='number'){if(!Number.isFinite(nv))return;nv=clamp(nv,k==='cardWidth'?120:k==='cardHeight'?50:16,k==='cardWidth'?520:k==='cardHeight'?250:420);}transact(()=>{page.orgLayout={...orgSettings(),[k]:nv};});return;}
if(key==='grid'){showGrid=!!v;pref('grid',showGrid);render();return;}if(key==='layoutDirection'){layoutDirection=v;pref('layout',v);render();return;}
if(key==='pageMode'){if(page.nodes.length||page.edges.length){toast('For a new diagram type use Diagram menu at the top.');return;}transact(()=>page.mode=v);return;}
if(key==='pageName'){transact(()=>page.name=v.trim()||page.name);return;}
const styleKeys=['stroke','strokeWidth','strokeStyle','fontSize','fontFamily','fontWeight','italic','textColor','textAlign'];
if(selected.size&&styleKeys.includes(key)){if(v===''&&key!=='stroke')return;const converted=['strokeWidth','fontSize','fontWeight'].includes(key)?Number(v):v;if(['strokeWidth','fontSize'].includes(key)&&(!Number.isFinite(converted)||converted<1))return;if(key==='fontWeight'&&!Number.isFinite(converted))return;transact(()=>{for(const id of selected){const n=byId(id);if(n)n[key]=converted;}});return;}
if(selected.size===1){const n=byId([...selected][0]);if(!n)return;if(key==='parentId'){changeParent(n.id,v);return;}if(['x','y','w','h'].includes(key)){const val=Number(v);if(!Number.isFinite(val))return;if(['w','h'].includes(key)&&val<35){toast('Minimum size is 35 pixels.');return;}transact(()=>{n[key]=val;if(['mind','flow'].includes(page.mode)){
  if(key==='x'||key==='y'){n.layoutManaged=false;h3Repair(n.id);}
  else{h3BranchReflow(n.id);h3Repair(n.id);}
 }});return;}if(['label','shape','pinned'].includes(key)){transact(()=>n[key]=key==='label'?(v.trim()||'Untitled'):v);return;}if(key==='role'||key==='department'){transact(()=>{n.data=n.data||{};n.data[key]=v;});return;}}
if(edgeSelected){const ed=ensureWritableEdge(edgeSelected);if(!ed)return;transact(()=>{if(key==='edgeLabel')ed.label=v;else if(['kind','route','arrowStart','arrowEnd','fromPort','toPort'].includes(key))ed[key]=v;else if(['fromFraction','toFraction'].includes(key)){const n=Number(v);if(Number.isFinite(n))ed[key]=clamp(n/100,.12,.88);}else if(key==='bendOffset'){ed.bendOffset=v===''?null:Number(v);}else if(isFreeEdge(ed)&&['startX','startY','endX','endY'].includes(key)){const val=Number(v);if(Number.isFinite(val))ed[key.startsWith('start')?'start':'end'][key.endsWith('X')?'x':'y']=val;}});}}

function deletePage(id){
  if(doc.pages.length===1){toast('Every workspace needs at least one page.');return false;}
  const doomed=doc.pages.find(p=>p.id===id);if(!doomed)return false;
  // One explicit confirmation covers both the page deletion and its native links.
  const hasLinks=doomed.nodes.some(n=>n.keepitLink?.provider==='keepit'&&n.keepitLink.itemId);
  if(hasLinks){if(!confirmKeepItReferenceRemoval(doomed.nodes,`delete page '${doomed.name}'`))return false;}
  else if(!window.confirm(`Delete page '${doomed.name}' and its contents?`))return false;
  transact(()=>{doc.pages=doc.pages.filter(p=>p.id!==id);if(doc.activePageId===id)doc.activePageId=doc.pages[0].id;page=getPage();selected.clear();edgeSelected=null;});fitView();return true;
}
function setupPanelResizer(id,cssVar,prefName,fromRight=false){const handle=$(id);let dragging=false;handle.addEventListener('pointerdown',e=>{if(window.innerWidth<=850)return;e.preventDefault();dragging=true;handle.classList.add('dragging');handle.setPointerCapture(e.pointerId);});handle.addEventListener('pointermove',e=>{if(!dragging)return;const width=clamp(fromRight?window.innerWidth-e.clientX:e.clientX,200,420);document.documentElement.style.setProperty(cssVar,`${Math.round(width)}px`);renderCanvas();});handle.addEventListener('pointerup',e=>{if(!dragging)return;dragging=false;handle.classList.remove('dragging');const width=parseInt(document.documentElement.style.getPropertyValue(cssVar),10);pref(prefName,width);try{handle.releasePointerCapture(e.pointerId);}catch{}});handle.addEventListener('pointercancel',()=>{dragging=false;handle.classList.remove('dragging');});}
function mindSiblingPosition(id){
 const node=byId(id);if(page?.mode!=='mind'||!node)return {siblings:[],index:-1};
 const siblings=page.nodes.filter(n=>(n.parentId||null)===(node.parentId||null));
 return {siblings,index:siblings.findIndex(n=>n.id===id)};
}

function canMoveMindTopic(id,delta){const {siblings,index}=mindSiblingPosition(id);return index>=0&&index+delta>=0&&index+delta<siblings.length;}

function moveMindTopic(id,delta){
 if(!canMoveMindTopic(id,delta))return false;
 const {siblings,index}=mindSiblingPosition(id),other=siblings[index+delta],moving=byId(id);
 let arranged=true;
 transact(()=>{
  const from=page.nodes.indexOf(moving),to=page.nodes.indexOf(other);
  [page.nodes[from],page.nodes[to]]=[page.nodes[to],page.nodes[from]];
  const settings={...mindSettings(),order:'manual'};page.mindLayout=settings;
  let next=null;const parent=moving.parentId?byId(moving.parentId):null;
  try{
   next=proposeMindLayout(settings,parent?.id||null);
   if(parent&&next[parent.id]){const dx=parent.x-next[parent.id].x,dy=parent.y-next[parent.id].y;
    for(const point of Object.values(next)){point.x+=dx;point.y+=dy;}}
   // Collapsed descendants follow their nearest arranged ancestor so that
   // expanding the moved branch later reveals its children in the same place.
   for(const n of page.nodes)if(!next[n.id]&&!n.pinned){
    let ancestor=n.parentId?byId(n.parentId):null;const seen=new Set([n.id]);
    while(ancestor&&!seen.has(ancestor.id)){
     seen.add(ancestor.id);
     if(next[ancestor.id]){next[n.id]={x:n.x+next[ancestor.id].x-ancestor.x,y:n.y+next[ancestor.id].y-ancestor.y};break;}
     ancestor=ancestor.parentId?byId(ancestor.parentId):null;
    }
   }
   if(Object.values(next).some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))next=null;
  }catch{next=null;}
  if(next){for(const n of page.nodes)if(next[n.id]){n.x=Math.round(next[n.id].x);n.y=Math.round(next[n.id].y);}}
  else arranged=false;
 });
 toast('Topic moved '+(delta<0?'earlier':'later')+'.'+(arranged?' Use Undo to restore the previous sequence.':' Sequence saved; arrange the canvas separately.'));
 return true;
}

function updateMindOrderControls(){
 for(const [suffix,delta] of [['Earlier',-1],['Later',1]]){
  const button=$('outlineOrder'+suffix);if(!button)continue;
  button.hidden=page.mode!=='mind';button.disabled=selected.size!==1||!canMoveMindTopic([...selected][0],delta);
 }
}

async function diExitCanvasMode(){
 if(diPrefs.focus)diToggleFocus();
 if(document.fullscreenElement)try{await document.exitFullscreen();}catch(error){toast(error.message);}
}

async function captureKeepItProject({opening=false}={}){
 if(!projectIsReady||!doc||!['indexeddb','localstorage'].includes(storageMode))throw Error('ThinkIt local storage is still opening.');
 if(editing||activeModal)throw Error('Finish the open ThinkIt edit before opening or syncing a file.');
 const empty=!$('diStartScreen').hidden&&!diHasSavedProject;
 if(empty&&!opening)return null;
 if(!empty&&lastSaved!==JSON.stringify(doc)&&await persist({manual:true})!==true)throw Error('ThinkIt could not save the project on this device.');
 const payload=JSON.stringify(doc);
 return {title:doc.name,identity:doc.id,token:payload,payload,empty};
}

function bindUI(){
 const orderParent=$('btnOutlineExpand').parentElement;
 for(const [suffix,label,delta] of [['Earlier','↑',-1],['Later','↓',1]]){
  const button=dom('button','mini-text-btn',label,orderParent);button.id='outlineOrder'+suffix;button.type='button';
  button.title='Move selected topic '+suffix.toLowerCase()+' among its siblings';button.setAttribute('aria-label','Move topic '+suffix.toLowerCase());
  button.onclick=()=>{if(selected.size===1)moveMindTopic([...selected][0],delta);};
 }
$('diStartOpen').onclick=()=>$('fileInput').click();$('diStartRecent').onclick=()=>{diHideStart();diOpenProjectManager();};$('diStartCreate').onclick=()=>{diHideStart();openProjectChooser(true);};$('diStartResume').onclick=()=>{diHideStart();diOpenTab(doc.activePageId);};setupPanelResizer('leftResizer','--panel-width','leftWidth');setupPanelResizer('rightResizer','--inspector-width','rightWidth',true);canvas.addEventListener('pointerdown',diP3Start,true);canvas.addEventListener('pointermove',diP3Move,true);canvas.addEventListener('pointerup',diP3End,true);canvas.addEventListener('pointercancel',diP3End,true);canvas.addEventListener('pointerdown',onDown);canvas.addEventListener('pointermove',onMove);canvas.addEventListener('pointerup',onUp);canvas.addEventListener('pointercancel',e=>{gesture=null;renderCanvas();});canvas.addEventListener('dblclick',onCanvasDblClick);canvas.addEventListener('wheel',onWheel,{passive:false});canvas.addEventListener('contextmenu',e=>{e.preventDefault();const nodeId=e.target.closest('[data-node-id]')?.dataset.nodeId;if(nodeId){selectNode(nodeId);openNodeMenu(nodeId,e.clientX,e.clientY);}else if(e.target.closest('[data-edge-id]'))selectEdge(e.target.closest('[data-edge-id]').dataset.edgeId);});
$('shapeLibrary').addEventListener('click',e=>{const b=e.target.closest('[data-shape]');if(b)addAtCenter(b.dataset.shape);});$('shapeLibrary').addEventListener('dragstart',e=>{const b=e.target.closest('[data-shape]');if(b)e.dataTransfer.setData('application/diagramit-shape',b.dataset.shape);});$('canvasWrap').addEventListener('dragover',e=>e.preventDefault());$('canvasWrap').addEventListener('drop',e=>{e.preventDefault();const shape=e.dataTransfer?.getData('application/diagramit-shape');if(shape)dropShape(shape,worldPoint(e));});
$('pageTabs').addEventListener('click',e=>{const c=e.target.closest('[data-close-page]');if(c){e.preventDefault();e.stopPropagation();diCloseTab(c.dataset.closePage);return;}if(e.target.closest('#tabNewPage'))promptNewPage();else if(e.target.closest('#diReopenPage'))diShowOpenTabChooser();else{const t=e.target.closest('[data-page-id]');if(t)selectPage(t.dataset.pageId);}});$('diEmptyOpen').onclick=diShowOpenTabChooser;
$('pageList').addEventListener('click',e=>{const b=e.target.closest('[data-page-id]');if(b){selectPage(b.dataset.pageId);diCloseMobilePanels(false);}});$('pageList').addEventListener('contextmenu',e=>{const b=e.target.closest('[data-page-id]');if(!b)return;e.preventDefault();const p=doc.pages.find(p=>p.id===b.dataset.pageId);if(!p)return;modal('Page options',`<p class="modal-subtext">${esc(p.name)} · ${MODES[p.mode].name}</p><div class="prop-field"><label>Rename page</label><input id="renamePageInput" value="${esc(p.name)}"></div>`,[{text:'Cancel'},{text:'Delete page',action:()=>deletePage(p.id)},{text:'Save changes',primary:true,action:body=>transact(()=>p.name=body.querySelector('#renamePageInput').value.trim()||p.name)}]);});
$('outlineTree').addEventListener('click',e=>{const collapse=e.target.closest('[data-collapse-id]');if(collapse){e.preventDefault();toggleCollapse(collapse.dataset.collapseId);return;}const b=e.target.closest('[data-outline-id]');if(b){selectNode(b.dataset.outlineId);centerNode(byId(b.dataset.outlineId));diCloseMobilePanels(false);focusCanvas();}});
$('inspectorContent').addEventListener('change',onInspectorChange);$('inspectorContent').addEventListener('focusout',()=>setTimeout(renderInspector,0));$('inspectorContent').addEventListener('click',e=>{const sw=e.target.closest('[data-fill]');if(sw&&selected.size){transact(()=>{for(const id of selected){const n=byId(id);if(n)n.fill=sw.dataset.fill;}});return;}const a=e.target.closest('[data-action]')?.dataset.action;if(!a)return;switch(a){case 'edit-annotation':if(selectedAnnotation)beginAnnotationEdit(selectedAnnotation);break;case 'delete-annotation':removeSelection();break;case 'anno-transparent':if(selectedAnnotation)transact(()=>annoById(selectedAnnotation).fill='transparent');break;case 'anno-noborder':if(selectedAnnotation)transact(()=>annoById(selectedAnnotation).strokeWidth=0);break;case 'detach-annotation':if(selectedAnnotation)transact(()=>{const a=annoById(selectedAnnotation),p=annoPosition(a);a.x=p.x;a.y=p.y;a.parentId=null;});break;case 'attach-annotation':if(selectedAnnotation)promptAnnotationAnchor();break;case 'layout-branch':openOrgLayoutDialog('branch');break;case 'mind-layout-branch':openMindLayoutDialog('branch');break;case 'mind-add-keepit-reference':openMindNotes([...selected][0],{addReference:true});break;case 'mind-notes':openMindNotes([...selected][0]);break;case 'format-painter':startPainter();break;case 'reset-route':if(edgeSelected)transact(()=>{const e=findEdge(edgeSelected);e.fromPort='auto';e.toPort='auto';e.fromFraction=.5;e.toFraction=.5;e.bendOffset=null;e.bendAxis=null;});break;case 'toggle-collapse':if(selected.size===1)toggleCollapse([...selected][0]);break;
 case 'flow-focus':if(page.mode==='flow'&&selected.size===1)flowSetFocus([...selected][0]);break;
 case 'flow-wrap':flowWrapSelected();break;
 case 'flow-group':if(page.mode==='flow')t22OpenFlowGrouping();break;
 case 'flow-predecessors':if(page.mode==='flow'&&selected.size===1)t22OpenPredecessorPicker([...selected][0]);break;case 'add-department':openDepartmentDialog();break;case 'add-child':if(selected.size===1)addChild([...selected][0]);break;case 'duplicate':duplicateSelection();break;case 'delete':removeSelection();break;case 'group':groupSelection();break;case 'layout':page.mode==='org'?openOrgLayoutDialog('all'):page.mode==='mind'?openMindLayoutDialog():showLayoutPreview();break;case 'fit':fitView();break;case 'reverse-edge':reverseEdge();break;case 'duplicate-edge':duplicateEdge();break;}});
$('btnLeftToggle').onclick=()=>togglePanel('library');$('btnNewPageTop').onclick=promptNewPage;$('modePill').onclick=openModeSwitcher;$('bubbleModeTop').onclick=openModeSwitcher;$('bubbleOpenTop').onclick=()=>document.getElementById('fileInput').click();
$('btnFormatPainter').onclick=()=>{if(paintActive){paintActive=false;paintRepeat=false;renderUI();}else startPainter();};$('btnFormatPainter').ondblclick=()=>startPainter(true);
$('btnUndo').onclick=undo;$('btnRedo').onclick=redo;$('btnSave').onclick=()=>{persist({manual:true});toast('Saving to this device. Export DiagramIt JSON for a portable backup.');};$('btnExport').onclick=openExport;$('btnTheme').onclick=toggleTheme;$('btnHelp').onclick=showHelp;$('btnCommand').onclick=()=>openPalette();$('btnQuickAdd').onclick=()=>selected.size===1?addChild([...selected][0]):addRoot();$('btnAutoLayout').onclick=()=>page.mode==='org'?openOrgLayoutDialog('all'):page.mode==='mind'?openMindLayoutDialog():showLayoutPreview();$('btnDepartment').onclick=openDepartmentDialog;$('btnTextBox').onclick=()=>addAnnotation(false);$('btnAttachText').onclick=()=>addAnnotation(true);$('btnGroup').onclick=groupSelection;$('btnUngroup').onclick=ungroupSelection;$('btnNewPage').onclick=promptNewPage;$('btnNewDoc').onclick=confirmNewDoc;$('btnImport').onclick=()=>$('fileInput').click();$('fileInput').onchange=async e=>{await importFile(e.target.files?.[0],{confirm:true});e.target.value='';};$('btnZoomIn').onclick=()=>zoomAt(1.18,{x:getWorldSize().w/2,y:getWorldSize().h/2});$('btnZoomOut').onclick=()=>zoomAt(1/1.18,{x:getWorldSize().w/2,y:getWorldSize().h/2});$('btnFit').onclick=fitView;$('btnGrid').onclick=()=>{showGrid=!showGrid;pref('grid',showGrid);render();};$('btnRightToggle').onclick=()=>togglePanel('inspector');$('leftCollapse').onclick=()=>togglePanel('library');$('rightCollapse').onclick=()=>togglePanel('inspector');$('mobileMenu').onclick=()=>togglePanel('library');$('diMobilePanelBackdrop').onclick=()=>diCloseMobilePanels();$('btnMindNotes').onclick=()=>openMindNotes();$('btnOutlineExpand').onclick=()=>{transact(()=>{for(const n of page.nodes)n.collapsed=false;});};t22BindWorkspace();$('btnConnect').onclick=()=>{if(tool==='connect')selectCanvasTool('select');else{selectCanvasTool('connect');toast('Click source, then destination. Drag from a node also works.');}};
$('btnArrow').onclick=()=>{if(tool==='arrow')selectCanvasTool('select');else{selectCanvasTool('arrow');toast('Click and drag anywhere to draw an independent arrow.');}};
$('floatEdit').onclick=()=>{if(selectedAnnotation)beginAnnotationEdit(selectedAnnotation);else if(selected.size===1)startEdit([...selected][0]);else if(edgeSelected)startEdit(edgeSelected,'edge');};$('floatChild').onclick=()=>{if(selected.size===1)addChild([...selected][0]);};$('floatDuplicate').onclick=duplicateSelection;$('floatDelete').onclick=removeSelection;
$('docName').addEventListener('change',e=>{const v=e.target.value.trim();if(v)transact(()=>doc.name=v);else e.target.value=doc.name;});
window.addEventListener('resize',()=>{diSyncMobilePanels();renderCanvas();});new ResizeObserver(()=>renderCanvas()).observe($('canvasWrap'));window.addEventListener('keydown',onKeyDown);window.addEventListener('keyup',e=>{if(e.code==='Space')spacePressed=false;});window.addEventListener('blur',()=>{spacePressed=false;diP3Touches.clear();diP3Pinch=null;});window.addEventListener('pagehide',()=>{if(doc&&storageMode==='indexeddb')persist();});window.addEventListener('beforeunload',()=>{if(doc&&JSON.stringify(doc)!==lastSaved)diWriteEmergencyShadow(JSON.stringify(doc));});}
function onKeyDown(e){
if(!$('diStartScreen').hidden){if(e.key==='Escape')e.preventDefault();return;}
const cmd=e.metaKey||e.ctrlKey, key=String(e.key),lo=key.toLowerCase(),isField=!!e.target.closest('input,textarea,select,[contenteditable="true"]');if(key==='Escape'&&!activeModal&&diCloseMobilePanels()){e.preventDefault();return;}if(page?.mode==='bubble'&&!cmd)return;
if(key==='Escape'){if(paintActive){paintActive=false;paintRepeat=false;renderUI();toast('Format painter cancelled.');e.preventDefault();return;}if(activeModal){activeModal.close();e.preventDefault();return;}if(editing){finishEdit(false);e.preventDefault();return;}if(gesture){gesture=null;renderCanvas();e.preventDefault();return;}if(connectSource){connectSource=null;setTool('select');focusCanvas();e.preventDefault();return;}if(preview){cancelPreview();e.preventDefault();return;}if(tool!=='select'){selectCanvasTool('select');e.preventDefault();return;}if(selected.size||edgeSelected||selectedAnnotation){clearSelection();focusCanvas();e.preventDefault();return;}return;}
if(activeModal||editing)return;
if(page.mode==='bmc'&&!(cmd&&(lo==='s'||lo==='o')))return;
if(cmd&&(lo==='k'||lo==='f')){e.preventDefault();openPalette();return;}
if(cmd&&lo==='s'){e.preventDefault();persist({manual:true});toast('Saving locally…');return;}
if(cmd&&lo==='o'){e.preventDefault();$('fileInput').click();return;}
if(isField)return;
if(page.mode==='mind'&&cmd&&e.shiftKey&&!e.altKey&&['ArrowUp','ArrowDown'].includes(key)&&selected.size===1){e.preventDefault();if(!e.repeat)moveMindTopic([...selected][0],key==='ArrowUp'?-1:1);return;}
if(cmd&&e.altKey&&lo==='c'){e.preventDefault();if(selected.size===1){paintStyle=visualStyle(byId([...selected][0]));toast('Style copied. Select destination and press ⌘⌥V, or activate Format Painter.');}return;}
if(cmd&&e.altKey&&lo==='v'){e.preventDefault();if(paintStyle&&selected.size)transact(()=>{for(const id of selected)applyVisualStyle(byId(id),paintStyle);});else toast('Copy a shape style first with ⌘⌥C.');return;}
if(cmd){switch(lo){case 'z':e.preventDefault();e.shiftKey?redo():undo();return;case 'y':e.preventDefault();redo();return;case 'd':e.preventDefault();if(edgeSelected)duplicateEdge();else duplicateSelection();return;case 'g':e.preventDefault();e.shiftKey?ungroupSelection():groupSelection();return;case 'c':if(!e.defaultPrevented){e.preventDefault();diCutCopy(false);}return;case 'x':if(!e.defaultPrevented){e.preventDefault();diCutCopy(true);}return;case 'v':if(!e.defaultPrevented){e.preventDefault();diPaste();}return;case 'enter':e.preventDefault();if(selected.size===1)startEdit([...selected][0]);else if(edgeSelected)startEdit(edgeSelected,'edge');return;}}
if(key.startsWith('Arrow')){
 const direction={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'}[key];
 if(e.altKey&&selected.size===1){e.preventDefault();if(!e.repeat)directionalCreation(direction,e.shiftKey);return;}
 if(!e.altKey&&!cmd){e.preventDefault();if(e.shiftKey&&selected.size){const step=6;const v={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]};nudge(...v[key]);}
 else if(!e.shiftKey)selectDirectionalNeighbor(direction);return;}
}
// Tool switches must outrank direct typing for the documented Shift+V and Shift+H shortcuts.
if(e.shiftKey&&!cmd&&!e.altKey&&(lo==='v'||lo==='h')){e.preventDefault();selectCanvasTool(lo==='v'?'select':'hand');return;}
if(selectedAnnotation&&!cmd&&!e.altKey&&key.length===1&&key!==' '){e.preventDefault();beginAnnotationEdit(selectedAnnotation,key);return;}
if(key==='F2'&&selectedAnnotation){e.preventDefault();beginAnnotationEdit(selectedAnnotation);return;}
if(key==='F2'){if(selected.size===1||edgeSelected){e.preventDefault();if(selected.size===1)startEdit([...selected][0]);else startEdit(edgeSelected,'edge');}return;}
if(selected.size===1&&!cmd&&!e.altKey&&key.length===1&&key!==' '){e.preventDefault();if(!e.repeat)startEdit([...selected][0],'node',key);return;}
if((key==='Backspace'||key==='Delete')&&selectedAnnotation){e.preventDefault();removeSelection();return;}
if(key==='Backspace'||key==='Delete'){e.preventDefault();removeSelection();return;}
if(key==='Tab'&&selected.size===1){e.preventDefault();if(e.shiftKey&&page.mode!=='flow'){const id=[...selected][0],n=byId(id);if(n?.parentId){const parent=byId(n.parentId);changeParent(id,parent?.parentId||'');}return;}if(!e.repeat)addChild([...selected][0]);return;}
if(key==='Enter'&&selected.size===1){e.preventDefault();if(!e.repeat)addChild([...selected][0],true);return;}
if(key===' '||e.code==='Space'){if(!cmd){spacePressed=true;e.preventDefault();}return;}
if(key==='!'&&e.shiftKey){e.preventDefault();fitView();return;}if(key==='@'&&e.shiftKey){e.preventDefault();view.k=1;view.x=0;view.y=0;renderCanvas();return;}
if(cmd||e.altKey)return;
if(e.shiftKey&&lo==='v'){selectCanvasTool('select');e.preventDefault();return;}if(e.shiftKey&&lo==='h'){selectCanvasTool('hand');e.preventDefault();return;}
if(lo==='t'){e.preventDefault();addAnnotation(false);return;}
if(lo==='v'){selectCanvasTool('select');e.preventDefault();}
else if(lo==='h'){selectCanvasTool('hand');e.preventDefault();}
else if(lo==='c'){selectCanvasTool('connect');toast('Click a source node, then a destination node. V exits.');e.preventDefault();}
else if(lo==='a'){selectCanvasTool('arrow');toast('Drag to draw a free annotation arrow. V exits.');e.preventDefault();}
else if(lo==='r'&&selected.size===1&&page.mode!=='flow'){reparentPick=[...selected][0];toast('Click a target parent. Esc cancels.');e.preventDefault();}
else if(key==='+'||key==='='){e.preventDefault();zoomAt(1.15,{x:getWorldSize().w/2,y:getWorldSize().h/2});}
else if(key==='-'){e.preventDefault();zoomAt(1/1.15,{x:getWorldSize().w/2,y:getWorldSize().h/2});}
}

function openNodeMenu(id,x,y){const n=byId(id);if(!n)return;const items=[['Edit text','edit'],...(page.mode==='flow'&&page.nodes.some(child=>child.outlineParentId===id)?[[n.collapsed?'Expand subprocess':'Collapse subprocess','collapse']]:[]),...(page.mode==='org'?[['Add department under…','department']]:[]),['Add connected child','add'],...(page.mode==='mind'?[['Move topic earlier','earlier'],['Move topic later','later']]:[]),['Duplicate','duplicate'],...(page.mode!=='flow'?[['Change parent (click a node)','reparent'],[n.collapsed?'Expand branch':'Collapse branch','collapse']]:[]),['Delete node / branch','delete']];const root=$('modalRoot');if(!root.hidden)return;let menu=document.getElementById('nodeContextMenu');if(menu)menu.remove();menu=dom('div','context-menu',undefined,document.body);menu.style.cssText=`position:fixed;z-index:25;left:${Math.min(window.innerWidth-240,x)}px;top:${Math.min(window.innerHeight-220,y)}px;width:225px;background:var(--surface);border:1px solid var(--border);border-radius:9px;box-shadow:var(--shadow);padding:6px`;menu.id='nodeContextMenu';for(const [text,action] of items){const b=dom('button','',text,menu);b.style.cssText='display:block;width:100%;padding:10px;border:none;border-radius:5px;background:transparent;text-align:left;color:var(--ink);font-size:12px';b.onmouseenter=()=>b.style.background='var(--teal-light)';b.onmouseleave=()=>b.style.background='transparent';b.onclick=()=>{menu.remove();if(action==='earlier')moveMindTopic(id,-1);if(action==='later')moveMindTopic(id,1);if(action==='edit')startEdit(id);if(action==='department')openDepartmentDialog();if(action==='add')addChild(id);if(action==='duplicate')duplicateSelection();if(action==='reparent'){reparentPick=id;toast('Click the new parent. Esc cancels.');}if(action==='collapse')toggleCollapse(id);if(action==='delete')removeSelection();};}setTimeout(()=>window.addEventListener('pointerdown',function dismiss(e){if(!menu.contains(e.target)){menu.remove();window.removeEventListener('pointerdown',dismiss);}}, {capture:true}),0);}

/* DiagramIt 0.9 shared command shell. Keeps document engines and old project schema intact. */
const DI_MENUS=['File','Edit','Insert','View','Format','Help'];
const DI_PREF_KEY='diagramit_v093_ui';
let diPrefs={toolsVisible:true,activeTab:'Insert',focus:false,grid:true,snap:true,ruler:false};
try{diPrefs={...diPrefs,...JSON.parse(localStorage.getItem(DI_PREF_KEY)||'{}')}}catch{}
let diMenuOpen='',diBubbleState={pane:'program',selection:'none',theme:'formal',showAreas:false};
let diFrameCounter=0,diClipboard=null;
const diCommands={};
function diAdd(id,label,group,run,{modes=null,enabled=null,shortcut='',icon='•'}={}){diCommands[id]={id,label,group,run,modes,enabled,shortcut,icon};}
function diIsBubble(){return page?.mode==='bubble'}
function diBubble(action,payload={}){
  if(!diIsBubble()||!bubbleReady){toast('Bubble editor is still opening.');return}
  bubbleFrame().contentWindow.postMessage({channel:'diagramit-bubble-v06',type:'ui-command',requestId:++diFrameCounter,action,payload},location.origin);
}
function diRun(id){const c=diCommands[id];if(!c)return;if(!diEnabled(c))return;diCloseMenu(true);try{c.run()}catch(err){console.error('Command '+id,err);toast('Command could not complete: '+err.message)}}
function diEnabled(c){if(page?.mode==='bmc'&&!diBusinessCommand(c))return false;if(diNoTabs()&&!((c.id||'').startsWith('file.')||(c.id||'').startsWith('help.')||['view.tools','view.focus','view.theme'].includes(c.id)))return false;return !!page&&(!c.modes||c.modes.includes(page.mode))&&(!c.enabled||c.enabled())}
function diClick(id){document.getElementById(id)?.click()}
function diFormatNode(key,value){if(diIsBubble()){toast('Select the bubble and use its detailed Properties panel for this formatting.');return;}if(!selected.size){toast('Select a shape to format.');return;}transact(()=>{for(const id of selected){const n=byId(id);if(n)n[key]=value;}})}
function diEnsureInspector(){if(document.body.classList.contains('inspector-collapsed'))togglePanel('inspector');}
function diSaveAs(){if(exportJson())toast('Editable DiagramIt copy downloaded · not a live file binding.');}
async function diShare(){
  let portable;try{portable=diPortableSnapshot();}catch(err){console.error(err);toast('Project sharing blocked: '+err.message);return;}
  const file=new File([portable.blob],portable.filename,{type:'application/json'});
  if(navigator.share&&navigator.canShare?.({files:[file]})){
    try{await navigator.share({title:doc.name,files:[file]});return}catch(e){if(e.name==='AbortError')return;console.warn(e)}
  }
  if(exportJson())toast('Sharing is unavailable here. A portable project copy was downloaded.');
}
function diCutCopy(cut=false){
 if(diIsBubble()){diBubble(cut?'edit.cut':'edit.copy');return}
 if(!selected.size){toast('Select a shape or group first.');return}
 const ids=affectedSelectionIds(),nodes=page.nodes.filter(n=>ids.has(n.id));
 const edges=page.edges.filter(e=>ids.has(e.from)&&ids.has(e.to));
 const annotations=(page.annotations||[]).filter(a=>a.parentId&&ids.has(a.parentId));
 // A cancelled Cut must leave BOTH the map and old clipboard unchanged.
 if(cut&&(!confirmKeepItReferenceRemoval(nodes,'cut')||!removeSelection({alreadyConfirmed:true})))return;
 diClipboard={nodes:clone(nodes),edges:clone(edges),annotations:clone(annotations),serial:0,wasCut:!!cut};
 toast(cut?'Cut objects to DiagramIt clipboard.':'Copied objects to DiagramIt clipboard.');
}
function diPaste(){
 if(diIsBubble()){diBubble('edit.paste');return}
 if(!diClipboard?.nodes?.length){toast('Nothing copied in DiagramIt.');return}
 const {nodes,edges,annotations}=diClipboard;
 // Native note associations must not become invisible data in non-Mind pages.
 if(page.mode!=='mind'&&nodes.some(n=>n.keepitLink?.provider==='keepit'&&n.keepitLink.itemId)){toast('Linked KeepIt topics can only be pasted into a Mind Map. Switch to a Mind Map before pasting.');return;}
 // Undo after Cut restores the originals. A subsequent paste is then a COPY,
 // and must use the same shared-note disclosure as any other duplication.
 const originalStillExists=diClipboard.wasCut&&doc.pages.some(p=>p.nodes.some(n=>nodes.some(old=>old.id===n.id)));
 if((!diClipboard.wasCut||originalStillExists)&&!confirmSharedKeepItCopy(nodes,'paste'))return;
 diClipboard.serial++;diClipboard.wasCut=false;
 const map=new Map(nodes.map(n=>[n.id,uid()]));const step=28*diClipboard.serial;const created=[];
 transact(()=>{
  for(const old of nodes){const n=clone(old);n.id=map.get(old.id);n.x+=step;n.y+=step;n.parentId=map.get(old.parentId)||null;n.groupId=null;page.nodes.push(n);created.push(n.id);}
  for(const old of edges)page.edges.push({...clone(old),id:uid(),from:map.get(old.from),to:map.get(old.to)});
  for(const old of annotations){const a=clone(old);a.id=uid();a.parentId=map.get(old.parentId);(page.annotations||(page.annotations=[])).push(a)}
  selected=new Set(created);edgeSelected=null;
 });toast(`Pasted ${created.length} shape(s).`);
}
function diSelectAll(){if(diIsBubble()){diBubble('edit.selectAll');return}selected=new Set(visibleNodes().map(n=>n.id));edgeSelected=null;render()}
function diDeselect(){if(diIsBubble()){diBubble('edit.deselect');return}clearSelection()}
function diFullscreen(){
 if(document.fullscreenElement){document.exitFullscreen?.().catch(e=>toast(e.message));return}
 document.documentElement.requestFullscreen?.().catch(e=>toast('Fullscreen is not available: '+e.message));
}
function diToggleFocus(){
 diPrefs.focus=!diPrefs.focus;
 document.body.classList.toggle('di-focus',diPrefs.focus);
 diSyncShell();
 if(diPrefs.focus)$('diFocusExit').focus({preventScroll:true});
 else{
  $('diFocusToggle').focus({preventScroll:true});
  requestAnimationFrame(()=>{if(!diIsBubble())renderCanvas()});
 }
}
function diSavePrefs(){const {focus,...preferences}=diPrefs;try{localStorage.setItem(DI_PREF_KEY,JSON.stringify(preferences))}catch{}}
function diToggleRibbon(){diPrefs.toolsVisible=!diPrefs.toolsVisible;document.body.classList.toggle('di-tools-hidden',!diPrefs.toolsVisible);diSavePrefs();diSyncShell()}
function diGridToggle(){if(diIsBubble()){toast('Bubble diagrams use a conceptual dotted drafting grid. Custom grid controls are in development.');return;}showGrid=!showGrid;pref('grid',showGrid);render();diSyncShell()}
function diRulerToggle(){diPrefs.ruler=!diPrefs.ruler;diSavePrefs();toast(diPrefs.ruler?'Conceptual rulers enabled (not calibrated dimensions).':'Rulers disabled.');diRenderRuler()}
function diRenderRuler(){let ruler=document.getElementById('diRulerOverlay');if(!ruler){ruler=document.createElement('div');ruler.id='diRulerOverlay';ruler.style.cssText='position:absolute;top:0;left:0;right:0;height:23px;pointer-events:none;background:repeating-linear-gradient(90deg,transparent 0 24px,#0d747544 24px 25px),var(--surface2);border-bottom:1px solid var(--outline);opacity:.83;z-index:4';$('canvasWrap').append(ruler)}ruler.hidden=!diPrefs.ruler||diIsBubble()}
function diPreferences(){const body=modal('Preferences',`<p class="modal-subtext">Settings apply to this browser. Diagram data is unchanged.</p><div class="di-pref-box"><label><input type="checkbox" id="diPrefRibbon"> Show tools when opening DiagramIt</label><label><input type="checkbox" id="diPrefRuler"> Show conceptual ruler</label><label><input type="checkbox" id="diPrefSnap"> Enable snapping (where supported)</label><label>Interface theme <select id="diPrefTheme"><option value="light">Light</option><option value="dark">Dark</option></select></label><p class="modal-subtext">Local recovery is not a file backup. Export DiagramIt JSON regularly for portable copies.</p></div>`,[{text:'Close'}]);
 body.querySelector('#diPrefRibbon').checked=diPrefs.toolsVisible;body.querySelector('#diPrefRuler').checked=diPrefs.ruler;body.querySelector('#diPrefSnap').checked=diPrefs.snap;body.querySelector('#diPrefTheme').value=theme;
 body.querySelector('#diPrefRibbon').onchange=e=>{if(e.target.checked!==diPrefs.toolsVisible)diToggleRibbon()};body.querySelector('#diPrefRuler').onchange=e=>{if(e.target.checked!==diPrefs.ruler)diRulerToggle()};body.querySelector('#diPrefSnap').onchange=e=>{diPrefs.snap=e.target.checked;diSavePrefs()};body.querySelector('#diPrefTheme').onchange=e=>{if(theme!==e.target.value)toggleTheme()};
}
function diPanel(which){togglePanel(which);diSyncShell()}
function diAddText(){if(diIsBubble()){diBubble('insert.text');return;}diClick('btnTextBox')}
function diInsertArrow(){if(diIsBubble()){diBubble('insert.arrow');return;}diClick('btnArrow')}
function diAddShape(){if(diIsBubble()){diBubble('insert.bubble');return;}diClick('btnQuickAdd')}
function diPalette(){openPalette()}
function diMode(){openModeSwitcher()}
function diFormatInspector(){if(diIsBubble()){diBubble('view.canvas');toast('Select an object. Its properties appear on the right of the Bubble workspace.');return;}diEnsureInspector();}
let diPrintCounter=0;const diPrintPending=new Map();
// P1: share Bubble's established page-size/fit/title print-preview controller
// with Flowchart, Org Chart and Mind Map. Only presentation changes here.
function diPrintStandardSheet(){
 const svg=staticSVG(); // complete printable content, not the viewport-culling layer
 const match=svg.match(/\bviewBox="([^"]+)"/);
 const values=(match?.[1]||'').trim().split(/[\s,]+/).map(Number);
 const vb=values.length===4&&values.every(Number.isFinite)&&values[2]>0&&values[3]>0
  ?values.join(' '):'0 0 1100 790';
 const popup=window.open('','_blank');
 if(!popup){toast('Allow pop-ups to open the Print Layout preview.');return;}
 // Single-pass placeholder expansion prevents recursive substitutions when
 // a user topic/project name happens to contain a placeholder-like string.
 const tokens={'__TITLE__':esc(page.name||MODES[page.mode]?.name||'Diagram'),
  '__SVG__':svg,'__CONTENT_VIEWBOX__':vb};
 const html=diPrintCleanTemplate().replace(/__TITLE__|__SVG__|__CONTENT_VIEWBOX__/g,key=>tokens[key]);
 try{popup.document.open();popup.document.write(html);popup.document.close();popup.focus();}
 catch(err){console.error(err);if(!popup.closed)popup.close();toast('Could not prepare the print preview.');}
}
function diPrintCleanTemplate(){
 // White print sheet, not cream-tinted bands around tall portrait diagrams.
 return PRINT_LAYOUT_HTML.replace('</head>','<style>#diagramSlot{background:#fff!important}</style></head>');
}
function diPrint(){
 if(page.mode==='bmc'){businessModel.print();return;}
 if(!diIsBubble()){diPrintStandardSheet();return;}
 if(!bubbleReady){toast('Bubble workspace is still loading.');return;}
 const popup=window.open('','_blank');
 if(!popup){toast('Allow pop-ups to print or save this Bubble Diagram as PDF.');return;}
 const requestId=++diPrintCounter;
 popup.document.open();popup.document.write('<!doctype html><html><head><meta charset="utf-8"><title>ThinkIt · Preparing print sheet</title></head><body style="font:14px sans-serif;padding:24px">Preparing a clean Bubble Diagram print sheet…</body></html>');popup.document.close();
 diPrintPending.set(requestId,{popup,pageId:page.id,project:doc.name,pageName:page.name});
 bubbleFrame().contentWindow.postMessage({channel:'diagramit-bubble-v06',type:'export',kind:'print-svg',requestId},location.origin);
 setTimeout(()=>{const job=diPrintPending.get(requestId);if(job){diPrintPending.delete(requestId);if(!job.popup.closed)job.popup.document.body.textContent='Print sheet could not be prepared. Close this tab and try again.';}},15000);
}
const PRINT_LAYOUT_HTML="<!DOCTYPE html>\n<html lang=\"en\"><head><meta charset=\"utf-8\"/><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/><title>__TITLE__ | ThinkIt \u00b7 Print Layout</title>\n<style>\n:root{--navy:#0d2f4f;--teal:#0d7475;--line:#cddbdd;--paper:#fff;--bg:#e8eded;--gray:#516b76}\n*{box-sizing:border-box}\nbody{margin:0;color:var(--navy);background:var(--bg);font:13px/1.4 -apple-system,BlinkMacSystemFont,\"Segoe UI\",Arial,sans-serif;display:grid;grid-template-columns:288px minmax(0,1fr);height:100vh;overflow:hidden}\n#controls{height:100vh;overflow:auto;background:#f7f7f3;border-right:1px solid #b8cacc;padding:18px;box-shadow:3px 0 14px #112f4b10;z-index:2}\nh1{font-size:19px;margin:0 0 4px}h2{font-size:13px;margin:18px 0 8px}.muted{color:var(--gray);font-size:12px}\nlabel{display:block;margin:11px 0 4px;font-size:12px;font-weight:650}select,input[type=number],input[type=range]{width:100%;accent-color:var(--teal)}select,input[type=number]{border:1px solid #b6c8ca;border-radius:6px;background:white;color:#12394e;padding:8px;font:inherit}input[type=range]{height:20px}\n.twocol{display:grid;grid-template-columns:1fr 1fr;gap:10px}.threecol{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.row{display:flex;gap:8px;align-items:center}.smallbtn{background:white;border:1px solid #a5babb;color:var(--navy);padding:8px;border-radius:6px;cursor:pointer;font-weight:600}.smallbtn:hover{border-color:var(--teal)}button.primary{color:white;background:var(--teal);border:0;border-radius:7px;padding:11px 13px;cursor:pointer;font-size:13px;font-weight:700}.primary:hover{background:#096064}.buttons{display:grid;gap:8px;margin-top:17px}\n#stage{overflow:auto;display:flex;flex-direction:column;align-items:center;min-width:0}#stageHead{width:100%;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;background:#f2f6f5;border-bottom:1px solid #c5d4d5}#stageArea{flex:1;min-height:0;min-width:0;width:100%;overflow:auto;display:flex;align-items:flex-start;justify-content:center;padding:20px}#sheetHost{flex:none}#sheet{background:white;box-shadow:0 7px 25px #172b3b38;transform-origin:top left;display:flex;flex-direction:column;gap:0;overflow:hidden;position:relative;color:var(--navy)}\n#sheetHeader{display:flex;align-items:center;flex:none;min-height:10mm;padding-bottom:2mm}#sheetHeader h3{font-size:16pt;line-height:1.12;margin:0;font-weight:700}\n#diagramSlot{min-height:0;flex:1;position:relative;overflow:hidden;background:#fbfaf5;margin-top:1.5mm;margin-bottom:0}\n#diagramSlot svg{position:absolute;display:block;max-width:none;max-height:none;overflow:visible}\n\n#warning{margin:13px 0 0;padding:8px 10px;background:#ffeedb;color:#804d16;border-radius:6px;font-size:11px}#warning[hidden]{display:none}\n.tip{background:#edf3f1;border-radius:6px;padding:9px;font-size:11px;color:#4b656d;margin-top:16px}.check{display:flex;gap:8px;align-items:center;margin-top:9px;font-size:12px}.check input{accent-color:var(--teal)}\n@media(max-width:790px){body{grid-template-columns:220px 1fr}#controls{padding:12px}}\n@page{size:297mm 210mm;margin:0}\n@media print{html,body{width:auto!important;height:auto!important;overflow:visible!important;display:block!important;background:white!important;margin:0!important;padding:0!important}#controls,#stageHead{display:none!important}#stage,#stageArea,#sheetHost{display:block!important;overflow:visible!important;width:auto!important;height:auto!important;min-height:0!important;margin:0!important;padding:0!important}#sheet{transform:none!important;box-shadow:none!important;margin:0!important;page-break-inside:avoid;break-inside:avoid}#diagramSlot{background:#fbfaf5}body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}\n</style><style id=\"pageRules\"></style></head>\n<body>\n<aside id=\"controls\"><h1>Print Layout</h1><div class=\"muted\">Arrange the diagram on the page before printing or saving as PDF.</div>\n<h2>Page setup</h2><div class=\"twocol\"><div><label for=\"paper\">Paper size</label><select id=\"paper\"><option>A4</option><option>A3</option><option>A2</option><option>Letter</option><option>Legal</option></select></div><div><label for=\"orientation\">Orientation</label><select id=\"orientation\"><option value=\"landscape\">Landscape</option><option value=\"portrait\">Portrait</option></select></div></div>\n<label for=\"margins\">Internal margins</label><select id=\"margins\"><option value=\"5\">Narrow \u00b7 5 mm</option><option value=\"10\" selected>Standard \u00b7 10 mm</option><option value=\"15\">Comfortable \u00b7 15 mm</option><option value=\"20\">Wide \u00b7 20 mm</option></select>\n<h2>Diagram position</h2><label for=\"framing\">Content framing</label><select id=\"framing\"><option value=\"content\">Fit all diagram content</option><option value=\"canvas\">Show full drawing canvas</option></select>\n<div class=\"row\" style=\"justify-content:space-between;margin-top:12px\"><label for=\"scale\" style=\"margin:0\">Artwork size (relative to fit)</label><strong id=\"scaleValue\">100%</strong></div><input id=\"scale\" type=\"range\" min=\"40\" max=\"140\" step=\"5\" value=\"100\"/>\n<div class=\"twocol\"><div><label for=\"halign\">Horizontal</label><select id=\"halign\"><option value=\"left\">Left</option><option value=\"center\" selected>Center</option><option value=\"right\">Right</option></select></div><div><label for=\"valign\">Vertical</label><select id=\"valign\"><option value=\"top\">Top</option><option value=\"center\" selected>Center</option><option value=\"bottom\">Bottom</option></select></div></div>\n<div class=\"twocol\"><div><label for=\"offsetX\">Shift X (mm)</label><input id=\"offsetX\" type=\"number\" min=\"-100\" max=\"100\" step=\"1\" value=\"0\"/></div><div><label for=\"offsetY\">Shift Y (mm)</label><input id=\"offsetY\" type=\"number\" min=\"-100\" max=\"100\" step=\"1\" value=\"0\"/></div></div>\n\n<div class=\"buttons\"><button id=\"fit\" class=\"smallbtn\" type=\"button\">Fit and center diagram</button><button id=\"print\" class=\"primary\" type=\"button\">Print / Save as PDF</button></div>\n<div id=\"warning\" hidden role=\"status\"></div>\n<div class=\"tip\">Chrome print settings: choose <strong>Save as PDF</strong>, keep <strong>Scale 100%</strong> and enable <strong>Background graphics</strong>. The page size and orientation are set here. In Chrome, disable <strong>Headers and footers</strong>. If Chrome overrides the page size or orientation, match the values shown here.</div>\n</aside>\n<section id=\"stage\"><div id=\"stageHead\"><strong>Print preview \u2014 __TITLE__</strong><span class=\"muted\" id=\"pageInfo\">A4 landscape \u00b7 1 page</span></div><div id=\"stageArea\"><div id=\"sheetHost\"><main id=\"sheet\"><header id=\"sheetHeader\"><h3>__TITLE__</h3></header><div id=\"diagramSlot\" data-content-view-box=\"__CONTENT_VIEWBOX__\">__SVG__</div></main></div></div></section>\n<script src=\"/thinkit/40791585175d0e8d51c4/assets/print-layout.js?v=measured-2\"></script></body></html>";
function diPrintBubbleSheet(msg){
 const job=diPrintPending.get(msg.requestId);if(!job)return;
 diPrintPending.delete(msg.requestId);
 if(job.popup.closed||job.pageId!==msg.pageId){if(!job.popup.closed)job.popup.close();return;}
 const safe=val=>esc(String(val??''));
 const colors=(msg.zones||[]).slice(0,18).filter(z=>/^#[0-9a-f]{6}$/i.test(z.fill)&&/^#[0-9a-f]{6}$/i.test(z.stroke));
 const legend=colors.map(z=>`<span class="zone"><i style="background:${z.fill};border-color:${z.stroke}"></i>${safe(z.name)}</span>`).join('');
 const extra=(msg.zones||[]).length>18?`<span class="zone">+${(msg.zones||[]).length-18} more zones</span>`:'';
 const allowedBounds=/^-?[0-9.]+(?:\s+-?[0-9.]+){3}$/;
 const vb=allowedBounds.test(String(msg.contentViewBox||''))?msg.contentViewBox:'0 0 1100 790';
 let html=PRINT_LAYOUT_HTML;
 const tokens={'__TITLE__':safe(job.pageName),'__PROJECT__':safe(job.project),
  '__SPACES__':String(Number(msg.spaces)||0),'__AREA__':Math.round(Number(msg.area)||0).toLocaleString(),
  '__ZONES__':legend,'__MORE__':extra,'__SVG__':msg.svg,'__CONTENT_VIEWBOX__':vb};
 html=diPrintCleanTemplate().replace(/__TITLE__|__PROJECT__|__SPACES__|__AREA__|__ZONES__|__MORE__|__SVG__|__CONTENT_VIEWBOX__/g,key=>tokens[key]);
 try{job.popup.document.open();job.popup.document.write(html);job.popup.document.close();job.popup.focus();}
 catch(err){console.error(err);toast('Could not prepare print layout.');}
}
function diExportSvg(){if(diIsBubble()){bubbleExport('svg');return;}exportSvg()}
function diExportPng(){if(diIsBubble()){bubbleExport('png');return;}exportPNG()}
// File menu
 diAdd('file.new','New Project','File',confirmNewDoc,{shortcut:'⌘N',icon:'＋'});
 diAdd('file.newPage','New Diagram','File',promptNewPage,{shortcut:'',icon:'▦'});
  diAdd('file.openPage','Open Diagram Tab…','File',diShowOpenTabChooser,{icon:'☷'});
 diAdd('file.open','Open Project…','File',()=>diClick('fileInput'),{shortcut:'⌘O',icon:'↥'});
 diAdd('file.recent','Project Manager / Open Recent…','File',diOpenProjectManager,{icon:'☷'});
 diAdd('file.save','Save on this device','File',()=>persist({manual:true}),{shortcut:'⌘S',icon:'✓'});
 diAdd('file.saveAs','Save As… (New Local Project)','File',diSaveAsLocalProject,{shortcut:'⇧⌘S',icon:'↧'});
 diAdd('file.saveCopy','Download Portable JSON…','File',diSaveAs,{icon:'⇩'});
 diAdd('file.recovery','Restore Local Version…','File',openLocalRecovery,{icon:'↶'});
 diAdd('file.export','Export…','File',openExport,{icon:'⇩'});
 diAdd('file.print','Print / PDF…','File',diPrint,{shortcut:'⌘P',icon:'▤'});
 diAdd('file.share','Share Project…','File',diShare,{icon:'↗'});
 diAdd('file.preferences','Preferences…','File',diPreferences,{shortcut:'⌘,',icon:'⚙'});
// Edit menu
 diAdd('edit.undo','Undo','Edit',()=>diIsBubble()?diBubble('edit.undo'):undo(),{shortcut:'⌘Z',icon:'↶'});
 diAdd('edit.redo','Redo','Edit',()=>diIsBubble()?diBubble('edit.redo'):redo(),{shortcut:'⇧⌘Z',icon:'↷'});
 diAdd('edit.cut','Cut','Edit',()=>diCutCopy(true),{shortcut:'⌘X',icon:'✂'});
 diAdd('edit.copy','Copy','Edit',()=>diCutCopy(false),{shortcut:'⌘C',icon:'▢'});
 diAdd('edit.paste','Paste','Edit',diPaste,{shortcut:'⌘V',icon:'▣'});
 diAdd('edit.delete','Delete','Edit',()=>diIsBubble()?diBubble('edit.delete'):removeSelection(),{shortcut:'⌫',icon:'⌫'});
 diAdd('edit.selectAll','Select All','Edit',diSelectAll,{shortcut:'⌘A',icon:'▧'});
 diAdd('edit.deselect','Deselect','Edit',diDeselect,{shortcut:'Esc',icon:'◌'});
 diAdd('edit.duplicate','Duplicate','Edit',()=>diIsBubble()?diBubble('edit.duplicate'):duplicateSelection(),{shortcut:'⌘D',icon:'⧉'});
 diAdd('edit.group','Group','Edit',groupSelection,{modes:['flow','org','mind'],shortcut:'⌘G',icon:'▣'});
 diAdd('edit.ungroup','Ungroup','Edit',ungroupSelection,{modes:['flow','org','mind'],shortcut:'⇧⌘G',icon:'◫'});
 diAdd('edit.topicEarlier','Move Topic Earlier','Edit',()=>moveMindTopic([...selected][0],-1),{modes:['mind'],enabled:()=>selected.size===1&&canMoveMindTopic([...selected][0],-1),shortcut:'⌘⇧↑',icon:'↑'});
 diAdd('edit.topicLater','Move Topic Later','Edit',()=>moveMindTopic([...selected][0],1),{modes:['mind'],enabled:()=>selected.size===1&&canMoveMindTopic([...selected][0],1),shortcut:'⌘⇧↓',icon:'↓'});
 diAdd('edit.formatPainter','Format Painter','Edit',()=>diIsBubble()?diBubble('edit.formatPainter'):diClick('btnFormatPainter'),{icon:'◈'});
 diAdd('edit.find','Find Command or Object…','Edit',diPalette,{shortcut:'⌘K',icon:'⌕'});
// Insert menu
 diAdd('insert.shape','Shape / Bubble','Insert',diAddShape,{icon:'◇'});
 diAdd('insert.arrow','Arrow / Connector','Insert',diInsertArrow,{icon:'↗'});
 diAdd('insert.text','Text / Note','Insert',diAddText,{icon:'T'});
 diAdd('insert.underlay','Image Underlay…','Insert',()=>diBubble('insert.underlay'),{modes:['bubble'],icon:'▧'});
 diAdd('insert.overlay','Image Overlay…','Insert',()=>toast('Image overlay is planned; Bubble currently supports image underlays.'),{modes:['bubble'],enabled:()=>false,icon:'▣'});
 diAdd('insert.link','Hyperlink…','Insert',()=>toast('Hyperlink attachment is scheduled for a later release.'),{enabled:()=>false,icon:'🔗'});
 diAdd('insert.sun','Sun Path','Insert',()=>diBubble('insert.sun'),{modes:['bubble'],icon:'☼'});
 diAdd('insert.wind','Wind / Monsoon Direction','Insert',()=>diBubble('insert.wind'),{modes:['bubble'],icon:'≋'});
 diAdd('insert.zone','Functional Zone / Department','Insert',()=>diIsBubble()?diBubble('format.zones'):page.mode==='org'?diClick('btnDepartment'):toast('Choose the appropriate diagram type first.'),{modes:['bubble','org'],icon:'▦'});
 diAdd('insert.attachedText','Attach Text to Shape','Insert',()=>diClick('btnAttachText'),{modes:['flow','org','mind'],icon:'▤'});
// View menu
 diAdd('view.program','Space Program','View',()=>diBubble('view.program'),{modes:['bubble'],icon:'▤'});
 diAdd('view.matrix','Adjacency Matrix','View',()=>diBubble('view.matrix'),{modes:['bubble'],icon:'▦'});
 diAdd('view.audit','Review Layout','View',()=>diBubble('view.audit'),{modes:['bubble'],icon:'◎'});
 diAdd('view.canvas','Bubble Diagram','View',()=>diBubble('view.canvas'),{modes:['bubble'],icon:'◯'});
 diAdd('view.chart','Chart View','View',()=>{if(!diIsBubble())diEnsureCanvasVisible();else diBubble('view.canvas')},{modes:['flow','org','mind'],icon:'◇'});
 diAdd('view.outline','Outline / Shapes Panel','View',()=>{if(document.body.classList.contains('sidebar-collapsed'))diPanel('library')},{modes:['flow','org','mind'],icon:'☷'});
 diAdd('view.fullscreen','Full Screen','View',diFullscreen,{icon:'⛶'});
 diAdd('view.focus','Focus Mode','View',diToggleFocus,{shortcut:'⇧F',icon:'◫'});
 diAdd('view.tools','Show / Hide Tools','View',diToggleRibbon,{shortcut:'⌘\\',icon:'⌃'});
 diAdd('view.ruler','Page rulers','View',diPrint,{modes:['flow','org','mind'],icon:'▤'});
 diAdd('view.grid','Grid Lines','View',diGridToggle,{modes:['flow','org','mind'],icon:'⊞'});
 diAdd('view.properties','Properties Panel','View',()=>diPanel('inspector'),{modes:['flow','org','mind'],icon:'⚙'});
 diAdd('view.fit','Fit to View','View',()=>diIsBubble()?diBubble('view.fit'):fitView(),{icon:'⛶'});
 diAdd('view.theme','Light / Dark Theme','View',toggleTheme,{icon:'◐'});
// Format menu
 diAdd('format.properties','Object Properties…','Format',diFormatInspector,{icon:'⚙'});
 diAdd('format.organize','Auto-organize / Arrange…','Format',()=>diClick('btnAutoLayout'),{modes:['flow','org','mind'],icon:'▦'});
 diAdd('format.zones','Zones & Colors…','Format',()=>diBubble('format.zones'),{modes:['bubble'],icon:'◐'});
 diAdd('format.lineDefaults','AEIOUX Line Defaults…','Format',()=>diBubble('format.lineDefaults'),{modes:['bubble'],icon:'≋'});
 diAdd('format.sketch','Sketch Presentation','Format',()=>diBubble('format.presentation',{value:'sketch'}),{modes:['bubble'],icon:'✎'});
 diAdd('format.formal','Formal Presentation','Format',()=>diBubble('format.presentation',{value:'formal'}),{modes:['bubble'],icon:'▱'});
 diAdd('format.showAreas','Show / Hide Areas','Format',()=>diBubble('format.showAreas',{value:!diBubbleState.showAreas}),{modes:['bubble'],icon:'㎡'});
 diAdd('format.painter','Format Painter','Format',()=>diIsBubble()?diBubble('edit.formatPainter'):diClick('btnFormatPainter'),{icon:'◈'});
// Help menu
 diAdd('help.guide','Getting Started','Help',showHelp,{icon:'?'});
 diAdd('help.shortcuts','Keyboard Shortcuts','Help',showHelp,{icon:'⌘'});
 diAdd('help.symbols','Diagram Symbols & Relationships','Help',()=>modal('DiagramIt notation',`<p>Flowchart symbols represent processes, decisions and start/end points. Org charts use primary reporting connections; secondary reporting is represented separately. Mind maps encode topic hierarchy. Bubble Diagram uses AEIOUX adjacency ratings (A/E/I/O/U/X) independently of circulation and sightlines.</p><p>Choose a diagram type when beginning a project. Each type shows only the applicable editing tools.</p>`,[{text:'Close'}]),{icon:'◇'});
 diAdd('help.about','About DiagramIt','Help',()=>modal('ThinkIt · v0.9.21',`<p>A focused diagramming workspace for Flowcharts, Organization Charts, Mind Maps and Architectural Bubble Diagrams.</p><p>DiagramIt runs locally in your browser. It does not require an account. Export an editable DiagramIt JSON backup regularly.</p><p><strong>Future roadmap:</strong> structured Mind Map notes and KeepIt references. Detailed scheduling is reserved for a separate PlanIt application.</p>`,[{text:'Close'}]),{icon:'ⓘ'});
function diEnsureCanvasVisible(){if(diIsBubble())return; if(document.body.classList.contains('sidebar-collapsed')){ /* canvas remains visible */ }focusCanvas()}
const DI_GROUPS={File:[['Project','file.new','file.newPage','file.openPage','file.open','file.recent','file.save','file.saveAs','file.recovery'],['Output','file.saveCopy','file.export','file.print','file.share'],['Settings','file.preferences']],Edit:[['History','edit.undo','edit.redo'],['Clipboard','edit.cut','edit.copy','edit.paste'],['Selection','edit.topicEarlier','edit.topicLater','edit.delete','edit.selectAll','edit.deselect','edit.duplicate','edit.group','edit.ungroup'],['Tools','edit.formatPainter','edit.find']],Insert:[['Objects','insert.shape','insert.arrow','insert.text','insert.attachedText','insert.zone'],['References','insert.underlay','insert.overlay','insert.link'],['Environment','insert.sun','insert.wind']],View:[['Representation','view.program','view.matrix','view.canvas','view.audit','view.chart','view.outline'],['Workspace','view.fullscreen','view.focus','view.tools','view.properties'],['Guides','view.ruler','view.grid','view.fit','view.theme']],Format:[['Properties','format.properties','format.organize','format.zones','format.lineDefaults'],['Presentation','format.sketch','format.formal','format.showAreas'],['Styles','format.painter']],Help:[['Guidance','help.guide','help.shortcuts','help.symbols','help.about']]};
function diBusinessCommand(command){return command.id.startsWith('file.')||command.id.startsWith('help.')||['view.fullscreen','view.focus','view.tools','view.theme'].includes(command.id);}
function diMenuItems(name){return (DI_GROUPS[name]||[]).map(([group,...ids])=>[group,...ids.filter(id=>{const command=diCommands[id];return command&&(!command.modes||command.modes.includes(page?.mode))&&(page?.mode!=='bmc'||diBusinessCommand(command));})]);}
function diOpenMenu(name){
 if(diMenuOpen===name){diCloseMenu();return;}
 diPrefs.activeTab=name;diSavePrefs();diMenuOpen=name;
 const popup=$('diMenuPopup');popup.replaceChildren();
 const trigger=[...document.querySelectorAll('.di-menu-tab')].find(b=>b.dataset.tab===name);
 popup.style.left=Math.max(8,trigger?.offsetLeft||12)+'px';
 for(const [group,...ids] of diMenuItems(name)){if(!ids.length)continue;const groupNode=document.createElement('div');groupNode.className='di-menu-group';groupNode.textContent=group;popup.append(groupNode);for(const id of ids){const c=diCommands[id],b=document.createElement('button');b.type='button';b.className='di-menu-item';b.dataset.dcmd=id;b.role='menuitem';b.disabled=!diEnabled(c);const l=document.createElement('span'),r=document.createElement('span');l.textContent=c.label;r.className='di-menu-shortcut';r.textContent=c.shortcut||'';b.append(l,r);popup.append(b)}}
 popup.hidden=false;document.querySelectorAll('.di-menu-tab').forEach(b=>{b.classList.toggle('active',b.dataset.tab===name);b.setAttribute('aria-expanded',String(b.dataset.tab===name))});
 diRenderRibbon();
 requestAnimationFrame(()=>{const r=popup.getBoundingClientRect();if(r.right>innerWidth-8)popup.style.left=Math.max(8,(trigger?.offsetLeft||12)-(r.right-innerWidth+14))+'px'});
}
function diCloseMenu(restoreFocus=false){const previous=diMenuOpen;diMenuOpen='';$('diMenuPopup').hidden=true;document.querySelectorAll('.di-menu-tab').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-expanded','false')});if(restoreFocus&&previous)document.querySelector(`.di-menu-tab[data-tab="${previous}"]`)?.focus();}
function diFocusMenuItem(toEnd=false){const items=[...$('diMenuPopup').querySelectorAll('button.di-menu-item:not([disabled])')];(toEnd?items.at(-1):items[0])?.focus();}
function diStepMenuItem(direction){const items=[...$('diMenuPopup').querySelectorAll('button.di-menu-item:not([disabled])')];if(!items.length)return;const i=items.indexOf(document.activeElement);items[(i+direction+items.length)%items.length]?.focus();}

function diRibbonButton(id){const c=diCommands[id];if(!c||!diEnabled(c))return null;const b=document.createElement('button');b.type='button';b.className='di-ribbon-btn';b.dataset.dcmd=id;b.title=c.label+(c.shortcut?' · '+c.shortcut:'');b.innerHTML=`<span class="di-ribbon-icon"></span><span></span>`;b.children[0].textContent=c.icon;b.children[1].textContent=c.label.replace(/…/g,'').replace(/\s*\/.*$/,'').replace(/ Diagram$/,'');return b}
function diRibbonSelect(options,value,change,shortLabel){const row=document.createElement('label');row.className='di-inline-check';row.textContent=shortLabel+' ';const el=document.createElement('select');el.className='di-ribbon-select';for(const [v,label] of options){const o=document.createElement('option');o.value=v;o.textContent=label;el.append(o)}el.value=value;el.onchange=e=>change(e.target.value);row.append(el);return row}
function diRibbonCheck(label,checked,change){const l=document.createElement('label');l.className='di-inline-check';const c=document.createElement('input');c.type='checkbox';c.checked=checked;c.onchange=e=>change(e.target.checked);l.append(c,document.createTextNode(label));return l}
function diRenderRibbon(){
 const root=$('diRibbonContent');if(!root||!page)return;root.replaceChildren();if(diNoTabs()){for(const id of ['file.new','file.openPage','file.newPage','file.open']){const button=diRibbonButton(id);if(button)root.append(button);}return;}
 const tab=diPrefs.activeTab||'Insert',mode=page.mode,groups=[];
 const addGroup=(ids,extras=[])=>{const g=document.createElement('div');g.className='di-ribbon-group';for(const id of ids){const b=diRibbonButton(id);if(b)g.append(b)}for(const node of extras)if(node)g.append(node);if(g.children.length){root.append(g);groups.push(g)}};
 if(tab==='File'){addGroup(['file.new','file.open','file.save','file.saveAs','file.recovery','file.export','file.print']);}
 else if(tab==='Edit'){addGroup(['edit.undo','edit.redo','edit.cut','edit.copy','edit.paste','edit.delete','edit.duplicate','edit.topicEarlier','edit.topicLater','edit.formatPainter']);}
 else if(tab==='Insert'){
  if(mode==='bubble')addGroup(['insert.shape','insert.arrow','insert.text','insert.underlay','insert.sun','insert.wind','insert.zone']);
  else if(mode==='org')addGroup(['insert.shape','insert.arrow','insert.text','insert.zone']);
  else addGroup(['insert.shape','insert.arrow','insert.text','insert.attachedText']);
 }
 else if(tab==='View'){
  if(mode==='bubble'){addGroup(['view.program','view.matrix','view.canvas','view.audit']);}
  else addGroup(['view.chart','view.outline']);
  addGroup(['view.fit','view.focus','view.fullscreen','view.tools',...(mode==='bubble'?[]:['view.grid','view.ruler','view.properties'])]);
 }
 else if(tab==='Format'){
  if(mode==='bubble'){
    addGroup(['format.properties','format.zones','format.lineDefaults','format.painter']);
    if(['space','multi'].includes(diBubbleState.selection)){
      addGroup([],[diRibbonSelect([['Anchor','Anchor'],['Primary','Primary'],['Support','Support'],['Secondary','Secondary'],['Optional','Optional']],'Support',v=>diBubble('format.quick',{key:'borderRole',value:v}),'Border'),
        diRibbonSelect([['0','Auto'],['10','10'],['12','12'],['14','14'],['16','16'],['18','18'],['22','22']],'0',v=>diBubble('format.quick',{key:'labelFontSize',value:v}),'Font size')]);
    }else if(['relation','flow'].includes(diBubbleState.selection)){
      addGroup([],[diRibbonSelect([['plain','Plain'],['open','Open'],['broken','Broken'],['banded','Banded'],['outline','Hollow block']],'open',v=>diBubble('format.quick',{key:'graphicStyle',value:v}),'Arrow'),
        diRibbonSelect([['none','None'],['left','Left / Up'],['right','Right / Down'],['both','Both']],'right',v=>diBubble('format.quick',{key:'direction',value:v}),'Head'),
        diRibbonSelect([['straight','Straight'],['elbow','Elbow'],['curve','Curve'],['spline','Spline']],'straight',v=>diBubble('format.quick',{key:'route',value:v}),'Route')]);
    }else if(diBubbleState.selection==='envGraphic'){
      addGroup([],[diRibbonSelect([['sun','Sun path'],['wind','Wind flow']],'sun',()=>diBubble('format.properties'),'Graphic'),
       diRibbonSelect([['.5','50%'],['.75','75%'],['1','100%'],['1.5','150%'],['2','200%']],'1',v=>diBubble('format.quick',{key:'scale',value:v}),'Scale')]);
    }else if(diBubbleState.selection==='note'){
      addGroup([],[diRibbonSelect([['10','10'],['12','12'],['14','14'],['16','16'],['18','18'],['22','22'],['28','28']],'18',v=>diBubble('format.quick',{key:'fontSize',value:v}),'Font size'),
        diRibbonSelect([['none','No fill'],['solid','Solid fill']],'none',v=>diBubble('format.quick',{key:'fillMode',value:v}),'Note box')]);
    }
    addGroup([],[diRibbonSelect([['formal','Formal'],['sketch','Sketch']],diBubbleState.theme,v=>diBubble('format.presentation',{value:v}),'Style'),diRibbonCheck('Areas',diBubbleState.showAreas,v=>diBubble('format.showAreas',{value:v}))]);
  }else{
    addGroup(['format.properties','format.organize','format.painter']);
    const ns=[...selected].map(byId).filter(Boolean);
    if(ns.length){
      const cols=[['plain','White'],['teal','Teal'],['blue','Blue'],['amber','Amber'],['rose','Rose'],['slate','Slate']];
      addGroup([],[diRibbonSelect(cols,ns.every(n=>n.fill===ns[0].fill)?ns[0].fill:'plain',v=>diFormatNode('fill',v),'Fill'),diRibbonSelect([['11','11 pt'],['12','12 pt'],['13','13 pt'],['15','15 pt'],['18','18 pt'],['22','22 pt']],String(ns[0].fontSize||13),v=>diFormatNode('fontSize',Number(v)),'Text')]);
    }
  }
 }
 else if(tab==='Help')addGroup(['help.guide','help.shortcuts','help.symbols']);
 document.querySelectorAll('.di-menu-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
 $('diActiveMode').textContent=MODES[mode].name+' ▾';
 $('diRibbonToggle').textContent=diPrefs.toolsVisible?'Hide tools ⌃':'Show tools ⌄';$('diRibbonToggle').setAttribute('aria-expanded',String(diPrefs.toolsVisible));
}
function diSyncShell(){document.body.classList.toggle('di-fullscreen',Boolean(document.fullscreenElement));if(!page)return;document.body.classList.toggle('di-no-tabs',diNoTabs());diRenderRibbon();$('diFocusToggle').setAttribute('aria-pressed',String(diPrefs.focus));}
// P2: an explicit, discoverable on-canvas first action for a collapsed mobile
// shape palette. No native note schema, state or selection contract changes.
function diUpdateMobileStarter(){
 let b=document.getElementById('diMobileStarter');
 if(!b)return;
 const empty=!!page&&!diNoTabs()&&!['bubble','bmc'].includes(page.mode)&&page.nodes.length===0;
 b.hidden=!empty;
 if(!empty)return;
 const mode=page.mode;
 b.textContent=mode==='mind'?'＋ Add first topic':mode==='org'?'＋ Add first role':'＋ Add first shape';
 b.setAttribute('aria-label',b.textContent.trim());
 const hint=$('emptyHint')?.querySelector('span:last-child');
 if(hint)hint.textContent='Choose Add below or open the shape library from the menu.';
}
function diInitMobileStarter(){
 if(document.getElementById('diMobileStarter'))return;
 const b=document.createElement('button');b.type='button';b.id='diMobileStarter';
 b.hidden=true;b.className='di-mobile-starter';
 b.onclick=()=>{if(!b.hidden)diRun('insert.shape');};
 $('canvasWrap').append(b);
 const style=document.createElement('style');style.id='di-mobile-starter-style';
 style.textContent='.di-mobile-starter{display:none;position:absolute;z-index:11;top:61%;left:50%;transform:translateX(-50%);background:#0D7475;color:white;border:1px solid #0D7475;border-radius:9px;padding:12px 18px;min-width:158px;min-height:44px;font-weight:700;box-shadow:0 7px 20px #0d2f4f22;white-space:nowrap}.di-mobile-starter:focus-visible{outline:3px solid #E5AC3E;outline-offset:2px}@media(max-width:850px){.di-mobile-starter:not([hidden]){display:block}}';
 document.head.append(style);
}
// P3 compact touch toolbar; scoped to the editor, not to KeepIt state.
function diP3UpdateNav(){const bar=document.getElementById('diMobileNav');if(!bar)return;
 bar.hidden=!page||diNoTabs()||['bubble','bmc'].includes(page.mode);
 const pan=bar.querySelector('[data-p3="pan"]');if(pan){pan.setAttribute('aria-pressed',String(tool==='hand'));pan.classList.toggle('active',tool==='hand');}
 const zoom=bar.querySelector('[data-p3="zoom"]');if(zoom)zoom.textContent=Math.round(view.k*100)+'%';
}
function diP3InitNav(){if(document.getElementById('diMobileNav'))return;
 const bar=document.createElement('div');bar.id='diMobileNav';bar.className='di-mobile-nav';bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','Canvas navigation');bar.hidden=true;
 for(const [key,text,title] of [['pan','✋','Pan canvas'],['select','↖','Select and edit shapes'],['out','−','Zoom out'],['zoom','100%','Current zoom'],['in','+','Zoom in'],['fit','Fit','Fit all content'],['read','Read','Readable view around first topic']]){
  if(key==='zoom'){const span=document.createElement('span');span.dataset.p3=key;span.className='di-mobile-nav-zoom';span.setAttribute('aria-live','off');bar.append(span);continue;}
  const b=document.createElement('button');b.type='button';b.dataset.p3=key;b.textContent=text;b.title=title;b.setAttribute('aria-label',title);bar.append(b);
 }
 bar.addEventListener('click',e=>{const key=e.target.closest('button[data-p3]')?.dataset.p3;if(!key||!page||page.mode==='bubble')return;
  if(key==='pan')setTool('hand');else if(key==='select')setTool('select');else if(key==='in')zoomAt(1.22,{x:getWorldSize().w/2,y:getWorldSize().h/2});else if(key==='out')zoomAt(1/1.22,{x:getWorldSize().w/2,y:getWorldSize().h/2});else if(key==='fit')fitView();else if(key==='read')fitView({initial:true});diP3UpdateNav();});
 $('canvasWrap').append(bar);diP3UpdateNav();
}
// Multi-pointer interactions must not drag or resize the underlying topic.
const diP3Touches=new Map();let diP3Pinch=null;
function diP3TouchPoint(e){return screenPoint(e);}
function diP3Start(e){if(e.pointerType!=='touch'||activeModal||editing||!page||page.mode==='bubble')return;
 const p=diP3TouchPoint(e);diP3Touches.set(e.pointerId,p);
 if(diP3Touches.size===2){
  if(gesture?.moved&&gesture.before)recordHistory(gesture.before);
  gesture=null;canvas.classList.remove('is-panning');
  const pair=[...diP3Touches.values()],mid={x:(pair[0].x+pair[1].x)/2,y:(pair[0].y+pair[1].y)/2},dist=Math.hypot(pair[1].x-pair[0].x,pair[1].y-pair[0].y);
  diP3Pinch={center:mid,dist:Math.max(dist,10),view:{...view}};
  try{canvas.setPointerCapture(e.pointerId);}catch{}
  e.preventDefault();e.stopImmediatePropagation();return;
 }
 if(diP3Touches.size>2||diP3Pinch){e.preventDefault();e.stopImmediatePropagation();return;}
 // Dragging the paper with one finger pans; touching a shape still selects/drags.
 const hit=e.target.closest('[data-node-id],[data-edge-id],[data-annotation-id],[data-port],[data-action],[data-collapse-node]');
 if(!hit&&tool==='select'){gesture={type:'pan',start:p,origin:{x:view.x,y:view.y}};canvas.classList.add('is-panning');try{canvas.setPointerCapture(e.pointerId);}catch{}e.preventDefault();e.stopImmediatePropagation();}
}
function diP3Move(e){if(e.pointerType!=='touch')return;
 if(diP3Touches.has(e.pointerId))diP3Touches.set(e.pointerId,diP3TouchPoint(e));
 if(!diP3Pinch)return;
 if(diP3Touches.size>=2){const pair=[...diP3Touches.values()],mid={x:(pair[0].x+pair[1].x)/2,y:(pair[0].y+pair[1].y)/2},d=Math.max(10,Math.hypot(pair[1].x-pair[0].x,pair[1].y-pair[0].y)),start=diP3Pinch;
 const k=clamp(start.view.k*d/start.dist,.16,3.6),wx=(start.center.x-start.view.x)/start.view.k,wy=(start.center.y-start.view.y)/start.view.k;
 view.k=k;view.x=mid.x-wx*k;view.y=mid.y-wy*k;renderCanvas();diP3UpdateNav();}
 e.preventDefault();e.stopImmediatePropagation();
}
function diP3End(e){if(e.pointerType!=='touch')return;diP3Touches.delete(e.pointerId);
 if(diP3Pinch){if(diP3Touches.size<2)diP3Pinch=null;gesture=null;canvas.classList.remove('is-panning');try{canvas.releasePointerCapture(e.pointerId);}catch{}e.preventDefault();e.stopImmediatePropagation();}
}
function diInitShell(){
 diInitMobileStarter();diP3InitNav();diUpdateMobileStarter();
 const tabs=$('diMenuTabs');for(const n of DI_MENUS){const b=document.createElement('button');b.type='button';b.className='di-menu-tab';b.dataset.tab=n;b.setAttribute('role','menuitem');b.setAttribute('aria-haspopup','menu');b.setAttribute('aria-expanded','false');b.textContent=n;b.onclick=()=>diOpenMenu(n);tabs.append(b)}
 $('diMenuPopup').onclick=e=>{const b=e.target.closest('[data-dcmd]');if(b&&!b.disabled)diRun(b.dataset.dcmd)};
 $('diRibbonContent').onclick=e=>{const b=e.target.closest('[data-dcmd]');if(b&&!b.disabled)diRun(b.dataset.dcmd)};
 $('diRibbonToggle').onclick=diToggleRibbon;$('diFocusToggle').onclick=diToggleFocus;$('diFocusExit').onclick=diExitCanvasMode;
 $('diInspectorToggle').onclick=()=>diPanel('inspector');$('diActiveMode').onclick=diMode;
 document.addEventListener('pointerdown',e=>{if(diMenuOpen&&!e.target.closest('#diMenuBar'))diCloseMenu()},true);
 document.addEventListener('keydown',e=>{
   if(!$('diStartScreen').hidden)return;
   if(activeModal)return;
   if(diMenuOpen){
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();diCloseMenu(true);return;}
    if(e.key==='ArrowRight'||e.key==='ArrowLeft'){
     e.preventDefault();e.stopPropagation();const idx=DI_MENUS.indexOf(diMenuOpen);
     diOpenMenu(DI_MENUS[(idx+(e.key==='ArrowRight'?1:-1)+DI_MENUS.length)%DI_MENUS.length]);diFocusMenuItem();return;
    }
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){
     e.preventDefault();e.stopPropagation();diStepMenuItem(e.key==='ArrowDown'?1:-1);return;
    }
    if(e.key==='Home'||e.key==='End'){
     e.preventDefault();e.stopPropagation();diFocusMenuItem(e.key==='End');return;
    }
   }
   if(e.target.matches('.di-menu-tab')&&(e.key==='ArrowDown'||e.key==='Enter'||e.key===' ')){
    e.preventDefault();e.stopPropagation();if(diMenuOpen!==e.target.dataset.tab)diOpenMenu(e.target.dataset.tab);diFocusMenuItem();return;
   }
  if((e.metaKey||e.ctrlKey)&&e.key==='\\'){e.preventDefault();e.stopPropagation();diToggleRibbon();return;}
  if(e.shiftKey&&!e.metaKey&&!e.ctrlKey&&!e.altKey&&e.key.toLowerCase()==='f'&&!e.target.closest('input,textarea,select,[contenteditable="true"]')){e.preventDefault();diToggleFocus()}
  if(diPrefs.focus&&e.key==='Escape'){e.preventDefault();diToggleFocus()}
  // Preserve native text editing, including note cells, and modal focus.
  if(activeModal||e.target.closest('input,textarea,select,[contenteditable="true"]'))return;
  if(e.metaKey||e.ctrlKey){const k=e.key.toLowerCase();if(k==='n'){e.preventDefault();e.stopPropagation();diRun('file.new')}
    else if(k==='p'){e.preventDefault();e.stopPropagation();diRun('file.print')}
    else if(k==='s'&&e.shiftKey){e.preventDefault();e.stopPropagation();diRun('file.saveAs')}
    else if(k==='c'&&!e.altKey){e.preventDefault();e.stopPropagation();diRun('edit.copy')}
    else if(k==='x'&&!e.altKey){e.preventDefault();e.stopPropagation();diRun('edit.cut')}
    else if(k==='v'&&!e.altKey){e.preventDefault();e.stopPropagation();diRun('edit.paste')}
    else if(k==='a'){e.preventDefault();e.stopPropagation();diRun('edit.selectAll')}
  }
 },true);
 window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===bubbleFrame()?.contentWindow&&e.data?.channel==='diagramit-bubble-v06'){
  if(e.data.type==='ui-state'&&page?.id===e.data.pageId){diBubbleState={...diBubbleState,...e.data};diSyncShell()}
  if(e.data.type==='ui-command-result'&&!e.data.ok)toast('Bubble command: '+e.data.error);
  if(e.data.type==='print-svg')diPrintBubbleSheet(e.data);
 }},false);
 document.body.classList.toggle('di-tools-hidden',!diPrefs.toolsVisible);
 // v0.9.3 preserves the document schema, but stores recovery data in a distinct workspace to avoid overwriting prior releases. This is an interface upgrade, not a schema migration.
 const observer=new MutationObserver(()=>{if(!page)return;diSyncShell()});observer.observe($('pageTabs'),{childList:true,subtree:false});
 const selectObs=new MutationObserver(()=>{if(!page||diPrefs.activeTab!=='Format')return;diSyncShell()});selectObs.observe($('inspectorContent'),{childList:true,subtree:false});
 document.addEventListener('fullscreenchange',()=>diSyncShell());
 diSyncShell();diRenderRuler();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',diInitShell);else diInitShell();

window.keepItAppFiles=Object.freeze({syncStatus(message){
 let label=document.getElementById('keepitProjectSync');
 if(!label){label=document.createElement('span');label.id='keepitProjectSync';label.className='save-status';label.setAttribute('role','status');document.querySelector('.document-title-wrap').append(label);}
 label.textContent=message;
},capture:captureKeepItProject,async open(payload,expected){
 const incoming=validateDocument(JSON.parse(payload));incoming.version=3;
 await saveQueue;
 if(editing||activeModal||JSON.stringify(doc)!==expected||diSaveConflict)throw Error('The local ThinkIt project changed. Review it before switching files.');
 const serial=JSON.stringify(incoming);
 if(storageMode==='indexeddb')await dbWrite(serial,{manual:true});
 else if(storageMode==='localstorage')await diFallbackWrite(serial);
 else throw Error('ThinkIt local storage is unavailable.');
 doc=incoming;lastSaved=serial;diHasSavedProject=true;diTabProjectId='';diLoadTabState();page=getPage();
 selected.clear();edgeSelected=null;selectedAnnotation=null;preview=null;history={undo:[],redo:[]};bubbleActivePageId=null;
 if(diPrefs.focus)diToggleFocus();
 render();if(page.mode!=='bubble')fitView({initial:true});diHideStart();setSaveState('saved','Saved on this device');
 return captureKeepItProject();
}});


// Explicit project transfer requests from the exact bundled KeepIt parent.
window.addEventListener('message',async event=>{
 if(window.parent===window||event.source!==window.parent||event.origin!==location.origin||event.data?.channel!=='thinkit-native-note-v1'||!['get-project','restore-project'].includes(event.data.type)||typeof event.data.requestId!=='string')return;
 const data=event.data,reply=(type,extra={})=>window.parent.postMessage({channel:'thinkit-native-note-v1',type,requestId:data.requestId,...extra},location.origin);
 try{
  if(data.type==='get-project'){
   const detail={jobs:[]};window.dispatchEvent(new CustomEvent('thinkit-project-export',{detail}));await Promise.all(detail.jobs);
   if(!doc||await persist({manual:true})!==true)throw Error('The local project could not be saved before export.');
   const project=clone(doc);project.localRecovery=JSON.parse(await (await ThinkItLocalNotes.exportRecovery(doc.id)).text());ThinkItLocalNotes.verifyExportObject(project.localRecovery);if(JSON.stringify(project).length>24*1024*1024)throw Error('Project exceeds the 24 MiB transfer budget.');reply('project-snapshot',{project});
  }else{
   if(JSON.stringify(data.project).length>24*1024*1024)throw Error('Restored project exceeds the transfer budget.');
   const incoming=validateDocument(clone(data.project));if(incoming.localRecovery){if(incoming.localRecovery.projectId!==incoming.id)throw Error('Local recovery project identity mismatch.');await ThinkItLocalNotes.restoreRecovery(incoming.localRecovery);}const adopted=await importFile(new File([JSON.stringify(incoming)],'Restored-project.diagramit.json',{type:'application/json'}));
   if(!adopted)throw Error('ThinkIt declined the imported project; original project was retained.');
   if(doc.id!==incoming.id||await persist({manual:true})!==true)throw Error('The restored project could not be saved locally. Native recovery remains in KeepIt.');reply('project-restored');
  }
 }catch(error){reply('project-failed',{message:String(error.message||error).slice(0,300)});}
});

bindUI();diStorageReady=initStorage();
})();
