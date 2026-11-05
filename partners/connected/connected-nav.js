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
 const nav=document.createElement('nav');
 nav.id='connected-apps-nav';nav.setAttribute('aria-label','Connected applications');
 const opener=document.createElement('button');
 opener.type='button';opener.id='connected-apps-toggle';opener.textContent='▦ Connected Apps';
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
 // KeepIt owns the native note operations, but LiveIt owns the visible workspace.
 // Present native note controls as an optional drawer instead of a fixed parent banner.
 // Keep the compiled KeepIt native host and all of its event handlers intact.
 function presentLiveItNoteTools(){
  if(current!=='liveit')return true;
  const host=document.querySelector('section[aria-label="LiveIt connected workspace"]');
  if(!host)return false;
  if(host.querySelector('#connected-note-tools'))return true;
  const header=host.querySelector(':scope > header');
  if(!header)return false;
  const oldReturn=[...header.querySelectorAll('button')].find(button=>button.textContent.trim()==='Return to KeepIt');
  oldReturn?.remove();
  const drawer=document.createElement('details');
  drawer.id='connected-note-tools';
  drawer.className='connected-note-tools';
  const summary=document.createElement('summary');
  summary.textContent='KeepIt notes';
  summary.setAttribute('aria-label','Open KeepIt note tools');
  header.replaceWith(drawer);
  drawer.append(summary,header);
  return true;
 }
 if(!presentLiveItNoteTools()){
  const observer=new MutationObserver(()=>{
   if(presentLiveItNoteTools())observer.disconnect();
  });
  observer.observe(document.body,{childList:true,subtree:true});
 }
 const note=document.createElement('p');note.className='connected-apps-notice';
 note.textContent='Native notes use KeepIt. Device save is not proof of OneDrive sync. Existing standalone app data is not migrated.';
 list.append(note);nav.append(opener,list);document.body.append(nav);
 opener.addEventListener('click',()=>{
  list.hidden=!list.hidden;opener.setAttribute('aria-expanded',String(!list.hidden));
 });
 document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&!list.hidden){list.hidden=true;opener.setAttribute('aria-expanded','false');opener.focus();}
 });
 document.addEventListener('click',e=>{
  if(!list.hidden&&!nav.contains(e.target)){list.hidden=true;opener.setAttribute('aria-expanded','false');}
 });
})();
