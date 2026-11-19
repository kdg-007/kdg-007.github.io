/* ThinkIt T22-A — versioned, pure Outline/WBS model.
   Diagram shapes and edges remain the only visual graph. This module creates
   neither notes nor cloud writes. Flowchart outline parenting is independent
   of its arrows; semantic predecessors refer only to immutable node IDs. */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.ThinkItOutline=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION=1;
  const MODES=new Set(['mind','flow','org']);
  const TYPES=new Set(['FS','SS','FF','SF']);
  const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  const isObject=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
  const validId=v=>typeof v==='string'&&v.length>0&&v.length<=256;
  const defaults=mode=>({version:VERSION,codeLabel:mode==='org'?'Outline Number':'WBS',preset:'standard',prefix:'',separator:'.',padding:0,startAt:1,showDependencies:true,showParent:true});
  const PRESETS={standard:{prefix:'',padding:0,separator:'.'},padded:{prefix:'',padding:2,separator:'.'},'work-package':{prefix:'WP-',padding:2,separator:'.'},custom:{}};
  function settingsFor(mode,raw){
    if(!MODES.has(mode))throw Error('Outline only supports Mind Map, Flowchart and Org Chart');
    if(raw!==undefined&&!isObject(raw))throw Error('Invalid outlineSettings');
    const src=raw||{};
    if(src.version!==undefined&&src.version!==VERSION)throw Error('Unsupported outlineSettings version');
    const preset=src.preset??'standard';
    if(!own(PRESETS,preset))throw Error('Unknown outline numbering preset');
    const out={...defaults(mode),...PRESETS[preset],...src,preset,version:VERSION};
    if(typeof out.codeLabel!=='string'||out.codeLabel.trim().length===0||out.codeLabel.length>64)throw Error('Invalid WBS column label');
    if(typeof out.prefix!=='string'||out.prefix.length>24||!/^[-_a-zA-Z0-9]*$/.test(out.prefix))throw Error('Invalid WBS prefix');
    if(typeof out.separator!=='string'||!/^[-./_]$/.test(out.separator))throw Error('Invalid WBS separator');
    if(!Number.isSafeInteger(out.padding)||out.padding<0||out.padding>6)throw Error('Invalid WBS zero-padding');
    if(!Number.isSafeInteger(out.startAt)||out.startAt<1||out.startAt>999999)throw Error('Invalid WBS starting sequence');
    for(const key of ['showDependencies','showParent'])if(typeof out[key]!=='boolean')throw Error('Invalid outline column visibility');
    return out;
  }
  function compactNode(n,index,mode){
    if(!isObject(n)||!validId(n.id))throw Error('Invalid outline node ID');
    const hierarchyParent=mode==='flow'?(n.outlineParentId??null):(n.parentId??null);
    if(hierarchyParent!==null&&!validId(hierarchyParent))throw Error('Invalid outline parent ID for '+n.id);
    const order=n.outlineOrder??(index+1);
    if(!Number.isSafeInteger(order)||order<0||order>10000000)throw Error('Invalid outline order for '+n.id);
    const override=n.wbsCodeOverride??null;
    if(override!==null&&(typeof override!=='string'||!override.trim()||override.length>96))throw Error('Invalid WBS code override for '+n.id);
    const deps=n.dependencies??[];
    if(!Array.isArray(deps)||deps.length>10000)throw Error('Invalid dependencies for '+n.id);
    for(const dep of deps){if(!isObject(dep)||!validId(dep.id)||!TYPES.has(dep.type??'FS'))throw Error('Invalid dependency record for '+n.id);}
    return {id:n.id,node:n,parentId:hierarchyParent,order,override,dependencies:deps,index};
  }
  function planPage(page){
    if(!isObject(page)||!Array.isArray(page.nodes)||!MODES.has(page.mode))throw Error('Invalid Outline/WBS page');
    const settings=settingsFor(page.mode,page.outlineSettings);
    const nodes=page.nodes.map((n,i)=>compactNode(n,i,page.mode));
    const lookup=new Map();for(const x of nodes){if(lookup.has(x.id))throw Error('Duplicate outline node ID: '+x.id);lookup.set(x.id,x);}
    const childMap=new Map(),rootKey=null;
    for(const x of nodes){
      if(x.parentId!==null&&!lookup.has(x.parentId))throw Error('Missing outline parent '+x.parentId+' for '+x.id);
      const key=x.parentId;
      if(!childMap.has(key))childMap.set(key,[]);
      childMap.get(key).push(x);
    }
    // Iterative parent-chain verification, linear even on 25,000-deep maps.
    const verified=new Set();
    for(const start of nodes){
      if(verified.has(start.id))continue;
      let x=start;const path=[],active=new Set();
      while(x&&!verified.has(x.id)){
        if(active.has(x.id))throw Error('Circular outline hierarchy at '+x.id);
        path.push(x.id);active.add(x.id);
        x=x.parentId===null?null:lookup.get(x.parentId);
      }
      for(const id of path)verified.add(id);
    }
    for(const arr of childMap.values())arr.sort((a,b)=>a.order-b.order||a.index-b.index);
    const encode=i=>String(i).padStart(settings.padding,'0');
    const rows=[],warnings=[],stack=[];
    const roots=childMap.get(rootKey)||[];
    for(let i=roots.length-1;i>=0;i--)stack.push({entry:roots[i],parentAuto:null,sequence:settings.startAt+i,depth:0});
    while(stack.length){
      const {entry:x,parentAuto,sequence,depth}=stack.pop();
      const proposed=parentAuto===null?settings.prefix+encode(sequence):parentAuto+settings.separator+encode(sequence);
      // Deep imported trees can contain 10,000+ ancestors. Avoid generating
      // quadratic-size WBS paths or exhausting memory in validation.
      const abbreviated=proposed.length>180;
      const autoCode=abbreviated?`~D${depth}_${x.index+1}`:proposed;
      if(abbreviated)warnings.push({code:'WBS_DEPTH_ABBREVIATED',nodeId:x.id,depth});
      const code=x.override??autoCode;
      rows.push({id:x.id,label:x.node.label,code,autoCode,manualCode:x.override!==null,depth,parentId:x.parentId,outlineOrder:x.order,
        dependencies:x.dependencies.map(d=>({id:d.id,type:d.type??'FS'}))});
      const kids=childMap.get(x.id)||[];
      for(let i=kids.length-1;i>=0;i--)stack.push({entry:kids[i],parentAuto:autoCode,sequence:i+1,depth:depth+1});
    }
    if(rows.length!==nodes.length)throw Error('Outline traversal did not include every node');
    const codes=new Map(),displayById=new Map(rows.map(r=>[r.id,r.code]));
    for(const row of rows){
      if(codes.has(row.code))warnings.push({code:'DUPLICATE_WBS_CODE',nodeId:row.id,relatedId:codes.get(row.code),displayCode:row.code});
      else codes.set(row.code,row.id);
    }
    // Dependencies are semantic predecessors, NEVER derived from graph arrows.
    const successors=new Map(nodes.map(x=>[x.id,[]]));
    for(const x of nodes){const seen=new Set();for(const dep of x.dependencies){
      if(!lookup.has(dep.id))warnings.push({code:'MISSING_PREDECESSOR',nodeId:x.id,relatedId:dep.id});
      else if(dep.id===x.id)warnings.push({code:'SELF_DEPENDENCY',nodeId:x.id,relatedId:dep.id});
      else successors.get(dep.id).push(x.id);
      if(seen.has(dep.id))warnings.push({code:'DUPLICATE_DEPENDENCY',nodeId:x.id,relatedId:dep.id});
      seen.add(dep.id);
    }}
    // Iterative DFS with back-edge detection; graph loops may still be valid.
    const color=new Map();
    for(const root of nodes){
      if(color.get(root.id))continue;
      color.set(root.id,1);const dfs=[{id:root.id,next:0}];
      while(dfs.length){const top=dfs[dfs.length-1],children=successors.get(top.id)||[];
        if(top.next>=children.length){color.set(top.id,2);dfs.pop();continue;}
        const dest=children[top.next++],state=color.get(dest)||0;
        if(state===1)warnings.push({code:'DEPENDENCY_CYCLE',nodeId:dest,relatedId:top.id});
        else if(state===0){color.set(dest,1);dfs.push({id:dest,next:0});}
      }
    }
    for(const row of rows){
      row.dependencies=row.dependencies.map(d=>({...d,displayCode:displayById.get(d.id)??null}));
    }
    const patches=nodes.map(x=>({node:x.node,outlineOrder:x.order,
      wbsCodeOverride:x.override,dependencies:x.dependencies.map(d=>({...d,type:d.type??'FS'})),
      ...(page.mode==='flow'?{outlineParentId:x.parentId}:{})}));
    return {settings,rows,warnings,patches};
  }
  // Two-phase commit: validate ALL pages before mutating any original input.
  function migrateDocument(document){
    if(!isObject(document)||!Array.isArray(document.pages))throw Error('Invalid Outline/WBS document');
    const planned=document.pages.map(page=>MODES.has(page?.mode)?{page,plan:planPage(page)}:null).filter(Boolean);
    for(const {page,plan} of planned){
      page.outlineSettings=plan.settings;
      for(const patch of plan.patches){const {node,...values}=patch;Object.assign(node,values);}
    }
    return {migratedPages:planned.length,warnings:planned.flatMap(({page,plan})=>plan.warnings.map(w=>({...w,pageId:page.id})))};
  }
  function auditPage(page){const p=planPage(page);return {rows:p.rows,warnings:p.warnings,settings:p.settings};}
  // T22-C: a linear, read-only outline visibility planner. Search includes the
  // complete ancestry of each matching topic, even below collapsed branches.
  // Collapse state, model order, IDs, notes and dependencies are never mutated.
  function visibleRows(rows,{query='',collapsed=new Set()}={}){
    if(!Array.isArray(rows))throw Error('Invalid outline row collection');
    const terms=String(query).trim().toLocaleLowerCase();
    if(!terms){
      const hidden=new Map(),visible=[];
      for(const row of rows){
        const isHidden=row.parentId!==null&&row.parentId!==undefined&&
          (collapsed.has(row.parentId)||hidden.get(row.parentId)===true);
        hidden.set(row.id,isHidden);
        if(!isHidden)visible.push(row);
      }
      return {rows:visible,matchCount:0};
    }
    const parents=new Map(rows.map(row=>[row.id,row.parentId]));
    const included=new Set();let matchCount=0;
    for(const row of rows){
      if(!String(row.label||'').toLocaleLowerCase().includes(terms)&&
         !String(row.code||'').toLocaleLowerCase().includes(terms))continue;
      matchCount++;
      let id=row.id;
      while(id!==null&&id!==undefined&&!included.has(id)){
        included.add(id);id=parents.get(id)??null;
      }
    }
    return {rows:rows.filter(row=>included.has(row.id)),matchCount};
  }
  function expandedPath(rows,targetId,collapsed){
    const next=new Set(collapsed||[]);
    const parents=new Map(rows.map(row=>[row.id,row.parentId]));
    if(!parents.has(targetId))return next;
    const seen=new Set([targetId]);let id=parents.get(targetId);
    while(id!==null&&id!==undefined&&!seen.has(id)){
      seen.add(id);next.delete(id);id=parents.get(id)??null;
    }
    return next;
  }
  // T22-D: pure, read-only editing helpers. A predecessor is not a visual
  // flow arrow, and an outline group is not a scheduled predecessor.
  function dependencyChoices(page,subjectId,query='',limit=100){
    const rows=auditPage(page).rows;
    if(!rows.some(r=>r.id===subjectId))throw Error('Unknown activity');
    if(!Number.isSafeInteger(limit)||limit<1||limit>500)throw Error('Invalid choice limit');
    const q=String(query).trim().toLocaleLowerCase();
    return rows.filter(r=>r.id!==subjectId&&(!q||String(r.code).toLocaleLowerCase().includes(q)||String(r.label||'').toLocaleLowerCase().includes(q)))
      .slice(0,limit).map(r=>({id:r.id,code:r.code,label:r.label}));
  }
  function previewDependencies(page,subjectId,dependencies){
    const rows=auditPage(page).rows;
    const ids=new Set(rows.map(r=>r.id));
    if(!ids.has(subjectId))throw Error('Unknown activity');
    if(!Array.isArray(dependencies)||dependencies.length>10000)throw Error('Invalid predecessor list');
    const seen=new Set();
    for(const d of dependencies){
      if(!isObject(d)||!validId(d.id)||!TYPES.has(d.type??'FS'))throw Error('Invalid predecessor entry');
      if(!ids.has(d.id))throw Error('Unknown predecessor ID: '+d.id);
      if(d.id===subjectId)throw Error('An activity cannot depend on itself');
      if(seen.has(d.id))throw Error('Repeated predecessor ID: '+d.id);
      seen.add(d.id);
    }
    // Walk predecessor chains in the candidate graph. Cycles involving the
    // edited item fail even if unrelated legacy cycles already exist.
    const lookup=new Map(page.nodes.map(n=>[n.id,n]));
    for(const d of dependencies){
      const stack=[d.id],visited=new Set();
      while(stack.length){
        const id=stack.pop();
        if(id===subjectId)throw Error('Circular predecessor relationship');
        if(visited.has(id))continue;
        visited.add(id);
        for(const parent of lookup.get(id)?.dependencies||[]){
          if(ids.has(parent.id))stack.push(parent.id);
        }
      }
    }
    return {nodeId:subjectId,dependencies:dependencies.map(d=>({id:d.id,type:d.type??'FS'}))};
  }
  function parseDependencyText(page,subjectId,raw){
    if(typeof raw!=='string'||raw.length>50000)throw Error('Invalid predecessor text');
    const rows=auditPage(page).rows,byId=new Set(rows.map(r=>r.id));
    const byCode=new Map(),duplicates=new Set();
    for(const r of rows){if(byCode.has(r.code))duplicates.add(r.code);else byCode.set(r.code,r.id);}
    const current=page.nodes.find(n=>n.id===subjectId)?.dependencies||[],parsed=[];
    for(const part of raw.split(',').map(s=>s.trim()).filter(Boolean)){
      const m=/^(.*?)(?:\s+\[(FS|SS|FF|SF)\])?$/i.exec(part);
      if(!m||!m[1].trim())throw Error('Invalid predecessor reference');
      const token=m[1].trim();
      if(duplicates.has(token))throw Error('Ambiguous WBS code: '+token);
      const id=byCode.get(token)??(token.startsWith('#')?token.slice(1):null);
      if(!id||!byId.has(id))throw Error('Unknown predecessor: '+token);
      const type=m[2]?.toUpperCase()||current.find(d=>d.id===id)?.type||'FS';
      parsed.push({id,type});
    }
    return previewDependencies(page,subjectId,parsed);
  }
  function previewFlowGrouping(page,subjectId,newParentId){
    if(page?.mode!=='flow')throw Error('Flowchart grouping is only available in Flowchart');
    const ids=new Set(page.nodes.map(n=>n.id));
    if(!ids.has(subjectId))throw Error('Unknown flowchart activity');
    if(newParentId!==null&&!ids.has(newParentId))throw Error('Unknown WBS group');
    if(subjectId===newParentId)throw Error('A node cannot group itself');
    const byId=new Map(page.nodes.map(n=>[n.id,n]));
    const visited=new Set();let current=newParentId;
    while(current!==null&&current!==undefined){
      if(current===subjectId)throw Error('Circular outline group');
      if(visited.has(current))throw Error('Existing outline group cycle');
      visited.add(current);
      current=byId.get(current)?.outlineParentId??null;
    }
    return {nodeId:subjectId,outlineParentId:newParentId};
  }
  // T22-E: export the same canonical ordered rows used by Diagram ↔ Outline.
  // Stable IDs are included so spreadsheet roundtrips cannot confuse a renamed
  // WBS code with record identity. CSV is spreadsheet-formula injection safe.
  const CSV_COLUMNS=['WBS','Item / Activity Name','Dependencies','Parent / Group','Node ID','Parent Node ID','Manual Code','Dependency IDs'];
  function csvCell(value){
    let text=String(value??'');
    // Excel/Sheets may evaluate leading = + - @ (and whitespace/control prefixes).
    // Prepend an apostrophe to any cell that could be interpreted as a formula.
    if(/^[\s\x00-\x1f]*[=+@-]/.test(text))text="'"+text;
    return '"'+text.replace(/"/g,'""')+'"';
  }
  function exportRows(page,{onlyIds=null}={}){
    const plan=auditPage(page),ids=onlyIds===null?null:new Set(onlyIds);
    const byId=new Map(plan.rows.map(r=>[r.id,r]));
    // T23: one lookup for Org Chart departments instead of a full source-node
    // scan per exported row (quadratic on large organization charts).
    const sourceById=page.mode==='org'?new Map(page.nodes.map(n=>[n.id,n])):null;
    const result=[];
    for(const r of plan.rows){
      if(ids&&!ids.has(r.id))continue;
      const deps=r.dependencies.map(d=>(d.displayCode??'#'+d.id)+(d.type!=='FS'?' ['+d.type+']':''));
      result.push({code:r.code,label:r.label,dependencies:page.mode==='org'?String(sourceById.get(r.id)?.data?.department||''):deps.join(', '),
        parent:r.parentId?(byId.get(r.parentId)?.code??'#'+r.parentId):'',
        id:r.id,parentId:r.parentId??'',manualCode:r.manualCode?'Yes':'No',
        dependencyIds:r.dependencies.map(d=>d.id+':'+d.type).join('; '),depth:r.depth});
    }
    return {settings:plan.settings,warnings:plan.warnings,rows:result};
  }
  function exportCsv(page,opts){
    const {settings,rows}=exportRows(page,opts);
    // Org Chart's third column describes departments, NOT predecessor links.
    // Export headers must match the actual value semantics of each mode.
    const columns=page.mode==='org'?
      [settings.codeLabel,'Position / Unit','Department / Unit','Reports To',...CSV_COLUMNS.slice(4)]:
      [settings.codeLabel,...CSV_COLUMNS.slice(1)];
    const lines=[columns.map(csvCell).join(',')];
    for(const row of rows)lines.push([row.code,row.label,row.dependencies,row.parent,row.id,row.parentId,row.manualCode,row.dependencyIds].map(csvCell).join(','));
    // BOM makes Unicode labels and non-Latin item names readable in Excel.
    return '\uFEFF'+lines.join('\r\n')+'\r\n';
  }
  function previewCodeOverride(page,nodeId,raw){
    if(typeof raw!=='string')throw Error('Invalid manual WBS code');
    const value=raw.trim()||null;
    const idx=page?.nodes?.findIndex(n=>n.id===nodeId);
    if(idx<0||!Number.isInteger(idx))throw Error('Unknown WBS activity');
    if(value!==null&&(value.length>96||/[\x00-\x1f]/.test(value)))throw Error('Manual WBS code exceeds limit or contains control characters');
    const shadow={...page,nodes:page.nodes.map((n,i)=>i===idx?{...n,wbsCodeOverride:value}:n)};
    const baseline=auditPage(page),candidate=auditPage(shadow);
    const oldDuplicates=new Set(baseline.warnings.filter(w=>w.code==='DUPLICATE_WBS_CODE').map(w=>w.nodeId+'|'+w.relatedId));
    const added=candidate.warnings.find(w=>w.code==='DUPLICATE_WBS_CODE'&&!oldDuplicates.has(w.nodeId+'|'+w.relatedId));
    if(added)throw Error('WBS code already assigned: '+added.displayCode);
    return {nodeId,wbsCodeOverride:value,displayCode:candidate.rows.find(r=>r.id===nodeId).code};
  }
  function previewSettings(page,patch){
    if(!isObject(patch))throw Error('Invalid WBS settings');
    const draft=settingsFor(page.mode,{...page.outlineSettings,...patch});
    const result=auditPage({...page,outlineSettings:draft});
    const current=auditPage(page);
    const previous=new Set(current.warnings.filter(w=>w.code==='DUPLICATE_WBS_CODE').map(w=>w.nodeId+'|'+w.relatedId));
    const introduced=result.warnings.find(w=>w.code==='DUPLICATE_WBS_CODE'&&!previous.has(w.nodeId+'|'+w.relatedId));
    if(introduced)throw Error('Numbering creates duplicate WBS codes: '+introduced.displayCode);
    return draft;
  }
  return Object.freeze({VERSION,settingsFor,planPage,auditPage,migrateDocument,visibleRows,expandedPath,dependencyChoices,previewDependencies,parseDependencyText,previewFlowGrouping,exportRows,exportCsv,previewCodeOverride,previewSettings});
});
