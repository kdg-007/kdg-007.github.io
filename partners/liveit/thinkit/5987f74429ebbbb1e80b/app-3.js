
/* LiveIt W12 local-domain features. Annual occurrences are visual projections of the
   SAME canonical event ID, never new records or external calendar sync. Feb 29 skips
   non-leap years; overdue and completion semantics are NOT inferred from recurrence. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.LiveItW12=api;})(typeof window!=='undefined'?window:undefined,function(){
  'use strict';
  const DATE=/^\d{4}-\d{2}-\d{2}$/;
  function validDate(x){if(typeof x!=='string'||!DATE.test(x))return false;const d=new Date(x+'T12:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===x;}
  function validClock(x){return typeof x==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(x);}
  // W17I-O: dashboard labels are relative to the day being inspected, not
  // implicitly the device's current date. Read-only and timezone-neutral: the
  // caller supplies local ISO dates from the existing daily clock.
  function dayContext(selected,today){
    if(!validDate(selected)||!validDate(today))throw new Error('Invalid dashboard date');
    const mode=selected===today?'today':selected<today?'past':'future';
    return {mode,isCurrent:mode==='today',
      viewLabel:mode==='today'?'Today':mode==='past'?'Earlier day':'Future day',
      dueLabel:mode==='today'?'Due today':'Currently open · due on selected day',
      overdueLabel:mode==='today'?'Overdue now':'Currently open · due before selected day',
      aheadLabel:mode==='today'?'Look ahead':'Look ahead from selected day'};
  }
  function occurrenceOn(record,day){
    if(!record||record.type!=='event'||record.archived||!validDate(day)||!validDate(record.date))return null;
    if(record.repeat==='yearly'){
      if(day<record.date||day.slice(5)!==record.date.slice(5))return null;
      // Feb-29 doesn't silently move to Feb-28 or Mar-01.
      return {...record,date:day,occurrenceDate:day,repeat:'yearly'};
    }
    return record.date===day?record:null;
  }
  function listEvents(records,day,workspace){if(!['work','personal'].includes(workspace))return [];
    return (Array.isArray(records)?records:[]).filter(x=>x&&x.workspace===workspace).flatMap(x=>{const row=occurrenceOn(x,day);return row?[row]:[];});
  }
  function dueReminders(records,day,workspace){return (Array.isArray(records)?records:[]).filter(x=>x&&x.workspace===workspace&&!x.archived&&!x.complete&&['task','reminder'].includes(x.type)&&x.dueDate===day);}
  // W17I-P: task sections are read-only projections of the CURRENT record state.
  // The existing record schema has no completion timestamp: do not reconstruct
  // historical completion from a selected calendar date or claim device alerts.
  function taskBuckets(rows,workspace,today,kind='all'){
    const groups={overdue:[],dueToday:[],upcoming:[],undated:[],completed:[]};
    if(!['work','personal'].includes(workspace)||!validDate(today)||!['all','task','reminder'].includes(kind))return groups;
    const eligible=(Array.isArray(rows)?rows:[]).filter(x=>x&&x.workspace===workspace&&!x.archived&&
      ['task','reminder'].includes(x.type)&&(kind==='all'||x.type===kind));
    for(const item of eligible){
      if(item.complete){groups.completed.push(item);continue;}
      if(!validDate(item.dueDate)){groups.undated.push(item);continue;}
      if(item.dueDate<today)groups.overdue.push(item);
      else if(item.dueDate===today)groups.dueToday.push(item);
      else groups.upcoming.push(item);
    }
    const ascending=(a,b)=>String(a.dueDate||a.date||'').localeCompare(String(b.dueDate||b.date||''))||
      String(a.createdAt||'').localeCompare(String(b.createdAt||''))||String(a.id||'').localeCompare(String(b.id||''));
    for(const key of ['overdue','dueToday','upcoming','undated'])groups[key].sort(ascending);
    groups.completed.sort((a,b)=>-ascending(a,b));
    return groups;
  }
  // W17I-Q: explicit due-date suggestions use the actual device-local day,
  // never a historical day selected in the Today dashboard. No alerts are sent.
  function quickDueDate(today,choice,type){
    if(!validDate(today)||!['task','reminder'].includes(type))throw new Error('Invalid due-date context');
    if(choice==='clear'){
      if(type==='reminder')throw new Error('A reminder must have a due date');
      return '';
    }
    const offsets={today:0,tomorrow:1,week:7};
    if(!Object.prototype.hasOwnProperty.call(offsets,choice))throw new Error('Invalid due-date action');
    const result=new Date(today+'T12:00:00Z');
    result.setUTCDate(result.getUTCDate()+offsets[choice]);
    return result.toISOString().slice(0,10);
  }
  // W17Q: foreground-only reminder triage. Times are interpreted as device-local
  // HH:MM by the caller; this never schedules notifications or background work.
  // The original records are not changed, and foreign workspaces stay hidden.
  function foregroundReminders(rows,workspace,today,clock){
    const result={dueNow:[],laterToday:[]};
    if(!['work','personal'].includes(workspace)||!validDate(today)||!validClock(clock))return result;
    for(const item of Array.isArray(rows)?rows:[]){
      if(!item||item.workspace!==workspace||item.type!=='reminder'||item.archived||
         item.complete||!validDate(item.dueDate))continue;
      if(item.remindAt && !validClock(item.remindAt))continue; // do not trust malformed clocks
      if(item.dueDate<today)result.dueNow.push({record:item,reason:'overdue'});
      else if(item.dueDate===today){
        if(!item.remindAt)result.dueNow.push({record:item,reason:'date-only'});
        else if(item.remindAt<=clock)result.dueNow.push({record:item,reason:'time-reached'});
        else result.laterToday.push({record:item,reason:'later-today'});
      }
    }
    const compare=(a,b)=>a.record.dueDate.localeCompare(b.record.dueDate)||
      String(a.record.remindAt||'').localeCompare(String(b.record.remindAt||''))||
      String(a.record.id||'').localeCompare(String(b.record.id||''));
    result.dueNow.sort(compare);result.laterToday.sort(compare);
    return result;
  }
  // W18A: presentation-only quick actions. KeepIt is not involved and this
  // allowlist cannot inject HTML or change the IndexedDB record schema.
  const QUICK_ACTION_TYPES=Object.freeze(['note','task','reminder','event','journal']);
  const QUICK_ACTION_DEFAULTS=Object.freeze({
    work:Object.freeze(['note','task','reminder','event']),
    personal:Object.freeze(['note','journal','reminder','event'])
  });
  function normalizeQuickActions(saved){
    const result={};
    for(const workspace of ['work','personal']){
      const raw=saved&&typeof saved==='object'&&!Array.isArray(saved)?saved[workspace]:null;
      const valid=Array.isArray(raw)&&raw.length>=1&&raw.length<=4&&
        raw.every((value,index)=>typeof value==='string'&&
          QUICK_ACTION_TYPES.includes(value)&&raw.indexOf(value)===index);
      result[workspace]=(valid?raw:QUICK_ACTION_DEFAULTS[workspace]).slice();
    }
    return result;
  }
  function toggleQuickAction(saved,workspace,type){
    if(!['work','personal'].includes(workspace)||!QUICK_ACTION_TYPES.includes(type))
      throw Error('Invalid quick action');
    const next=normalizeQuickActions(saved);
    const list=next[workspace];
    if(list.includes(type)){
      if(list.length===1)throw Error('Keep at least one quick action');
      next[workspace]=list.filter(x=>x!==type);
    }else{
      if(list.length===4)throw Error('Show at most four quick actions. Hide one first.');
      // Preserve the chosen order of the existing shortcuts.
      next[workspace]=[...list,type];
    }
    return next;
  }
  // W17T: deterministic offline date brief. No LLM, cloud, historical
  // completion inference, attendance inference, or cross-workspace lookup.
  function dayBrief(rows,workspace,day){
    const zero={planned:0,recorded:0,journal:0,quick:0,due:0,openNow:0,highlights:[]};
    if(!['work','personal'].includes(workspace)||!validDate(day))return zero;
    const scoped=(Array.isArray(rows)?rows:[]).filter(x=>x&&x.workspace===workspace&&!x.archived);
    const planned=listEvents(scoped,day,workspace).length;
    const isActual=x=>['note','quote','journal'].includes(x.type) &&
      (x.type==='journal'?(x.occurredOn||x.date):x.date)===day;
    const actual=scoped.filter(isActual);
    const due=scoped.filter(x=>['task','reminder'].includes(x.type)&&x.dueDate===day);
    const highlightRows=[...actual].sort((a,b)=>(a.type==='journal'?0:1)-(b.type==='journal'?0:1)||
      String(b.createdAt||'').localeCompare(String(a.createdAt||''))||
      String(a.id||'').localeCompare(String(b.id||'')));
    const highlights=highlightRows.slice(0,2).filter(x=>typeof x.body==='string').map(x=>({
      id:x.id,type:x.type,preview:x.body.replace(/\s+/g,' ').trim().slice(0,96)
    }));
    return {
      planned,recorded:actual.length,journal:actual.filter(x=>x.type==='journal').length,
      quick:actual.filter(x=>x.type!=='journal').length,
      due:due.length,openNow:due.filter(x=>!x.complete).length,highlights
    };
  }
  // W17R: read-only INVENTORY of a separately validated, already decrypted
  // local backup. It conveys counts only; no body, title, filename, credential,
  // note reference, or draft contents are returned to the review UI.
  // This is NOT evidence of source-origin identity or migration permission.
  function restoreInventory(stores){
    if(!stores||typeof stores!=='object'||Array.isArray(stores))throw Error('Backup store inventory unavailable');
    const required=['meta','records','drafts','operations','audit','spaces',
      'note_associations','note_association_ops','projection_records',
      'projection_receipts','projection_tombstones','outbox','integration_bindings'];
    for(const name of required)if(!Array.isArray(stores[name]))throw Error('Backup inventory store missing: '+name);
    const byWorkspace=()=>({work:0,personal:0});
    const records=byWorkspace(),drafts=byWorkspace(),links=byWorkspace();
    const allocated=(row,type)=>{
      const workspace=type==='draft'&&typeof row.workspace==='string'&&row.workspace.startsWith('parked:')
        ?row.workspace.split(':')[1]:row.workspace;
      if(!['work','personal'].includes(workspace))throw Error('Invalid '+type+' workspace in restore inventory');
      return workspace;
    };
    for(const row of stores.records)records[allocated(row,'record')]++;
    for(const row of stores.drafts)drafts[allocated(row,'draft')]++;
    for(const row of stores.note_associations)links[allocated(row,'association')]++;
    const dataRows=required.filter(name=>!['meta','spaces'].includes(name))
      .reduce((count,name)=>count+stores[name].length,0);
    return Object.freeze({
      records:Object.freeze(records),drafts:Object.freeze(drafts),
      links:Object.freeze(links),
      nativeLinkOperations:stores.note_association_ops.length,
      travelProjections:stores.projection_records.length+stores.projection_tombstones.length+
        stores.projection_receipts.length,
      connectorEntries:stores.integration_bindings.length+stores.outbox.length,
      localRecords:stores.records.length,
      dataRows,
      generation:stores.meta.find(row=>row.key==='state')?.initializedAt||null
    });
  }
  function restoreReview(incomingStores,currentStores){
    const incoming=restoreInventory(incomingStores);
    const current=restoreInventory(currentStores);
    const blockers=[];
    if(incoming.links.work+incoming.links.personal+incoming.nativeLinkOperations)
      blockers.push('KeepIt native-note links or receipts need owner-side reconciliation');
    if(incoming.travelProjections)
      blockers.push('TravelIt projections or receipts require source verification');
    if(incoming.connectorEntries)
      blockers.push('Pending connector commands cannot be restored automatically');
    const recordOperations=new Set();
    for(const row of incomingStores.records){
      if(recordOperations.has(row.opId)){blockers.push('Duplicate record operation identities in backup');break;}
      recordOperations.add(row.opId);
    }
    return Object.freeze({
      incoming,current,
      replaceCurrent:current.dataRows>0,
      sameGeneration:!!incoming.generation&&incoming.generation===current.generation,
      blockers:Object.freeze(blockers),
      localRestoreAllowed:blockers.length===0,
      migrationApproved:false,
      sourceOriginAuthenticated:false,
      keepItCloudVerified:false,
      reviewOnly:true
    });
  }
  function uniqueName(names,candidate,except=''){return !names.some(x=>x.toLocaleLowerCase()===candidate.toLocaleLowerCase()&&x.toLocaleLowerCase()!==except.toLocaleLowerCase());}
  function manageSpace(data,scope,action,oldName,newName){
    if(!['work','personal'].includes(scope)||!data||!data.spaces||!Array.isArray(data.spaces[scope]))throw new Error('Invalid Quick Space workspace');
    if(!['rename','remove'].includes(action))throw new Error('Invalid Quick Space operation');
    const names=data.spaces[scope],idx=names.indexOf(oldName);
    if(idx<0)throw new Error('Quick Space no longer exists');
    if(action==='rename'){
      if(typeof newName!=='string'||!newName.trim()||newName.length>40||/[\u0000-\u001f]/.test(newName))throw new Error('Invalid Quick Space name');
      const target=newName.trim();
      if(!uniqueName(names,target,oldName))throw new Error('A Quick Space with that name already exists');
      names[idx]=target;
      for(const row of data.records.filter(x=>x.workspace===scope)){row.categories=[...new Set(row.categories.map(x=>x===oldName?target:x))];}
    }else{
      names.splice(idx,1);
      // Records remain; removal means untag, not delete or archive the content.
      for(const row of data.records.filter(x=>x.workspace===scope)){row.categories=row.categories.filter(x=>x!==oldName);}
    }
    return true;
  }
  // W17I-L: read-only journal navigation. The caller supplies the current
  // workspace; no record or association is moved or rewritten to group it.
  // W17I-N: Journal retrieval is read-only, workspace-scoped and independent of
  // general search. All selector options come from eligible local records, not
  // the current text match, so typing never silently changes selected dates.
  function journalTimeline(rows,workspace,year='all',month='all',query=''){
    if(!['work','personal'].includes(workspace))return {years:[],groups:[],total:0,visible:0};
    const candidates=(Array.isArray(rows)?rows:[]).filter(x=>
      x && x.workspace===workspace && !x.archived && ['note','quote','journal'].includes(x.type) &&
      validDate(x.type==='journal'?(x.occurredOn||x.date):x.date));
    const dated=candidates.map(x=>({record:x,day:x.type==='journal'?(x.occurredOn||x.date):x.date}));
    const years=[...new Set(dated.map(x=>x.day.slice(0,4)))].sort((a,b)=>b.localeCompare(a));
    const selection=year==='all'||years.includes(year)?year:'all';
    const inYear=selection==='all'?dated:dated.filter(x=>x.day.startsWith(selection+'-'));
    const months=[...new Set(inYear.map(x=>x.day.slice(5,7)))].sort((a,b)=>a.localeCompare(b));
    const monthSelection=month==='all'||months.includes(month)?month:'all';
    const needle=typeof query==='string'?query.slice(0,100).trim().normalize('NFKC').toLocaleLowerCase():'';
    const selected=inYear.filter(x=>(monthSelection==='all'||x.day.slice(5,7)===monthSelection) &&
      (!needle || [x.record.body,...(Array.isArray(x.record.categories)?x.record.categories:[])]
        .some(value=>typeof value==='string'&&value.normalize('NFKC').toLocaleLowerCase().includes(needle))));
    selected.sort((a,b)=>b.day.localeCompare(a.day)||
      String(b.record.createdAt||'').localeCompare(String(a.record.createdAt||''))||
      String(a.record.id||'').localeCompare(String(b.record.id||'')));
    const groups=[];
    for(const entry of selected){
      const month=entry.day.slice(0,7);
      if(groups.at(-1)?.month!==month)groups.push({month,items:[]});
      groups.at(-1).items.push(entry.record);
    }
    return {years,selection,months,monthSelection,groups,total:dated.length,visible:selected.length};
  }
  // Contextual capture must never silently retarget an existing recovery draft.
  // This is a decision only: actual parking is performed by the local repository
  // in an atomic IndexedDB transaction after the user explicitly requests it.
  function captureIntentNotice(draft,request){
    if(!draft || !request || !['note','quote','task','reminder','event','journal'].includes(request.type))return null;
    if(!['work','personal'].includes(draft.workspace)||typeof draft.body!=='string'||
       !['note','quote','task','reminder','event','journal'].includes(draft.type))return null;
    return {existingType:draft.type,requestedType:request.type,
      category:typeof request.category==='string'?request.category:'',date:validDate(request.occurredOn)?request.occurredOn:null};
  }
  return {validDate,validClock,dayContext,occurrenceOn,listEvents,dueReminders,taskBuckets,quickDueDate,foregroundReminders,dayBrief,normalizeQuickActions,toggleQuickAction,restoreReview,manageSpace,uniqueName,journalTimeline,captureIntentNotice};
});
