import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {hashText} from './app-repository-store.mjs';
const source=readFileSync('partners/connected/app-repository-sync.mjs','utf8');
const methods=source.slice(source.indexOf(' async function openDeviceCopy('),source.indexOf(' async function changeFileState('));
function fixture({online=true,connected=true,failList=false,scope='scope'}={}){
 const actions=[],opened=[],copies=[],status={textContent:''};let cloudCalls=0,listCalls=0;
 const env={app:'thinkit',scopeKey:'selected',navigator:{onLine:online},showTrash:false,hashText,status,list:{replaceChildren(){actions.length=0;}},loadBinding:()=>scope?{scope}:null,localStorage:{getItem:()=>null},
  localFiles:async selected=>copies.filter(c=>c.scope===selected),action:(label,run)=>actions.push({label,run}),run:work=>work(),openCopy:async(copy,selected)=>opened.push({copy,scope:selected}),
  connected:async()=>{cloudCalls++;if(!connected)throw Error('Not connected');return {scope,repo:{list:async()=>{listCalls++;if(failList)throw Error('Microsoft unavailable');return [];}},isCurrent:()=>true};}};
 const api=vm.runInNewContext('(()=>{'+methods+';return {browse,browseDeviceCopies,openDeviceCopy};})()',env);
 return {api,env,actions,opened,copies,status,get cloudCalls(){return cloudCalls;},get listCalls(){return listCalls;}};
}
async function copy(f,overrides={}){const payload='{"project":"saved work"}',digest=await hashText(payload);const row={app:'thinkit',scope:'scope',title:'Saved project',key:'project-key',revision:'revision',parent:'root',payload,digest,...overrides};f.copies.push(row);return row;}
test('a Microsoft request failing after connection falls back to the last saved device copy',async()=>{
 const f=fixture({failList:true});await copy(f);await f.api.browse();
 assert.equal(f.listCalls,1);assert.match(f.status.textContent,/could not be reached/);assert.match(f.status.textContent,/Newer OneDrive changes are not included/);
 assert.equal(f.actions.length,1);assert.equal(f.opened.length,0);
 await f.actions[0].run();assert.equal(f.opened.length,1);assert.equal(f.opened[0].copy.title,'Saved project');
});
test('offline browsing and explicit device-copy browsing do not attempt to contact OneDrive',async()=>{
 for(const online of [false,true]){
  const f=fixture({online});await copy(f);
  if(online)await f.api.browseDeviceCopies();else await f.api.browse();
  assert.equal(f.cloudCalls,0);assert.equal(f.actions.length,1);
 }
});
test('only the latest saved revision of each file is offered alongside separate local recoveries',async()=>{
 const f=fixture({connected:false});await copy(f);await copy(f,{title:'Newer project',revision:'new-revision',parent:'revision'});
 const recovery=await copy(f,{title:'Independent local recovery',key:'recovery',localOnly:true});recovery.revision=await hashText(recovery.payload);
 await copy(f,{scope:'another-library',title:'Other library'});await f.api.browse();
 assert.deepEqual(f.actions.map(a=>a.label),['Newer project · device copy','Independent local recovery · device copy']);
 await f.actions[1].run();assert.equal(f.opened[0].copy.localOnly,true);
});
test('damaged or foreign device copies cannot replace the open project',async()=>{
 const f=fixture();const valid=await copy(f);
 await assert.rejects(()=>f.api.openDeviceCopy({...valid,payload:'damaged'},'scope'),/could not be verified/);
 await assert.rejects(()=>f.api.openDeviceCopy({...valid,app:'liveit'},'scope'),/does not belong/);
 await assert.rejects(()=>f.api.openDeviceCopy(valid,'other-scope'),/does not belong/);
 await assert.rejects(()=>f.api.openDeviceCopy(valid,'scope',()=>false),/folder changed/);
 assert.equal(f.opened.length,0);
});
test('a first-time device with no copies keeps current app work and explains what is available',async()=>{
 const f=fixture({scope:null});await f.api.browseDeviceCopies();
 assert.match(f.status.textContent,/current work remains in the app/);assert.equal(f.actions.length,0);assert.equal(f.cloudCalls,0);
});
