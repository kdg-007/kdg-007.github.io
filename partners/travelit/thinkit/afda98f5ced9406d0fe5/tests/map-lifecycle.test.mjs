import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createStreetMapLoader} from '../js/street-map-loader.js';

function fixture(timeoutMs=1000){
 let runtime;const scripts=[];
 const document={createElement:()=>({remove(){this.removed=true;}}),head:{append:script=>scripts.push(script)}};
 return {scripts,ready(){runtime={map(){}};},load:createStreetMapLoader({document,getRuntime:()=>runtime,timeoutMs})};
}
test('street-map requests share one load, while an existing runtime needs no request',async()=>{
 const f=fixture(),a=f.load(),b=f.load();assert.equal(a,b);assert.equal(f.scripts.length,1);
 f.ready();f.scripts[0].onload();assert.ok(await a);assert.ok(await f.load());assert.equal(f.scripts.length,1);
});
test('failed and timed-out runtime downloads release for an explicit retry',async()=>{
 const f=fixture(),first=f.load();f.scripts[0].onerror();await assert.rejects(first,/could not load/);assert.equal(f.scripts[0].removed,true);
 const next=f.load();assert.equal(f.scripts.length,2);f.ready();f.scripts[1].onload();await next;
 const slow=fixture(5);await assert.rejects(slow.load(),/timed out/);assert.equal(slow.scripts[0].removed,true);
 const retry=slow.load();slow.ready();slow.scripts[1].onload();await retry;
});
test('a script load without a map runtime is reported as unavailable',async()=>{
 const f=fixture(),pending=f.load();f.scripts[0].onload();await assert.rejects(pending,/did not initialize/);
});

const source=readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
const refreshFunction=source.slice(source.indexOf('async function externalRefresh(){'),source.indexOf('function scheduleExternalRefresh(){'));
function refreshFixture(info,{modal=false,fail=false}={}){
 const calls=[];const state={db:{},workspaceEpoch:'generation-1',workspaceRevision:7,mapRevision:3};
 const context=vm.createContext({state,versionObsolete:false,localOperationDepth:0,externalRenderPending:false,
  getWorkspaceMetadata:async()=>{calls.push('metadata');if(fail)throw Error('read failed');return info;},
  refresh:async()=>calls.push('records'),render:()=>calls.push('render'),showExternalChangeNotice:()=>calls.push('notice'),
  toast:()=>calls.push('error'),scheduleExternalRefresh:()=>calls.push('schedule'),
  $:()=>({classList:{contains:()=>!modal}})});
 vm.runInContext(refreshFunction+';this.run=externalRefresh;',context);return {calls,run:context.run};
}
test('returning with unchanged data avoids a full read, false edit warnings and map replacement',async()=>{
 for(const modal of [false,true]){const f=refreshFixture({epoch:'generation-1',revision:7,mapRevision:3},{modal});await f.run();assert.deepEqual(f.calls,['metadata']);}
});
test('other-tab edits, map changes and restored generations still refresh',async()=>{
 for(const info of [{epoch:'generation-1',revision:8,mapRevision:3},{epoch:'generation-1',revision:7,mapRevision:4},{epoch:'generation-2',revision:7,mapRevision:3}]){
  const f=refreshFixture(info);await f.run();assert.deepEqual(f.calls,['metadata','records','render']);
 }
 const editing=refreshFixture({epoch:'generation-1',revision:8,mapRevision:3},{modal:true});await editing.run();assert.deepEqual(editing.calls,['metadata','records','notice']);
 const failed=refreshFixture(null,{fail:true});await failed.run();assert.deepEqual(failed.calls,['metadata','error']);
});
