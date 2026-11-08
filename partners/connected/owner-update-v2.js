(() => {
 'use strict';
 // Carry the explicit connection request across Microsoft's registered callback.
 if(location.pathname.startsWith('/auth/callback')){
  if(window.parent===window&&!window.opener)sessionStorage.setItem('keepit-owner-connect-return','1');
  return;
 }
 // Replace the QA worker without deleting caches, databases or drafts.
 if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).then(registration=>registration.update()).catch(()=>{});
 const requested=new URL(location.href).searchParams.get('connect-onedrive')==='1'||sessionStorage.getItem('keepit-owner-connect-return')==='1';
 if(!requested)return;
 const deadline=Date.now()+20000;
 function consumed(){
  sessionStorage.removeItem('keepit-owner-connect-return');
  const url=new URL(location.href);url.searchParams.delete('connect-onedrive');history.replaceState(null,'',url.pathname+url.search+url.hash);
 }
 function openWhenReady(){
  const dialog=document.getElementById('onedrive-dialog');
  if(dialog?.open){consumed();return;}
  if(Date.now()>deadline||document.querySelector('dialog[open]'))return;
  const button=document.getElementById('connect-onedrive');
  if(button&&!button.disabled&&typeof button.onclick==='function'){
   button.click();
   if(dialog?.open){consumed();return;}
  }
  setTimeout(openWhenReady,100);
 }
 openWhenReady();
})();
