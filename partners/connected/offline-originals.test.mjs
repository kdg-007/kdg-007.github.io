import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {hashText} from './app-repository-store.mjs';
import {mountKeepItItemLinks} from './liveit-keepit-links.mjs';
import {offlineCopyLabel} from './offline-originals-ui.mjs';

const source=readFileSync('ops/ui/live-modules/onedrive-connection.js','utf8');
const plan=vm.runInNewContext('(()=>{'+source.slice(source.indexOf('function originalCacheItem('),source.indexOf('var N ='))+';return planOriginalCachePut;})()');
const scope=['account','drive','root','library'];
const key=(id,digest='v1',target=scope,path='FILE.txt')=>JSON.stringify(['original-v1',[...target,path],id,digest,10]);
const row=(id,bytes,pinned,used=1,target=scope)=>({key:key(id,'v1',target),bytes,pinned,used});
test('automatic cache eviction preserves explicitly kept files even when they are older',()=>{
 const first=row('kept',10,true),second=row('automatic',10,false,2);
 const p=plan([first,second],{key:key('new'),bytes:10,pinned:false,maxBytes:20,maxEntries:2});
 assert.deepEqual(Array.from(p.remove),[second.key]);assert.equal(p.pinned,false);
});
test('a full kept-copy budget fails before changing the previous copies',()=>{
 assert.throws(()=>plan([row('a',10,true),row('b',10,true)],{key:key('c'),bytes:1,pinned:true,maxBytes:20,maxEntries:3}),/full of kept copies/);
});
test('version replacement removes only this item’s kept copies in the exact library scope',()=>{
 const own=row('same',10,true),other=row('same',10,true,2,['account','drive','other-root','library']);
 const p=plan([own,other],{key:key('same','v2',scope,'NEW.txt'),bytes:10,pinned:true,maxBytes:20,maxEntries:2});
 assert.deepEqual(Array.from(p.remove),[own.key]);assert.equal(p.pinned,true);
});
test('ordinary reads of a kept version retain its kept policy',()=>{
 const p=plan([row('same',10,true)],{key:key('same'),bytes:10,pinned:false,maxBytes:20,maxEntries:2});
 assert.equal(p.pinned,true);assert.equal(p.remove.length,0);
});
test('an old browser tab cannot evict a newer kept revision of the same original',()=>{
 const newer={...row('same',10,true),itemVersion:3};
 assert.throws(()=>plan([newer],{key:key('same','old'),bytes:10,pinned:true,maxBytes:10,maxEntries:1,itemVersion:1}),/full of kept copies/);
});
test('cache accounting corruption fails without guessing how much pinned data to remove',()=>{
 assert.throws(()=>plan([{...row('kept',10,true),bytes:NaN}],{key:key('new'),bytes:1,pinned:true,maxBytes:20,maxEntries:2}),/accounting/);
});
test('availability distinguishes kept, automatic, outdated and missing copies',()=>{
 assert.match(offlineCopyLabel({available:true,pinned:true}),/^Kept offline/);
 assert.match(offlineCopyLabel({available:true,pinned:false}),/automatic cache/);
 assert.match(offlineCopyLabel({available:false,olderCopy:true}),/^Older offline copy/);
 assert.match(offlineCopyLabel({available:false}),/^Not saved/);
});
test('cached-library originals support ordinary documents and refuse missing bytes and closed libraries',async()=>{
 const Klass=vm.runInNewContext('('+source.slice(source.indexOf('z = class {')+4,source.indexOf('\nvar ue =')).replace(/;\s*$/,'')+')',{
  structuredClone,N:(s,t)=>JSON.stringify([s,t.id,t.digest]),d:(ok,msg)=>{if(!ok)throw Error(msg);},O:class{}
 });
 const file={id:'file',digest:'digest',bytes:4,mime:'text/plain',trashedAt:null};let stored=new Blob(['safe']);
 const lib=new Klass({homeId:'account',driveId:'drive',rootId:'root'},{identity:{libraryId:'library'},verified:{state:{items:[file],paths:{file:'FILE.txt'}}}},{originalCache:{get:async()=>stored?{blob:stored}:null}});
 assert.equal(await(await lib.original('file')).text(),'safe');stored=null;
 await assert.rejects(()=>lib.original('file'),/not available on this device/);await lib.close();
 await assert.rejects(()=>lib.original('file'),/last verified gallery/);
});

function bridgeFixture(){
 let loaded;const item={id:'a1000000-0000-4000-8000-000000000001',title:'Boarding pass',mime:'text/plain'};
 let pins=0,opens=0,library={isCloud:true,readOnly:true,getItem:async()=>item,list:async()=>[item],offlineStatus:async()=>({available:true,pinned:true}),keepOffline:async()=>{pins++;return {available:true,pinned:true};}};
 const document={},child={location:{pathname:'/partners/liveit/thinkit/connected-w18e-c15396/index.html'}};
 const frame={isConnected:true,contentWindow:child,contentDocument:document,addEventListener:(_,fn)=>{loaded=fn;}};
 const target='original-library';mountKeepItItemLinks({frame,getLibrary:()=>library,getTarget:async()=>target,openItem:async(_,expected)=>{assert.equal(expected,library);opens++;},isNote:()=>false});loaded();
 return {api:child.liveItKeepItLinks,item,target,get pins(){return pins;},get opens(){return opens;},setLibrary:value=>{library=value;}};
}
test('offline link reads retain scope validation and do not acquire a writable library',async()=>{
 const f=bridgeFixture(),ref={scope:'sha256:'+await hashText(f.target),itemId:f.item.id,title:f.item.title,kind:'file'};
 assert.equal((await f.api.offlineStatus(ref)).pinned,true);await f.api.open(ref);assert.equal(f.opens,1);
 await assert.rejects(()=>f.api.keepOffline({...ref,scope:'sha256:'+'0'.repeat(64)}),/original KeepIt library/);assert.equal(f.pins,0);
});
test('an already-open cloud library uses only verified device bytes when the browser is offline',async()=>{
 const start=source.indexOf('  async original(e) {',source.indexOf('  originalScope() {'));
 const method=source.slice(start,source.indexOf('  async thumbnailSource(e) {',start));
 const Klass=vm.runInNewContext('(class {'+method+'})',{navigator:{onLine:false},N:(s,t)=>JSON.stringify([s,t.id,t.digest]),d:(ok,msg)=>{if(!ok)throw Error(msg);}});
 const reader=new Klass(),blob=new Blob(['safe']);let permission=0,metadata=0;
 Object.assign(reader,{state:{items:[{id:'file',digest:'same',bytes:4}],paths:{file:'FILE.txt'}},originalLoads:new Map(),originalScope:()=>scope,
  permission:async()=>{permission++;},originalCache:{get:async()=>({blob,version:{id:'remote'}})},fs:{item:async()=>{metadata++;throw Error('Unexpected network access');}}});
 assert.equal(await reader.original('file'),blob);assert.equal(metadata,0);assert.equal(permission,2);
 reader.originalCache.get=async()=>null;await assert.rejects(()=>reader.original('file'),/not available on this device/);assert.equal(metadata,0);
});

test('changed remote metadata followed by a failed transfer retains the verified device copy',async()=>{
 const start=source.indexOf('  async original(e) {',source.indexOf('  originalScope() {'));
 const method=source.slice(start,source.indexOf('  async thumbnailSource(e) {',start));
 const Klass=vm.runInNewContext('(class {'+method+'})',{navigator:{onLine:true},N:(s,t)=>JSON.stringify([s,t.id,t.digest]),d:(ok,msg)=>{if(!ok)throw Error(msg);}});
 const reader=new Klass(),blob=new Blob(['safe']);let removed=0;
 Object.assign(reader,{state:{items:[{id:'file',digest:'same',bytes:4}],paths:{file:'FILE.txt'}},originalLoads:new Map(),originalScope:()=>scope,
  permission:async()=>{},originalCache:{get:async()=>({blob,pinned:true,version:{id:'remote',parentId:'files',eTag:'old',name:'FILE.txt'}}),remove:async()=>{removed++;}},
  fs:{item:async()=>({file:true,id:'remote',eTag:'new',size:4,name:'FILE.txt'}),validate:value=>value},thumbnailSource:async()=>{throw Error('Transfer unavailable');}});
 await assert.rejects(()=>reader.original('file'),/Transfer unavailable/);assert.equal(removed,0);
});
