(() => {
 'use strict';
 // The application owns connection intent and callback handling. This helper
 // only replaces the retired worker; it never clicks or opens a dialog.
 if('serviceWorker' in navigator&&location.protocol==='https:')
  navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).catch(()=>{});
})();
