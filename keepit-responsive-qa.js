/* KeepIt QA app buttons and collapsible mobile tools. No storage/auth changes. */
(()=>{
'use strict';
// The branch-backed Pages publisher regenerates index.html. Keep the legacy
// route migration here in the stable extension loaded by that generated page.
const appIds=['liveit','keepit','thinkit','travelit'];
const requested=new URLSearchParams(location.search).getAll('connected-app');
if(location.pathname==='/'&&requested.length===1&&appIds.includes(requested[0])){
 const destination=new URL('/partners/connected/',location.origin);
 destination.search=location.search;
 destination.hash=location.hash;
 location.replace(destination.pathname+destination.search+destination.hash);
 return;
}
// Root KeepIt remains the separate notes/files workspace by default.
document.addEventListener('click',event=>{
 if(location.pathname!=='/')return;
 const original=event.target?.closest?.('#thinkit-launch');
 if(!original)return;
 event.preventDefault();
 event.stopImmediatePropagation();
 window.open('/partners/connected/?connected-app=thinkit','_blank','noopener,noreferrer');
},true);
const mobile=window.matchMedia('(max-width:700px)');
let navReady=false,qaReady=false,observer;
function enhanceNav(){
 if(navReady)return true;
 const header=document.querySelector('.library-top');
 const heading=header?.querySelector('.toolbar-heading');
 const think=header?.querySelector('#thinkit-launch');
 const travel=header?.querySelector('#connected-travelit-launch');
 const live=header?.querySelector('#connected-liveit-launch');
 if(!header||!heading||!think||!travel||!live)return false;
 header.querySelector('#connected-thinkit-launch')?.remove();
 const nav=document.createElement('nav');nav.className='keepit-app-launchers';nav.setAttribute('aria-label','Connected applications');
 function button(anchor,label){
  const url=new URL(anchor.getAttribute('href'),document.baseURI);
  if(url.origin!==new URL(document.baseURI).origin||url.pathname!=='/'||url.searchParams.get('connected-app')!==label.toLowerCase())return null;
  const b=document.createElement('button');b.type='button';b.className='secondary keepit-app-button';b.textContent=label;b.title='Open '+label+' in a new tab';
  const connected=new URL('/partners/connected/',url.origin);
  connected.searchParams.set('connected-app',label.toLowerCase());
  b.addEventListener('click',()=>{window.open(connected.href,'_blank','noopener,noreferrer');});
  return b;
 }
 const travelButton=button(travel,'TravelIt'),liveButton=button(live,'LiveIt');
 if(!travelButton||!liveButton)return false;
 travel.remove();live.remove();nav.append(think,travelButton,liveButton);
 const place=()=>{if(mobile.matches)header.append(nav);else heading.append(nav)};
 place();mobile.addEventListener?.('change',place);
 navReady=true;return true;
}
function enhanceQa(){
 if(qaReady)return true;
 const panel=document.querySelector('aside[aria-label="Private QA recovery controls"]');
 if(!panel)return false;
 panel.id='keepit-private-qa-panel';panel.dataset.qaOpen='false';
 const toggle=document.createElement('button');toggle.type='button';toggle.className='keepit-qa-toggle';toggle.textContent='QA tools';toggle.setAttribute('aria-controls',panel.id);toggle.setAttribute('aria-expanded','false');
 toggle.addEventListener('click',()=>{
  const open=panel.dataset.qaOpen!=='true';panel.dataset.qaOpen=String(open);
  toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'Close QA':'QA tools';
 });
 // This is an owner-facing library, not a perpetual engineering test console.
 // The recovery tools remain explicitly available through the ?qa=1 URL.
 toggle.hidden=new URLSearchParams(location.search).get('qa')!=='1';
 document.body.append(toggle);qaReady=true;return true;
}
function apply(){enhanceNav();enhanceQa();if(navReady&&qaReady)observer?.disconnect()}
function init(){observer=new MutationObserver(apply);observer.observe(document.body,{childList:true,subtree:true});apply()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();