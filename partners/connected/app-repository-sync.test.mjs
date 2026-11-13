import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
import {createSyncBindings} from './app-sync-bindings.mjs';
import {createAppRepository,hashText,newFileKey,projectFileKey,travelWorkspaceKey,findTravelWorkspace,liveWorkspaceKey,findLiveWorkspace} from './app-repository-store.mjs';

// Exercise the production coordinator, not a reimplementation of its decisions.
// Browser mounting is covered separately; these adapters model local editing and
// a OneDrive folder while the real revision store verifies every uploaded byte.
const source=readFileSync(new URL('./app-repository-sync.mjs',import.meta.url),'utf8');
const syncSource=source.slice(source.indexOf(' async function sync({'),source.indexOf(" action('Save current work as new file'"));
const runSource=source.slice(source.indexOf(' function run(work,'),source.indexOf(' async function snapshot()'));
const keyName=app=>'keepit-app-file-binding-v1:'+app;
function storage(){const values=new Map();return {get length(){return values.size;},key:index=>[...values.keys()][index]??null,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value))};}
function fixture(app='thinkit'){
 const shared=storage(),scope='a'.repeat(64),tree=new Map([['root',[]]]);
 let current=true,beforeWrite=null;
 const fs={allow(){},async child(id,name){return tree.get(id)?.find(item=>item.name===name)||null;},async children(id){return [...tree.get(id)||[]];},async folder(id,name){
  let item=await fs.child(id,name);if(!item){item={id:id+'/'+name,name,folder:{}};tree.get(id).push(item);tree.set(item.id,[]);}return item;
 },async create(id,name,blob){if(beforeWrite)await beforeWrite();const existing=await fs.child(id,name);if(existing)return existing;const item={id:id+'/'+name,name,file:{},blob};tree.get(id).push(item);return item;},async read(item){return item.blob;}};
 const repo=createAppRepository({app,library:{isCloud:true,fs,root:{item:{id:'root'}}},isCurrent:()=>current});
 return {app,shared,scope,repo,setCurrent:value=>current=value,setWrite:work=>beforeWrite=work,isCurrent:()=>current};
}
async function seed(f,payload='original',identity='project',title='Project'){
 const key=await projectFileKey(f.scope,identity,title),version=(await f.repo.save({key,parent:'root',title,payload})).envelope;
 const binding={scope:f.scope,key,identity,revision:version.revision,digest:version.digest};
 f.shared.setItem(keyName(f.app),JSON.stringify(binding));return binding;
}
function tab(f,payload='original',session=storage()){
 const bindings=createSyncBindings({storage:f.shared,session,key:keyName(f.app)});
 const state={payload,identity:'project',title:'Project',empty:false,revision:0};
 const messages=[],copies=[];
 const client={capture:async()=>({...state,token:state.revision}),syncStatus:message=>messages.push(message)};
 const env={app:f.app,folder:f.app,contentLabel:'Project',loadBinding:(...args)=>bindings.load(...args),saveBinding:value=>bindings.save(value),adapter:()=>client,
 connected:async()=>({scope:f.scope,repo:f.repo,isCurrent:f.isCurrent}),hashText,newFileKey,projectFileKey,travelWorkspaceKey,findTravelWorkspace,liveWorkspaceKey,findLiveWorkspace,lastRead:0,
 status:{textContent:''},saveSession:crypto.randomUUID(),resyncRequested:false,task:null,panel:{querySelectorAll:()=>[]},queueMicrotask,console,
 remember:async(scope,version)=>{copies.push(version);},Date,followups:0};
 env.openCopy=async(version,scope,isCurrent,{background=false}={})=>{
  const local=bindings.load(state.identity,scope);
  if(background&&!state.empty&&local?.digest!==await hashText(state.payload))return false;
  if(!isCurrent())throw Error('folder changed');
  state.payload=version.payload;state.empty=false;
  bindings.save({scope,key:version.key,revision:version.revision,digest:version.digest,identity:state.identity});return true;
 };
 const context=vm.createContext(env),sync=vm.runInContext('('+syncSource+')',context),run=vm.runInContext('('+runSource+')',context);
 env.auto=()=>{env.followups++;return run(()=>sync({quiet:true}),{quiet:true,retry:true});};
 return {sync,run,env,state,bindings,session,messages,copies};
}
const drain=()=>new Promise(resolve=>setImmediate(resolve));
function gate(){let release,entered;return {wait:new Promise(resolve=>entered=resolve),hold:new Promise(resolve=>release=resolve),release:()=>release(),enter:()=>entered()};}

test('a clean older tab pulls a newer save instead of uploading its older content',async()=>{
 const f=fixture(),first=await seed(f),older=tab(f),newer=tab(f,'newer edit');
 await newer.sync();await older.sync();
 assert.equal((await f.repo.openSingle(first.key)).version.payload,'newer edit');
 assert.equal(older.state.payload,'newer edit');
});
test('independent edits keep the last acknowledged parent and preserve the newer cloud save',async()=>{
 const f=fixture(),first=await seed(f),older=tab(f,'older tab edit'),newer=tab(f,'newer edit');
 await newer.sync();await older.sync();
 assert.equal((await f.repo.openSingle(first.key)).version.payload,'newer edit');
 assert.equal(older.state.payload,'older tab edit');assert.match(older.env.status.textContent,/conflicting version/);
 assert.equal(older.bindings.load().revision,first.revision);
});
test('the same tab keeps its baseline through reload after another tab saves',async()=>{
 const f=fixture(),first=await seed(f),older=tab(f,'older tab edit'),newer=tab(f,'newer edit');
 await newer.sync();const reloaded=tab(f,'older tab edit',older.session);await reloaded.sync();
 assert.equal(reloaded.bindings.load().revision,first.revision);
 assert.equal((await f.repo.openSingle(first.key)).version.payload,'newer edit');
});
test('switching projects retains the saved file association, including after a rename',async()=>{
 const f=fixture(),first=await seed(f),t=tab(f,'A edit');await t.sync();
 t.state.identity='B';t.state.title='B project';t.state.payload='B content';await t.sync();
 t.state.identity='project';t.state.title='Renamed A';t.state.payload='A later edit';await t.sync();
 const files=await f.repo.list();assert.equal(files.length,2);
 assert.equal((await f.repo.openSingle(first.key)).version.payload,'A later edit');
 assert.equal((await f.repo.openSingle(first.key)).version.title,'Renamed A');
 const fresh=tab(f,'A later edit');fresh.state.title='Renamed A';await fresh.sync();assert.equal((await f.repo.list()).length,2);
});
test('an edit made during upload receives another pass before the saved status',async()=>{
 const f=fixture(),first=await seed(f),t=tab(f,'first edit'),g=gate();
 f.setWrite(async()=>{f.setWrite(null);g.enter();await g.hold;});
 const pending=t.run(()=>t.sync({quiet:true}),{quiet:true,retry:true});await g.wait;
 t.state.payload='latest edit';t.state.revision++;g.release();await pending;
 assert.match(t.messages.at(-1),/pending/);
 await drain();await t.env.task;
 assert.equal((await f.repo.openSingle(first.key)).version.payload,'latest edit');
 assert.equal(t.env.followups,1);assert.match(t.messages.at(-1),/saved in KeepIt/);
});
test('many save notifications during an operation coalesce into one follow-up',async()=>{
 const f=fixture();await seed(f);const t=tab(f),g=gate();
 const pending=t.run(async()=>{g.enter();await g.hold;});await g.wait;
 for(let i=0;i<10;i++)t.run(()=>t.sync({quiet:true}),{quiet:true,retry:true});
 g.release();await pending;await drain();await t.env.task;
 assert.equal(t.env.followups,1);assert.equal(t.env.task,null);
});
test('network interruption leaves the baseline intact and retries without losing local edits',async()=>{
 const f=fixture(),first=await seed(f),t=tab(f,'offline edit');
 f.setWrite(async()=>{throw Error('Network unavailable');});await assert.rejects(()=>t.sync(),/Network unavailable/);
 assert.equal(t.bindings.load().revision,first.revision);assert.equal(t.state.payload,'offline edit');
 f.setWrite(null);await t.sync();assert.equal((await f.repo.openSingle(first.key)).version.payload,'offline edit');
});
test('a failed recovery cache does not discard the verified cloud receipt',async()=>{
 const f=fixture(),first=await seed(f),t=tab(f,'uploaded edit');
 t.env.remember=async()=>{throw Error('Device recovery cache is full');};
 await assert.rejects(()=>t.sync(),/cache is full/);const acknowledged=t.bindings.load();
 assert.notEqual(acknowledged.revision,first.revision);
 t.env.remember=async()=>{};await t.sync();
 assert.equal((await f.repo.openSingle(first.key)).version.revision,acknowledged.revision);
 assert.equal((await f.repo.heads(first.key)).length,1);
});
test('a folder switch during upload never adopts a receipt for the wrong folder',async()=>{
 const f=fixture(),first=await seed(f),t=tab(f,'local edit');
 f.setWrite(async()=>{f.setCurrent(false);});await assert.rejects(()=>t.sync(),/folder changed/);
 assert.equal(t.bindings.load().revision,first.revision);assert.equal(t.state.payload,'local edit');
});
test('tab isolation also protects TravelIt and LiveIt workspace saves',async()=>{
 for(const app of ['travelit','liveit']){
  const f=fixture(app),first=await seed(f),older=tab(f,'independent local edit'),newer=tab(f,'newer workspace');
  await newer.sync();await older.sync();
  assert.equal((await f.repo.openSingle(first.key)).version.payload,'newer workspace');
  assert.equal(older.state.payload,'independent local edit');
 }
});

test('LiveIt starts saving automatically and a fresh device reopens its workspace',async()=>{
 const f=fixture('liveit'),mac=tab(f,'tasks and journal');
 await mac.sync({quiet:true});const key=liveWorkspaceKey(f.scope);
 assert.equal((await f.repo.openSingle(key)).version.payload,'tasks and journal');
 const phone=tab({...f,shared:storage()},'blank');phone.state.identity='phone';phone.state.empty=true;
 await phone.sync({quiet:true});assert.equal(phone.state.payload,'tasks and journal');
 phone.state.payload='phone task edit';await phone.sync({quiet:true});
 mac.env.lastRead=0;await mac.sync({quiet:true});assert.equal(mac.state.payload,'phone task edit');
 assert.equal((await f.repo.list()).length,1);
});
test('LiveIt preserves independently created offline work on a second device',async()=>{
 const f=fixture('liveit'),mac=tab(f,'Mac journal');await mac.sync({quiet:true});
 const phone=tab({...f,shared:storage()},'offline phone task');phone.state.identity='phone';
 await phone.sync({quiet:true});
 assert.equal(phone.state.payload,'offline phone task');assert.match(phone.messages.at(-1),/review/);
 assert.equal((await f.repo.openSingle(liveWorkspaceKey(f.scope))).version.payload,'Mac journal');
 assert.equal(phone.bindings.load(),null);
});
test('LiveIt automatically reopens one legacy manual workspace, without guessing among copies',async()=>{
 const f=fixture('liveit'),old=await seed(f,'legacy journal'),phone=tab({...f,shared:storage()},'blank');phone.state.empty=true;
 await phone.sync({quiet:true});assert.equal(phone.state.payload,'legacy journal');assert.equal(phone.bindings.load().key,old.key);
 const second=newFileKey('Another workspace');await f.repo.save({key:second,parent:'root',title:'Another workspace',payload:'other'});
 const fresh=tab({...f,shared:storage()},'blank');fresh.state.empty=true;await fresh.sync({quiet:true});
 assert.equal(fresh.state.payload,'blank');assert.match(fresh.messages.at(-1),/choose/);
});
test('LiveIt automatic opening never resurrects a workspace in Trash',async()=>{
 const f=fixture('liveit'),mac=tab(f,'journal');await mac.sync();const binding=mac.bindings.load();await f.repo.trash(binding.key,binding.revision);
 const phone=tab({...f,shared:storage()},'offline entry');await phone.sync({quiet:true});
 assert.equal(phone.state.payload,'offline entry');assert.match(phone.messages.at(-1),/Trash/);
 assert.equal((await f.repo.openSingle(binding.key)).state,'deleted');
});
test('LiveIt reconnect retries an interrupted first save with the same file identity',async()=>{
 const f=fixture('liveit'),mac=tab(f,'offline tasks');f.setWrite(async()=>{throw Error('offline');});
 await assert.rejects(()=>mac.sync(),/offline/);const key=mac.bindings.load().key;
 f.setWrite(null);await mac.sync();assert.equal(mac.bindings.load().key,key);assert.equal((await f.repo.list()).length,1);
});

function liveAdapter(){
 const source=readFileSync(new URL('../liveit/thinkit/connected-w18e-c15396/app-8.js',import.meta.url),'utf8');
 const code=source.slice(source.indexOf('  async function captureKeepItLiveIt(){'),source.indexOf('  window.liveItOwnedAccess='));
 const event={id:'event',type:'event',opId:'event-op',date:'2026-11-13'},task={id:'task',type:'task',opId:'task-op'};
 let snapshot={stores:{meta:[{revision:5,initializedAt:'epoch'}],records:[event,task],spaces:[],note_associations:[{id:'event-link',entityType:'event'},{id:'task-link',entityType:'task'}],note_association_ops:[{associationId:'event-link'},{associationId:'task-link'}],operations:[{opId:'event-op'},{opId:'task-op'}],drafts:[{text:'unfinished draft'}]}};
 const repository={revision:5,exportContents:async()=>structuredClone(snapshot),restoreContents:async incoming=>{snapshot=structuredClone(incoming);repository.revision++;snapshot.stores.meta[0].revision=repository.revision;},loadConsistentSnapshot:async()=>({data:{},drafts:{work:null,personal:null},parked:{work:[],personal:[]}})};
 const env={window:{},ready:Promise.resolve(),storageReady:true,repository,composer:{open:false},details:{open:false},$:()=>null,workspaceSyncMessage:'',storeVerification(){},cachedDrafts:{},parkedDrafts:{},render(){},data:{}};
 vm.runInNewContext(code,env);return {client:env.window.keepItAppFiles,repository,snapshot:()=>snapshot};
}
test('LiveIt workspace transfer retains calendar events, their links, and unfinished drafts',async()=>{
 const t=liveAdapter(),before=await t.client.capture(),payload=JSON.parse(before.payload);
 assert.deepEqual(payload.records.map(r=>r.id),['task']);assert.deepEqual(payload.notes.map(r=>r.id),['task-link']);
 payload.records=[{id:'journal',type:'journal',opId:'journal-op'}];payload.notes=[];payload.noteOps=[];
 await t.client.open(JSON.stringify(payload),before.token);
 assert.deepEqual(t.snapshot().stores.records.map(r=>r.id),['event','journal']);
 assert.deepEqual(t.snapshot().stores.note_associations.map(r=>r.id),['event-link']);
 assert.deepEqual(t.snapshot().stores.drafts,[{text:'unfinished draft'}]);
});
test('LiveIt refuses an automatic open if local records changed since capture',async()=>{
 const t=liveAdapter(),before=await t.client.capture();t.repository.revision=6;
 await assert.rejects(()=>t.client.open(before.payload,4),/workspace changed/);
 assert.equal(t.snapshot().stores.records[1].id,'task');
});
