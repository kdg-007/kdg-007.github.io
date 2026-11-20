import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
export async function checkOfflineOriginalCache(browser,origin){
 const context=await browser.newContext({ignoreHTTPSErrors:true,serviceWorkers:'block'});
 try{
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const page=await context.newPage();await page.exposeFunction('__setOriginalCacheOffline',offline=>context.setOffline(offline));await page.goto(origin+'/partners/connected/status.json');
  const path=JSON.parse(readFileSync('ops/ui/LIVE_STABILITY_MODULES.json')).paths.connection;
  const result=await page.evaluate(async path=>{
   const {OfflineOriginalCache:Cache,CachedOneDriveLibrary:Cached}=await import('/'+path);
   const cache=new Cache({name:'offline-originals-qa-'+crypto.randomUUID(),maxBytes:20,maxFileBytes:20,maxEntries:4});
   const scope=['owner','drive','root','library'];
   const digest=async blob=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(n=>n.toString(16).padStart(2,'0')).join('');
   const make=async(id,text,where=scope)=>{const blob=new Blob([text]),item={id,bytes:blob.size,digest:await digest(blob),mime:'text/plain',version:1};return {blob,item,key:JSON.stringify(['original-v1',[...where,'FILE-'+id+'.txt'],id,item.digest,item.bytes])};};
   const put=(row,pin=false)=>cache.put(row.key,row.item,row.blob,{id:'remote-'+row.item.id,eTag:'unchanged'},{pin});
   const get=row=>cache.get(row.key,row.item);
   const expect=(ok,message)=>{if(!ok)throw Error(message);};
   try{
    const a=await make('a','aaaaaaaaaa'),b=await make('b','bbbbbbbbbb'),c=await make('c','cccccccccc');
    await put(a,true);await put(b);await put(c);
    expect((await get(a))?.pinned,'Kept original was evicted by an automatic read');expect(!await get(b),'Automatic least-used original should be evicted');
    await put(c,true);let full=false;
    try{await put(await make('extra','x'),true);}catch(error){full=/full of kept copies/.test(error.message);}
    expect(full,'Kept-copy budget must reject overflow');expect(await get(a)&&await get(c),'Quota rejection removed a previous copy');
    const newer=await make('a','AAAAAAA');newer.item.version=2;await put(newer,true);
    expect(!await get(a),'Old kept version must be replaced only after the new copy fits');expect(await get(newer),'Updated kept original missing');
    let stale=false;try{await put(a,true);}catch{stale=true;}expect(stale&&await get(newer),'An older tab displaced the newer kept copy');
    const foreign=await make('a','fff',['owner','drive','other-root','library']);await put(foreign,true);
    await cache.removeItem(scope,'a');expect(!await get(newer),'Own device copy not removed');expect(await get(foreign),'Another library’s copy was removed');
    await cache.db.files.update(c.key,{blobData:new TextEncoder().encode('XXXXXXXXXX').buffer});expect(!await get(c),'Damaged cached bytes were accepted');
    expect(await get(foreign),'Corruption cleanup removed an unrelated copy');await put(a,true);
    const cached=new Cached({homeId:'owner',driveId:'drive',rootId:'root'},{identity:{libraryId:'library'},verified:{state:{items:[newer.item],paths:{a:'NEW-a.txt'}}}},{originalCache:cache});
    const status=await cached.offlineStatus('a');expect(!status.available&&status.olderCopy,'An old digest was labelled as the current file');
    let missing=false;try{await cached.original('a');}catch{missing=true;}expect(missing,'An old digest was substituted for the current original');
    await window.__setOriginalCacheOffline(true);
    const offlineCopy=await get(a);
    if(!offlineCopy){
     const raw=await cache.db.files.get(a.key);let blobRead;
     try{blobRead=await digest(new Blob([raw.blobData]));}catch(error){blobRead=error.name+': '+error.message;}
     throw Error('Fully offline cache read failed: '+JSON.stringify({present:!!raw,pinned:raw?.pinned,bytes:raw?.blobData?.byteLength,blobRead,expected:a.item.digest}));
    }
    expect(await offlineCopy.blob.text()==='aaaaaaaaaa','Offline bytes must remain previewable');
    await window.__setOriginalCacheOffline(false);
    return {protected:true,quotaSafe:true,scoped:true,corruptionRejected:true,olderVersionLabelled:true,fullyOffline:true};
   }finally{await cache.db.delete();}
  },path);
  assert.ok(Object.values(result).every(Boolean));
  console.log('KEEPIT_OFFLINE_ORIGINAL_REAL_INDEXEDDB_PIN_QUOTA_SCOPE_CORRUPTION_'+browser.browserType().name().toUpperCase()+'_PASS');
 }finally{await context.setOffline(false);await context.close();}
}
