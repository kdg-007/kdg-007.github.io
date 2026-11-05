
(function(){
  'use strict';
  return; // KeepIt owns this integrated candidate's shell worker.
  if(!window.isSecureContext || location.protocol==='file:')return;
  window.addEventListener('load',async()=>{
    try{
      const reg=await navigator.serviceWorker.register('./sw.js',{scope:'./'});
      // Never skipWaiting automatically during an open note/draft.
      reg.addEventListener('updatefound',()=>{
        const worker=reg.installing;
        if(!worker)return;
        worker.addEventListener('statechange',()=>{
          if(worker.state==='installed'&&navigator.serviceWorker.controller){
            console.info('LiveIt shell update cached; close and reopen after saving/backup.');
          }
        });
      });
    }catch(err){console.warn('LiveIt install/offline shell unavailable:',err.message);}
  });
})();
