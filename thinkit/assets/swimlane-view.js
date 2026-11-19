/* ThinkIt SW1 - read-only cross-functional Responsibility View.
 * Does not mutate Flowchart nodes, edges, geometry, WBS hierarchy or metadata.
 * Presentation lanes are NOT BPMN pools and have no execution semantics.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ThinkItSwimlanes = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const WIDTH = 178, HEIGHT = 70, GAP = 36, HEADER = 188, TOP = 56, LANE_HEIGHT = 152;
  const LIMIT = 25000;
  const svgNS = 'http://www.w3.org/2000/svg';
  const normalized = value => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  function ownerOf(node, details) {
    // The H4 helper honors explicit flowActivity.responsible, including blank
    // overrides, and falls back to the legacy node.data.role field.
    if (typeof details === 'function') return normalized(details(node)?.responsible);
    if (typeof node?.flowActivity?.responsible === 'string')
      return normalized(node.flowActivity.responsible);
    return normalized(node?.data?.role);
  }
  // SW2: progressively disclose one WBS level in the Swimlanes view.
  // No original collapsed flags, coordinates, or other project data change.
  function scopedProjection(page, hierarchy, focus, focusId = null, depthMode = 'next') {
    if (!page || page.mode !== 'flow' || !Array.isArray(page.nodes))
      throw Error('Swimlane scope requires an existing Flowchart');
    if (!hierarchy?.plan || !focus?.scope) throw Error('H5 hierarchy/focus helpers unavailable');
    if (!['next','all'].includes(depthMode)) throw Error('Unknown Swimlane view depth');
    const byId=new Map(page.nodes.map(n=>[n.id,n]));
    if (focusId && !byId.has(focusId)) throw Error('Unknown Swimlane subprocess');
    const collapsed=new Set(page.nodes.filter(n=>n.collapsed===true).map(n=>n.id));
    if (depthMode==='all') collapsed.clear();
    else {
      const visited=new Set();
      let cursor=focusId;
      while(cursor) {
        if(visited.has(cursor))throw Error('Circular Flowchart focus ancestry');
        visited.add(cursor);collapsed.delete(cursor);
        cursor=byId.get(cursor)?.outlineParentId??null;
      }
      const parentsWithChildren=new Set(page.nodes.map(n=>n.outlineParentId).filter(Boolean));
      // A phase shows its workstreams first; focusing one workstream then shows
      // its activities. Parent summaries are proxies, not role assignments.
      for (const n of page.nodes) if((n.outlineParentId??null)===(focusId??null)
        &&parentsWithChildren.has(n.id))collapsed.add(n.id);
    }
    const complete=hierarchy.plan(page,{collapsedIds:collapsed});
    const scoped=focusId?focus.scope(page,complete,focusId):complete;
    return {...scoped,swimDepthMode:depthMode};
  }
  function project(page, projection, details, options = {}) {
    if (!page || page.mode !== 'flow' || !Array.isArray(page.nodes) || !Array.isArray(page.edges))
      throw Error('Swimlanes require an existing Flowchart page');
    if (!projection || !Array.isArray(projection.visibleNodeIds) || !Array.isArray(projection.edgeViews))
      throw Error('Swimlanes require a Flowchart visible projection');
    if (page.nodes.length > LIMIT) throw Error('Flowchart is above the supported diagram limit');
    const ids = new Set(), byId = new Map();
    for (const n of page.nodes) {
      if (!n || typeof n.id !== 'string' || !n.id || ids.has(n.id))
        throw Error('Missing or duplicate Flowchart activity ID');
      ids.add(n.id); byId.set(n.id, n);
    }
    const visible = new Set();
    for (const id of projection.visibleNodeIds) {
      if (!byId.has(id) || visible.has(id)) throw Error('Invalid or duplicate visible activity');
      visible.add(id);
    }
    // Navigation is derived from the existing WBS; it does not introduce a
    // second ownership tree or a new saved lane schema.
    const children = new Map();
    for (const n of page.nodes) if(n.outlineParentId != null)
      children.set(n.outlineParentId,(children.get(n.outlineParentId)||0)+1);
    const focusOptions = page.nodes.filter(n => visible.has(n.id) &&
      (n.outlineParentId ?? null) === (projection.focusId || null) &&
      (children.get(n.id)||0)>0 && n.id!==projection.focusId)
      .map(n => ({id:n.id,label:String(n.label || 'Untitled subprocess'),count:children.get(n.id)}));
    const categoryMode=options.groupMode==='categories';
    if(categoryMode&&typeof options.resolveCategory!=='function')
      throw Error('Reviewed-category view requires a validated catalog resolver');
    const map = new Map();
    let unclassifiedCount=0,reviewedCount=0,unassignedCount=0;
    for (const n of page.nodes) {
      if (!visible.has(n.id)) continue;
      const owner = ownerOf(n, details);
      // The opt-in reviewed category never overwrites the source role text.
      const group=categoryMode?options.resolveCategory(n):null;
      const lookup=categoryMode?group?.key:owner.toLocaleLowerCase('en');
      if(typeof lookup!=='string')throw Error('Invalid responsibility category result');
      const label=categoryMode?group.label:(owner||'Unassigned / needs review');
      if(categoryMode&&group.status==='unclassified')unclassifiedCount++;
      if(categoryMode&&group.status==='reviewed')reviewedCount++;
      // Summaries, decision gates and endpoints need not have an individual
      // accountable owner. Exclude them from missing-activity-owner warnings.
      if(!owner&&!['subprocess','decision','terminator'].includes(n.shape))unassignedCount++;
      if(!map.has(lookup)) map.set(lookup,
        { key: categoryMode?lookup:owner,label,nodes:[] });
      map.get(lookup).nodes.push({node:n,owner,status:group?.status||'literal'});
    }
    // Reviewed summaries/gates are visually distinguished from actual
    // responsibility ownership. Unclassified / unassigned remain last.
    let lanes=[...map.values()];
    if(categoryMode) {
      const ranks={'meta:subprocess':1,'meta:decision':2,'meta:terminator':3,
        'meta:unclassified':5,'meta:unassigned':6};
      lanes.sort((a,b)=>(ranks[a.key]||0)-(ranks[b.key]||0));
    } else {
      lanes=lanes.filter(x=>x.key);
      if(map.has(''))lanes.push(map.get(''));
    }
    const positions = new Map();
    let maxCards = 0, cursorY = TOP;
    const maxPerRow=categoryMode?6:Number.POSITIVE_INFINITY;
    const renderedLanes = lanes.map(lane => {
      const y=cursorY;
      const rowCount=categoryMode?Math.max(1,Math.ceil(lane.nodes.length/maxPerRow)):1;
      const laneHeight=categoryMode?Math.max(LANE_HEIGHT,58+rowCount*(HEIGHT+28)):LANE_HEIGHT;
      cursorY+=laneHeight;
      maxCards=Math.max(maxCards,categoryMode?Math.min(maxPerRow,lane.nodes.length):lane.nodes.length);
      const rendered = lane.nodes.map((entry,localIndex) => {
        const n=entry.node;
        const column=categoryMode?localIndex%maxPerRow:localIndex;
        const row=categoryMode?Math.floor(localIndex/maxPerRow):0;
        const x=HEADER+32+column*(WIDTH+GAP);
        const pos={id:n.id,label:String(n.label||'Untitled activity'),
          shape:String(n.shape||'process'),x,y:y+42+row*(HEIGHT+28),w:WIDTH,h:HEIGHT,
          laneKey:lane.key,
          // SW2 scope owns the displayed disclosure state; persisted node.collapsed
          // can differ because Swimlanes uses a read-only WBS projection.
          collapsed:Object.prototype.toString.call(projection.effectiveCollapsed) === '[object Set]'
            ?projection.effectiveCollapsed.has(n.id):n.collapsed===true,
          originalRole:entry.owner,status:entry.status};
        positions.set(n.id,pos);
        return pos;
      });
      return {key:lane.key,label:lane.label,y,height:laneHeight,count:rendered.length,nodes:rendered};
    });
    const links = [];
    let excludedFree = 0, projectedCount = 0, handoffs = 0;
    for (const e of projection.edgeViews) {
      if (!e || typeof e.id !== 'string') throw Error('Invalid projected connector');
      // Free annotations have absolute coordinates and do not represent
      // responsibility handoffs; never fabricate endpoints for them.
      if (e.from == null || e.to == null) { excludedFree++; continue; }
      const from = positions.get(e.from), to = positions.get(e.to);
      if (!from || !to) throw Error('Visible connector has an unprojected endpoint: ' + e.id);
      const a = from.x + from.w, b = from.y + from.h / 2;
      const c = to.x, d = to.y + to.h / 2;
      const reverse = c <= a;
      const dPath = reverse
        ? 'M ' + a + ' ' + b + ' C ' + (a + 64) + ' ' + (b - 45) + ' ' + (c - 64) + ' ' + (d - 45) + ' ' + c + ' ' + d
        : 'M ' + a + ' ' + b + ' C ' + (a + 55) + ' ' + b + ' ' + (c - 55) + ' ' + d + ' ' + c + ' ' + d;
      const crossLane = from.laneKey !== to.laneKey;
      if (crossLane) handoffs++;
      if (e.displayProjection) projectedCount++;
      links.push({ id: e.id, from: e.from, to: e.to, path: dPath,
        label: String(e.label || '').slice(0, 90), crossLane,
        proxy: !!e.displayProjection, arrow: e.arrowEnd !== 'none' && e.kind !== 'primary',
        labelX: (a+c)/2, labelY: (b+d)/2 - 8 });
    }
    const width = Math.max(850, HEADER + 48 + maxCards * (WIDTH + GAP) + 42);
    const height = cursorY + 32;
    return { lanes: renderedLanes, nodes: [...positions.values()], links, width, height, focusOptions,
      dense: width > 3600 || height > 3600 || links.length > 80 || lanes.length > 12,
      groupMode:categoryMode?'categories':'literal',unclassifiedCount,reviewedCount,unassignedCount,
      visibleCount: visible.size, assignedCount: visible.size-unassignedCount,
      handoffs, projectedCount, excludedFree, sourceNodeCount: page.nodes.length,
      suppressedCount: Array.isArray(projection.suppressedEdgeIds) ? projection.suppressedEdgeIds.length : 0,
      focusId: projection.focusId || null, depthMode: projection.swimDepthMode || 'next',
      disclaimer: 'Activity order is a display sequence, not a schedule. Cross-lane lines are graphical connections, not necessarily formal handoffs. WBS predecessors remain distinct. Long role labels are shortened visually, not in the underlying data.' };
  }
  const el = (tag, className, text, parent) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    if (parent) parent.appendChild(node);
    return node;
  };
  const sv = (tag, attrs, parent) => {
    const node = document.createElementNS(svgNS, tag);
    for (const [k,v] of Object.entries(attrs || {})) if (v != null) node.setAttribute(k, String(v));
    if (parent) parent.appendChild(node);
    return node;
  };
  function shorten(value, max) {
    const str = String(value || '');
    return str.length > max ? str.slice(0, max - 1) + '…' : str;
  }

  function drawProcessShape(g,n) {
    const x=n.x,y=n.y,w=n.w,h=n.h,klass='sw1-activity-box';
    switch(n.shape) {
      case 'decision':
        return sv('polygon',{points:(x+w/2)+','+y+' '+(x+w)+','+(y+h/2)+' '+
          (x+w/2)+','+(y+h)+' '+x+','+(y+h/2),class:klass},g);
      case 'data':
        return sv('polygon',{points:(x+16)+','+y+' '+(x+w)+','+y+' '+
          (x+w-16)+','+(y+h)+' '+x+','+(y+h),class:klass},g);
      case 'document':
        return sv('path',{d:'M '+x+' '+y+' H '+(x+w)+' V '+(y+h-11)+
          ' Q '+(x+w*.72)+' '+(y+h-21)+' '+(x+w*.5)+' '+(y+h-10)+
          ' T '+x+' '+(y+h-10)+' Z',class:klass},g);
      case 'subprocess': {
        const outline=sv('rect',{x,y,width:w,height:h,rx:6,class:klass},g);
        sv('path',{d:'M '+(x+13)+' '+y+' V '+(y+h)+' M '+(x+w-13)+' '+y+' V '+(y+h),
          class:'sw1-subprocess-bars'},g);
        return outline;
      }
      default:
        return sv('rect',{x,y,width:w,height:h,rx:n.shape==='terminator'?h/2:8,class:klass},g);
    }
  }
  // SW4: portable SVG snapshot of the existing read-only projection.
  // Explicit download only. Never serializes user project JSON, editor controls,
  // cloud credentials, original diagram geometry, or mutable review state.
  const exportCss = [
    'svg{background:#f5f8f9;font-family:Arial,Helvetica,sans-serif}',
    '.sw1-lane{fill:#fff;stroke:#bccbd4;stroke-width:1}',
    '.sw1-lane.sw1-unassigned{stroke:#b97822;stroke-dasharray:5 4}',
    '.sw1-lane-label{fill:#e9f0f4;stroke:#bccbd4}',
    '.sw1-lane-text{fill:#183c50;font-size:13px;font-weight:700}',
    '.sw1-lane-count{fill:#536775;font-size:11px}',
    '.sw1-link{fill:none;stroke:#405969;stroke-linecap:round;stroke-linejoin:round;opacity:.7}',
    '.sw1-link.cross-lane{stroke:#007b87;opacity:.9}',
    '.sw1-link-text{font-size:10px;fill:#173d51;stroke:white;stroke-width:3;paint-order:stroke}',
    '.sw1-activity-box{fill:white;stroke:#405969;stroke-width:1.6}',
    '.sw1-activity.is-selected .sw1-activity-box{stroke:#007b87;stroke-width:2.5;fill:#e0f5f4}',
    '.sw1-activity-text{fill:#182d3a;font-size:12px;font-weight:600}',
    '.sw1-collapse-badge{fill:#007b87;font-size:14px;font-weight:800}',
    '.sw1-subprocess-bars{fill:none;stroke:#405969;stroke-width:1.2}',
    '#sw1Arrow path{fill:#405969}'
  ].join('\n');
  function standaloneSvg(liveSvg, Serializer=typeof XMLSerializer==='function'?XMLSerializer:null) {
    if(!liveSvg||typeof liveSvg.cloneNode!=='function'||typeof Serializer!=='function')
      throw Error('SVG snapshot is unavailable in this browser');
    const snapshot=liveSvg.cloneNode(true);
    const doc=snapshot.ownerDocument||(typeof document!=='undefined'?document:null);
    if(!doc?.createElementNS||typeof snapshot.insertBefore!=='function')
      throw Error('SVG document support is unavailable');
    snapshot.setAttribute('xmlns',svgNS);
    snapshot.setAttribute('role','img');
    snapshot.setAttribute('preserveAspectRatio','xMinYMin meet');
    const style=doc.createElementNS(svgNS,'style');
    style.setAttribute('type','text/css');
    style.textContent=exportCss;
    snapshot.insertBefore(style,snapshot.firstChild);
    // Accessible semantics travel with the exported SVG, not just the live UI.
    const description=doc.createElementNS(svgNS,'desc');
    description.textContent='Responsibility swimlane projection. Original responsibilities and WBS records remain authoritative. Activity order is not a schedule. Cross-lane lines are graphical connectors, not necessarily formal handoffs.';
    snapshot.insertBefore(description,snapshot.firstChild);
    const title=doc.createElementNS(svgNS,'title');
    title.textContent='ThinkIt responsibility swimlane snapshot';
    snapshot.insertBefore(title,snapshot.firstChild);
    // The live marker uses a theme variable. Replace it on the clone only;
    // downloaded SVGs must remain legible without ThinkIt's host stylesheet.
    for(const path of snapshot.querySelectorAll?.('marker path')||[]){
      if((path.getAttribute('fill')||'').includes('var('))
        path.setAttribute('fill','#405969');
    }
    // A downloaded static illustration must not advertise editable buttons.
    for(const item of snapshot.querySelectorAll?.('.sw1-activity')||[]){
      for(const name of ['role','tabindex','aria-pressed'])item.removeAttribute(name);
    }
    const markup=new Serializer().serializeToString(snapshot);
    if(typeof markup!=='string'||!markup.includes('<svg'))
      throw Error('SVG serialization did not produce a valid snapshot');
    return '<?xml version="1.0" encoding="UTF-8"?>\n'+markup;
  }
  function downloadSvg(host,filename='ThinkIt-Swimlanes.svg') {
    const liveSvg=host?.querySelector?.('.sw1-scroll svg');
    if(!liveSvg)throw Error('No visible swimlane diagram to export');
    const snapshot=standaloneSvg(liveSvg);
    const uri=URL.createObjectURL(new Blob([snapshot],
      {type:'image/svg+xml;charset=utf-8'}));
    const link=document.createElement('a');
    link.href=uri;link.download=filename;link.hidden=true;
    document.body.appendChild(link);
    try{link.click();}
    finally{
      link.remove();
      // Avoid premature blob revocation on Safari's asynchronous download path.
      setTimeout(()=>URL.revokeObjectURL(uri),5000);
    }
  }
  function render(host, model, options = {}) {
    if (!host || !model) throw Error('Missing swimlane host or projection');
    const previous = host.querySelector('.sw1-scroll');
    const scrollLeft = previous ? previous.scrollLeft : 0;
    const scrollTop = previous ? previous.scrollTop : 0;
    host.replaceChildren();
    const info = el('div', 'sw1-info', undefined, host);
    el('strong', '', 'Responsibility swimlanes · diagram read-only', info);
    const stats = model.visibleCount + ' visible activities · ' + model.lanes.length + ' lanes · ' +
      model.links.length + ' graphical links · ' + model.handoffs + ' cross-lane connections';
    el('span', 'sw1-stats', stats, info);
    if(['onGroupMode','onReview','onUndo','onRedo'].some(key=>typeof options[key]==='function')){
      const tools=el('div','sw3-view-tools',undefined,host);
      if(typeof options.onGroupMode==='function'){
        const wrap=el('label','','Group by',tools);
        const select=el('select','sw3-group-select',undefined,wrap);
        for(const [id,name] of [['literal','Original responsibility'],['categories','Reviewed categories']]){
          const entry=el('option','',name,select);entry.value=id;
        }
        select.value=model.groupMode;
        select.addEventListener('change',()=>options.onGroupMode(select.value));
      }
      if(typeof options.onReview==='function'){
        const review=el('button','sw3-review-toggle',options.reviewOpen?'Close category review':'Review responsibility categories',tools);
        review.type='button';review.addEventListener('click',()=>options.onReview(!options.reviewOpen));
      }
      const exportBtn=el('button','sw4-export-svg','Export current view · SVG',tools);
      exportBtn.type='button';
      exportBtn.disabled=model.visibleCount===0;
      exportBtn.title='Download this visible swimlane scope as a standalone vector image';
      exportBtn.addEventListener('click',()=>{
        if(exportBtn.disabled)return;
        try{
          downloadSvg(host,'ThinkIt-Swimlanes-'+(model.groupMode==='categories'?'Reviewed':'Original')+'.svg');
        }catch(error){
          console.error('Swimlane SVG export failed without changing the Flowchart',error);
          if(typeof window!=='undefined'&&typeof window.alert==='function')
            window.alert('Unable to export the swimlane SVG in this browser. Your diagram is unchanged.');
        }
      });
      if(typeof options.onUndo==='function'){
        const undo=el('button','sw3-undo','Undo last edit',tools);
        undo.type='button';undo.disabled=!options.canUndo;
        undo.addEventListener('click',()=>options.onUndo());
      }
      if(typeof options.onRedo==='function'){
        const redo=el('button','sw3-redo','Redo last edit',tools);
        redo.type='button';redo.disabled=!options.canRedo;
        redo.addEventListener('click',()=>options.onRedo());
      }
    }
    if(options.reviewOpen&&typeof options.renderReview==='function'){
      const review=el('section','sw3-review',undefined,host);
      review.setAttribute('aria-label','Responsibility category review');
      options.renderReview(review);
    }
    const hint = el('p', 'sw1-hint', model.disclaimer+' SVG export captures the currently visible swimlane scope as a vector snapshot. Physical paper-scale Print Layout remains available only in Diagram view.', host);
    hint.setAttribute('role', 'note');
    if (model.visibleCount === 0) {
      el('p', 'sw1-empty', 'No visible activities in this Flowchart scope.', host);
      return;
    }
    if(model.groupMode==='categories'&&model.unclassifiedCount){
      el('p','sw1-warning',model.unclassifiedCount+
        ' visible activities have no reviewed category. Their original responsibilities are preserved; no assignment is inferred.',host);
    }
    if (model.unassignedCount > 0) {
      el('p', 'sw1-warning', model.unassignedCount +
        ' activity/activities lack a responsible stakeholder. Assign responsibilities in the existing Properties panel; no responsibility is inferred.', host);
    }
    if (model.projectedCount) {
      el('p', 'sw1-warning', model.projectedCount +
        ' connection(s) use collapsed subprocess proxies. Displayed lane ownership may differ from the hidden activity owner; expand the subprocess to inspect actual responsibilities.', host);
    }
    if (model.dense) el('p', 'sw1-warning',
      'Large process view ('+model.visibleCount+' activities; '+model.width+' × '+model.height+' px). Focus on a subprocess for legibility. Scrolling remains available; no records are hidden or rearranged.', host);
    if ((typeof options.onFocus === 'function' && (model.focusOptions.length || model.focusId)) || typeof options.onDepth === 'function') {
      const bar=el('div','sw1-scope-bar',undefined,host);
      if (typeof options.onDepth === 'function') {
        const label=el('label','','Detail',bar);
        const select=el('select','sw1-depth-select',undefined,label);
        for(const [value,text] of [['next','One WBS level'],['all','All levels (may be crowded)']]){
          const opt=el('option','',text,select);opt.value=value;
        }
        select.value=model.depthMode;
        select.addEventListener('change',()=>options.onDepth(select.value));
      }
      if (typeof options.onFocus === 'function' && (model.focusOptions.length || model.focusId)) {
      const label=el('label','', 'Scope',bar);
      const select=el('select','sw1-focus-select',undefined,label);
      const prompt=el('option','','Focus on a subprocess…',select);
      prompt.value=''; prompt.disabled=true; prompt.selected=true;
      for (const entry of model.focusOptions) {
        const opt=el('option','', entry.label+' ('+entry.count+' direct activities)',select);
        opt.value=entry.id;
      }
      select.addEventListener('change',()=>{if(select.value)options.onFocus(select.value);});
      if(model.focusId) {
        const back=el('button','sw1-focus-all','All activities',bar);
        back.type='button';back.addEventListener('click',()=>options.onFocus(null));
      }
      }
    }
    const scroll = el('div', 'sw1-scroll', undefined, host);
    scroll.setAttribute('tabindex','0');
    scroll.setAttribute('aria-label','Scrollable responsibility swimlane diagram');
    const svg = sv('svg', {xmlns:svgNS, width:model.width, height:model.height,
      viewBox:'0 0 ' + model.width + ' ' + model.height,
      role:'group','aria-label':'Process activities grouped by responsible stakeholder'}, scroll);
    const defs = sv('defs', {}, svg);
    const marker = sv('marker', {id:'sw1Arrow', markerWidth:8, markerHeight:8, refX:7, refY:4,
      orient:'auto', markerUnits:'strokeWidth'}, defs);
    sv('path', {d:'M 0 0 L 8 4 L 0 8 z',fill:'var(--line-strong)'}, marker);
    const laneLayer = sv('g', {'aria-hidden':'true'}, svg);
    for (let i=0;i<model.lanes.length;i++) {
      const lane=model.lanes[i], empty=lane.key === '';
      sv('rect',{x:8,y:lane.y,width:model.width-16,height:lane.height-5,
        rx:8,class:'sw1-lane'+(empty?' sw1-unassigned':'')},laneLayer);
      sv('rect',{x:8,y:lane.y,width:HEADER-10,height:lane.height-5,rx:8,
        class:'sw1-lane-label'},laneLayer);
      const label=sv('text',{x:22,y:lane.y+40,class:'sw1-lane-text',
        'aria-label':lane.label},laneLayer);
      label.textContent=shorten(lane.label,27);
      const fullLabel=sv('title',{},label);fullLabel.textContent=lane.label;
      const count=sv('text',{x:22,y:lane.y+63,class:'sw1-lane-count'},laneLayer);
      count.textContent=lane.count+(lane.count===1?' activity':' activities');
    }
    const linksLayer=sv('g',{'aria-label':'Existing graphical connectors'},svg);
    for (const link of model.links) {
      const g=sv('g',{'data-sw1-edge-id':link.id},linksLayer);
      sv('path',{d:link.path,fill:'none',class:'sw1-link'+(link.crossLane?' cross-lane':''),
        'stroke-width':link.crossLane?2.2:1.5,
        'marker-end':link.arrow?'url(#sw1Arrow)':null},g);
      if(link.label) {
        const t=sv('text',{x:link.labelX,y:link.labelY,class:'sw1-link-text'},g);
        t.textContent=shorten(link.label,24);
      }
    }
    const nodeLayer=sv('g',{},svg);
    const selected=options.selectedIds || new Set();
    for (const n of model.nodes) {
      const g=sv('g',{'data-sw1-id':n.id,tabindex:0,role:'button',
        'aria-label':n.label+'; select activity to view details',
        'aria-pressed':selected.has(n.id)?'true':'false',
        class:'sw1-activity'+(selected.has(n.id)?' is-selected':'')},nodeLayer);
      drawProcessShape(g,n);
      const words=n.label.split(/\s+/).filter(Boolean);
      const lines=[],lineLimit=n.shape==='decision'?18:26;
      let current='';
      for (const word of words) {
        if ((current+' '+word).trim().length>lineLimit && current) {
          lines.push(current);current=word;
        } else current=(current+' '+word).trim();
      }
      if(current) lines.push(current);
      const label=sv('text',{x:n.x+n.w/2,y:n.y+n.h/2-(Math.min(lines.length,2)-1)*9,
        'text-anchor':'middle',class:'sw1-activity-text'},g);
      (lines.length?lines:['Untitled activity']).slice(0,2).forEach((line,index)=>{
        const tspan=sv('tspan',{x:n.x+n.w/2,dy:index?18:0},label);
        tspan.textContent=shorten(line,index===1&&lines.length>2?25:27);
      });
      if(n.originalRole){
        const title=sv('title',{},g);
        title.textContent='Original responsibility: '+n.originalRole;
      }
      if(n.collapsed) {
        const badge=sv('text',{x:n.x+n.w-10,y:n.y+13,'text-anchor':'end',
          class:'sw1-collapse-badge'},g);
        badge.textContent='+';
      }
      if (typeof options.onSelect === 'function') {
        const choose=()=>options.onSelect(n.id);
        g.addEventListener('click',choose);
        g.addEventListener('keydown',event=>{
          if(event.key==='Enter' || event.key===' ') {
            event.preventDefault();choose();
          }
        });
      }
    }
    scroll.scrollLeft=scrollLeft; scroll.scrollTop=scrollTop;
  }
  return Object.freeze({project,render,ownerOf,scopedProjection,standaloneSvg});
});
