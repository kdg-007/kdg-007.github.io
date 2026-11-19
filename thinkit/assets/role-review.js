/* ThinkIt SW3 - accessible review pane for explicitly approved role categories.
 * No role/category guesses. Every edit is delivered through owner callbacks.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.ThinkItRoleReview=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const el=(tag,cls,text,parent)=>{
  const n=document.createElement(tag);if(cls)n.className=cls;
  if(text!==undefined)n.textContent=text;if(parent)parent.appendChild(n);return n;
 };
 const MAX_ROWS=50;
 function render(host,audit,catalog,options={}){
  if(!host||!audit||!catalog)throw Error('Missing role-review workspace');
  host.replaceChildren();
  const intro=el('div','sw3-review-intro',undefined,host);
  el('strong','', 'Review responsibility categories',intro);
  el('p','',audit.activities+' individual activities · '+audit.uniqueRoles+' exact role labels · '+
   audit.reviewed+' reviewed assignments · '+audit.unclassified+' unclassified · '+
   audit.unassigned+' without a responsible party.',intro);
  el('p','', 'Categories summarize responsibility for navigation only. The exact original text remains authoritative. A shared or multi-party label is not split automatically. Assignments apply only after you choose a category.',intro);
  const add=el('div','sw3-add-category',undefined,host);
  const label=el('label','', 'New category',add);
  const categoryName=el('input','',undefined,label);
  categoryName.type='text';categoryName.maxLength=100;categoryName.placeholder='e.g., Architectural services';
  const create=el('button','','Add category',add);create.type='button';
  create.addEventListener('click',()=>{
   const name=categoryName.value.trim();
   if(name&&typeof options.onCreateCategory==='function')options.onCreateCategory(name);
  });
  if(audit.categories.length){
    const inventory=el('details','sw3-catalog-list',undefined,host);
    const summary=el('summary','', 'Manage '+audit.categories.length+' categories',inventory);
    summary.title='Category IDs remain stable when names change';
    const rows=el('div','sw3-category-rows',undefined,inventory);
    for(const category of audit.categories){
      const row=el('div','sw3-category-row',undefined,rows);
      const label=el('label','', 'Category name',row);
      const field=el('input','',undefined,label);field.type='text';
      field.maxLength=100;field.value=category.name;
      const save=el('button','','Rename',row);save.type='button';
      save.addEventListener('click',()=>options.onRenameCategory?.(category.id,field.value.trim()));
      const mappedRoles=catalog.roleAssignments.filter(x=>x.categoryId===category.id).length;
      const mappedActivities=catalog.nodeAssignments.filter(x=>x.categoryId===category.id).length;
      const remove=el('button','','Delete',row);remove.type='button';
      remove.disabled=!!(mappedRoles||mappedActivities);
      remove.title=remove.disabled?'Unassign mapped roles/activities before deleting':'Delete this unused category';
      remove.addEventListener('click',()=>options.onRemoveCategory?.(category.id));
      el('small','',mappedRoles+' role mappings · '+mappedActivities+' activity exceptions',row);
    }
  }
  if(!audit.categories.length)el('p','sw3-review-message',
    'Create a category, then explicitly map matching role statements to it. No assignments have been assumed.',host);
  if(audit.staleNodeAssignments.length)el('p','sw3-review-message',
    audit.staleNodeAssignments.length+' per-activity overrides refer to deleted/missing IDs. They are not applied to another activity.',host);
  if(audit.inactiveNodeAssignments?.length)el('p','sw3-review-message',
    audit.inactiveNodeAssignments.length+' per-activity category overrides are currently inactive because their activity is a summary/gate or has no responsible stakeholder. Review these in Properties; their original records are unchanged.',host);
  const chosen=options.selectedNode;
  if(chosen&&options.assignable?.(chosen)){
   const row=el('div','sw3-selected-review',undefined,host);
   el('strong','', 'Selected activity: '+String(chosen.label||chosen.id).slice(0,110),row);
   const source=typeof options.originalRole==='function'?options.originalRole(chosen):'';
   const current=typeof options.resolver?.resolve==='function'?options.resolver.resolve(chosen):null;
   el('p','', 'Original: '+(source||'Unassigned'),row);
   const wrap=el('label','', 'Per-activity exception',row);
   const sel=categorySelect(wrap,audit.categories,'',true);
   const override=catalog.nodeAssignments.find(x=>x.nodeId===chosen.id);
   sel.value=override?.categoryId||'';
   // The catalog is a navigation aid, not a substitute for assigning an
   // accountable stakeholder. Blank source responsibilities cannot be mapped.
   if(!source){
     sel.disabled=true;
     el('small','sw3-review-message','Set the responsible stakeholder in the existing Properties panel before categorizing this activity.',row);
   }else sel.addEventListener('change',()=>options.onAssignNode?.(chosen.id,sel.value));
   if(current?.status==='reviewed')el('small','', 'Effective category: '+current.label,row);
  }
  const search=el('label','sw3-search-label', 'Search original responsibility labels',host);
  const input=el('input','sw3-search',undefined,search);
  input.type='search';input.placeholder='Find an exact role or combined responsibility';
  input.value=options.initialSearch||'';
  // Selected exact role labels live only in the current review session.
  // They are never saved or automatically converted to category mappings.
  const available=new Set(audit.roles.filter(x=>x.role).map(x=>x.role));
  const selectedRoles=new Set([...options.selectedRoles||[]].filter(role=>available.has(role)));
  const batch=el('div','sw3-batch-controls',undefined,host);
  const batchCount=el('strong','sw3-batch-count','0 selected',batch);
  const batchLabel=el('label','','Assign selected labels to',batch);
  const batchSelect=categorySelect(batchLabel,audit.categories,'',true);
  batchSelect.setAttribute('aria-label','Reviewed category for explicitly selected role labels');
  const batchApply=el('button','sw3-batch-apply','Assign selected roles',batch);
  batchApply.type='button';
  const batchClear=el('button','sw3-batch-clear','Clear selection',batch);
  batchClear.type='button';
  const updateBatch=()=>{
    batchCount.textContent=selectedRoles.size+' exact role label'+(selectedRoles.size===1?'':'s')+' selected';
    batchApply.disabled=!selectedRoles.size||!batchSelect.value||typeof options.onAssignRoles!=='function';
    batchClear.disabled=!selectedRoles.size;
  };
  batchSelect.addEventListener('change',updateBatch);
  batchApply.addEventListener('click',()=>{
    if(batchApply.disabled)return;
    // Every selected role must still exist in this page's current audit.
    const exactRoles=[...selectedRoles].filter(role=>available.has(role));
    if(exactRoles.length&&batchSelect.value)options.onAssignRoles?.(exactRoles,batchSelect.value);
  });
  batchClear.addEventListener('click',()=>{
    for(const role of selectedRoles)options.onSelectionChange?.(role,false);
    selectedRoles.clear();
    for(const input of host.querySelectorAll('.sw3-role-check'))input.checked=false;
    updateBatch();
  });
  updateBatch();
  const count=el('div','sw3-results-count','',host);
  const results=el('div','sw3-role-results',undefined,host);
  let visibleLimit=Math.max(MAX_ROWS,Math.min(5000,Number.isSafeInteger(options.initialLimit)?options.initialLimit:MAX_ROWS));
  const paint=()=>{
   const term=input.value.trim().toLocaleLowerCase('en');
   const items=audit.roles.filter(r=>(r.role||'Unassigned').toLocaleLowerCase('en').includes(term));
   results.replaceChildren();
   for(const role of items.slice(0,visibleLimit)){
    const row=el('div','sw3-role-row',undefined,results);
    const reviewLabel=el('label','sw3-role-pick',undefined,row);
    const check=el('input','sw3-role-check',undefined,reviewLabel);
    check.type='checkbox';
    check.checked=selectedRoles.has(role.role);
    check.disabled=!role.role;
    check.setAttribute('aria-label','Select original responsibility: '+(role.role||'Unassigned'));
    check.addEventListener('change',()=>{
      if(!role.role)return;
      if(check.checked)selectedRoles.add(role.role);else selectedRoles.delete(role.role);
      options.onSelectionChange?.(role.role,check.checked);
      updateBatch();
    });
    const desc=el('div','sw3-role-description',undefined,row);
    const title=el('div','sw3-role-text',role.role||'Unassigned / needs review',desc);
    title.title=role.role||'Unassigned / needs review';
    el('small','',role.count+' activit'+(role.count===1?'y':'ies')+
      (role.reviewedCount?' · '+role.reviewedCount+' reviewed':'')+
      (role.exceptionCount?' · '+role.exceptionCount+' activity exception'+(role.exceptionCount===1?'':'s'):''),desc);
    const assignment=el('label','sw3-role-mapping', 'Category',row);
    const sel=categorySelect(assignment,audit.categories,role.categoryId||'',true);
    sel.disabled=!role.role; // Never map an absent source role.
    sel.addEventListener('change',()=>options.onAssignRole?.(role.role,sel.value));
    if(role.exceptionCount)el('small','sw3-mixed-warning',
      'Activity-specific exceptions take precedence. This dropdown changes the role-wide mapping only.',row);
   }
   count.textContent='Showing '+Math.min(items.length,visibleLimit)+' of '+items.length+' matching role labels';
   if(items.length>visibleLimit){
    const more=el('button','sw3-show-more','Show more results',results);
    more.type='button';more.addEventListener('click',()=>{visibleLimit=Math.min(5000,visibleLimit+MAX_ROWS);options.onVisibleLimit?.(visibleLimit);paint();});
   }
  };
  input.addEventListener('input',()=>{visibleLimit=MAX_ROWS;options.onVisibleLimit?.(visibleLimit);options.onSearch?.(input.value);paint();});
  paint();
 }
 function categorySelect(parent,categories,current,allowNone){
  const select=el('select','sw3-category-select',undefined,parent);
  if(allowNone){const opt=el('option','', '— Not reviewed —',select);opt.value='';}
  for(const item of categories){
   const opt=el('option','',item.name,select);opt.value=item.id;
  }
  select.value=current||'';
  return select;
 }
 // Capture only transient navigation state, never catalog or activity data.
 function captureState(panel) {
  const review=panel?.querySelector?.('.sw3-review');
  if(!review)return null;
  const active=document.activeElement;
  const roleRow=active?.closest?.('.sw3-role-row');
  const inside=typeof review.contains==='function'&&review.contains(active);
  let focus=null;
  if(inside&&active){
   if(active.classList?.contains('sw3-search'))focus={kind:'search'};
   else if(roleRow&&active.classList?.contains('sw3-category-select'))
    focus={kind:'role',role:roleRow.querySelector('.sw3-role-text')?.textContent||''};
  }
  return {scrollTop:Math.max(0,review.scrollTop||0),
    catalogOpen:!!review.querySelector('.sw3-catalog-list')?.open,focus};
 }
 function restoreState(panel,state){
  if(!state)return;
  const review=panel?.querySelector?.('.sw3-review');
  if(!review)return;
  const details=review.querySelector('.sw3-catalog-list');
  if(details)details.open=!!state.catalogOpen;
  const scrollTop=Math.max(0,Number(state.scrollTop)||0);
  if(state.focus?.kind==='search')review.querySelector('.sw3-search')?.focus({preventScroll:true});
  if(state.focus?.kind==='role'&&state.focus.role){
   const row=[...review.querySelectorAll('.sw3-role-row')].find(
    x=>x.querySelector('.sw3-role-text')?.textContent===state.focus.role);
   row?.querySelector('.sw3-category-select')?.focus({preventScroll:true});
  }
  review.scrollTop=scrollTop;
 }
 return Object.freeze({render,captureState,restoreState});
});
