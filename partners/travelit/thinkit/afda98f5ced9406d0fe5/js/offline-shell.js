/** Independent, non-destructive check of TravelIt's installed offline app shell.
 * This checks CacheStorage entries, not future device persistence or map-navigation readiness.
 * Cache existence is NOT proof of an intact response body; do not label a successful check as permanent storage.
 */
export const SHELL_CACHE_NAME="travelit-foundation-shell-v0.29.0";
export const SHELL_ASSETS=Object.freeze(["./","./index.html","./css/style.css","./js/app.js","./js/db.js","./js/local-health.js","./js/offline-shell.js","./js/workspace-coordination.js","./js/domain.js","./js/keepit-associations.js","./js/liveit-projections.js","./js/backup.js","./js/restore-impact.js","./js/trip-brief.js","./js/trip-preparation.js","./js/on-the-road.js","./js/map-tools.js","./js/map-view.js","./js/offline-map-pack.js","./js/map-catalog.js","./js/map-navigation.js","./js/osm-street-import.js","./js/region-atlas.js","./js/atlas-pack-tools.js","./js/atlas-renderer.js","./js/packing-templates.js","./js/packing-interaction.js","./js/trip-costs.js","./js/travel-planning.js","./js/today-schedule.js","./icons/icon.svg","./manifest.webmanifest"]);


export const CONNECTED_SHELL_ASSETS=Object.freeze(['./','./index.html','./js/app-fast.js?v=map-focus-2','./css/style.css?v=excel-import-1','./css/workspace.css?v=map-focus-2','./vendor/leaflet/leaflet.js','./vendor/leaflet/leaflet.css','/partners/design/app-family-v1.css','/partners/design/app-appearance.css?v=workspace-2','/partners/design/app-appearance.js?v=journal-1','./js/excel-preview.js?v=excel-import-1','./js/excel-preview.js','./js/excel-preview-worker.js','./js/excel-reader.js','./js/excel-import-plan.js','./js/excel-save.js?v=trip-scope-1','./js/excel-metadata.js?v=excel-import-1','./js/domain.js','./js/domain.js?v=excel-import-1','./js/db.js?v=excel-import-1','./js/trip-dependencies.js','./js/trip-costs.js','./js/travel-planning.js','./js/keepit-associations.js','./js/backup.js?v=excel-import-1','./vendor/excel/reader-vendors.js','/partners/liveit/thinkit/connected-w18e-c15396/keepit-reference.js?v=1']);
async function connectedRegistration(serviceWorker,scope){
 const registration=await serviceWorker?.getRegistration?.(scope);
 return registration?.active?.scriptURL&&new URL(registration.active.scriptURL).pathname==='/sw.js'?registration:null;
}
export async function prepareOfflineShell({scope,fetcher=fetch,cacheStorage=globalThis.caches,serviceWorker=globalThis.navigator?.serviceWorker}={}){
 if(!await connectedRegistration(serviceWorker,scope))throw Error('Open TravelIt from LiveIt and reload online to prepare offline use.');
 const name='liveit-owner-shell-entry-v3';
 if(!(await cacheStorage.keys()).includes(name))throw Error('The offline app cache is still opening. Reload online and retry.');
 const cache=await cacheStorage.open(name);
 for(const path of CONNECTED_SHELL_ASSETS){
  const url=new URL(path,scope).href,response=await fetcher(url,{cache:'no-store'});
  if(!response.ok)throw Error('An offline app file could not be downloaded. Retry while connected.');
  await cache.put(url,response);
 }
 return verifyOfflineShell({scope,cacheStorage,serviceWorker});
}

/** Dependency injection is intentional: tests need no real service worker and cannot contact the network.
 * `scope` must be the service worker scope URL, never the current page query string.
 */
export async function verifyOfflineShell({cacheStorage=globalThis.caches,serviceWorker=globalThis.navigator?.serviceWorker,scope=globalThis.location?.origin+'/',registration=null}={}){
  const missing=[],faults=[];
  let controlled=Boolean(serviceWorker?.controller);
  if(!cacheStorage?.keys||!cacheStorage?.open){return {ready:false,controlled,cached:0,total:SHELL_ASSETS.length,missing:[...SHELL_ASSETS],reason:'CacheStorage is unavailable.'};}
  try{
    if(!registration && serviceWorker?.getRegistration) registration=await serviceWorker.getRegistration(scope);
    const connected=registration?.active?.scriptURL&&new URL(registration.active.scriptURL).pathname==='/sw.js';
    const cacheName=connected?'liveit-owner-shell-entry-v3':SHELL_CACHE_NAME,assets=connected?CONNECTED_SHELL_ASSETS:SHELL_ASSETS;
    if(!connected&&registration?.scope)scope=registration.scope;
    const keys=await cacheStorage.keys();
    if(!keys.includes(cacheName))return {ready:false,controlled,cached:0,total:SHELL_ASSETS.length,missing:[...SHELL_ASSETS],reason:'Current-version offline cache is missing.'};
    // Open only after keys() proves the named cache exists: avoid creating an empty cache as a side effect.
    const cache=await cacheStorage.open(cacheName);
    const root=new URL(scope);
    for(const asset of assets){
      const requestUrl=new URL(asset,root).href;
      try{const response=await cache.match(requestUrl);
        if(!response?.ok)missing.push(asset);
      }catch{missing.push(asset);faults.push(asset);}
    }
    const cached=assets.length-missing.length;
    const ready=controlled&&missing.length===0;
    const reason=!controlled?'The installed service worker does not control this page yet. Reload after installation.':missing.length?`${missing.length} offline file(s) are missing or invalid. Reload online to repair the cache.`:'Offline application files are cached in this browser. Device persistence is not guaranteed.';
    return {ready,controlled,cached,total:assets.length,missing,reason,faults};
  }catch(error){return {ready:false,controlled,cached:0,total:SHELL_ASSETS.length,missing:[...SHELL_ASSETS],reason:`Could not inspect offline cache: ${error?.message||'unknown error'}`};}
}
