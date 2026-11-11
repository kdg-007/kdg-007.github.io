// Connected first-party navigation, intentionally separate from KeepIt's note writer.
// App switching is user-initiated and opens another tab to protect unfinished drafts.
(() => {
 'use strict';
 const modes=Object.freeze([
  {id:'liveit',label:'LiveIt',help:'Today, tasks and journal'},
  {id:'keepit',label:'KeepIt',help:'Canonical notes and files'},
  {id:'thinkit',label:'ThinkIt',help:'Mind maps and diagrams'},
  {id:'travelit',label:'TravelIt',help:'Trips and activities'}
 ]);
 // No app selector means the LiveIt dashboard, never a KeepIt library landing page.
 // KeepIt itself remains available only through the explicit app launcher.
 const selected=new URLSearchParams(location.search).getAll('connected-app');
 if(selected.length!==1 || !modes.some(mode=>mode.id===selected[0])){
  location.replace('/partners/connected/?connected-app=liveit');
  return;
 }
 const current=selected[0];
 document.documentElement.dataset.connectedApp=current;
 const nav=document.createElement('nav');
 nav.id='connected-apps-nav';nav.setAttribute('aria-label','Connected applications');
 const opener=document.createElement('button');
 opener.type='button';opener.id='connected-apps-toggle';opener.textContent='▦ Apps';
 opener.setAttribute('aria-expanded','false');opener.setAttribute('aria-controls','connected-apps-list');
 opener.setAttribute('title','Open another app without closing LiveIt');
 const list=document.createElement('div');list.id='connected-apps-list';list.hidden=true;
 for(const mode of modes){
  const link=document.createElement('a');
  const target=new URL('/partners/connected/',location.origin);
  target.searchParams.set('connected-app',mode.id);
  link.href=target.pathname+target.search;
  link.target='_blank';link.rel='noopener noreferrer';
  link.textContent=mode.label;
  link.title='Open '+mode.label+' in a new tab; existing drafts stay open';
  link.setAttribute('aria-current',mode.id===current?'page':'false');
  const small=document.createElement('small');small.textContent=mode.help;
  link.append(small);list.append(link);
 }
 // Note tools live in the shared Apps menu, not on top of the LiveIt canvas.
 if(current!=='keepit'){
  const toolsButton=document.createElement('button');
  toolsButton.id='connected-note-tools-toggle';
  toolsButton.type='button';
  toolsButton.textContent='Notes & integration';
  toolsButton.setAttribute('aria-controls','connected-note-tools');
  toolsButton.setAttribute('aria-expanded','false');
  toolsButton.title='Open KeepIt native note tools for this application';
  toolsButton.addEventListener('click',()=>{
   const drawer=document.getElementById('connected-note-tools');
   if(!drawer)return;
   drawer.open=!drawer.open;
   toolsButton.setAttribute('aria-expanded',String(drawer.open));
   list.hidden=true;
   opener.setAttribute('aria-expanded','false');
  });
  list.append(toolsButton);
 }
 const connection=document.createElement('button');
 connection.type='button';connection.id='connected-cloud-status';connection.hidden=true;
 connection.setAttribute('aria-live','polite');
 connection.addEventListener('click',()=>document.getElementById('connect-onedrive')?.click());
 const updateConnection=detail=>{
  if(!detail?.message)return;
  connection.hidden=false;
  const labels={connected:'KeepIt connected',connecting:'Connecting…',waiting:'Sync waiting',signin:'Reconnect KeepIt','choose-folder':'Choose KeepIt folder',error:'Connection needs attention'};
  connection.textContent=labels[detail.phase]||'KeepIt connection';
  connection.setAttribute('aria-label',detail.message);
  connection.dataset.phase=detail.phase;
  connection.title=detail.message+' · Open connection details';
 };
 window.addEventListener('keepit-connection-state',event=>updateConnection(event.detail));
 updateConnection(window.keepItConnectionState);
 const cloudButton=document.createElement('button');cloudButton.type='button';cloudButton.textContent='OneDrive connection';cloudButton.id='connected-onedrive-toggle';cloudButton.addEventListener('click',()=>{list.hidden=true;opener.setAttribute('aria-expanded','false');document.getElementById('connect-onedrive')?.click();});list.append(cloudButton);
 function mountShellBar(host){
  document.title=current==='liveit'?'LiveIt — Today':modes.find(mode=>mode.id===current).label+' — LiveIt';
  const bar=document.createElement('div');
  bar.className='connected-shell-bar';
  bar.setAttribute('role','navigation');
  bar.setAttribute('aria-label','Application workspace');
  const home=document.createElement('a');
  home.className='connected-shell-home';
  home.href='/partners/connected/?connected-app=liveit';
  home.target='_blank';home.rel='noopener noreferrer';
  home.textContent='LiveIt';
  home.title='Open LiveIt home, leaving current drafts intact';
  if(current==='liveit')home.setAttribute('aria-current','page');
  const app=document.createElement('strong');
  app.className='connected-shell-current';
  app.textContent=current==='liveit'?'Today':modes.find(mode=>mode.id===current).label;
  bar.append(home,app,connection,nav);
  host.prepend(bar);
  host.dataset.connectedUi='ready';
  const finishOpening=()=>{
   delete document.documentElement.dataset.connectedStarting;
   window.dispatchEvent(new Event('connected-workspace-ready'));
  };
  const frame=host.querySelector('iframe');
  const reserve=()=>{
   const width=Math.ceil(bar.getBoundingClientRect().width)+24;
   host.style.setProperty('--connected-controls-width',width+'px');
   try{frame?.contentDocument?.documentElement.style.setProperty('--connected-controls-width',width+'px');}catch{}
  };
  new ResizeObserver(reserve).observe(bar);window.addEventListener('resize',reserve);
  if(frame)frame.addEventListener('load',reserve);
  reserve();
  if(frame){
   frame.addEventListener('load',finishOpening,{once:true});
   if(frame.contentDocument?.readyState==='complete'&&frame.contentDocument.URL!=='about:blank')finishOpening();
  }else finishOpening();
 }
 function presentConnectedWorkspace(){
  if(current==='keepit'){
   const library=document.querySelector('.library-main');
   if(!library)return false;
   mountShellBar(library);
   return true;
  }
  const host=current==='thinkit'
    ?document.getElementById('thinkit-host-panel')
    :document.querySelector('section[aria-label="'+(current==='liveit'?'LiveIt':'TravelIt')+' connected workspace"]');
  const header=host?.querySelector(':scope > header');
  if(!header)return false;
  const oldReturn=[...header.querySelectorAll('button')].find(button=>button.textContent.trim()==='Return to KeepIt');
  oldReturn?.remove();
  const drawer=document.createElement('details');
  drawer.id='connected-note-tools';
  drawer.className='connected-note-tools';
  const summary=document.createElement('summary');
  summary.textContent='KeepIt notes';
  summary.setAttribute('aria-label','Close KeepIt note tools');
  header.replaceWith(drawer);
  drawer.append(summary,header);
  mountShellBar(host);
  drawer.addEventListener('toggle',()=>{
   const toggle=document.getElementById('connected-note-tools-toggle');
   if(toggle)toggle.setAttribute('aria-expanded',String(drawer.open));
  });
  return true;
 }
 const note=document.createElement('p');note.className='connected-apps-notice';
 note.textContent='Native notes use KeepIt. Device save is not proof of OneDrive sync. Existing standalone app data is not migrated.';
 list.append(note);nav.append(opener,list);document.body.append(nav);
 if(!presentConnectedWorkspace()){
  const observer=new MutationObserver(()=>{
   if(presentConnectedWorkspace())observer.disconnect();
  });
  observer.observe(document.body,{childList:true,subtree:true});
 }
 opener.addEventListener('click',()=>{
  list.hidden=!list.hidden;opener.setAttribute('aria-expanded',String(!list.hidden));
 });
 document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&!list.hidden){list.hidden=true;opener.setAttribute('aria-expanded','false');opener.focus();}
 });
 document.addEventListener('click',e=>{
  if(!list.hidden&&!nav.contains(e.target)){list.hidden=true;opener.setAttribute('aria-expanded','false');}
 });
 const wired=new WeakSet(),documents=new Set();
 function dismiss(source,target,escape=false){
  let closed=false;
  for(const doc of documents){
   if(doc!==document&&!doc.defaultView?.frameElement?.isConnected){documents.delete(doc);continue;}
   const inside=element=>!escape&&source===doc&&target&&element?.contains(target);
   const apps=doc.getElementById('connected-apps-list'),toggle=doc.getElementById('connected-apps-toggle');
   if(apps&&!apps.hidden&&!inside(apps)&&!inside(toggle)){
    apps.hidden=true;toggle?.setAttribute('aria-expanded','false');if(escape)toggle?.focus();closed=true;
   }
   const drawer=doc.getElementById('connected-note-tools');
   if(drawer?.open&&!inside(drawer)&&!inside(doc.getElementById('connected-note-tools-toggle'))){drawer.open=false;closed=true;}
   for(const menu of doc.querySelectorAll('details.action-menu[open],details.note-command-menu[open],details.apps-menu[open]')){
    if(!inside(menu)){menu.open=false;if(escape)menu.querySelector('summary')?.focus();closed=true;}
   }
   const popup=doc.getElementById('diMenuPopup');
   if(popup&&!popup.hidden&&!inside(doc.getElementById('diMenuBar'))){const trigger=doc.querySelector('#diMenuTabs [aria-expanded=true]');if(trigger){trigger.click();if(escape)trigger.focus();}closed=true;}
   const more=doc.getElementById('more-menu');
   if(more&&!more.hidden&&!inside(more)&&!inside(doc.getElementById('more-trigger'))){more.hidden=true;doc.getElementById('more-trigger')?.setAttribute('aria-expanded','false');closed=true;}
  }
  return closed;
 }
 function wire(doc){
  if(!doc||wired.has(doc))return;wired.add(doc);documents.add(doc);
  doc.addEventListener('pointerdown',event=>dismiss(doc,event.target),true);
  doc.addEventListener('keydown',event=>{
   if(event.key==='Escape'&&dismiss(doc,event.target,true)){event.preventDefault();event.stopPropagation();}
  },true);
  doc.addEventListener('click',event=>{
   const menu=doc.getElementById('connected-apps-list');
   if(menu?.contains(event.target)&&event.target.closest('a,button'))queueMicrotask(()=>{menu.hidden=true;doc.getElementById('connected-apps-toggle')?.setAttribute('aria-expanded','false');});
  },true);
  const scan=()=>doc.querySelectorAll('iframe').forEach(frame=>{
   if(!frame.dataset.dismissWired){frame.dataset.dismissWired='true';frame.addEventListener('load',()=>{try{wire(frame.contentDocument);}catch{}});}
   try{wire(frame.contentDocument);}catch{}
  });
  new MutationObserver(scan).observe(doc,{childList:true,subtree:true});scan();
 }
 wire(document);
})();
