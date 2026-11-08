(() => {
 'use strict';
 const current=new URL(location.href);
 const apps=['liveit','keepit','thinkit','travelit'];
 const modes=current.searchParams.getAll('connected-app');
 const connect=current.searchParams.get('connect-onedrive')==='1'||current.searchParams.get('keepit-linked')==='1';
 const mode=modes.length===1&&apps.includes(modes[0])?modes[0]:connect?'keepit':'liveit';
 const destination=new URL('/partners/connected/',current.origin);
 destination.searchParams.set('connected-app',mode);
 for(const key of ['connect-onedrive','keepit-linked','text','url','title']){
  const value=current.searchParams.get(key);if(value!==null)destination.searchParams.set(key,value);
 }
 destination.hash=current.hash;
 location.replace(destination.pathname+destination.search+destination.hash);
})();
