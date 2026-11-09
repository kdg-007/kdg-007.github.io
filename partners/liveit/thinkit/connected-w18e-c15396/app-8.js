/* LiveIt v0.6 W3: encrypted local backups, validated atomic restore, and privacy-safe recovery. KEEPIT/TRAVELIT DISCONNECTED. */
(function () {
  'use strict';
  const C = window.LiveItCore;
  const D = window.LiveItDailyDomain;
  const W12 = window.LiveItW12;
  let todayDate = D.formatISODate();
  const localMinute=()=>{const at=new Date();return String(at.getHours()).padStart(2,'0')+':'+String(at.getMinutes()).padStart(2,'0');};
  let lastForegroundMinute=localMinute();
  const $ = s => document.querySelector(s);
  const esc = C.esc;
  const app = $('#app');
  const composer = $('#captureDialog');
  const details = $('#recordDialog');
  let failLocal = false;
  let toastTimer;
  let captureReturnFocus=null, detailReturnFocus=null;
  let externalChangeDetected=false;
  let captureConflictMode=false, conflictRecoveryId=null, conflictCopySaved=false;
  let captureIntent=null, freshCaptureInProgress=false;
  const isEditableTarget=el=>!!el?.closest?.('input,textarea,select,[contenteditable="true"]');
  function restoreFocusAfterDialog(el){
    // Native <dialog> already traps focus. Restore the invoking control only
    // when no other dialog has taken over; otherwise leave focus inside it.
    setTimeout(()=>{
      if(composer.open||details.open||$('#backupPasswordDialog')?.open)return;
      const visible=node=>!!node?.isConnected && node.getClientRects?.().length>0 && !node.closest?.('[hidden]');
      const fallback=[...app.querySelectorAll('[data-action="capture"], [data-action="scope"]')].find(visible);
      const destination=visible(el)?el:fallback;
      destination?.focus?.();
    },0);
  }
  // D1 source remains unchanged. LiveIt W1 is local-only and requires IndexedDB to save.
  let data=D.emptyData(C);
  let calendarSyncState={phase:'offline',message:'Events saved on this device · waiting for OneDrive'};
  let projections=[]; // Trusted adapter absent: read-only projections; no writer exposed in W2.
  let storageIssue='Opening local IndexedDB…';
  let storageReady=false;
  let repository=null;
  let integrationGate=null;
  const cachedDrafts={work:null,personal:null};
  const parkedDrafts={work:[],personal:[]};
  let draftQueue=Promise.resolve();
  let saveInProgress=false;
  let workspaceSwitchPending=false;
  let mutationQueue=Promise.resolve();
  // A task only changes visually after its IndexedDB transaction succeeds.
  const pendingTaskMutations=new Set();
  const VISUAL_PREF_KEY='liveit_visual_prefs_v051';
  const BACKUP_VERIFIED_KEY='liveit_alpha_backup_verified_v1';
  let verifiedBackup=null;
  let persistentStorage='checking';
  let currentDatabaseEpoch=null;
  try {const v=JSON.parse(localStorage.getItem(BACKUP_VERIFIED_KEY)||'null');
    if(v && typeof v.verifiedAt==='string' && Number.isSafeInteger(v.revision))verifiedBackup=v;
  }catch{}
  let visualPrefs={theme:'dark',density:'calm'};
  let storedQuickActions=null;
  try {const saved=JSON.parse(localStorage.getItem(VISUAL_PREF_KEY)||'null');
    if(saved && ['light','dark'].includes(saved.theme))visualPrefs.theme=saved.theme;
    if(saved && ['calm','compact'].includes(saved.density))visualPrefs.density=saved.density;
    if(saved && saved.quickActions)storedQuickActions=saved.quickActions;
  } catch {}
  visualPrefs.quickActions=W12.normalizeQuickActions(storedQuickActions);
  // UI-only, per-device preferences. Neither notes nor Work/Personal records move.
  const LAYOUT_PREF_KEY='liveit_layout_prefs_v1';
  let layoutPrefs={leftMode:'expanded',rightMode:'hidden',focus:false};
  try {
    const stored=JSON.parse(localStorage.getItem(LAYOUT_PREF_KEY)||'null');
    if(stored&&typeof stored==='object'&&!Array.isArray(stored)){
      if(['expanded','rail','hidden'].includes(stored.leftMode))layoutPrefs.leftMode=stored.leftMode;
      if(['visible','hidden'].includes(stored.rightMode))layoutPrefs.rightMode=stored.rightMode;
      if(typeof stored.focus==='boolean')layoutPrefs.focus=stored.focus;
    }
  }catch{ /* An invalid UI preference must never prevent opening daily records. */ }
  function persistLayout(){
    try{localStorage.setItem(LAYOUT_PREF_KEY,JSON.stringify({leftMode:ui.leftMode,rightMode:ui.rightMode,focus:ui.focus}));}catch{}
  }
  const APP_LINKS=Object.freeze([
    Object.freeze({id:'keepit',name:'KeepIt',description:'Notes and documents',url:'/partners/connected/?connected-app=keepit'}),
    Object.freeze({id:'thinkit',name:'ThinkIt',description:'Diagrams and ideas',url:'/partners/connected/?connected-app=thinkit'}),
    Object.freeze({id:'travelit',name:'TravelIt',description:'Trips and itineraries',url:'/partners/connected/?connected-app=travelit'})
  ]);
  const ui = {quickActionsCustomize:false,mobileSearchOpen:false, scope:'work', view:'today', selected:todayDate, calendarMode:'month', query:'', category:'', range:7, journalYear:'all', journalMonth:'all', journalQuery:'', taskKind:'all',taskStream:'all', mobileMore:false, capture:null, detail:null, pendingScope:null, editing:null, recovered:false, captureDetailsOpen:false, ...visualPrefs,...layoutPrefs,appsOpen:false,mobileRightOpen:false};
  function applyAppearance(){
    document.documentElement.dataset.theme=ui.theme;
    document.documentElement.dataset.density=ui.density;
    document.documentElement.dataset.workspace=ui.scope;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',ui.scope==='personal'?(ui.theme==='dark'?'#1b2031':'#f7f7fc'):(ui.theme==='dark'?'#142331':'#f6f8f6'));
    try{localStorage.setItem(VISUAL_PREF_KEY,JSON.stringify({theme:ui.theme,density:ui.density,quickActions:ui.quickActions}));}catch{}
  }
  applyAppearance();
  const scopes = {work:'Work',personal:'Personal'};
  const scopeLabels={work:'▣ WORK · OFFICE',personal:'⌂ PERSONAL · HOME'};
  const icons = {note:'✎',quote:'❞',task:'□',reminder:'◷',event:'▣',journal:'✧'};
  const spaceIcons = {Architecture:'⌂',Meetings:'☷',Planning:'◫',Finance:'◈',Family:'♡',Travel:'✈',Music:'♫',Philosophy:'◉',Investments:'↗'};
  async function saveStore(next, {clearDraftWorkspace=null,clearDraftOpId=null,workspaceTransfer=null,calendarImport=false,skipUnchanged=false}={}) {
    if (failLocal) throw new Error('Simulated storage failure');
    if (!storageReady || !repository) throw new Error('Local database unavailable. Nothing has been saved.');
    if(externalChangeDetected || captureConflictMode) throw new Error('Another LiveIt window changed the library. Reload latest library before changing records.');
    // Any in-flight keystroke draft must settle before atomic record commit + draft deletion.
    await draftQueue;
    await repository.save(next,data,{clearDraftWorkspace,clearDraftOpId,workspaceTransfer,calendarImport});
    data=next;
    markBackupStale();
    if (clearDraftWorkspace){cachedDrafts[clearDraftWorkspace]=null;try{parkedDrafts[clearDraftWorkspace]=await repository.listParkedDrafts(clearDraftWorkspace);}catch{ /* commit succeeded; do not report a false save failure */ }}
    storageIssue='';externalChangeDetected=false;if(!calendarImport&&next.records.some(r=>r._calendarSync?.pending)){calendarSyncState={phase:'pending',message:'Events saved on this device · waiting to sync'};paintCalendarStatus();}if(!calendarImport)window.dispatchEvent(new Event('liveit-calendar-change'));
  }
  async function reloadLatestLibrary(){
    if(!storageReady||!repository){notify('Local database is unavailable; no reload was attempted.');return false;}
    if(composer.open||details.open||ui.capture){
      notify('Keep the editor open until the draft is preserved. Close it before reloading the library.');return false;
    }
    try{
      await draftQueue;await mutationQueue;
      const latest=await repository.loadConsistentSnapshot();
      // W15: a reload still never authorizes or displays untrusted TravelIt staging.
      data=latest.data;projections=[];
      for(const scope of ['work','personal']){
        cachedDrafts[scope]=latest.drafts[scope];parkedDrafts[scope]=latest.parked[scope];
      }
      currentDatabaseEpoch=latest.dbEpoch;
      // A consistent snapshot can become outdated while another tab writes.
      // Never promise the user that a superseded read was the latest library.
      const persisted=await repository.getDatabaseIdentity();
      const newer=persisted.revision!==latest.revision || persisted.initializedAt!==latest.dbEpoch;
      externalChangeDetected=newer;
      storageIssue=newer?'Another LiveIt window saved during reload. This is a consistent older snapshot; reload again before editing.':'';
      markBackupStale();render();
      notify(newer?'Another window saved during reload. No records were mixed; reload again to see its changes.':'Latest on-device library loaded. Verify any unfinished draft before editing.');
      return true;
    }catch(err){storageIssue='Reload failed: '+err.message+'. Current view has been preserved.';
      notify(storageIssue);return false;}
  }
  function enqueueMutation(change,{clearDraftWorkspace=null,clearDraftOpId=null,workspaceTransfer=null,calendarImport=false,skipUnchanged=false}={}) {
    const pending=mutationQueue.then(async()=>{
      const latest=JSON.parse(JSON.stringify(data));
      change(latest);
      if(skipUnchanged&&JSON.stringify(latest)===JSON.stringify(data))return false;
      await saveStore(latest,{clearDraftWorkspace,clearDraftOpId,workspaceTransfer,calendarImport});
      return true;
    });
    mutationQueue=pending.catch(()=>{}); // a rejected mutation must not block later work
    return pending;
  }
  function persistDraft() {
    if (!ui.capture) return Promise.resolve(true);
    const snapshot=JSON.parse(JSON.stringify(ui.capture));
    if (!storageReady || !repository){storageIssue='Local storage unavailable. Keep the editor open or copy your text.';return Promise.resolve(false);}
    const attempt=draftQueue.then(async()=>{
      if(failLocal)throw new Error('Simulated draft failure');
      try{
        if(captureConflictMode || externalChangeDetected)throw new Error('Data changed in another LiveIt window; save conflict copy instead');
        await repository.putDraft(snapshot.workspace,snapshot);
        try{parkedDrafts[snapshot.workspace]=await repository.listParkedDrafts(snapshot.workspace);}catch{ /* draft itself was saved */ }
        cachedDrafts[snapshot.workspace]=snapshot;
        markBackupStale();
        return true;
      }catch(error){
        if(!captureConflictMode && !/Data changed in another LiveIt window/i.test(String(error?.message||'')))throw error;
        captureConflictMode=true;externalChangeDetected=true;
        if(!conflictRecoveryId)throw new Error('Missing recovery identity');
        await repository.parkConflictCopy(snapshot.workspace,snapshot,currentDatabaseEpoch,conflictRecoveryId);
        conflictCopySaved=true;
        // The active draft belongs to the newer window. Only the parked copy
        // is touched here; do not replace the current draft from this stale view.
        parkedDrafts[snapshot.workspace]=await repository.listParkedDrafts(snapshot.workspace);
        storageIssue='Another window changed the library. A separate recovery copy of this edit is saved on this device. Close the editor to reload before editing other records.';
        const status=$('#captureContent .status-line');if(status){status.textContent='⚠ '+storageIssue;status.setAttribute('role','status');}
        markBackupStale();
        return true;
      }
    }).catch(error=>{conflictCopySaved=false;storageIssue='Latest draft not saved ('+String(error?.message||'storage error')+'). Keep this editor open or copy your text.';const status=$('#captureContent .status-line');if(status){status.textContent='⚠ '+storageIssue;status.setAttribute('role','alert');}return false;});
    draftQueue=attempt.then(()=>undefined);
    return attempt;
  }
  function readDraft(scope){const d=cachedDrafts[scope];return d&&d.workspace===scope&&typeof d.body==='string'?d:null;}
  function notify(message) { const t = $('#toast'); t.textContent = message; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3600); }
  function dateShort(date) { return new Intl.DateTimeFormat('en',{month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z')); }
  function dateIs(iso, same) { return iso === same; }
  function monthGrid(iso) {
    const first = iso.slice(0,7)+'-01';
    const startOffset = (new Date(first+'T12:00:00Z').getUTCDay()+6)%7;
    const start = C.dayAdd(first,-startOffset);
    return Array.from({length:42}, (_,i)=>C.dayAdd(start,i));
  }
  function weekStart(iso) { return C.dayAdd(iso,-((new Date(iso+'T12:00:00Z').getUTCDay()+6)%7)); }
  function records(opts={}) { return C.scoped(data,ui.scope,{category:ui.category || undefined,query:ui.query || undefined,...opts}); }
  function allScoped(opts={}) { return C.scoped(data,ui.scope,opts); }
  // W18E: Work task streams use existing record categories, not a new IndexedDB schema.
  // Older tasks without either marker are always recoverable in Unassigned.
  const TASK_STREAMS=Object.freeze(['Projects','Operations']);
  function workTaskStream(record){
    const tags=Array.isArray(record?.categories)?record.categories:[];
    return tags.includes('Projects')?'projects':tags.includes('Operations')?'operations':'unassigned';
  }
  function applyTaskStream(cap,choice){
    if(!cap||!['task','reminder'].includes(cap.type)||(cap.targetWorkspace||cap.workspace)!=='work')return;
    const next=choice==='projects'?'Projects':choice==='operations'?'Operations':null;
    cap.categories=[...(cap.categories||[]).filter(c=>!TASK_STREAMS.includes(c)),...(next?[next]:[])];
  }
  function taskList() { return allScoped().filter(x=>x.type==='task'||x.type==='reminder'); }
  function taskSaving(rec){return pendingTaskMutations.has(rec.workspace+':'+rec.id);}
  function eventsOn(iso) { return [...[...W12.listEvents(data.records,iso,'work'),...W12.listEvents(data.records,iso,'personal')], ...D.listForDay(projections,iso,ui.scope)]; }
  function activityOn(iso) { return allScoped().filter(x=>['note','quote','journal'].includes(x.type) && (x.type==='journal' ? (x.occurredOn || x.date) : x.date)===iso); }
  function dayCount(iso) { return eventsOn(iso).length + activityOn(iso).length + taskList().filter(x=>x.dueDate===iso).length; }
  function tag(name){return `<span class="category-label">${esc(name)}</span>`;}
  function spaceTile(name) {
    return `<div class="space-tile ${ui.category===name?'selected':''}">
      <button type="button" class="space-capture" data-action="capture" data-category="${esc(name)}" aria-label="Capture into ${esc(name)}" title="Capture here">+</button>
      <button type="button" class="text-link" data-action="space" data-category="${esc(name)}" style="display:flex;flex-direction:column;align-items:flex-start;gap:6px;min-height:53px;text-align:left" aria-label="Open ${esc(name)} space"><span class="space-icon">${esc(spaceIcons[name]||'◇')}</span><span class="space-text">${esc(name)}</span></button><button type="button" class="text-link" data-action="manage-space" data-category="${esc(name)}" aria-label="Manage ${esc(name)} space" style="font-size:10px;margin-top:4px">Manage</button>
    </div>`;
  }
  function miniCalendar() {
    const days = monthGrid(ui.selected);
    const month = new Intl.DateTimeFormat('en',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(ui.selected.slice(0,7)+'-01T12:00:00Z'));
    return `<div class="mini-toolbar"><span class="mini-month">${esc(month)}</span><div><button class="tiny-button" data-action="month" data-offset="-1" aria-label="Previous month">‹</button> <button class="tiny-button" data-action="month" data-offset="1" aria-label="Next month">›</button></div></div>
    <div class="mini-grid">${['M','T','W','T','F','S','S'].map((s,i)=>`<span class="mini-weekday" aria-label="Weekday ${i+1}">${s}</span>`).join('')}
    ${days.map(d=>`<button type="button" class="mini-day ${d===ui.selected?'today':''} ${dayCount(d)?'has-records':''} ${d.slice(0,7)===ui.selected.slice(0,7)?'':'other-month'}" data-action="pick-day" data-date="${d}" aria-label="Show ${esc(C.dateLabel(d))}">${Number(d.slice(8))}</button>`).join('')}</div>`;
  }
  function sidebar() {
    const unfinished=taskList().filter(x=>!x.complete).sort((a,b)=>(a.dueDate||a.date).localeCompare(b.dueDate||b.date)).slice(0,5);
    const spaces=data.spaces[ui.scope]||[];
    return `<aside class="sidebar ${ui.mobileMore?'mobile-open':''}" id="sidebar" aria-label="Day navigation and spaces">
      <nav class="liveit-icon-rail" aria-label="Compact day navigation">
        ${[['today','⌂','Today'],['calendar','▦','Calendar'],['tasks','☑','Tasks'],['inbox','▤','Inbox'],['journal','✧','Journal']].map(([view,glyph,label])=>`<button type="button" data-action="rail-nav" data-view="${view}" aria-label="${label}" title="${label}" ${ui.view===view?'aria-current="page"':''}>${glyph}</button>`).join('')}
      </nav>
      <div class="mobile-panel-controls" aria-label="Workspace display">
        <button type="button" class="button ghost" data-action="right-mobile" aria-label="Open Look Ahead and memories">▤ Look Ahead</button>
        <button type="button" class="button ghost" data-action="focus" aria-pressed="${ui.focus}">${ui.focus?'Exit Focus mode':'Focus mode'}</button>
      </div>
      <section class="sidebar-section"><div class="section-label">Calendar navigator</div>${miniCalendar()}</section>
      <section class="sidebar-section" aria-label="Recoverable drafts"><div class="row-between"><h2 class="section-label">Unfinished drafts</h2><span class="caption">${(readDraft(ui.scope)?1:0)+parkedDrafts[ui.scope].length}</span></div>
      ${readDraft(ui.scope)?`<button type="button" class="text-link" data-action="capture" style="display:block;margin:8px 0">Resume current ${readDraft(ui.scope).editingId?'edit':'draft'}</button>`:''}
      ${parkedDrafts[ui.scope].map(d=>`<button type="button" class="text-link" data-action="recover-parked" data-draft-id="${esc(d.id)}" style="display:block;text-align:left;margin:9px 0" title="Recover prior unfinished draft">↩ ${esc((d.content?.body||'Untitled').slice(0,55))}</button>`).join('')}
      ${!readDraft(ui.scope)&&!parkedDrafts[ui.scope].length?'<p class="muted small">No unfinished drafts.</p>':''}</section>
      <section class="sidebar-section"><h2 class="section-label">Navigation</h2>
      <button type="button" class="text-link" data-action="nav" data-view="tasks" style="display:block;margin:10px 0">Tasks</button>
      <button type="button" class="text-link" data-action="nav" data-view="archive" style="display:block;margin:10px 0">Archive (${allScoped({includeArchived:true}).filter(x=>x.archived).length})</button>
    </section>
    <section class="sidebar-section focus-task-section"><h2 class="section-label">Focus tasks</h2>
      <div class="focus-task-list">${unfinished.length ? unfinished.map(x=>`<label class="tiny-task"><input type="checkbox" data-action="task-toggle" data-id="${esc(x.id)}" ${x.complete?'checked':''} ${taskSaving(x)?'disabled aria-busy="true"':''}/><span><span class="task-label">${esc(x.body)}</span>${x.dueDate && x.dueDate < todayDate?`<br><span class="overdue-text">Overdue · ${esc(dateShort(x.dueDate))}</span>`:''}${taskSaving(x)?'<span class="task-save-status" role="status">Saving…</span>':''}</span></label>`).join(''):'<p class="muted small">Nothing unfinished in this workspace.</p>'}</div></section>
      <section class="sidebar-section"><div class="row-between"><h2 class="section-label">Quick Spaces</h2><button type="button" data-action="new-space" class="text-link">+ New</button></div>
      <div class="space-grid">${spaces.map(spaceTile).join('')}<button type="button" class="space-tile space-add" data-action="new-space"><span class="space-icon">+</span><span class="space-text">New Space</span></button></div>
      ${ui.category?`<button class="button subtle" style="margin-top:10px;width:100%" data-action="clear-space">Clear “${esc(ui.category)}” filter</button>`:''}</section>
      <div class="mobile-backup-tools">${backupProtectionPanel()}<section class="right-section" aria-label="Application connections"><h2 class="section-label">App connections</h2><div class="notice"><strong>KeepIt · Separate note owner</strong><p>Short entries stay on this device. Native-note access requires an authorized KeepIt host; standalone LiveIt cannot verify OneDrive saves.</p><strong>TravelIt · Not connected</strong><p>Trip calendar synchronization is unavailable.</p></div></section></div>
      <div class="workspace-note">${ui.scope==='work'?'WORK workspace: only Work records are visible. Your data remains on this device; no employer account or cloud connection.':'PERSONAL workspace: private entries only. No travel, contacts, or cloud account is connected yet.'}</div>
      <p class="caption" style="margin-top:20px">Local controls · <button type="button" data-action="export" class="text-link">Encrypted backup</button> · <button type="button" data-action="restore" class="text-link">Restore backup</button> · <button type="button" data-action="reset" class="text-link">Erase local records</button></p>
    </aside>`;
  }
  function feedCard(x, description='') {
    const isTask=x.type==='task'||x.type==='reminder';
    const dueState=isTask?(W12.validDate(x.dueDate)?'scheduled':x.dueDate?'invalid':'undated'):null;
    const label=x.source==='travelit'?'TravelIt · read-only':x.type==='event'?'Planned event':x.type==='journal'?'Recorded activity':x.type==='task'?(dueState==='scheduled'?'Due task':'Task'):x.type==='reminder'?'Reminder':'Captured '+x.type;
    const metaDate=x.type==='journal'?x.occurredOn||x.date:isTask&&dueState==='scheduled'?x.dueDate:x.date;
    const displayMeta=isTask&&dueState!=='scheduled'?(dueState==='invalid'?'Due date needs review':'No due date'):dateShort(metaDate);
    const displayClock=x.allDay?'':x.type==='reminder'&&dueState==='scheduled'?(x.remindAt||''):x.type==='task'?'':x.time;
    return `<article class="feed-card" data-record-id="${esc(x.id)}">
       <div class="feed-symbol ${esc(x.type)}" aria-hidden="true">${icons[x.type]||'✎'}</div>
       <div class="feed-main"><div class="feed-meta"><span class="type-tag">${esc(label)}</span><span>${x.source==='travelit'&&x.allDay?esc(dateShort(x.origin.startDate))+' – '+esc(dateShort(C.dayAdd(x.origin.endDateExclusive,-1))):esc(displayMeta)}${displayClock?' · '+esc(displayClock):''}${x.endDate&&x.endDate!==x.date?' – '+esc(dateShort(x.endDate)):''}${x.endTime&&!x.allDay?' → '+esc(x.endTime):''}${x.allDay?' · All day':''}${x.type==='event'?' · '+esc(scopes[x.workspace]):''}${x.repeat==='yearly'?' · Repeats yearly':''}${x.source==='travelit'?' · '+esc(x.timezone):''}</span>${x.complete?'<span class="type-tag inbox-tag">Completed</span>':''}${x.archived?'<span class="type-tag">Archived · restore from details</span>':''}</div>
       <button type="button" class="text-link feed-title ${x.type==='quote'?'italic':''}" data-action="${x.source==='travelit'?'travel-detail':'detail'}" data-id="${esc(x.id)}" style="text-align:left;display:block">${esc(x.body)}</button>
       ${x.categories.map(tag).join('')}${description?`<div class="feed-desc">${esc(description)}</div>`:''}</div>
       ${isTask?`<label class="feed-actions"><input type="checkbox" data-action="task-toggle" data-id="${esc(x.id)}" ${x.complete?'checked':''} ${taskSaving(x)?'disabled aria-busy="true"':''} aria-label="${taskSaving(x)?'Saving task change for':x.complete?'Mark incomplete':'Complete'} ${esc(x.body)}"/>${taskSaving(x)?'<span class="task-save-status" role="status">Saving…</span>':''}</label>`:''}
     </article>`;
  }
  function foregroundReminderPanel(clock=localMinute()){
    if(ui.view!=='today'||ui.selected!==todayDate)return '';
    const attention=W12.foregroundReminders(allScoped(),ui.scope,todayDate,clock);
    if(!attention.dueNow.length)return '';
    const why={overdue:'Past due', 'date-only':'Due today · no time set', 'time-reached':'Reference time reached'};
    return `<section class="foreground-reminders panel" aria-label="Reminders requiring attention"><div class="row-between"><h2 class="section-heading">Reminders to review <span class="type-count">${attention.dueNow.length}</span></h2><button type="button" class="text-link" data-action="nav" data-view="tasks">All reminders</button></div>
      <p class="muted small">Visible only while LiveIt is open. Device notifications and background alarms are not enabled; times use this device’s local clock.</p>
      ${attention.dueNow.slice(0,4).map(({record,reason})=>feedCard(record,why[reason]||'Reminder')).join('')}
      ${attention.dueNow.length>4?`<p class="muted small">${attention.dueNow.length-4} more reminders in Tasks.</p>`:''}
      ${attention.laterToday.length?`<p class="muted small">${attention.laterToday.length} timed reminder${attention.laterToday.length===1?'':'s'} later today.</p>`:''}</section>`;
  }
  function empty(title, desc) { return `<div class="empty"><h3>${esc(title)}</h3><p>${esc(desc)}</p><button class="button secondary" data-action="capture">+ Capture an idea</button></div>`; }
  function summary() {
    const pending=taskList().filter(x=>!x.complete);
    const due=pending.filter(x=>x.dueDate===ui.selected).length;
    const overdue=pending.filter(x=>x.dueDate && x.dueDate<ui.selected).length;
    const context=W12.dayContext(ui.selected,todayDate);
    return `<div class="summary-strip"><div class="summary-tile"><div class="summary-count">${eventsOn(ui.selected).length}</div><div class="summary-lab">Planned appointments</div></div><div class="summary-tile"><div class="summary-count">${due}</div><div class="summary-lab">${esc(context.dueLabel)} · tasks & reminders</div></div><div class="summary-tile"><div class="summary-count">${overdue}</div><div class="summary-lab">${esc(context.overdueLabel)} · tasks & reminders</div></div></div>`;
  }
  // W17T: offline, scope-limited entry digest. Recorded means saved in
  // LiveIt; planned does not mean attended and completion has no historic date.
  function dayBriefPanel(){
    const brief=W12.dayBrief(allScoped(),ui.scope,ui.selected);
    const total=brief.planned+brief.recorded+brief.due;
    const plural=(count,single)=>count+' '+single+(count===1?'':'s');
    const narrative=total?
      [plural(brief.planned,'planned appointment'),plural(brief.recorded,'recorded or captured moment'),
       plural(brief.due,'commitment due')].join(' · '):
      'No LiveIt entries saved for this date yet.';
    const highlights=brief.highlights.map(item=>`<button type="button" class="day-brief-highlight" data-action="detail" data-id="${esc(item.id)}" aria-label="Open ${esc(item.type)} entry: ${esc(item.preview)}">${esc(item.preview)}</button>`).join('');
    return `<section class="day-brief panel" aria-label="Day in brief">
      <div class="row-between"><h2 class="section-heading">Day in brief</h2><span class="muted small">Offline · ${esc(scopes[ui.scope])} only</span></div>
      <p class="day-brief-line">${esc(narrative)}</p>
      ${brief.due?`<p class="muted small">${brief.openNow} of ${brief.due} due commitment${brief.due===1?'':'s'} currently marked open.</p>`:''}
      ${highlights?`<div class="day-brief-highlights" aria-label="Recent recorded highlights"><span class="muted small">Recorded highlights</span>${highlights}</div>`:''}
      <p class="muted small day-brief-caution">Based only on saved entries. Planned appointments are not evidence of attendance, and current task status does not establish a historical completion date.</p>
    </section>`;
  }
  // W18A: one-tap route to the existing safe capture editor. A previously
  // saved unfinished draft is recovered, not overwritten by a shortcut.
  function quickActionPanel(){
    const types=['note','task','reminder','event','journal'];
    const labels={note:'Note',task:'Task',reminder:'Reminder',event:'Event',journal:'Journal'};
    const captions={note:'Capture a thought',task:'Add an undated task',
      reminder:'Due on this day',event:'Plan for this day',journal:'Record this day'};
    const glyphs={note:'✎',task:'□',reminder:'◷',event:'▣',journal:'✧'};
    const selected=ui.quickActions[ui.scope];
    return `<section class="quick-actions-panel panel" aria-label="Quick actions for ${esc(scopes[ui.scope])}">
      <div class="row-between quick-actions-heading">
        <div><h2 class="section-heading">Quick actions</h2><p class="muted small">One tap to start an entry in ${esc(scopes[ui.scope])}.</p></div>
        <button type="button" class="text-link quick-actions-customize" data-action="shortcut-customize" aria-expanded="${ui.quickActionsCustomize}" aria-controls="quickActionsCustomize">${ui.quickActionsCustomize?'Done':'Customize'}</button>
      </div>
      <div class="quick-actions-grid" role="group" aria-label="Start a saved local entry">
        ${selected.map(type=>`<button type="button" class="quick-action-tile" data-action="capture" data-type="${type}" data-shortcut="${type}" ${type==='journal'?`data-occurred-on="${esc(ui.selected)}"`:''} aria-label="New ${labels[type]} in ${esc(scopes[ui.scope])}">
          <span class="quick-action-glyph" aria-hidden="true">${glyphs[type]}</span>
          <span class="quick-action-copy"><strong>${labels[type]}</strong><small>${captions[type]}</small></span>
        </button>`).join('')}
      </div>
      ${ui.quickActionsCustomize?`<div class="quick-actions-settings" id="quickActionsCustomize" role="group" aria-label="Customize visible shortcuts in ${esc(scopes[ui.scope])}">
        <p class="muted small">Choose 1–4 shortcuts. Settings are stored only in this browser, independently for Work and Personal; they are not part of an encrypted backup.</p>
        <div class="quick-actions-picks">${types.map(type=>`<button type="button" class="quick-action-pick" data-action="shortcut-toggle" data-shortcut-type="${type}" aria-pressed="${selected.includes(type)}" ${selected.length===4&&!selected.includes(type)||selected.length===1&&selected.includes(type)?'disabled':''}>${selected.includes(type)?'✓ ':''}${labels[type]}</button>`).join('')}</div>
      </div>`:''}
      ${ui.selected!==todayDate?`<p class="muted small quick-actions-date-note">For ${esc(C.dateLabel(ui.selected))}: reminders, events and journal moments use this selected date; notes use today and tasks remain undated unless a due date is set.</p>`:''}
    </section>`;
  }
  function today() {
    const planned=eventsOn(ui.selected);
    const actual=activityOn(ui.selected);
    const dues=taskList().filter(x=>x.dueDate===ui.selected);
    const upcoming=[...planned,...dues].sort((a,b)=>(a.time||'').localeCompare(b.time||''));
    const captured=[...actual].sort((a,b)=>(a.time||'').localeCompare(b.time||''));
    return `<div id="foregroundReminderSlot" aria-live="polite">${foregroundReminderPanel()}</div>${summary()}${dayBriefPanel()}
      <section aria-label="Scheduled and due"><div class="timeline-head"><h2 class="section-heading">Scheduled &amp; due</h2>
      <span class="timeline-sub">Plans are not a record of attendance</span></div>
      ${upcoming.length ? upcoming.map(x=>feedCard(x,x.type==='event'?'Planned appointment':'')).join('') : '<p class="muted small">Nothing scheduled or due on this date.</p>'}</section>
      <section aria-label="Captured and recorded"><div class="timeline-head"><h2 class="section-heading">Captured &amp; recorded</h2><button class="text-link" data-action="capture" data-type="journal" data-occurred-on="${esc(ui.selected)}">Record a moment for this day</button></div>
      ${captured.length ? captured.map(x=>feedCard(x,x.type==='journal'?'Recorded occurrence':'')).join('') : '<p class="muted small">No moments recorded on this date. Capture a thought without filing it.</p>'}</section>`;
  }
  function calendarCell(iso) {
    const count=dayCount(iso);
    const list=eventsOn(iso).slice(0,2);
    return `<button type="button" data-action="calendar-day" data-date="${iso}" class="calendar-cell ${iso===ui.selected?'selected':''} ${iso.slice(0,7)!==ui.selected.slice(0,7)?'other':''}" aria-label="${esc(C.dateLabel(iso))}, ${count} entries">
      <span class="calendar-daynum">${Number(iso.slice(8))}</span>${list.map(x=>`<span class="calendar-mark">▣ ${esc(x.body.slice(0,23))}</span>`).join('')}${count>list.length?`<span class="calendar-mark">+ ${count-list.length} more</span>`:''}</button>`;
  }
  function calendar() {
    const mode=ui.calendarMode;
    const dates=mode==='week'?Array.from({length:7},(_,i)=>C.dayAdd(weekStart(ui.selected),i)) : monthGrid(ui.selected);
    const tabs=['day','week','month'].map(s=>`<button data-action="calendar-mode" data-mode="${s}" class="${mode===s?'active':''}" aria-pressed="${mode===s}">${s[0].toUpperCase()+s.slice(1)}</button>`).join('');
    return `<div class="row-between" style="flex-wrap:wrap"><div class="calendar-view-controls">${tabs}</div><button class="button secondary" data-action="capture" data-type="event">+ Add event</button></div>
      ${mode==='day'?today():`<div class="${mode==='week'?'calendar-week':'calendar-grid'}" style="margin-top:17px">
      ${mode==='month'?['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day=>`<div class="calendar-wd">${day}</div>`).join(''):''}
      ${dates.map(calendarCell).join('')}</div>
      <h2 class="section-heading">${esc(C.dateLabel(ui.selected))}</h2>${[...eventsOn(ui.selected),...activityOn(ui.selected)].map(x=>feedCard(x)).join('')||'<p class="muted small">No entries on this date.</p>'}`}`;
  }
  function inbox() {
    const results=records({inbox:true}).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    return `<p class="page-sub">Unfiled quick captures remain here even when categorized. There is no obligation to clear your Inbox.</p><div class="filter-line">${ui.category?`<button class="filter-pill active" data-action="clear-space">${esc(ui.category)} ×</button>`:'<span class="muted small">All categories · add a category only when useful</span>'}</div>
      <h2 class="section-heading">Quick captures <span class="type-count">${results.length}</span></h2>${results.length?results.map(x=>feedCard(x)).join(''):empty('Your Inbox is clear','Capture a thought without deciding where it belongs.')}`;
  }
  function journal() {
    const timeline=W12.journalTimeline(records(),ui.scope,ui.journalYear,ui.journalMonth,ui.journalQuery);
    const yearOptions=['all',...timeline.years];
    const monthOptions=['all',...timeline.months];
    const monthName=m=>new Intl.DateTimeFormat('en',{month:'long',timeZone:'UTC'}).format(new Date('2024-'+m+'-01T12:00:00Z'));
    return `<p class="page-sub">A record of what you actually noted or experienced. Planned appointments do not count as completed activities.</p>
    <div class="row-between journal-toolbar"><h2 class="section-heading">Historical timeline <span class="type-count">${timeline.visible}</span></h2>
      <div class="journal-toolbar-actions"><label for="journalYear">Year</label><select class="select-input" id="journalYear" aria-label="Filter journal by year">${yearOptions.map(year=>`<option value="${year}" ${year===timeline.selection?'selected':''}>${year==='all'?'All years':year}</option>`).join('')}</select>
      <label for="journalMonth">Month</label><select class="select-input" id="journalMonth" aria-label="Filter journal by month">${monthOptions.map(month=>`<option value="${month}" ${month===timeline.monthSelection?'selected':''}>${month==='all'?'All months':monthName(month)}</option>`).join('')}</select>
      <button class="button secondary" data-action="capture" data-type="journal">+ Record a moment</button></div></div>
      <div class="journal-search-row"><label for="journalQuery">Find in Journal</label><input type="search" id="journalQuery" maxlength="100" autocomplete="off" aria-label="Find only journal, note and quote entries in current workspace" placeholder="Search journal text or categories" value="${esc(ui.journalQuery)}" />
      ${(ui.journalQuery||ui.journalYear!=='all'||ui.journalMonth!=='all')?'<button type="button" class="button subtle" data-action="journal-clear">Clear filters</button>':''}</div>
      ${timeline.groups.length?timeline.groups.map(group=>`<section class="journal-month" aria-label="${esc(group.month)} journal entries"><h3 class="journal-month-heading">${esc(new Intl.DateTimeFormat('en',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(group.month+'-01T12:00:00Z')))} <span class="type-count">${group.items.length}</span></h3>${group.items.map(x=>`<div class="journal-result">${feedCard(x,x.type==='journal'?'Recorded activity · not inferred from calendar':'')}<button type="button" class="text-link journal-day-link" data-action="journal-day" data-date="${esc(x.type==='journal'?(x.occurredOn||x.date):x.date)}">View this day</button></div>`).join('')}</section>`).join(''):timeline.total?'<p class="muted small" role="status">No entries match these Journal filters. Clear filters to see the full timeline.</p>':empty('No recorded history in this view','Your first quick note starts a useful timeline.')}`;
  }
  function tasks() {
    const scopedTasks=records();
    const workTasks=scopedTasks.filter(x=>['task','reminder'].includes(x.type));
    const activeRows=ui.scope==='work'&&ui.taskStream!=='all'
      ?scopedTasks.filter(x=>!['task','reminder'].includes(x.type)||workTaskStream(x)===ui.taskStream)
      :scopedTasks;
    const groups=W12.taskBuckets(activeRows,ui.scope,todayDate,ui.taskKind);
    const streamCounts={all:workTasks.length,projects:0,operations:0,unassigned:0};
    for(const task of workTasks)streamCounts[workTaskStream(task)]++;
    const streams=[['all','All work'],['projects','Projects'],['operations','Operations'],['unassigned','Unassigned']];
    const open=groups.overdue.length+groups.dueToday.length+groups.upcoming.length+groups.undated.length;
    const kinds=[['all','All'],['task','Tasks'],['reminder','Reminders']];
    const section=(key,title,description)=>groups[key].length?`<section class="task-group" aria-label="${esc(title)}"><div class="task-group-header"><h3 class="section-heading">${esc(title)} <span class="type-count">${groups[key].length}</span></h3>${description?`<p class="muted small">${esc(description)}</p>`:''}</div>${groups[key].map(x=>feedCard(x)).join('')}</section>`:'';
    return `<div class="row-between task-page-head"><h2 class="section-heading">Open tasks & reminders <span class="type-count">${open}</span></h2><button class="button secondary" data-action="capture" data-type="task">+ New task</button></div>
      ${ui.scope==='work'?`<div class="task-stream-controls" role="group" aria-label="Work task streams">
       ${streams.map(([key,label])=>`<button type="button" data-action="task-stream" data-stream="${key}" aria-pressed="${ui.taskStream===key}" class="${ui.taskStream===key?'active':''}">${label} <span class="task-stream-count">${streamCounts[key]}</span></button>`).join('')}
       </div>`:''}
      <div class="task-kind-controls" role="group" aria-label="Filter tasks and reminders">${kinds.map(([key,label])=>`<button type="button" data-action="task-kind" data-kind="${key}" class="${ui.taskKind===key?'active':''}" aria-pressed="${ui.taskKind===key}">${label}</button>`).join('')}</div>
      <p class="muted small task-status-hint">Grouped by due date relative to today. Completion is the current on-device status, not a historical snapshot. Reminders do not trigger device notifications.</p>
      ${section('overdue','Overdue','Open items due before today')}
      ${section('dueToday','Due today','Open items due today')}
      ${section('upcoming','Upcoming','Open items due after today')}
      ${section('undated','No valid due date','Undated tasks, or entries needing a due-date correction')}
      ${open?'':empty('Nothing pending in this filter','Create a task or change the type filter to see other items.')}
      ${section('completed','Completed','Current completion status')}
      ${groups.completed.length?'':'<p class="muted small">No completed items in this filter.</p>'}`;
  }
  function archiveView() {
    const items=allScoped({includeArchived:true}).filter(x=>x.archived)
      .sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
    return `<p class="page-sub">Archived entries are hidden from Today, calendar, tasks, search, and memories until restored. Nothing is deleted.</p>
      <h2 class="section-heading">Archived records <span class="type-count">${items.length}</span></h2>
      ${items.length?items.map(x=>feedCard(x)).join(''):'<p class="muted small">Your archive is empty.</p>'}`;
  }
  function searchResults() {
    const result=(ui.view==='archive'?records({includeArchived:true}).filter(x=>x.archived):records()).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    return `<p class="page-sub">Search is confined to the <strong>${esc(scopes[ui.scope])}</strong> workspace. No hidden workspace results or suggestions.</p><h2 class="section-heading">${result.length} matching records</h2>${result.length?result.map(x=>feedCard(x)).join(''):empty('Nothing matches','Try another word or clear the search field.')}`;
  }
  function primary() {
    const views={today:'Today',calendar:'Calendar',inbox:'Inbox',journal:'Journal',tasks:'Tasks',archive:'Archive'};
    const subtitles={today:'A clear view of what is planned and what actually happened.',calendar:'Navigate dates without treating plans as recorded history.',inbox:'Ideas first, filing later.',journal:'Your life and work, remembered chronologically.',tasks:'Commitments with honest due dates and completion states.',archive:'Recover entries without deleting or recreating them.'};
    const head=ui.query?`<div class="date-kicker">SCOPED SEARCH · ${esc(scopes[ui.scope])}</div><h1 class="page-title">Search results</h1>`:
      `<div class="date-kicker">${esc(scopes[ui.scope])} workspace · shared event calendar</div><h1 class="page-title">${ui.view==='today'?esc(C.dateLabel(ui.selected)):views[ui.view]}</h1>`;
    const nav=ui.view==='today'||ui.view==='calendar'?`<div class="day-nav"><button class="button ghost" data-action="day-step" data-offset="-1" aria-label="Previous ${ui.calendarMode==='month'&&ui.view==='calendar'?'month':'day'}">‹</button><button class="button ghost" data-action="today">Today</button><button class="button ghost" data-action="day-step" data-offset="1" aria-label="Next ${ui.calendarMode==='month'&&ui.view==='calendar'?'month':'day'}">›</button></div>`:'';
    const selectedContext=W12.dayContext(ui.selected,todayDate);
    return `<main class="main-content" id="main-content"><div class="hero"><div>${head}<p class="page-sub">${ui.query?'Only current-workspace matching items are visible.':subtitles[ui.view]}</p></div><div class="hero-actions">${nav}</div></div>
      ${ui.view==='today'&&!ui.query&&!selectedContext.isCurrent?`<div class="selected-day-context" role="status"><span><strong>${esc(selectedContext.viewLabel)}:</strong> dates refer to ${esc(C.dateLabel(ui.selected))}. Task counts reflect which items are open now, not their historical completion state.</span><button type="button" class="text-link" data-action="today">Return to today</button></div>`:''}
      ${ui.view==='today'&&!ui.query?'<button type="button" class="quick-entry" data-action="capture" aria-label="Capture a thought"><span class="quick-entry-icon" aria-hidden="true">✎</span><span class="quick-entry-text">Capture a thought, a task, or a moment…</span><kbd>⌘⇧J</kbd></button>':''}
       ${ui.view==='today'&&!ui.query?quickActionPanel():''}
      ${ui.query?searchResults():({today,calendar,inbox,journal,tasks,archive:archiveView}[ui.view]||today)()}
      ${ui.view==='today'&&!ui.query?compactDailyPanels():''}
      <div class="caption" style="margin-top:24px">LiveIt v0.6 · W17I-E KeepIt private QA candidate · TravelIt calendar disconnected</div>
    </main>`;
  }
  function backupProtectionPanel(){
    const current=repository?.revision||0;
    const isCurrent=!!verifiedBackup && verifiedBackup.revision===current && verifiedBackup.dbEpoch===currentDatabaseEpoch && !verifiedBackup.dirty && !!currentDatabaseEpoch && storageReady;
    const last=verifiedBackup?.verifiedAt ? new Date(verifiedBackup.verifiedAt).toLocaleString() : '';
    const status=isCurrent?'Verified encrypted backup for current revision.':verifiedBackup?'Last verified backup is older or differs from the current library.':'No downloaded encrypted backup has been independently verified.';
    const protection=persistentStorage==='granted'?'Browser reports persistent storage. Backup still required.':
      persistentStorage==='denied'?'Persistent storage not granted; export backups regularly.':
      persistentStorage==='unsupported'?'Storage protection is not supported here.':'Checking browser storage protection…';
    return `<section class="right-section backup-protection" aria-label="Backup and device storage safeguards">
      <h2 class="section-label">Backup & device protection</h2>
      <strong class="${isCurrent?'status-verified':'status-unverified'}">${esc(status)}</strong>
      ${verifiedBackup?`<p>Last file verified: ${esc(last)}. Work and Personal LiveIt data are in the encrypted file; native KeepIt note bodies and assets are not included.</p>`:''}
      <button type="button" class="button secondary" data-action="verify-backup">Verify saved backup file</button>
      <p>${esc(protection)}</p>
      ${persistentStorage!=='granted'?'<button type="button" class="button subtle" data-action="persist-storage">Request storage protection</button>':''}
      <p>Local-only alpha. No cross-device sync. Browser data can still be lost; keep an encrypted backup outside the app.</p>
    </section>`;
  }
  // W17I-C: Look-ahead and memories use the SAME current-workspace data on
  // desktop and mobile. This is a read-only view: no new storage or sync paths.
  function dailyInsights(){
    const futureDays=Array.from({length:ui.range},(_,i)=>C.dayAdd(ui.selected,i+1));
    const futureEvents=[];const seenFuture=new Set();
    for(const day of futureDays)for(const item of eventsOn(day)){
      if(!seenFuture.has(item.id)){seenFuture.add(item.id);futureEvents.push({...item,displayDate:day});}
    }
    const futureTasks=taskList().filter(x=>!x.complete&&x.dueDate>ui.selected&&x.dueDate<=C.dayAdd(ui.selected,ui.range));
    const ahead=[...futureEvents,...futureTasks].sort((a,b)=>(a.displayDate||a.dueDate||a.date).localeCompare(b.displayDate||b.dueDate||b.date)).slice(0,5);
    const recent=allScoped().filter(x=>x.type==='note'||x.type==='quote').sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,3);
    const memories=ui.scope==='personal'?allScoped().filter(x=>['journal','note','quote'].includes(x.type) &&
      (x.occurredOn||x.date).slice(5)===ui.selected.slice(5) && (x.occurredOn||x.date)<ui.selected):[];
    const overdue=taskList().filter(x=>!x.complete&&x.dueDate&&x.dueDate<ui.selected).sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
    return {ahead,recent,memories,overdue};
  }
  function dailyInsightRows(rows){return rows.map(x=>`<div class="small-record"><button type="button" data-action="${x.source==='travelit'?'travel-detail':'detail'}" data-id="${esc(x.id)}">${esc(x.body)}</button><div class="small-sub">${esc(dateShort(x.displayDate||x.dueDate||x.date))} · ${esc(x.source==='travelit'?'TravelIt (read-only)':x.type==='event'?'Planned':x.type==='task'?'Task due':x.type==='reminder'?'Reminder':'Captured')}</div></div>`).join('');}
  function compactDailyPanels(){
    const {ahead,memories,overdue}=dailyInsights();
    const context=W12.dayContext(ui.selected,todayDate);
    return `<div class="mobile-daily-insights" aria-label="Daily look-ahead and memories">
      <section class="panel" aria-label="Look ahead"><div class="row-between"><h2 class="panel-title">${esc(context.aheadLabel)}</h2><div class="range-selector" role="group" aria-label="Look-ahead range">${[7,14,30].map(n=>`<button type="button" data-action="range" data-days="${n}" class="${ui.range===n?'active':''}" aria-pressed="${ui.range===n}">${n}d</button>`).join('')}</div></div>
      ${ahead.length?dailyInsightRows(ahead):'<p class="muted small">Nothing upcoming in this range.</p>'}</section>
      ${overdue.length?`<section class="panel" aria-label="Overdue tasks and reminders"><h2 class="panel-title">${esc(context.overdueLabel)} · ${overdue.length}</h2>${dailyInsightRows(overdue.slice(0,3))}${overdue.length>3?'<button type="button" class="text-link" data-action="nav" data-view="tasks">See all in Tasks</button>':''}</section>`:''}
      <section class="panel" aria-label="On this day"><h2 class="panel-title">On this day</h2>${ui.scope==='work'?'<p class="muted small">Personal memories are hidden in Work.</p>':memories.length?memories.slice(0,5).map(x=>`<div class="small-record"><button type="button" data-action="detail" data-id="${esc(x.id)}">${esc(x.body)}</button><div class="small-sub">${esc(dateShort(x.occurredOn||x.date))} · ${esc((x.occurredOn||x.date).slice(0,4))}</div></div>`).join(''):'<p class="muted small">Older memories appear here when recorded.</p>'}</section>
    </div>`;
  }
  function rightbar() {
    const {ahead:rangeEntries,recent,memories:historic,overdue}=dailyInsights();
    const context=W12.dayContext(ui.selected,todayDate);
    return `<aside class="rightbar" id="liveit-right-panel" aria-label="Look ahead and recent records"><section class="right-section"><h2 class="section-label">${esc(context.aheadLabel)}</h2><div class="range-selector">${[7,14,30].map(n=>`<button data-action="range" data-days="${n}" class="${ui.range===n?'active':''}" aria-pressed="${ui.range===n}">${n} days</button>`).join('')}</div>
      ${rangeEntries.length?dailyInsightRows(rangeEntries):'<p class="muted small">Nothing upcoming in this range.</p>'}</section>
      ${overdue.length?`<section class="right-section" aria-label="Overdue tasks and reminders"><h2 class="section-label">${esc(context.overdueLabel)} · ${overdue.length}</h2>${dailyInsightRows(overdue.slice(0,3))}${overdue.length>3?'<button type="button" class="text-link" data-action="nav" data-view="tasks">See all in Tasks</button>':''}</section>`:''}
      <section class="right-section"><h2 class="section-label">Recent captures</h2>${recent.map(x=>`<div class="small-record"><button data-action="${x.source==='travelit'?'travel-detail':'detail'}" data-id="${esc(x.id)}">${esc(x.body)}</button><div class="small-sub">${esc(x.type)} · ${esc(dateShort(x.date))}</div></div>`).join('')||'<p class="muted small">No captures.</p>'}</section>
      <section class="right-section"><h2 class="section-label">On this day</h2>${ui.scope==='work'?'<div class="notice">Hidden in Work by default to protect personal memories.</div>':historic.length?historic.map(x=>`<div class="small-record"><button data-action="${x.source==='travelit'?'travel-detail':'detail'}" data-id="${esc(x.id)}">${esc(x.body)}</button><div class="small-sub">${esc(dateShort(x.occurredOn||x.date))} · ${esc((x.occurredOn||x.date).slice(0,4))}</div></div>`).join(''):'<div class="notice">Older memories appear here when recorded.</div>'}</section>
      ${backupProtectionPanel()}
      <section class="right-section" aria-label="Application integration status"><h2 class="section-label">App connections</h2>
        <div class="notice" role="status"><strong>KeepIt · Separate note owner</strong><p>Short entries remain on this device. An approved KeepIt host is required for native notes; LiveIt cannot certify OneDrive readback.</p>
        <strong>TravelIt · Not connected</strong><p>Travel schedules will appear here only after an approved connection. No events have been published.</p></div></section>
      <section class="right-section"><h2 class="section-label">Storage transparency</h2><div class="notice"><strong>${storageReady?'Saved locally using IndexedDB (this browser profile).':'Local database unavailable; do not close unsaved notes.'}</strong> Short entries and note links stay in this browser. Native notes use KeepIt through the toolbar above; verify each cloud save there. Events sync through your selected KeepIt library; other short records remain on this device. Browser storage can be cleared or evicted. Export a local backup regularly. ${storageIssue?`<br><strong>${esc(storageIssue)}</strong>`:''}</div></section></aside>`;
  }
  function render() {
    window.dispatchEvent(new Event('liveit-owned-workspace-render'));
    const views=[['today','Today'],['calendar','Calendar'],['inbox','Inbox'],['journal','Journal'],['tasks','Tasks']];
    document.documentElement.dataset.liveitFocus=ui.focus?'true':'false';
    app.innerHTML=`<div class="app-shell"><header class="topbar"><div class="brand"><span class="brand-mark" aria-hidden="true">L</span><div><div class="brand-name">LiveIt</div><div class="brand-sub">a quieter way to keep up</div></div></div>
      <nav class="header-nav" aria-label="Main navigation">${views.map(([key,value])=>`<button class="nav-button ${ui.view===key?'active':''}" data-action="nav" data-view="${key}" ${ui.view===key?'aria-current="page"':''}>${value}</button>`).join('')}</nav><div class="top-spacer"></div>
      <div class="apps-menu-wrap">
        <button type="button" id="liveit-apps-button" class="button subtle apps-trigger" data-action="apps" aria-haspopup="true" aria-expanded="${ui.appsOpen}" aria-controls="liveit-app-switcher" title="Launch another app">▦ <span>Apps</span></button>
        <nav id="liveit-app-switcher" class="apps-popover" aria-label="Launch applications" ${ui.appsOpen?'':'hidden'}>
          ${APP_LINKS.map(link=>`<a class="apps-link" href="${link.url}" target="_blank" rel="noopener noreferrer" data-app="${link.id}"><strong>${link.name}</strong><small>${link.description}</small></a>`).join('')}
        </nav>
      </div>
      <div class="workspace-switch" role="group" aria-label="Workspace">${['work','personal'].map(scope=>`<button class="workspace-button ${ui.scope===scope?'active':''}" data-action="scope" data-scope="${scope}" aria-pressed="${ui.scope===scope}" aria-label="Switch to ${scopes[scope]} workspace">${scope==='work'?'▣ Work':'⌂ Personal'}</button>`).join('')}</div>
      <label class="header-search"><span class="search-glyph" aria-hidden="true">⌕</span><input id="searchField" aria-label="Search current workspace" placeholder="Search records" value="${esc(ui.query)}" autocomplete="off"></label>
      <div class="header-utility">
        <button type="button" class="utility-button panel-toggle panel-toggle-left" data-action="panel-left" aria-label="Left navigation: ${ui.focus?'hidden by Focus mode':ui.leftMode}. Change layout" aria-controls="sidebar" aria-expanded="${!ui.focus&&ui.leftMode!=='hidden'}" title="Cycle left navigation: expanded, icons, hidden">☷</button>
        <button type="button" class="utility-button panel-toggle panel-toggle-right" data-action="panel-right" aria-label="Toggle right Look Ahead panel" aria-controls="liveit-right-panel" aria-expanded="${!ui.focus&&ui.rightMode==='visible'}" title="Toggle Look Ahead">◨</button>
        <button type="button" class="utility-button panel-toggle panel-toggle-focus" data-action="focus" aria-pressed="${ui.focus}" aria-label="${ui.focus?'Exit':'Enter'} Focus mode" title="Toggle Focus mode">⛶</button>
        <button type="button" class="utility-button mobile-search-toggle" data-action="mobile-search" aria-label="Search ${esc(scopes[ui.scope])} records" aria-expanded="${ui.mobileSearchOpen}" title="Search current workspace">⌕</button><button type="button" class="utility-button density-switch" data-action="density" aria-label="Switch dashboard density" aria-pressed="${ui.density==='compact'}" title="Switch between comfortable and compact layout">${ui.density==='compact'?'Compact':'Comfort'}</button>
      <button type="button" class="utility-button theme-toggle" data-action="theme" aria-label="Switch to ${ui.theme==='dark'?'light':'dark'} mode" title="Switch to ${ui.theme==='dark'?'light':'dark'} mode">${ui.theme==='dark'?'☼':'☾'}</button></div>
      <button class="button primary capture-top" data-action="capture">+ Capture</button></header>
      <div class="workspace-context-banner" aria-live="polite"><span class="workspace-context-identity">${scopeLabels[ui.scope]}</span><span class="workspace-context-detail">${ui.scope==='work'?'Work records':'Personal records'} · Calendar shows Work + Personal</span><span class="workspace-context-local" id="calendarSyncStatus" role="status" data-phase="${calendarSyncState.phase}">${storageReady?esc(calendarSyncState.message):'Storage unavailable'}</span></div>
      <div id="calendarSyncConflicts"></div>
      ${externalChangeDetected?`<div class="freshness-banner" role="alert"><strong>Another LiveIt window changed this library.</strong> Your open edits are not automatically merged. Preserve your draft before reloading. <button type="button" class="button secondary" data-action="reload-library">Reload latest library</button></div>`:''}
      ${ui.mobileSearchOpen?`<div class="mobile-search-panel"><label for="mobileSearchField">Search ${esc(scopes[ui.scope])} records</label><input type="search" id="mobileSearchField" autocomplete="off" placeholder="Search current workspace" value="${esc(ui.query)}"/></div>`:''}
      <div class="columns" data-left="${ui.focus?'hidden':ui.leftMode}" data-right="${ui.focus?'hidden':ui.rightMode}" data-focus="${ui.focus}" data-mobile-right="${ui.mobileRightOpen?'open':'closed'}">${sidebar()}${primary()}${rightbar()}</div>
      <button type="button" class="liveit-panel-scrim" data-action="close-panels" data-open="${ui.mobileMore||ui.mobileRightOpen}" aria-label="Close open navigation panel"></button>
      <button type="button" class="mobile-fab" data-action="capture" aria-label="Capture a thought">+</button>
      <nav class="mobile-tabs" aria-label="Mobile navigation">${[['today','⌂','Today'],['calendar','▦','Calendar'],['inbox','▤','Inbox'],['journal','✧','Journal']].map(([key,icon,label])=>`<button class="${ui.view===key&&!ui.mobileMore?'active':''}" data-action="nav" data-view="${key}"><span class="mobile-icon">${icon}</span>${label}</button>`).join('')}<button class="${ui.mobileMore?'active':''}" data-action="more"><span class="mobile-icon">☰</span>More</button></nav></div>`;
    paintCalendarStatus();
  }
  function refreshContent() {
    const m=$('#main-content'); if (m) m.outerHTML=primary();
    const s=$('#sidebar'); if (s) s.outerHTML=sidebar();
    const r=$('.rightbar'); if (r) r.outerHTML=rightbar();
  }
  // W9: no interrupting confirmation dialog. A switch is allowed ONLY AFTER the
  // originating workspace draft has committed to IndexedDB. Never reassign a draft.
  async function changeScope(scope) {
    if (!scopes[scope] || scope===ui.scope || workspaceSwitchPending) return false;
    workspaceSwitchPending=true;
    try {
      const hadDraft=!!ui.capture;
      const from=ui.scope;
      if (hadDraft && !await persistDraft()) {
        notify('Could not preserve the unfinished draft. Still in '+scopes[from]+'; copy your text before leaving.');
        return false;
      }
      performScopeSwitch(scope);
      notify((hadDraft?'Draft saved in '+scopes[from]+'. ':'')+'Now in '+scopes[scope]+'.');
      return true;
    } finally {workspaceSwitchPending=false;}
  }
  function performScopeSwitch(scope) {
    if (details.open) details.close();
    if (composer.open) composer.close();
    ui.capture=null;ui.editing=null;ui.detail=null;ui.pendingScope=null;ui.recovered=false;captureIntent=null;
    ui.captureDetailsOpen=false;ui.quickActionsCustomize=false;ui.scope=scope;ui.taskKind='all';ui.taskStream='all';ui.journalYear='all';ui.journalMonth='all';ui.journalQuery='';ui.query='';ui.category='';ui.mobileMore=false;ui.mobileSearchOpen=false;
    applyAppearance();render();
  }
  function openCapture(category='',type='note',options={}) {
    captureReturnFocus=document.activeElement;
    const existing=readDraft(ui.scope);
    ui.recovered=!!existing && !options.editing;
    ui.editing=options.editing||((existing?.editingId&&!existing?.conflictSourceOpId)?data.records.find(r=>r.id===existing.editingId&&r.workspace===existing.workspace)||{id:existing.editingId}:null);
    captureConflictMode=false;conflictCopySaved=false;conflictRecoveryId=C.uid();
    ui.capture=options.editing ? {...options.editing, workspace:options.editing.workspace, targetWorkspace:options.editing.workspace, body:options.editing.body, categories:[...options.editing.categories], editingId:options.editing.id, opId:C.uid()} :
      existing ? {...existing, editingId:existing.conflictSourceOpId?null:existing.editingId, targetWorkspace:existing.targetWorkspace||existing.workspace, categories:[...(existing.categories||[])]} :
      {body:'',type: type||'note', workspace:ui.scope, targetWorkspace:ui.scope, categories:category?[category]:[],date:options.date||(type==='event'?ui.selected:todayDate), dueDate:type==='reminder'?(options.date||ui.selected):'',remindAt:'',occurredOn:options.occurredOn||'',time:'12:00',repeat:'none',opId:C.uid()};
    // A contextual New Task / Record Moment click must not mutate an
    // unfinished draft that the recovery layer opened instead.
    captureIntent=existing&&!options.editing&&options.explicitIntent ?
      W12.captureIntentNotice(existing,{type,category,occurredOn:options.occurredOn||''}) : null;
    if (!existing && category && !ui.capture.categories.includes(category)) ui.capture.categories.push(category);
    ui.captureDetailsOpen=!!(ui.capture.categories.length||options.editing||ui.capture.editingId||
      ['event','reminder','journal'].includes(ui.capture.type));
    if(!existing&&!options.editing&&ui.scope==='work'&&['task','reminder'].includes(ui.capture.type)
       &&['projects','operations'].includes(ui.taskStream))applyTaskStream(ui.capture,ui.taskStream);
    if (options.related && !existing) ui.capture.related=options.related;
    renderCapture();if (!composer.open) composer.showModal();
    setTimeout(()=>$('#captureBody')?.focus(),0);
  }
  function renderCapture() {
    const cap=ui.capture;if(!cap)return;
    const isTask=cap.type==='task'||cap.type==='reminder';const isEvent=cap.type==='event';const isJournal=cap.type==='journal';
    const types=['note','quote','task','reminder','event','journal'];
    $('#captureContent').innerHTML=`<div class="dialog-body"><div class="dialog-header"><div><div class="date-kicker">${esc(scopeLabels[cap.workspace])} · local draft</div><h2 class="dialog-title" id="captureHeading">${ui.editing?'Edit record':'Quick Capture'}</h2></div><button class="button icon subtle" data-action="capture-close" aria-label="Close and preserve draft">×</button></div>
      ${captureIntent?`<div class="notice" role="status" style="margin-bottom:12px"><strong>Unfinished ${esc(captureIntent.existingType)} recovered.</strong> You requested a new ${esc(captureIntent.requestedType)}${captureIntent.date?' for '+esc(captureIntent.date):''}. This editor is showing your existing draft unchanged. <button type="button" class="button secondary" data-action="capture-fresh">Start new ${esc(captureIntent.requestedType)} (keep draft)</button></div>`:''}
      ${ui.recovered?`<div class="notice" style="margin-bottom:12px"><strong>${cap.conflictSourceOpId?'Recovered conflicting copy':cap.editingId?'Recovered unfinished edit':'Recovered draft'}.</strong> ${cap.conflictSourceOpId?'Another window changed the library. Save creates a SEPARATE record and leaves the newer original unchanged.':cap.editingId?'Saving will update the existing record, not create a new one.':'This text was preserved in its original workspace.'}</div>`:''}
      <label class="field-label" for="captureBody">Start typing</label><textarea class="capture-textarea" id="captureBody" placeholder="A thought, a quote, something to remember…">${esc(cap.body)}</textarea>
      ${isTask&&(cap.targetWorkspace||cap.workspace)==='work'?`<div class="task-stream-field"><label class="field-label" for="captureTaskStream">Work task stream</label><select id="captureTaskStream" class="select-input" aria-label="Classify this Work task"><option value="unassigned" ${workTaskStream(cap)==='unassigned'?'selected':''}>Unassigned</option><option value="projects" ${workTaskStream(cap)==='projects'?'selected':''}>Projects</option><option value="operations" ${workTaskStream(cap)==='operations'?'selected':''}>Operations</option></select></div>`:''}
      <div class="capture-toolrow"><div class="capture-type"><label class="field-label" for="captureType">Capture as</label><select id="captureType" class="select-input">${types.map(t=>`<option value="${t}" ${cap.type===t?'selected':''}>${t[0].toUpperCase()+t.slice(1)}</option>`).join('')}</select></div>
      <button class="button subtle" data-action="capture-more" aria-expanded="${ui.captureDetailsOpen}" aria-controls="captureOptional">${ui.captureDetailsOpen?'− Fewer options':'+ Date, space & settings'}</button></div>
      ${cap.categories.length&&!ui.captureDetailsOpen?`<p class="caption" style="margin-top:8px">Selected: ${cap.categories.map(esc).join(', ')}</p>`:''}
      ${ui.captureDetailsOpen?`<div id="captureOptional" class="capture-optional"><div class="field-group" style="margin-top:0"><label class="field-label" for="captureScope">Save this record in</label><select id="captureScope" class="select-input" aria-label="Choose destination workspace for this record" style="max-width:210px">${["work","personal"].map(s=>`<option value="${s}" ${s===(cap.targetWorkspace||cap.workspace)?"selected":""}>${scopes[s]}</option>`).join("")}</select>${(cap.targetWorkspace||cap.workspace)!==cap.workspace?`<p class="caption" role="status" style="margin-top:8px">On Save, this ${cap.editingId?'record will move':'entry will be created'} in <strong>${esc(scopes[cap.targetWorkspace])}</strong>. The unfinished recovery draft stays available here until saved.</p>`:''}</div><div class="row-fields field-group"><div><label class="field-label" for="captureDate">${isJournal?'Occurred on':isEvent?'Start date':'Date'}</label><input class="date-input" type="date" id="captureDate" value="${esc(isJournal?cap.occurredOn||cap.date:cap.date)}" /></div>
      ${isTask?`<div><label class="field-label" for="captureDue">${cap.type==='reminder'?'Due date (required)':'Due date (optional)'}</label><input class="date-input" type="date" id="captureDue" value="${esc(cap.dueDate||'')}" ${cap.type==='reminder'?'required':''}/><div class="due-quick-actions" role="group" aria-label="Quick due-date choices">${[['today','Today'],['tomorrow','Tomorrow'],['week','In 7 days'],...(cap.type==='task'?[['clear','Clear date']]:[])].map(([choice,label])=>{const expected=W12.quickDueDate(todayDate,choice,cap.type);return `<button type="button" class="due-quick-choice" data-action="due-quick" data-choice="${choice}" aria-pressed="${(cap.dueDate||'')===expected}">${label}</button>`;}).join('')}</div></div>`:'<div></div>'}</div>
      ${(isTask||isEvent)?`<div class="field-group"><label class="field-label" for="captureTime">${isEvent?'Event time':'Reference time (optional; no device alert)'}</label><input class="date-input" type="time" id="captureTime" value="${esc(isEvent?cap.time||'12:00':cap.remindAt||'')}" ${isEvent&&cap.allDay?'disabled':''}/></div>`:''}
      ${isEvent?`<div class="field-group"><label class="field-label" for="captureEndDate">End date</label><input class="date-input" type="date" id="captureEndDate" min="${esc(cap.date)}" value="${esc(cap.endDate||cap.date)}"/><label style="display:flex;align-items:center;gap:10px;margin-top:12px"><input type="checkbox" id="captureAllDay" ${cap.allDay?'checked':''} style="width:20px;height:20px"/> All day</label>${cap.allDay?'':`<label class="field-label" for="captureEndTime">End time (optional)</label><input class="date-input" type="time" id="captureEndTime" value="${esc(cap.endTime||'')}"/>`}<p class="caption">Events appear on every covered date in both Work and Personal calendars.</p></div>`:''}
      ${isEvent?`<div class="field-group"><label class="field-label" for="captureRepeat">Repeat</label><select id="captureRepeat" class="select-input"><option value="none" ${(cap.repeat||'none')==='none'?'selected':''}>Does not repeat</option><option value="yearly" ${cap.repeat==='yearly'?'selected':''}>Every year (birthdays, anniversaries)</option></select><p class="caption">Leap-day events repeat only on February 29 in leap years. No device notifications are scheduled.</p></div>`:''}
      <div class="field-group"><div class="field-label">Quick Spaces (optional)</div><div class="tagbox">${(data.spaces[cap.targetWorkspace||cap.workspace]||[]).map(name=>`<button class="tag-opt ${cap.categories.includes(name)?'active':''}" type="button" data-action="toggle-category" data-category="${esc(name)}" aria-pressed="${cap.categories.includes(name)}">${esc(name)}</button>`).join('')}</div></div>`:''}
      <div class="status-line">${storageIssue?`⚠ ${esc(storageIssue)}`:'Drafts and short entries save on this device. Native-note access requires an authorized KeepIt host.'}</div>
      <div class="dialog-actions"><button class="button subtle" data-action="capture-close">Keep draft &amp; close</button><button class="button primary" data-action="capture-save" id="saveCapture" ${!C.normalize(cap.body)?'disabled':''}>${isEvent?'Save event':'Save on this device'} <span class="small">⌘↵</span></button></div></div>`;
  }
  async function startRequestedCapture() {
    if(freshCaptureInProgress || !captureIntent || !ui.capture || !composer.open)return false;
    if(!storageReady || !repository || captureConflictMode || externalChangeDetected || saveInProgress){
      notify('Cannot start a new entry until this draft is safely stored and the library is current.');return false;
    }
    const previous=ui.capture,request=captureIntent,workspace=ui.scope;
    if(previous.workspace!==workspace){notify('Workspace changed. No draft was replaced.');return false;}
    freshCaptureInProgress=true;
    let started=false;
    const controls=$('#captureContent')?.querySelectorAll('input,textarea,button,select')||[];
    controls.forEach(element=>element.disabled=true);
    try {
      // Previous keystrokes may still be queued. Verify the current draft was
      // actually persisted, not merely scheduled for storage.
      if(!await persistDraft())throw new Error('The unfinished draft could not be saved');
      await draftQueue;
      if(previous!==ui.capture || workspace!==ui.scope || captureConflictMode || externalChangeDetected)
        throw new Error('The editor or library changed during draft preservation');
      const fresh={body:'',type:request.requestedType,workspace,targetWorkspace:workspace,
        categories:request.category?[request.category]:[],date:request.requestedType==='event'?ui.selected:todayDate,
        dueDate:request.requestedType==='reminder'?ui.selected:'',remindAt:'',
        occurredOn:request.requestedType==='journal'?(request.date||todayDate):'',time:'12:00',repeat:'none',opId:C.uid()};
      // Atomic repository transaction parks prior nonempty draft and installs
      // the new empty one. On a revision conflict neither change is committed.
      await repository.putDraft(workspace,fresh);
      cachedDrafts[workspace]=fresh;
      parkedDrafts[workspace]=await repository.listParkedDrafts(workspace).catch(()=>parkedDrafts[workspace]);
      markBackupStale();
      if(storageIssue.startsWith('Latest draft not saved'))storageIssue='';
      ui.capture=fresh;ui.editing=null;ui.recovered=false;captureIntent=null;
      ui.captureDetailsOpen=!!(fresh.categories.length||['event','reminder','journal'].includes(fresh.type));
      renderCapture();
      $('#captureBody')?.focus();
      notify('New '+fresh.type+' started.'+(C.normalize(previous.body)?' Earlier unfinished draft preserved in Recoverable drafts.':''));
      started=true;
      return true;
    }catch(error){
      notify('New entry not started: '+error.message+'. Your unfinished editor remains open.');
      return false;
    }finally{freshCaptureInProgress=false;if(!started)renderCapture();}
  }
  async function closeCapture() {
    if (ui.capture && C.normalize(ui.capture.body)) { const ok=await persistDraft(); if(!ok){notify('Draft recovery failed. Copy your text before leaving.');return;} notify('Unfinished draft preserved on this device.'); }
    const hadConflict=captureConflictMode;
    ui.capture=null;ui.editing=null;ui.recovered=false;captureIntent=null;
    captureConflictMode=false;conflictRecoveryId=null;conflictCopySaved=false;
    if(composer.open)composer.close();
    if(hadConflict){
      await reloadLatestLibrary();
      notify('Conflicting edit preserved in Recoverable drafts. Latest library reloaded; review the copy before saving.');
    }
  }
  async function commitCapture() {
    const cap=ui.capture;
    if (!cap || !C.normalize(cap.body) || saveInProgress) return false;
    if(captureConflictMode || externalChangeDetected){
      const saved=await persistDraft();
      renderCapture();
      notify(saved?'Cannot overwrite a newer edit. Recovery copy saved separately; close editor to reload.':'Cannot overwrite a newer edit. Latest draft is NOT saved; keep this editor open or copy your text.');
      return false;
    }
    saveInProgress=true;
    try {
      const destination=cap.targetWorkspace||cap.workspace;
      if(!scopes[destination])throw new Error('Select a valid destination workspace');
      if(cap.type==='event' && (!W12.validDate(cap.date)||!W12.validClock(cap.time||'12:00')))throw new Error('Set a valid event date and time');
      if(['task','reminder'].includes(cap.type)&&cap.dueDate&&!W12.validDate(cap.dueDate))throw new Error('Invalid due date');
      if(cap.type==='reminder'&&!cap.dueDate)throw new Error('A reminder requires a due date; no device alerts are available yet');
      if(['task','reminder'].includes(cap.type)&&cap.remindAt&&!W12.validClock(cap.remindAt))throw new Error('Set a valid optional reference time (HH:MM)');
      if(cap.type==='event'&&!['none','yearly'].includes(cap.repeat||'none'))throw new Error('Invalid repeat setting');
      if(cap.editingId&&ui.editing?.type==='event'){const current=data.records.find(r=>r.id===cap.editingId);if(!current||C.eventSignature(current)!==C.eventSignature(ui.editing))throw Error('Data changed in another LiveIt window. Your edit is retained for review.');}
      if(cap.type==='event'&&!C.validEventRange(cap))throw Error('Choose an end date/time after the start. Yearly events may span up to one year.');
      const transfer=cap.editingId&&destination!==cap.workspace?{id:cap.editingId,from:cap.workspace,to:destination}:null;
      await enqueueMutation(next=>{
        if(cap.editingId){
          const rec=C.update(next,cap.editingId,cap.workspace,{body:C.normalize(cap.body),type:cap.type,categories:cap.categories,dueDate:cap.dueDate||'',remindAt:cap.remindAt||'',date:cap.date||todayDate,time:cap.time||'12:00',occurredOn:cap.type==='journal'?cap.occurredOn||cap.date:'',endDate:cap.type==='event'?(cap.endDate||cap.date):'',endTime:cap.type==='event'?(cap.endTime||''):'',allDay:cap.type==='event'&&cap.allDay===true,repeat:cap.type==='event'?cap.repeat||'none':'none'});
          if(transfer)rec.workspace=destination;
        }else C.create(next,{workspace:destination,body:cap.body,type:cap.type,categories:cap.categories,date:cap.date,time:cap.type==='event'?(cap.time||'12:00'):'12:00',dueDate:cap.type==='task'||cap.type==='reminder'?cap.dueDate:'',remindAt:cap.type==='task'||cap.type==='reminder'?cap.remindAt:'',occurredOn:cap.type==='journal'?cap.occurredOn||cap.date:'',endDate:cap.type==='event'?(cap.endDate||cap.date):'',endTime:cap.type==='event'?(cap.endTime||''):'',allDay:cap.type==='event'&&cap.allDay===true,repeat:cap.type==='event'?cap.repeat||'none':'none',opId:cap.opId});
      },{clearDraftWorkspace:cap.workspace,clearDraftOpId:cap.opId,workspaceTransfer:transfer});
      const didSwitch=ui.scope!==destination;
      ui.capture=null;ui.editing=null;ui.recovered=false;captureIntent=null;captureConflictMode=false;conflictRecoveryId=null;conflictCopySaved=false;
      if(composer.open)composer.close();
      if(didSwitch){ui.scope=destination;ui.taskKind='all';ui.taskStream='all';ui.query='';ui.category='';ui.mobileMore=false;}
      if(cap.type==='event'){ui.selected=cap.date||todayDate;ui.view='today';}
      else if(didSwitch){ui.view=cap.type==='journal'?'journal':(['task','reminder'].includes(cap.type)?'tasks':'inbox');}
      applyAppearance();render();notify('Saved in '+scopes[destination]+(didSwitch?' · Now viewing '+scopes[destination]:'')+(cap.type==='event'?'. Saved on this device; event sync is queued for KeepIt.':'. Stored on this device only.'));if(cap.type==='event')window.dispatchEvent(new Event('liveit-calendar-change'));return true;
    } catch (err) {
      if(/Data changed in another LiveIt window/i.test(String(err?.message||''))){
        // Preserve a second editor's input when the conflicting window wrote
        // after the last keystroke but just before Save.
        await persistDraft();
      }
      storageIssue=`Save failed: ${err.message}. ${captureConflictMode&&conflictCopySaved?'A recovery copy is saved separately.':'Your text remains in the editor. Verify draft recovery before closing.'}`;
      renderCapture();notify(storageIssue);return false;
    } finally {saveInProgress=false;}
  }
  function openDetail(id) {
    detailReturnFocus=document.activeElement;
    const rec=allScoped({includeArchived:true}).find(x=>x.id===id);
    if(!rec)return;
    ui.detail=id;
    $('#recordContent').innerHTML=`<div class="dialog-body"><div class="dialog-header"><div><div class="date-kicker">${esc(scopes[rec.workspace])} · ${esc(rec.type)}</div><h2 id="recordHeading" class="dialog-title">Record details</h2></div><button class="button icon subtle" data-action="detail-close" aria-label="Close details">×</button></div>
      <div class="detail-text">${esc(rec.body)}</div><div class="detail-meta" style="margin-top:17px">Recorded date: ${esc(dateShort(rec.date))}${rec.type==='journal'&&rec.occurredOn?`<br>Occurred on: ${esc(dateShort(rec.occurredOn))}`:''}${rec.dueDate?`<br>Due: ${esc(dateShort(rec.dueDate))}`:''}${rec.type==='event'?'<br>End: '+esc(dateShort(rec.endDate||rec.date))+(rec.endTime&&!rec.allDay?' '+esc(rec.endTime):'')+(rec.allDay?' · All day':''):''}<br>Workspace: ${esc(scopes[rec.workspace])}<br>Type: ${esc(rec.type)}</div>
      <div>${rec.categories.map(tag).join('')}</div>${rec.type==='event'&&rec.repeat==='yearly'?'<p class="caption">Repeats yearly from the original date. Feb 29 occurs only in leap years.</p>':''}<div class="detail-footer">${rec.archived?'':`<button class="button secondary" data-action="edit" data-id="${esc(rec.id)}">Edit</button>`}${['task','reminder'].includes(rec.type)?`<button class="button subtle" data-action="toggle-detail-task" data-id="${esc(rec.id)}" ${taskSaving(rec)?'disabled aria-busy="true"':''}>${taskSaving(rec)?'Saving…':rec.complete?'Mark incomplete':'Complete task'}</button>`:''}<button class="button subtle" data-action="archive" data-id="${esc(rec.id)}">${rec.archived?'Restore':'Archive'}</button><button class="button ghost" data-action="move-record" data-id="${esc(rec.id)}" data-destination="${rec.workspace==='work'?'personal':'work'}">Move to ${rec.workspace==='work'?'Personal':'Work'}…</button></div>
      ${['note','quote','journal'].includes(rec.type)?`<section class="keepit-manual-handoff" aria-label="Optional manual KeepIt transfer">
        <div class="keepit-manual-heading">KeepIt notes</div>
        <p>This record is saved only in LiveIt on this device. Native KeepIt linking and cloud synchronization are not connected.</p>
        <div class="keepit-manual-actions">
          <button type="button" class="button secondary" data-action="copy-local-note" data-id="${esc(rec.id)}">Copy text</button>
          <a class="button ghost" href="https://kdg-007.github.io/" target="_blank" rel="noopener noreferrer">Open KeepIt</a>
        </div>
        <p class="caption">Optional manual transfer: paste into a KeepIt note yourself. The LiveIt record stays unchanged and the two notes are not linked.</p>
      </section>`:''}
      <p class="caption" style="margin-top:15px">On-device record. KeepIt promotion is intentionally disabled until its authenticated connector is verified.</p></div>`;
    if(!details.open)details.showModal();
  }
  // Explicit transfer opens the editor: Save is required, never a surprise view switch.
  function beginWorkspaceMove(id,destination){
    const rec=allScoped({includeArchived:true}).find(r=>r.id===id&&!r.archived);
    if(!rec||!scopes[destination]||destination===rec.workspace)return false;
    if(details.open)details.close();
    openCapture('',rec.type,{editing:rec});
    ui.capture.targetWorkspace=destination;
    ui.capture.categories=ui.capture.categories.filter(c=>(data.spaces[destination]||[]).includes(c));
    ui.captureDetailsOpen=true;renderCapture();
    void persistDraft();
    return true;
  }
  function openTravelDetail(key) {
    detailReturnFocus=document.activeElement;
    const p=projections.find(v=>(v.key||v.projectionKey)===key);
    if(!p || ui.scope!=='personal')return;
    let when=p.eventType==='all_day'?`${p.startDate} through ${C.dayAdd(p.endDateExclusive,-1)}`:
      `${D.sameLocalDay(p.startUTC,p.timezone)} ${D.localClock(p.startUTC,p.timezone)} (${p.timezone})`;
    $('#recordContent').innerHTML=`<div class="dialog-body"><div class="dialog-header"><div><div class="date-kicker">Personal · TravelIt-owned</div><h2 id="recordHeading" class="dialog-title">Travel schedule</h2></div><button class="button icon subtle" data-action="detail-close">×</button></div>
      <div class="detail-text">${esc(p.title)}</div><div class="detail-meta">${esc(when)}</div><div class="notice" style="margin-top:15px">Read-only TravelIt projection. Editing stays in TravelIt. No verified TravelIt app deep-link or synchronization is connected in W2.</div></div>`;
    if(!details.open)details.showModal();
  }
  async function mutateRecord(id,updates) {
    try {const scope=ui.scope;await enqueueMutation(next=>C.update(next,id,scope,updates));render();return true;}
    catch(err){notify(`Could not save change: ${err.message}`);render();return false;}
  }
  async function toggleTaskCompletion(rec,complete){
    if(!rec || !['task','reminder'].includes(rec.type) || taskSaving(rec))return false;
    const key=rec.workspace+':'+rec.id;
    pendingTaskMutations.add(key);
    // Undo the native checkbox's optimistic appearance and disable duplicate
    // controls while the revision-protected IndexedDB write is pending.
    render();
    if(details.open && ui.detail===rec.id){
      const button=$('#recordContent [data-action="toggle-detail-task"]');
      if(button){button.disabled=true;button.setAttribute('aria-busy','true');button.textContent='Saving…';}
    }
    notify('Saving task change…');
    try {
      const ok=await mutateRecord(rec.id,{complete});
      if(ok){
        if(details.open && ui.detail===rec.id)details.close();
        notify(complete?'Task completed. Saved on this device.':'Task reopened. Saved on this device.');
      }
      return ok;
    } finally {
      pendingTaskMutations.delete(key);
      // A failed write leaves data at its previously committed state.
      render();
    }
  }
  function advanceDate(amount) {
    if(ui.view==='calendar'&&ui.calendarMode==='month') ui.selected=C.monthAdd(ui.selected,amount);
    else if(ui.view==='calendar'&&ui.calendarMode==='week')ui.selected=C.dayAdd(ui.selected,amount*7);
    else ui.selected=C.dayAdd(ui.selected,amount);
    render();
  }
  document.addEventListener('click',ev=>{
    if(ev.target.closest('#liveit-app-switcher a'))return;
    const el=ev.target.closest('[data-action]');
    if(!el){
      if(ui.appsOpen&&!ev.target.closest('#liveit-app-switcher')){ui.appsOpen=false;render();}
      return;
    }
    const action=el.dataset.action;
    if(ui.appsOpen&&action!=='apps'&&!el.closest('#liveit-app-switcher'))ui.appsOpen=false;
    if(action==='apps'){
      ui.appsOpen=!ui.appsOpen;render();$('#liveit-apps-button')?.focus();return;
    }
    if(action==='panel-left'){
      if(window.matchMedia('(max-width:860px)').matches){
        ui.mobileMore=!ui.mobileMore;ui.mobileRightOpen=false;render();return;
      }
      ui.leftMode=ui.leftMode==='expanded'?'rail':ui.leftMode==='rail'?'hidden':'expanded';
      ui.focus=false;persistLayout();render();return;
    }
    if(action==='panel-right'){
      if(window.matchMedia('(max-width:860px)').matches){
        ui.mobileRightOpen=!ui.mobileRightOpen;ui.mobileMore=false;render();return;
      }
      ui.rightMode=ui.rightMode==='visible'?'hidden':'visible';
      ui.focus=false;persistLayout();render();return;
    }
    if(action==='right-mobile'){
      ui.mobileRightOpen=!ui.mobileRightOpen;ui.mobileMore=false;render();return;
    }
    if(action==='close-panels'){
      ui.mobileRightOpen=false;ui.mobileMore=false;render();return;
    }
    if(action==='focus'){
      ui.focus=!ui.focus;ui.mobileMore=false;ui.mobileRightOpen=false;
      persistLayout();render();return;
    }
    if(action==='due-quick'){
      if(!composer.open||!ui.capture||!['task','reminder'].includes(ui.capture.type)||saveInProgress)return;
      try{
        const choice=el.dataset.choice;
        ui.capture.dueDate=W12.quickDueDate(todayDate,choice,ui.capture.type);
        void persistDraft();renderCapture();
        $('#captureContent [data-action="due-quick"][data-choice="'+choice+'"]')?.focus();
      }catch(err){notify('Due date unchanged: '+err.message);}
      return;
    }
    if(action==='shortcut-customize'){
      if(ui.view!=='today'||ui.query||composer.open)return;
      ui.quickActionsCustomize=!ui.quickActionsCustomize;
      refreshContent();
      $('#main-content [data-action="shortcut-customize"]')?.focus();
      return;
    }
    if(action==='shortcut-toggle'){
      if(ui.view!=='today'||ui.query||!ui.quickActionsCustomize||composer.open)return;
      const type=el.dataset.shortcutType;
      try{
        ui.quickActions=W12.toggleQuickAction(ui.quickActions,ui.scope,type);
        applyAppearance();
        refreshContent();
        $('#main-content [data-action="shortcut-toggle"][data-shortcut-type="'+type+'"]')?.focus();
      }catch(error){notify(error.message);}
      return;
    }
    if(action==='task-stream'){
      if(ui.scope!=='work'||ui.view!=='tasks'||!['all','projects','operations','unassigned'].includes(el.dataset.stream))return;
      ui.taskStream=el.dataset.stream;refreshContent();return;
    }
    if(action==='task-kind'){if(!['all','task','reminder'].includes(el.dataset.kind)||ui.view!=='tasks')return;ui.taskKind=el.dataset.kind;refreshContent();return;}
    if(action==='journal-clear'){ui.journalYear='all';ui.journalMonth='all';ui.journalQuery='';refreshContent();$('#journalQuery')?.focus();return;}
    if(action==='journal-day'){const day=el.dataset.date;if(ui.view!=='journal'||!W12.validDate(day))return;ui.selected=day;ui.view='today';ui.query='';ui.category='';ui.mobileMore=false;render();return;}
    if(action==='nav'||action==='rail-nav') {ui.view=el.dataset.view||'today';ui.mobileMore=false;ui.mobileRightOpen=false;ui.appsOpen=false;ui.query='';ui.category='';render();return;}
    if(action==='more') {ui.mobileMore=!ui.mobileMore;ui.mobileRightOpen=false;render();return;}
    if(action==='mobile-search'){ui.mobileSearchOpen=!ui.mobileSearchOpen;render();if(ui.mobileSearchOpen)$('#mobileSearchField')?.focus();return;}
    if(action==='reload-library'){void reloadLatestLibrary();return;}
    if(action==='scope') {void changeScope(el.dataset.scope);return;}
    if(action==='theme') {ui.theme=ui.theme==='dark'?'light':'dark';applyAppearance();render();return;}
    if(action==='density') {ui.density=ui.density==='compact'?'calm':'compact';applyAppearance();render();return;}
    if(action==='capture') {openCapture(el.dataset.category||'',el.dataset.type||'note',{...el.dataset.occurredOn&&W12.validDate(el.dataset.occurredOn)?{occurredOn:el.dataset.occurredOn}:{},explicitIntent:el.hasAttribute('data-type')||el.hasAttribute('data-category')});return;}
    if(action==='capture-fresh') {void startRequestedCapture();return;}
    if(action==='recover-parked'){
      const key=el.dataset.draftId,scope=ui.scope;
      void (async()=>{try{
        if(composer.open){notify('Close the editor before recovering another draft.');return;}
        await draftQueue;await mutationQueue;
        const restored=await repository.activateParkedDraft(scope,key);
        cachedDrafts[scope]=restored;
        parkedDrafts[scope]=await repository.listParkedDrafts(scope);
        markBackupStale();render();openCapture();
        notify('Recovered an unfinished '+(restored.editingId?'edit':'draft')+' in '+scopes[scope]+'.');
      }catch(err){notify('Draft recovery was not completed: '+err.message);}})();
      return;
    }
    if(action==='capture-close') {void closeCapture();return;}
    if(action==='capture-save') {void commitCapture();return;}
    if(action==='capture-more') {ui.captureDetailsOpen=!ui.captureDetailsOpen;renderCapture();$('#captureContent [data-action="capture-more"]')?.focus();return;}
    if(action==='toggle-category') {const cat=el.dataset.category;const set=new Set(ui.capture.categories);if(set.has(cat))set.delete(cat);else set.add(cat);ui.capture.categories=[...set];persistDraft();const position=$('#captureBody')?.selectionStart;renderCapture();const ta=$('#captureBody');if(ta){ta.focus();ta.setSelectionRange(position,position);}return;}
    if(action==='space') {ui.category=el.dataset.category;ui.query='';ui.view='inbox';ui.mobileMore=false;render();return;}
    if(action==='manage-space'){
      const original=el.dataset.category,scope=ui.scope;
      void (async()=>{try{
        // W12: settle any unfinished IndexedDB draft write before changing tags.
        await draftQueue;
        const draftList=[cachedDrafts[scope],...parkedDrafts[scope].map(x=>x.content)].filter(Boolean);
        if(draftList.some(d=>d.categories?.includes(original))){notify('Finish or refile unfinished drafts using this category before changing it. Nothing changed.');return;}
        const operation=prompt('Manage "'+original+'": enter RENAME or REMOVE. Cancel does nothing:');
        if(!operation)return;
        const kind=operation.trim().toLowerCase();
        if(!['rename','remove'].includes(kind)){notify('No changes. Choose RENAME or REMOVE.');return;}
        let destination='';
        if(kind==='rename'){const v=prompt('New name for "'+original+'":');if(v===null)return;destination=v.trim();if(!destination){notify('A Quick Space name cannot be empty.');return;}}
        if(kind==='remove'&&!confirm('Remove Quick Space "'+original+'" and remove only its tags from records in '+scopes[scope]+'? Records will NOT be deleted.'))return;
        await enqueueMutation(next=>W12.manageSpace(next,scope,kind,original,destination));
        if(ui.category===original)ui.category=kind==='rename'?destination:'';
        render();notify(kind==='rename'?'Quick Space renamed. Records retained.':'Quick Space removed. Records retained.');
      }catch(err){notify('Quick Space unchanged: '+err.message);}})();return;
    }
    if(action==='clear-space') {ui.category='';render();return;}
    if(action==='new-space') {const response=prompt('Name a Quick Space for the current workspace:');const name=C.normalize(response||'').slice(0,40);if(!name)return;const scope=ui.scope;void (async()=>{try{await enqueueMutation(next=>{if(!W12.uniqueName(next.spaces[scope],name))throw new Error('Quick Space name already exists');next.spaces[scope].push(name);});render();notify('Quick Space saved on this device.');}catch(e){notify('Could not save Quick Space: '+e.message);}})();return;}
    if(action==='calendar-retry'){window.dispatchEvent(new Event('liveit-calendar-change'));return;}
    if(action==='calendar-keep-both'){void keepBothCalendar(el.dataset.id);return;}
    if(action==='detail') {const r=data.records.find(x=>x.id===el.dataset.id&&x.type==='event');if(r&&r.workspace!==ui.scope)void changeScope(r.workspace).then(()=>{if(ui.scope===r.workspace)openDetail(el.dataset.id);});else openDetail(el.dataset.id);return;}
    if(action==='travel-detail') {openTravelDetail(el.dataset.id);return;}
    if(action==='detail-close') {details.close();ui.detail=null;return;}
    if(action==='edit') {const rec=allScoped({includeArchived:true}).find(x=>x.id===el.dataset.id);if(!rec)return;details.close();openCapture('',rec.type,{editing:rec});return;}
    if(action==='move-record') {beginWorkspaceMove(el.dataset.id,el.dataset.destination);return;}
    if(action==='archive') {const rec=allScoped({includeArchived:true}).find(x=>x.id===el.dataset.id);if(rec){void mutateRecord(rec.id,{archived:!rec.archived}).then(ok=>{if(ok){details.close();notify(rec.archived?'Record restored.':'Record archived, not deleted.');}});}return;}
    if(action==='toggle-detail-task') {const rec=allScoped({includeArchived:true}).find(x=>x.id===el.dataset.id);if(rec)void toggleTaskCompletion(rec,!rec.complete);return;}
    if(action==='copy-local-note'){
      // Only the visible note's original workspace may be copied by a trusted click.
      // No note text is sent to another site or embedded in a URL. This is not a native KeepIt save.
      const rec=allScoped({includeArchived:true}).find(x=>x.id===el.dataset.id&&['note','quote','journal'].includes(x.type));
      if(!details.open||!rec||ui.detail!==rec.id){notify('Note is not available in this workspace. Nothing was copied.');return;}
      if(!navigator.clipboard?.writeText){notify('Clipboard access is unavailable. Select and copy the visible note text manually.');return;}
      void navigator.clipboard.writeText(rec.body).then(
        ()=>notify('Text copied. Open KeepIt and paste manually. These records are not linked or synchronized.'),
        ()=>notify('Clipboard permission was denied. Select and copy the visible note text manually.'));
      return;
    }
    if(action==='month') {ui.selected=C.monthAdd(ui.selected,Number(el.dataset.offset));render();return;}
    if(action==='pick-day') {ui.selected=el.dataset.date;ui.view='today';ui.mobileMore=false;render();return;}
    if(action==='calendar-day') {ui.selected=el.dataset.date;ui.calendarMode='day';render();return;}
    if(action==='calendar-mode') {ui.calendarMode=el.dataset.mode;render();return;}
    if(action==='day-step') {advanceDate(Number(el.dataset.offset));return;}
    if(action==='today') {refreshClock();ui.selected=todayDate;render();return;}
    if(action==='range') {ui.range=Number(el.dataset.days);refreshContent();return;}
    if(action==='verify-backup') {$('#verifyBackupFile')?.click();return;}
    if(action==='persist-storage') {void requestStorageProtection();return;}
    if(action==='export') {void exportLocal();return;}
    if(action==='restore') {$('#restoreFile')?.click();return;}
    if(action==='reset') {void requestEraseWithConfirmation();return;}
  });
  document.addEventListener('change',ev=>{
    const el=ev.target;
    if(el.id==='journalYear'){ui.journalYear=/^(all|[0-9]{4})$/.test(el.value)?el.value:'all';ui.journalMonth='all';refreshContent();return;}
    if(el.id==='journalMonth'){ui.journalMonth=/^(all|0[1-9]|1[0-2])$/.test(el.value)?el.value:'all';refreshContent();return;}
    if(el.matches('input[data-action="task-toggle"]')) {const rec=allScoped().find(x=>x.id===el.dataset.id);if(rec){const wanted=el.checked;el.checked=rec.complete;void toggleTaskCompletion(rec,wanted);}return;}
    if(!ui.capture)return;
    if(el.id==='captureScope'){
      if(!scopes[el.value])return;
      const cap=ui.capture,priorCategories=cap.categories.length;
      cap.targetWorkspace=el.value;cap.categories=cap.categories.filter(cat=>(data.spaces[el.value]||[]).includes(cat)||(el.value==='work'&&TASK_STREAMS.includes(cat)));
      void persistDraft();renderCapture();$('#captureScope')?.focus();
      if(priorCategories!==cap.categories.length)notify('Categories not present in '+scopes[el.value]+' were deselected.');
      return;
    }
    if(el.id==='captureTaskStream'){
      if(!['projects','operations','unassigned'].includes(el.value))return;
      applyTaskStream(ui.capture,el.value);void persistDraft();renderCapture();$('#captureTaskStream')?.focus();return;
    }
    if(el.id==='captureType'){ui.capture.type=el.value;
      if(!['task','reminder'].includes(el.value))ui.capture.categories=ui.capture.categories.filter(x=>!TASK_STREAMS.includes(x));
      else if((ui.capture.targetWorkspace||ui.capture.workspace)==='work'
        &&workTaskStream(ui.capture)==='unassigned'
        &&['projects','operations'].includes(ui.taskStream))applyTaskStream(ui.capture,ui.taskStream);
      if(el.value!=='event')ui.capture.repeat='none';if(el.value==='reminder'&&!ui.capture.dueDate)ui.capture.dueDate=ui.selected;if(['event','reminder','journal'].includes(el.value)){ui.captureDetailsOpen=true;if(el.value==='journal'&&!ui.capture.occurredOn)ui.capture.occurredOn=ui.view==='today'?ui.selected:todayDate;}persistDraft();renderCapture();$('#captureType')?.focus();return;}
    if(el.id==='captureRepeat'){ui.capture.repeat=el.value;void persistDraft();return;}
    if(el.id==='captureEndDate'){ui.capture.endDate=el.value;persistDraft();return;}
    if(el.id==='captureEndTime'){ui.capture.endTime=el.value;persistDraft();return;}
    if(el.id==='captureAllDay'){ui.capture.allDay=el.checked;persistDraft();renderCapture();return;}
    if(el.id==='captureDate'){if(ui.capture.type==='journal')ui.capture.occurredOn=el.value;else {const prior=ui.capture.date;ui.capture.date=el.value;if(!ui.capture.endDate||ui.capture.endDate===prior)ui.capture.endDate=el.value;}persistDraft();return;}
    if(el.id==='captureDue'){ui.capture.dueDate=el.value;persistDraft();return;}
    if(el.id==='captureTime'){if(ui.capture.type==='event')ui.capture.time=el.value;else ui.capture.remindAt=el.value;persistDraft();return;}
  });
  document.addEventListener('input',ev=>{
    const el=ev.target;
    if(el.id==='journalQuery'){ui.journalQuery=el.value.slice(0,100);const caret=el.selectionStart;refreshContent();const replacement=$('#journalQuery');replacement?.focus();replacement?.setSelectionRange(caret,caret);return;}
    if(el.id==='captureBody'&&ui.capture){ui.capture.body=el.value;persistDraft();const save=$('#saveCapture');if(save)save.disabled=!C.normalize(el.value);return;}
    if(el.id==='searchField'||el.id==='mobileSearchField'){
      ui.query=el.value;const caret=el.selectionStart;refreshContent();
      const replacement=$('#'+el.id);replacement?.setSelectionRange(caret,caret);return;
    }
  });
  composer.addEventListener('cancel',ev=>{ev.preventDefault();void closeCapture();});
  composer.addEventListener('close',()=>{captureIntent=null;const former=captureReturnFocus;captureReturnFocus=null;restoreFocusAfterDialog(former);});
  details.addEventListener('close',()=>{const former=detailReturnFocus;detailReturnFocus=null;restoreFocusAfterDialog(former);});
  details.addEventListener('cancel',ev=>{ev.preventDefault();details.close();ui.detail=null;});
  document.addEventListener('keydown',ev=>{
    if(ev.key==='Escape'){
      if(ui.appsOpen||ui.mobileMore||ui.mobileRightOpen){
        ui.appsOpen=false;ui.mobileMore=false;ui.mobileRightOpen=false;render();
        $('#liveit-apps-button')?.focus();return;
      }
    }
    if((ev.metaKey||ev.ctrlKey)&&ev.shiftKey&&ev.key.toLowerCase()==='j'){ev.preventDefault();if(!composer.open)openCapture();return;}
    if((ev.metaKey||ev.ctrlKey)&&ev.key.toLowerCase()==='k'){
      if(!composer.open&&!details.open){
        ev.preventDefault();ui.mobileMore=false;
        if(window.matchMedia('(max-width:860px)').matches){ui.mobileSearchOpen=true;render();$('#mobileSearchField')?.focus();}
        else{render();$('#searchField')?.focus();}
      }
      return;
    }
    if(ev.altKey&&ev.shiftKey&&!ev.ctrlKey&&!ev.metaKey&&!composer.open&&!details.open&&!isEditableTarget(ev.target)&&/^Digit[1-6]$/.test(ev.code)){
      ev.preventDefault();const views=['today','calendar','inbox','journal','tasks','archive'];
      ui.view=views[Number(ev.code.slice(5))-1];ui.query='';ui.category='';ui.mobileMore=false;
      render();const heading=app.querySelector('h1.page-title');heading?.setAttribute('tabindex','-1');heading?.focus();return;
    }
    if((ev.metaKey||ev.ctrlKey)&&ev.key==='Enter'&&composer.open){ev.preventDefault();void commitCapture();return;}
  });
  async function inspectStorageProtection(){
    if(!navigator.storage?.persisted){persistentStorage='unsupported';render();return;}
    try {persistentStorage=await navigator.storage.persisted()?'granted':'denied';}
    catch{persistentStorage='unsupported';}
    render();
  }
  async function requestStorageProtection(){
    if(!navigator.storage?.persist){persistentStorage='unsupported';render();notify('This browser does not support persistent storage requests. Keep backups.');return;}
    try {
      const result=await navigator.storage.persist();
      persistentStorage=result?'granted':'denied';render();
      notify(result?'Browser granted persistent storage. Continue making encrypted backups.':'Browser did not grant persistent storage. Keep your backup outside the app.');
    }catch(err){persistentStorage='unsupported';render();notify('Could not request persistent storage. Keep backups.');}
  }
  function storeVerification(value){
    verifiedBackup=value;
    try {if(value)localStorage.setItem(BACKUP_VERIFIED_KEY,JSON.stringify(value));
      else localStorage.removeItem(BACKUP_VERIFIED_KEY);}catch{}
  }
  function markBackupStale(){if(verifiedBackup && !verifiedBackup.dirty)storeVerification({...verifiedBackup,dirty:true});}
  async function verifySavedBackup(file){
    if(!storageReady||!repository){notify('Local database unavailable; verification disabled.');return;}
    if(!file || file.size>window.LiveItBackupCrypto.MAX_FILE_BYTES*1.5){notify('Choose a valid encrypted backup file.');return;}
    const unlocked=await requestPassphrase(false, async(passphrase)=>{
      const envelope=JSON.parse(await file.text());
      const snapshot=await window.LiveItBackupCrypto.open(envelope,passphrase);
      const info=window.LiveItLocalStore.validateBackup(snapshot,C);
      return {snapshot,info};
    });
    if(unlocked===null)return;
    try {
      await mutationQueue;await draftQueue;
      const {snapshot,info}=unlocked;
      const current=await repository.exportContents();
      const same=window.LiveItLocalStore.sameRestoredData(snapshot.stores,current.stores);
      const currentRevision=current.stores.meta.find(row=>row.key==='state')?.revision;
      if(currentRevision!==repository.revision)throw new Error('Library changed during verification; please try again');
      if(same){storeVerification({revision:currentRevision,dbEpoch:currentDatabaseEpoch,verifiedAt:new Date().toISOString(),recordCount:info.recordCount});
        render();notify('Downloaded backup VERIFIED: readable, authenticated and matches the current library ('+info.recordCount+' records).');}
      else {render();notify('Backup is readable and authenticated, but does NOT match current local data. Export a new backup and verify it.');}
    }catch(err){notify('Backup verification FAILED: '+err.message+'. Existing data unchanged.');}
  }
  $('#verifyBackupFile').addEventListener('change',event=>{
    const file=event.target.files&&event.target.files[0];event.target.value='';
    if(file)void verifySavedBackup(file);
  });
  // W17E: match the safety standard already required for destructive restore.
  // A typed ERASE confirmation alone is never sufficient to clear populated data.
  async function assertEraseSafety(){
    if(!storageReady||!repository)throw new Error('Local database unavailable');
    if(composer.open||details.open||ui.capture)throw new Error('Close the editor and preserve any draft before erasing');
    await draftQueue;await mutationQueue;
    const snapshot=await repository.exportContents();
    const meta=snapshot.stores.meta.find(row=>row.key==='state');
    if(!meta||meta.revision!==repository.revision)
      throw new Error('Library changed in another window; reload before erasing');
    const populated=Object.entries(snapshot.stores).some(([name,rows])=>
      !['meta','spaces'].includes(name)&&rows.length>0);
    if(populated){
      const protectedCopy=!!verifiedBackup && verifiedBackup.dirty!==true &&
        verifiedBackup.revision===meta.revision &&
        verifiedBackup.dbEpoch===meta.initializedAt &&
        currentDatabaseEpoch===meta.initializedAt;
      if(!protectedCopy)throw new Error('First create an encrypted backup, then verify the downloaded file for the current library. No records were erased');
    }
    return {populated,revision:meta.revision};
  }
  async function requestEraseWithConfirmation(){
    try{
      await assertEraseSafety();
      if(prompt('ERASE every local LiveIt Work and Personal record in this browser? This cannot be undone. Type ERASE:')!=='ERASE')return false;
      return await resetLocal(); // Rechecks revision and verified safety after confirmation.
    }catch(err){notify('Erase blocked: '+err.message);return false;}
  }
  async function resetLocal(){
    try{
      await assertEraseSafety();
      await repository.reset(D.emptyData(C));storeVerification(null);data=D.emptyData(C);projections=[];cachedDrafts.work=cachedDrafts.personal=null;parkedDrafts.work=[];parkedDrafts.personal=[];
      ui.scope='work';ui.taskKind='all';ui.view='today';ui.journalYear='all';ui.journalMonth='all';ui.journalQuery='';ui.query='';refreshClock();ui.selected=todayDate;ui.category='';ui.mobileMore=false;
      storageIssue='';render();notify('Local Work and Personal records erased. Restore from a protected backup if needed.');return true;
    }catch(err){notify('Reset failed: '+err.message);return false;}
  }
  function requestPassphrase(forExport,unlock){
    // W17B: only close the unlock dialog AFTER the selected backup decrypts
    // and validates. Incorrect passphrases are inline, retryable, and non-destructive.
    return new Promise(resolve=>{
      const dialog=$('#backupPasswordDialog'),form=$('#backupPasswordForm'),primary=$('#backupPassword'),confirmField=$('#backupPasswordConfirm'),error=$('#backupPasswordError');
      const confirmButton=form.querySelector('button[value="confirm"]'),cancelButton=form.querySelector('button[value="cancel"]'),showPassword=$('#backupShowPassphrase');
      $('#backupPasswordHeading').textContent=forExport?'Protect new encrypted backup':'Unlock encrypted backup';
      $('#backupPasswordHelp').textContent=forExport?'Use 12 or more characters. Both Work and Personal data will be encrypted. Store this passphrase in a password manager; it cannot be recovered.':'Enter the passphrase for the selected backup. A wrong passphrase will show an error here. No password is stored in LiveIt.';
      $('#backupConfirmSection').hidden=!forExport;primary.value='';confirmField.value='';error.textContent='';
      primary.removeAttribute('aria-invalid');confirmField.removeAttribute('aria-invalid');
      showPassword.checked=false;primary.type='password';confirmField.type='password';
      const togglePassword=()=>{const type=showPassword.checked?'text':'password';primary.type=type;confirmField.type=type;};
      showPassword.addEventListener('change',togglePassword);
      let outcome=null,busy=false;
      const clearError=()=>{error.textContent='';primary.removeAttribute('aria-invalid');confirmField.removeAttribute('aria-invalid');};
      const fail=(message,target=primary)=>{
        error.textContent=message;target.setAttribute('aria-invalid','true');target.focus();
      };
      const submit=async e=>{
        e.preventDefault(); // Do NOT let method=dialog close before decrypt/validation.
        if(busy)return;
        if(e.submitter?.value==='cancel'){dialog.close('cancel');return;}
        if(primary.value.length<12||primary.value.length>1024){fail('Passphrase must contain 12–1024 characters.');return;}
        if(forExport&&primary.value!==confirmField.value){fail('Passphrases do not match.',confirmField);return;}
        busy=true;confirmButton.disabled=true;cancelButton.disabled=true;
        const original=confirmButton.textContent;
        confirmButton.textContent=forExport?'Preparing…':'Checking…';
        try{
          outcome=forExport?primary.value:(unlock?await unlock(primary.value):primary.value);
          dialog.close('confirm');
        }catch(err){
          const message=String(err?.message||'');
          if(/Cannot decrypt backup|wrong passphrase/i.test(message)){
            fail('Could not unlock this backup. The passphrase may be incorrect, or the file may be damaged. Try again.');
          }else if(/Unexpected token|not valid JSON|JSON parse|Unsupported or malformed encrypted backup|Invalid backup encoding|Malformed encrypted backup/i.test(message)){
            fail('This file is not a valid readable encrypted LiveIt backup. Cancel and choose another file.');
          }else{
            fail('Backup could not be opened: '+(message||'Unknown error')+'. No records were changed.');
          }
        }finally{
          busy=false;confirmButton.disabled=false;cancelButton.disabled=false;
          confirmButton.textContent=original;
        }
      };
      const onClose=()=>{
        form.removeEventListener('submit',submit);
        primary.removeEventListener('input',clearError);
        confirmField.removeEventListener('input',clearError);
        showPassword.removeEventListener('change',togglePassword);
        showPassword.checked=false;primary.type='password';confirmField.type='password';
        const result=dialog.returnValue==='confirm'?outcome:null;
        primary.value='';confirmField.value='';clearError();
        resolve(result);
      };
      primary.addEventListener('input',clearError);confirmField.addEventListener('input',clearError);
      form.addEventListener('submit',submit);dialog.addEventListener('close',onClose,{once:true});
      dialog.showModal();primary.focus();
    });
  }

  function downloadBackup(envelope,prefix){
    const file=new Blob([JSON.stringify(envelope)],{type:'application/json'});
    const url=URL.createObjectURL(file),link=document.createElement('a');link.href=url;
    link.download=prefix+'_'+new Date().toISOString().replace(/[:.]/g,'-')+'.liveitbak';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  async function exportLocal(){
    if(!repository||!storageReady){notify('Local database unavailable. Copy any unsaved text.');return;}
    const password=await requestPassphrase(true);if(password===null)return;
    try{await draftQueue;await mutationQueue;
      const snapshot=await repository.exportContents();
      window.LiveItLocalStore.validateBackup(snapshot,C);
      const envelope=await window.LiveItBackupCrypto.seal(snapshot,password);
      // Local cryptographic round trip before requesting a download. This verifies
      // the in-memory envelope, NOT the bytes received by the browser's Downloads folder.
      const selfCheck=await window.LiveItBackupCrypto.open(envelope,password);
      window.LiveItLocalStore.validateBackup(selfCheck,C);
      if(!window.LiveItLocalStore.sameRestoredData(snapshot.stores,selfCheck.stores))
        throw new Error('Encrypted backup did not match the source library during self-check');
      downloadBackup(envelope,'LiveIt_W17D_Encrypted_Backup');
      notify('Encrypted backup self-check PASSED; download requested. Check Downloads, then verify the saved file. Not cloud-backed up.');
    }catch(err){notify('Backup failed: '+err.message);}
  }
  // W17D: validation copies contain decrypted data in a temporary IndexedDB.
  // Remove them on success, cancellation AND exceptions; an orphan from a killed
  // browser is cleaned up on the next launch when indexedDB.databases is available.
  const RESTORE_STAGE_PREFIX='liveit_restore_stage_w17d_';
  async function deleteRestoreStage(name){
    if(!name || !/^(liveit_restore_stage_w17d_|liveit_w3_restore_stage_)[A-Za-z0-9_-]+$/.test(name))
      throw new Error('Unsafe staging database identity');
    if(typeof window.indexedDB?.deleteDatabase!=='function')
      throw new Error('Cannot safely clean the temporary restore database in this browser');
    await new Promise((resolve,reject)=>{
      let settled=false;
      const finish=err=>{if(settled)return;settled=true;clearTimeout(timer);err?reject(err):resolve();};
      const timer=setTimeout(()=>finish(new Error('Temporary restore database cleanup timed out')),3500);
      let req;
      try{req=window.indexedDB.deleteDatabase(name);}catch(err){finish(err);return;}
      req.onsuccess=()=>finish(null);
      req.onerror=()=>finish(new Error('Temporary restore database cleanup failed'));
      req.onblocked=()=>finish(new Error('Temporary restore database is still open; close other LiveIt tabs'));
    });
  }
  async function purgeOrphanRestoreStages(){
    if(typeof window.indexedDB?.databases!=='function')return;
    try {
      const entries=await window.indexedDB.databases();
      for(const row of entries){
        if(typeof row.name==='string' &&
           (row.name.startsWith(RESTORE_STAGE_PREFIX)||row.name.startsWith('liveit_w3_restore_stage_'))){
          try{await deleteRestoreStage(row.name);}catch(err){console.warn('Could not clear abandoned restore staging database:',err.message);}
        }
      }
    }catch(err){console.warn('Temporary restore database enumeration unavailable:',err.message);}
  }
  async function validateInTemporaryStore(snapshot){
    const name=RESTORE_STAGE_PREFIX+Date.now()+'_'+Math.random().toString(36).slice(2);
    let stage;
    try{
      const attempt=await window.LiveItLocalStore.LocalStore.connect({indexedDB:window.indexedDB,core:C,name,seed:D.emptyData(C)});
      stage=attempt.store;
      await stage.restoreContents(snapshot,{allowReplace:false});
      if(!window.LiveItLocalStore.sameRestoredData(snapshot.stores,(await stage.exportContents()).stores))
        throw new Error('Temporary restore readback does not match the downloaded backup');
    }finally{
      if(stage)stage.close();
      // Fail closed if cleanup cannot be confirmed. Never knowingly leave a
      // second plaintext copy and proceed to replace the active library.
      await deleteRestoreStage(name);
    }
  }
  // W17R: counts only; the decrypted backup stays in the restore closure.
  // A green local validation is NOT source-origin or OneDrive authorization.
  function reviewLocalRestore(plan){
    return new Promise(resolve=>{
      const dialog=document.createElement('dialog');
      dialog.id='restoreReviewDialog';
      dialog.className='restore-review-dialog';
      dialog.setAttribute('aria-labelledby','restoreReviewHeading');
      const row=(label,key)=>`<tr><th scope="row">${label}</th><td>${plan.incoming[key].work} Work / ${plan.incoming[key].personal} Personal</td><td>${plan.current[key].work} Work / ${plan.current[key].personal} Personal</td></tr>`;
      dialog.innerHTML=`<div class="dialog-body restore-review-body">
        <h2 id="restoreReviewHeading">Review LiveIt backup before restore</h2>
        <p class="muted small">The encrypted backup was opened and validated. Its account, source origin, KeepIt notes, and OneDrive status have NOT been authenticated. No records are changed by this review.</p>
        <table class="restore-review-table"><caption>Local inventory — no personal entry text</caption>
          <thead><tr><th>Local data</th><th>Incoming backup</th><th>Current library</th></tr></thead>
          <tbody>${row('Records','records')}${row('Unfinished drafts','drafts')}${row('KeepIt note links','links')}
          <tr><th>KeepIt link receipts</th><td>${plan.incoming.nativeLinkOperations}</td><td>${plan.current.nativeLinkOperations}</td></tr>
          <tr><th>TravelIt projection/receipt rows</th><td>${plan.incoming.travelProjections}</td><td>${plan.current.travelProjections}</td></tr>
          <tr><th>App-connection rows</th><td>${plan.incoming.connectorEntries}</td><td>${plan.current.connectorEntries}</td></tr></tbody></table>
        <p class="restore-review-outcome"><strong>${plan.replaceCurrent?'Current records will be REPLACED, not merged.':'Destination contains no local records.'}</strong> Both Work and Personal are restored together. ${plan.replaceCurrent?'An independently verified safety backup of the current library must remain valid.':''}</p>
        <p class="muted small">Drafts remain in their workspace; native KeepIt note bodies are not included. This is a local restore, NOT an approved cross-origin migration or cloud synchronization.</p>
        ${plan.sameGeneration?'<p class="muted small" role="status">Incoming and current libraries report the same generation; source origin remains unverified.</p>':''}
        ${plan.blockers.length?`<div class="notice restore-review-hold" role="alert"><strong>Restore blocked — unresolved source records.</strong><ul>${plan.blockers.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>Resolve owner-side KeepIt/TravelIt associations separately. No automatic import will occur.</div>`:''}
        <label class="field-label" for="restoreReviewPhrase">Type RESTORE to confirm local replacement</label>
        <input id="restoreReviewPhrase" type="text" maxlength="7" autocomplete="off" autocapitalize="characters" spellcheck="false" ${plan.localRestoreAllowed?'':'disabled'} />
        <p id="restoreReviewHelp" class="muted small">${plan.localRestoreAllowed?'No changes until you explicitly confirm.':'Confirm is disabled until source ownership and links are reconciled.'}</p>
        <div class="dialog-actions"><button type="button" id="restoreReviewCancel" class="button subtle">Cancel — keep current data</button>
          <button type="button" id="restoreReviewConfirm" class="button primary" disabled>Restore local records</button></div></div>`;
      document.body.append(dialog);
      const phrase=dialog.querySelector('#restoreReviewPhrase'),accept=dialog.querySelector('#restoreReviewConfirm');
      let settled=false;
      const finish=allowed=>{
        if(settled)return;settled=true;
        if(dialog.open)dialog.close();
        dialog.remove();
        resolve(allowed);
      };
      phrase.addEventListener('input',()=>{accept.disabled=!plan.localRestoreAllowed||phrase.value!=='RESTORE';});
      dialog.querySelector('#restoreReviewCancel').addEventListener('click',()=>finish(false));
      accept.addEventListener('click',()=>{if(plan.localRestoreAllowed&&phrase.value==='RESTORE')finish(true);});
      dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});
      dialog.addEventListener('close',()=>finish(false),{once:true});
      dialog.showModal();
      (plan.localRestoreAllowed?phrase:dialog.querySelector('#restoreReviewCancel')).focus();
    });
  }
  async function restoreLocal(file){
    if(!repository||!storageReady){notify('Database unavailable: restore disabled.');return;}
    if(composer.open||details.open||$('#restoreReviewDialog')?.open){notify('Close the open editor, details or restore review before restoring.');return;}
    if(!file||file.size>window.LiveItBackupCrypto.MAX_FILE_BYTES*1.5){notify('Invalid or oversized backup file.');return;}
    const unlocked=await requestPassphrase(false, async(passphrase)=>{
      const envelope=JSON.parse(await file.text());
      const snapshot=await window.LiveItBackupCrypto.open(envelope,passphrase);
      const info=window.LiveItLocalStore.validateBackup(snapshot,C);
      return {snapshot,info};
    });
    if(unlocked===null)return;
    try{
      const {snapshot,info}=unlocked;
      await draftQueue;await mutationQueue;
      await validateInTemporaryStore(snapshot);
      const currentSnapshot=await repository.exportContents();
      const currentMeta=currentSnapshot.stores.meta.find(row=>row.key==='state');
      if(!currentMeta || currentMeta.revision!==repository.revision)
        throw new Error('The library changed in another window; reload before restoring');
      const hasCurrent=Object.entries(currentSnapshot.stores).some(([name,rows])=>!['meta','spaces'].includes(name)&&rows.length>0);
      if(hasCurrent){
        // A download request or an in-memory cryptographic check is NOT a verified
        // on-disk safety backup. Only an independently re-opened download counts.
        const covered=!!verifiedBackup && verifiedBackup.dirty!==true &&
          verifiedBackup.revision===currentMeta.revision &&
          verifiedBackup.dbEpoch===currentMeta.initializedAt &&
          currentDatabaseEpoch===currentMeta.initializedAt;
        if(!covered){
          notify('Restore not started: first make an encrypted backup of your CURRENT library, then use “Verify saved backup file” to confirm the downloaded copy. Select Restore again afterward. No data was changed.');
          return;
        }
      }
      const plan=W12.restoreReview(window.LiveItLocalStore.canonicalBackup(snapshot),
        window.LiveItLocalStore.canonicalBackup(currentSnapshot));
      if(!await reviewLocalRestore(plan)){
        notify('Restore cancelled or held. Existing Work and Personal records unchanged.');return;
      }
      // A user may leave the review open while another tab writes. Check
      // the entire current library and the safety receipt again before commit.
      await draftQueue;await mutationQueue;
      const latestSnapshot=await repository.exportContents();
      const latestMeta=latestSnapshot.stores.meta.find(row=>row.key==='state');
      if(!latestMeta||latestMeta.revision!==currentMeta.revision||
        latestMeta.initializedAt!==currentMeta.initializedAt||
        latestMeta.revision!==repository.revision||
        !window.LiveItLocalStore.sameRestoredData(currentSnapshot.stores,latestSnapshot.stores))
        throw new Error('Local library changed during restore review. Reload and reverify a safety backup.');
      if(hasCurrent&&(!verifiedBackup||verifiedBackup.dirty===true||
        verifiedBackup.revision!==latestMeta.revision||
        verifiedBackup.dbEpoch!==latestMeta.initializedAt))
        throw new Error('Current-library safety backup was superseded during restore review');
      const result=await repository.restoreContents(snapshot,{allowReplace:!!hasCurrent});
      storeVerification(null);
      currentDatabaseEpoch=(await repository.exportContents()).stores.meta.find(row=>row.key==='state')?.initializedAt||null;
      const restored=await repository.loadConsistentSnapshot();
      data=restored.data;
      projections=[];
      for(const scope of ['work','personal']){cachedDrafts[scope]=restored.drafts[scope];parkedDrafts[scope]=restored.parked[scope];}
      ui.scope='personal';ui.taskKind='all';ui.view='today';ui.journalYear='all';ui.journalMonth='all';ui.journalQuery='';ui.category='';ui.query='';refreshClock();ui.selected=todayDate;
      render();notify('Restore VERIFIED: '+result.records+' records restored on this device. Not synced to cloud.');
    }catch(err){notify('Restore not completed: '+err.message+'. Existing records remain unless a committed readback warning was reported. Preserve your original backup.');}
  }
  $('#restoreFile').addEventListener('change',event=>{
    const chosen=event.target.files&&event.target.files[0];event.target.value='';
    if(chosen)void restoreLocal(chosen);
  });
  async function boot(){
    try {
      // W2 is isolated from the W1 synthetic-demo database. No implicit destructive migration.
      const outcome=await window.LiveItLocalStore.LocalStore.connect({indexedDB:window.indexedDB,core:C,name:'liveit_alpha_local_v1',seed:D.emptyData(C)});
      repository=outcome.store;
      // W17G: connect initialization and draft loading must not produce a
      // mixed-generation display if a second tab writes during app startup.
      const consistent=await repository.loadConsistentSnapshot();
      data=consistent.data;
      void purgeOrphanRestoreStages();
      // Initialize only a disconnected, capability-gated local connector.
      integrationGate=window.LiveItIntegrationGate.create({
        associationRepository:repository,
        KeepItPort:window.LiveItKeepItPort,
        TravelItStaging:window.LiveItTravelItStaging
      });
      // W5C: identify this database on ordinary boot, not only after a restore.
      currentDatabaseEpoch=consistent.dbEpoch;
      projections=[]; // W15: no trusted TravelIt ingress. Existing staging rows retained, never published or displayed.
      for(const scope of ['work','personal']){cachedDrafts[scope]=consistent.drafts[scope];parkedDrafts[scope]=consistent.parked[scope];}
      storageReady=true;storageIssue='';
    }catch(err){storageReady=false;storageIssue='Local database failed: '+err.message+'. Saves are disabled; copy any unsaved text.';}
    render();void inspectStorageProtection();return storageReady;
  }
  function refreshClock(){
    if(document.hidden)return false;
    const now=D.formatISODate(),minute=localMinute();
    if(now!==todayDate){
      const old=todayDate;todayDate=now;lastForegroundMinute=minute;
      if(ui.selected===old)ui.selected=now;
      render();return true;
    }
    if(minute===lastForegroundMinute)return false;
    lastForegroundMinute=minute;
    const slot=$('#foregroundReminderSlot');
    if(slot && ui.view==='today'&&ui.selected===todayDate){slot.innerHTML=foregroundReminderPanel(minute);return true;}
    return false;
  }
  window.addEventListener('focus',refreshClock);
  // W5C: detect external changes before trusting saved-backup freshness.
  async function checkExternalChanges(){
    if(!storageReady||!repository)return;
    try{
      if((await repository.getPersistedRevision())!==repository.revision){
        markBackupStale();externalChangeDetected=true;
        storageIssue='Another LiveIt window changed the library. Preserve your open draft before reloading.';
        render();
      }
    }catch{
      storageIssue='Unable to verify local library freshness. Keep an encrypted backup.';
      render();
    }
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){refreshClock();void checkExternalChanges();}});
  window.setInterval(refreshClock,60000);
  const ready=boot();
  const calendarPayload=r=>r.type==='event'?C.eventPayload(r):r._calendarSync?.outgoing?JSON.parse(r._calendarSync.outgoing):null;
  function calendarConflicts(){return data.records.filter(r=>r._calendarSync?.conflict);}
  function paintCalendarStatus(){
    const line=$('#calendarSyncStatus');if(line){line.dataset.phase=calendarSyncState.phase;line.innerHTML=esc(calendarSyncState.message)+' <button class="text-link" data-action="calendar-retry">Sync events</button>';}
    const label=$('.workspace-context-local');if(label&&label!==line)label.textContent=calendarSyncState.message;
    const panel=$('#calendarSyncConflicts');if(panel)panel.innerHTML=calendarConflicts().map(r=>`<div class="notice" style="margin:8px 16px" role="alert"><strong>Event changed on another device</strong><p>On this device: ${esc(r.body)}<br>Saved in KeepIt: ${esc(r._calendarSync.conflict.record.body)}</p><button class="button secondary" data-action="calendar-keep-both" data-id="${esc(r.id)}">Keep both versions</button></div>`).join('');
  }
  async function keepBothCalendar(id){
    if(composer.open||details.open){notify('Close the editor before resolving an event change.');return;}
    const conflict=data.records.find(r=>r.id===id),transfer=conflict?._calendarSync?.conflict?.record?.workspace!==conflict?.workspace?{id,from:conflict?.workspace,to:conflict?._calendarSync?.conflict?.record?.workspace}:null;
    try{await enqueueMutation(next=>{
      const local=next.records.find(r=>r.id===id),remote=local?._calendarSync?.conflict;if(!remote)return;
      if(local.type!=='event')throw Error('This entry was converted on this device. Its local text is retained; review the saved event separately.');
      const target=local._calendarSync.target,copy={...C.eventPayload(local),id:C.uid(),body:local.body+' (copy)',opId:C.uid(),createdAt:new Date().toISOString(),_calendarSync:{target,version:0,pending:true,operationId:crypto.randomUUID()}};
      Object.assign(local,remote.record,{_calendarSync:{target,version:remote.version,itemId:remote.itemId,digest:remote.digest,pending:false,syncedRecord:C.eventSignature(remote.record)}});
      next.records.unshift(copy);if(!next.operations.includes(copy.opId))next.operations.push(copy.opId);
    },{calendarImport:true,workspaceTransfer:transfer});render();window.dispatchEvent(new Event('liveit-calendar-change'));}catch(error){notify(error.message);}
  }
  const calendarAccess={
    ready:()=>ready,
    canSync:()=>!composer.open&&!details.open&&!saveInProgress&&!externalChangeDetected,
    async bind(target){
      const pending=mutationQueue.then(async()=>{
        await draftQueue;if(composer.open||details.open||saveInProgress)return false;if(externalChangeDetected){this.status('error','Reload the latest LiveIt library before syncing events.');return false;}
        if(!await repository.bindCalendarTarget(target)){this.status('wrong-library','Events belong to another KeepIt library. Reconnect that library to sync.');return false;}
        data=(await repository.load()).data;render();return true;
      });mutationQueue=pending.catch(()=>{});return pending;
    },
    pending(target){return data.records.filter(r=>r._calendarSync?.target===target&&r._calendarSync.pending&&!r._calendarSync.conflict).map(r=>{const record=calendarPayload(r);return record?{record,signature:JSON.stringify(record),receipt:{version:r._calendarSync.version||0,operationId:r._calendarSync.operationId}}:null;}).filter(Boolean);},
    conflicts:()=>calendarConflicts().length,
    status(phase,message){calendarSyncState={phase,message};paintCalendarStatus();},
    async merge(remote,target){
      if(composer.open||details.open||externalChangeDetected)return false;
      for(const saved of remote){
        const prior=data.records.find(r=>r.id===saved.record.id),transfer=prior&&prior.workspace!==saved.record.workspace&&!prior._calendarSync?.pending?{id:prior.id,from:prior.workspace,to:saved.record.workspace}:null;
        await enqueueMutation(next=>{
          let local=next.records.find(r=>r.id===saved.record.id);
          if(local?._calendarSync?.target&&local._calendarSync.target!==target)return;
          if(local?.type!=='event'&&local)return;
          if(local?._calendarSync?.pending){
            const signature=C.eventSignature(saved.record);
            if(signature===local._calendarSync.syncedRecord){local._calendarSync.version=saved.version;local._calendarSync.itemId=saved.itemId;local._calendarSync.digest=saved.digest;}
            else if(saved.version!==local._calendarSync.version&&signature!==C.eventSignature(local))local._calendarSync.conflict=saved;
            return;
          }
          const imported={...saved.record,_calendarSync:{target,itemId:saved.itemId,version:saved.version,digest:saved.digest,pending:false,syncedRecord:C.eventSignature(saved.record)}};
          if(local)Object.assign(local,imported);else{next.records.unshift(imported);if(!next.operations.includes(imported.opId))next.operations.push(imported.opId);}
        },{calendarImport:true,skipUnchanged:true,workspaceTransfer:transfer});
      }
      render();return true;
    },
    async ack(id,signature,saved,target){
      await enqueueMutation(next=>{
        const row=next.records.find(r=>r.id===id);if(!row||row._calendarSync?.target!==target)return;
        const matches=JSON.stringify(calendarPayload(row))===signature;
        row._calendarSync={...row._calendarSync,version:saved.version,itemId:saved.itemId,digest:saved.digest,syncedRecord:C.eventSignature(saved.record),pending:!matches};if(matches)delete row._calendarSync.conflict;
      },{calendarImport:true,skipUnchanged:true});paintCalendarStatus();
    },
    async conflict(id,saved,target){await enqueueMutation(next=>{const row=next.records.find(r=>r.id===id);if(row?._calendarSync?.target===target)row._calendarSync.conflict=saved;},{calendarImport:true,skipUnchanged:true});paintCalendarStatus();}
  };
  window.liveItCalendarAccess=Object.freeze(calendarAccess);

  window.liveItOwnedAccess=Object.freeze({ready:()=>ready,getRepository:()=>repository,getScope:()=>ui.scope,changed:()=>{markBackupStale();render();}});
  window.LiveItDemo=Object.freeze({
    waitReady:()=>ready,
    getPersistenceStatus:()=>({ready:storageReady,revision:repository?.revision||0,issue:storageIssue,db:'liveit_alpha_local_v1',persistentStorage,backupVerifiedCurrent:!!verifiedBackup&&!verifiedBackup.dirty&&verifiedBackup.revision===repository?.revision&&verifiedBackup.dbEpoch===currentDatabaseEpoch}),
    getVisibleText:()=>app.innerText,
    state:()=>JSON.parse(JSON.stringify(data)),
    getScope:()=>ui.scope,
    setSimulatedStorageFailure:(v)=>{failLocal=!!v;storageIssue=failLocal?'Simulated storage failure enabled for test.':'';render();},
    reset:()=>resetLocal(),
    openCapture:()=>openCapture(),
    scopedCount:(workspace)=>C.scoped(data,workspace).length,
    getTodayDate:()=>todayDate,
    getProjectionCount:()=>projections.length,
    getIntegrationCapabilities:()=>integrationGate?.capabilities() || Object.freeze({keepit:window.LiveItIntegrationGate?.NO_KEEPIT,travelit:window.LiveItIntegrationGate?.NO_TRAVELIT}),
    getDraftSummary:()=>({work:{current:!!readDraft('work'),parked:parkedDrafts.work.length},personal:{current:!!readDraft('personal'),parked:parkedDrafts.personal.length}})
  });
})();
