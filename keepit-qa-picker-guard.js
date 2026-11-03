/* KeepIt hosted QA folder-picker UI guard (2026-11-03).
   Defense-in-depth: core requireQaRepository stays authoritative.
   No library, token or content changes. */
(()=>{
 'use strict';
 const qaFolder='KeepIt-TK02-QA-2026-10-30';
 const target='OneDrive / '+qaFolder,root='OneDrive /';
 const dialog=document.getElementById('onedrive-dialog');
 const path=document.getElementById('onedrive-path');
 const folders=document.getElementById('onedrive-folders');
 const use=document.getElementById('onedrive-use');
 if(!dialog||!path||!folders||!use)return;
 const current=()=>String(path.textContent||'').trim();
 const atQa=()=>current()===target,atRoot=()=>current()===root;
 const exact=button=>String(button.textContent||'').replace(/^▱\s*/,'').replace(/\s*›\s*$/,'').trim()===qaFolder;
 function update(){
   if(!document.getElementById('onedrive-create-qa'))return;
   const root=atRoot(),qa=atQa();
   for(const button of folders.querySelectorAll('button.onedrive-folder')){
     const visible=root&&exact(button);
     if(button.hidden===visible)button.hidden=!visible;
   }
   for(const text of folders.querySelectorAll('p.fineprint')){
     if(text.textContent.includes('You can select this folder below.')&&text.hidden!==!qa)text.hidden=!qa;
   }
   if(use.hidden!==!qa)use.hidden=!qa;
   let notice=document.getElementById('keepit-qa-picker-notice');
   if(!notice){
     notice=document.createElement('p');
     notice.id='keepit-qa-picker-notice';
     notice.className='fineprint';
     notice.setAttribute('role','status');
     folders.append(notice);
   }
   const message=qa?'Protected QA folder selected. You can use this folder.':
     root?'Open the QA folder shown here, or select Create or open disposable QA folder.':
     'This location is not a QA library. Select Up to return to OneDrive root.';
   if(notice.textContent!==message)notice.textContent=message;
 }
 dialog.addEventListener('click',event=>{
   const button=event.target.closest?.('button');
   if(!button||!document.getElementById('onedrive-create-qa'))return;
   if(button.id==='onedrive-use'&&!atQa()){
     event.preventDefault();event.stopImmediatePropagation();update();return;
   }
   if(button.classList.contains('onedrive-folder')&&!(atRoot()&&exact(button))){
     event.preventDefault();event.stopImmediatePropagation();update();
   }
 },true);
 new MutationObserver(update).observe(dialog,{subtree:true,childList:true,characterData:true});
 update();
})();