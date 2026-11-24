import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
const source=readFileSync(new URL('../../ops/ui/live-modules/onedrive-connection.js',import.meta.url),'utf8');
const classSource=source.slice(source.indexOf('var ve = class {')+9,source.indexOf('\nexport {',source.indexOf('var ve = class {'))).replace(/;\s*$/,'');
const createConnectionTrace=vm.runInNewContext('('+source.slice(source.indexOf('function createConnectionTrace('),source.indexOf('function legacyCatalogSource('))+')',{Date});
function fixture(){
 const nodes=new Map();
 const node=()=>({hidden:false,disabled:false,textContent:'',children:[],open:false,append(child){this.children.push(child);},replaceChildren(){this.children=[];},before(){},setAttribute(){},addEventListener(){},querySelectorAll(){return [...nodes.values()];},close(){this.open=false;},showModal(){this.open=true;}});
 const get=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);};
 let requests=0,responses=[];
 class Auth{constructor(){this.reconnectRequired=false;this.invalidations=0;}account(){return {homeAccountId:'owner'};}invalidateToken(){this.invalidations++;}async token(){return 'renewed';}}
 class FS{constructor(auth,{fetcher}){this.fetcher=fetcher;this.homeId='owner';}async initialize(){return {id:'root',name:'OneDrive'};}}
 const env={createConnectionTrace,x:class{},ae:Auth,ne:'id',q:false,O:class{},S:()=>({homeId:'owner',path:'KeepIt'}),H:error=>error.message,
 window:{addEventListener(){},dispatchEvent(){}},document:{getElementById:get,createElement:node,querySelector:()=>null},
 location:{href:'https://example.test/partners/connected/?connected-app=thinkit',origin:'https://example.test'},
 sessionStorage:{setItem(){}},URL,Headers,AbortController,Response,Date,setTimeout,clearTimeout,
 re:async work=>work(),_:FS,fetch:async()=>{requests++;return new Response('',{status:responses.shift()??200});}};
 const Connection=vm.runInNewContext('('+classSource+')',env),c=new Connection({ready:async()=>{},pause:async()=>{},canChange:()=>true,progress(){},disconnected:async()=>{}});
 c.publish=(phase,message)=>{c.phase=phase;c.message=message;};c.stack=[{id:'root',name:'OneDrive'}];
 return {c,get,env,setResponses:value=>responses=value,get requests(){return requests;}};
}
test('failed navigation keeps the last loaded path and lets the user retry it',async()=>{
 const {c,get}=fixture();let fail=false;
 const folder={id:'docs',name:'Documents',folder:{}};
 c.fs={async children(id){if(fail)throw Error('Temporary network interruption');return id==='root'?[folder]:[];}};
 await c.browse();const button=get('onedrive-folders').children[0];
 fail=true;await button.onclick();assert.equal(c.stack.at(-1).id,'root');assert.equal(get('onedrive-path').textContent,'OneDrive / ');
 assert.equal(get('onedrive-folders').children[0],button);assert.equal(get('onedrive-use').disabled,true);
 fail=false;await button.onclick();assert.equal(c.stack.at(-1).id,'docs');assert.equal(c.listedFolderId,'docs');assert.equal(get('onedrive-use').disabled,false);
});
test('failed Up navigation retains the current loaded folder',async()=>{
 const {c,get}=fixture();c.stack.push({id:'docs',name:'Documents'});c.fs={children:async()=>[]};await c.browse();
 c.fs.children=async()=>{throw Error('OneDrive unavailable');};await get('onedrive-up').onclick();
 assert.equal(c.stack.at(-1).id,'docs');assert.match(get('onedrive-path').textContent,/Documents/);assert.equal(get('onedrive-use').disabled,false);
});
test('Retry reloads the current picker folder without reconnecting or resetting selection',async()=>{
 const {c,get}=fixture();c.stack.push({id:'docs',name:'Documents'});let listed;
 c.fs={children:async id=>{listed=id;return [];}};c.selecting=true;c.start=async()=>{throw Error('Unexpected library reconnect');};
 await get('onedrive-retry').onclick();assert.equal(listed,'docs');assert.equal(c.listedFolderId,'docs');
});
test('an unlisted folder cannot be selected, including after a failed initial request',async()=>{
 const {c}=fixture();c.stack.push({id:'unread',name:'Unread'});c.fs={children:async()=>{throw Error('offline');}};
 await assert.rejects(()=>c.browse(),/offline/);await assert.rejects(()=>c.choose(),/Load this folder/);
});
test('an outdated listing cannot replace a newer connection',async()=>{
 const {c}=fixture();let finish;const wait=new Promise(resolve=>finish=resolve);
 c.fs={children:async()=>wait};const pending=c.browse();c.fs={children:async()=>[]};finish([]);
 await assert.rejects(()=>pending,/connection changed/);assert.equal(c.listedFolderId,undefined);
});
test('expired access is renewed once and a successful retry preserves the connection',async()=>{
 const f=fixture();await f.c.connectFiles();f.c.bound=true;f.c.transportWaiting=true;f.setResponses([401,200]);
 const result=await f.c.fs.fetcher('https://graph.microsoft.com/v1.0/me/drive',{headers:{Authorization:'Bearer expired'}});
 assert.equal(result.status,200);assert.equal(f.requests,2);assert.equal(f.c.auth.invalidations,1);assert.equal(f.c.phase,'connected');assert.equal(f.c.auth.reconnectRequired,false);
});
test('a second rejection requests sign-in without further automatic retries',async()=>{
 const f=fixture();await f.c.connectFiles();f.c.bound=true;f.setResponses([401,401]);
 const result=await f.c.fs.fetcher('https://graph.microsoft.com/v1.0/me/drive');
 assert.equal(result.status,401);assert.equal(f.requests,2);assert.equal(f.c.phase,'signin');assert.equal(f.c.auth.reconnectRequired,true);
 let starts=0;f.c.start=async()=>{starts++;return false;};await f.c.show();assert.equal(starts,1);assert.doesNotMatch(f.get('onedrive-message').textContent,/^Connected to/);
});
test('opening a healthy connection only shows details and does not restart it',async()=>{
 const {c}=fixture();c.bound=true;c.fs={};c.start=async()=>{throw Error('Unexpected reconnect');};assert.equal(await c.show(),true);
});

function rememberedReconnect(){
 const f=fixture(), savedRoot={id:'saved-root',name:'KeepIt'};
 const binding={homeId:'owner',driveId:'saved-drive',rootId:savedRoot.id,path:'Documents / KeepIt'};
 const errors=[];let pickerOpens=0;
 f.env.S=()=>binding;f.c.prepareAuth=async()=>{};f.c.progress=event=>{if(event.error)errors.push(event.error);};
 f.c.connectFiles=async()=>{f.c.fs={driveId:binding.driveId,item:async()=>savedRoot};};
 f.c.browse=async()=>{pickerOpens++;};
 return {...f,savedRoot,binding,errors,get pickerOpens(){return pickerOpens;}};
}

test('a missing catalog item keeps the saved library selected and retry reopens that library',async()=>{
 const f=rememberedReconnect(), attempts=[];
 f.c.selecting=true;
 f.c.bindLibrary=async(root,path)=>{
  attempts.push([root.id,path]);
  if(attempts.length===1)throw Object.assign(Error('Catalog file missing'),{details:{status:404}});
  return true;
 };
 assert.equal(await f.c.restore({interactive:true}),false);
 assert.match(f.errors[0]??'',/Catalog file missing/);
 assert.equal(f.pickerOpens,0);
 assert.equal(f.c.selecting,false);
 await f.get('onedrive-retry').onclick();
 assert.deepEqual(attempts,[[f.savedRoot.id,f.binding.path],[f.savedRoot.id,f.binding.path]]);
});

test('a missing saved folder still opens the picker',async()=>{
 const f=rememberedReconnect();
 const connect=f.c.connectFiles;
 f.c.connectFiles=async()=>{
  await connect();f.c.fs.item=async()=>{throw Object.assign(Error('Folder missing'),{details:{status:404}});};
 };
 f.c.bindLibrary=async()=>assert.fail('A missing folder cannot be opened');
 assert.equal(await f.c.restore({interactive:true}),false);
 assert.equal(f.pickerOpens,1);
 assert.equal(f.c.selecting,true);
 assert.equal(f.c.phase,'choose-folder');
});

test('a stalled metadata body times out and releases the connection for a successful retry',async()=>{
 const f=fixture();await f.c.connectFiles();f.c.bound=true;
 f.env.re=async work=>{let timer;try{return await Promise.race([work(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('metadata body timed out')),15);})]);}finally{clearTimeout(timer);}};
 f.env.fetch=async(_,options)=>new Response(new ReadableStream({start(controller){
  controller.enqueue(new TextEncoder().encode('{"value":'));
  options.signal.addEventListener('abort',()=>controller.error(Error('aborted')),{once:true});
 }}),{headers:{'Content-Type':'application/json'}});
 await assert.rejects(()=>f.c.fs.fetcher('https://graph.microsoft.com/v1.0/me/drive'),/timed out/);
 assert.equal(f.c.bound,true);assert.equal(f.c.transportWaiting,true);
 f.env.fetch=async()=>new Response('{"id":"same-drive"}');
 assert.deepEqual(await (await f.c.fs.fetcher('https://graph.microsoft.com/v1.0/me/drive')).json(),{id:'same-drive'});
 assert.equal(f.c.transportWaiting,false);assert.equal(f.c.phase,'connected');
});
test('rejected authenticated saves renew once and preserve their method, bytes and concurrency guards',async()=>{
 for(const method of ['POST','PUT','PATCH']){
  const f=fixture();await f.c.connectFiles();f.c.bound=true;const calls=[];
  f.env.fetch=async(url,options)=>{calls.push({url,options});return new Response('{}',{status:calls.length===1?401:200});};
  const body=new Blob(['same pending save']);
  const result=await f.c.fs.fetcher('https://graph.microsoft.com/v1.0/drives/drive/items/item',{method,body,headers:{Authorization:'Bearer expired','If-Match':'original-etag'}});
  assert.equal(result.status,200);assert.equal(calls.length,2);assert.equal(f.c.auth.invalidations,1);
  assert.equal(calls[1].options.method,method);assert.equal(calls[1].options.body,body);
  assert.equal(new Headers(calls[1].options.headers).get('If-Match'),'original-etag');
  assert.equal(new Headers(calls[1].options.headers).get('Authorization'),'Bearer renewed');
 }
});
test('upload-session transfer URLs never receive a Microsoft bearer or an automatic replay',async()=>{
 const f=fixture();await f.c.connectFiles();f.c.bound=true;let calls=0;
 f.env.fetch=async(_,options)=>{calls++;assert.equal(new Headers(options.headers).has('Authorization'),false);return new Response('{}',{status:401});};
 const result=await f.c.fs.fetcher('https://fixture.storage.live.com/upload-session',{method:'PUT',body:new Blob(['fragment'])});
 assert.equal(result.status,401);assert.equal(calls,1);assert.equal(f.c.auth.invalidations,0);
});
test('renewal requiring sign-in is not overwritten by a generic waiting message',async()=>{
 const f=fixture();await f.c.connectFiles();f.c.bound=true;
 f.env.fetch=async()=>new Response('{}',{status:401});
 f.c.auth.token=async()=>{f.c.auth.reconnectRequired=true;throw Object.assign(Error('Sign in needed'),{code:'AUTH_REQUIRED'});};
 await assert.rejects(()=>f.c.fs.fetcher('https://graph.microsoft.com/v1.0/me/drive'),/Sign in/);
 assert.equal(f.c.phase,'signin');assert.equal(f.c.bound,true);
});

test('download transport failures are classified without storing signed URLs or credentials',async()=>{
 const f=fixture();await f.c.connectFiles();
 const signedUrl='https://sample.files.1drv.com/download?token=PRIVATE-SIGNATURE';
 f.env.fetch=async()=>{throw Error('Simulated browser transport failure');};
 await assert.rejects(()=>f.c.fs.fetcher(signedUrl),/Simulated browser transport failure/);
 assert.equal(f.c.lastNetworkFailure?.kind,'transfer');
 assert.doesNotMatch(JSON.stringify(f.c.lastNetworkFailure),/PRIVATE-SIGNATURE|files\\.1drv\\.com|Bearer/);
});
test('a rejected signed download can use credential-free XHR and preserve the bytes',async()=>{
 const f=fixture();await f.c.connectFiles();let fetches=0,xhrs=0;
 f.env.fetch=async()=>{fetches++;throw TypeError('Fetch download blocked');};
 f.env.XMLHttpRequest=class{
  open(method,url,async){assert.equal(method,'GET');assert.equal(url,'https://sample.files.1drv.com/signed');assert.equal(async,true);}
  setRequestHeader(){assert.fail('Signed downloads must not add authentication or preflight headers');}
  send(){xhrs++;assert.equal(this.withCredentials,false);assert.equal(this.responseType,'blob');assert.equal(this.timeout,20000);this.status=200;this.response=new Blob(['verified original bytes']);this.onload();}
 };
 const response=await f.c.fs.fetcher('https://sample.files.1drv.com/signed',{method:'GET',signal:new AbortController().signal});
 assert.equal(await response.text(),'verified original bytes');assert.equal(fetches,1);assert.equal(xhrs,1);
 assert.equal(f.c.lastNetworkFailure,undefined);
});
test('failed uploads and cancelled downloads never enter XHR recovery',async()=>{
 for(const method of ['PUT','POST','PATCH','DELETE','GET']){
  const f=fixture();await f.c.connectFiles();const controller=new AbortController();
  if(method==='GET')controller.abort();
  f.env.fetch=async()=>{throw TypeError('Interrupted request');};
  f.env.XMLHttpRequest=class{constructor(){assert.fail('Request must not be replayed');}};
  await assert.rejects(()=>f.c.fs.fetcher('https://sample.storage.live.com/signed',{method,signal:controller.signal}),/Interrupted request/);
 }
});
test('XHR recovery failure retains the safe transfer diagnostic',async()=>{
 const f=fixture();await f.c.connectFiles();
 f.env.fetch=async()=>{throw TypeError('Rejected download');};
 f.env.XMLHttpRequest=class{open(){}send(){this.onerror();}};
 await assert.rejects(()=>f.c.fs.fetcher('https://sample.files.1drv.com/signed?secret=hidden'),/Rejected download/);
 assert.deepEqual(JSON.parse(JSON.stringify(f.c.lastNetworkFailure)),{kind:'transfer'});
});
test('Graph transport failures are distinguished from signed-file download failures',async()=>{
 const f=fixture();await f.c.connectFiles();
 f.env.fetch=async()=>{throw Error('Simulated Graph network failure');};
 await assert.rejects(()=>f.c.fs.fetcher('https://graph.microsoft.com/v1.0/me/drive'),/Simulated Graph network failure/);
 assert.equal(f.c.lastNetworkFailure?.kind,'graph');
});

test('a null OneDrive catalog original produces a safe readback error, not null.size',async()=>{
 const start=source.indexOf('V = class {'),end=source.indexOf('\nvar G',start);
 assert.ok(start>0&&end>start,'Directory adapter source boundary must remain present');
 const Directory=vm.runInNewContext('('+source.slice(start+4,end).replace(/;\s*$/,'')+')',{
  Blob,d:(ok,message)=>{if(!ok)throw Error(message);},B:()=>Error('Not found')
 });
 const adapter={children:async()=>[{id:'snapshot',name:'0000000001-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.json',file:{}}],
  read:async()=>null,directory:()=>null};
 const folder=new Directory(adapter,{id:'commits',name:'commits'});
 const entry=await(async()=>{for await(const [,item] of folder.entries())return item;})();
 await assert.rejects(()=>entry.getFile(),/KI-OD-NULL-FILE/);
 const healthy=new Blob(['safe unchanged original']);
 let attempts=0;
 adapter.read=async()=>++attempts===1?null:healthy;
 const item=await(async()=>{for await(const [,file] of folder.entries())return file;})();
 assert.equal(await item.getFile(),healthy);
 assert.equal(attempts,2,'Transient null cache result must recover with exactly one read-only bypass');
});

const readOneDriveChunk = vm.runInNewContext(
  '(' + source.slice(source.indexOf('async function readOneDriveChunk'), source.indexOf('function originalCacheItem')) + ')',
  {setTimeout, clearTimeout}
);
test('a stalled download body releases the caller even if transport cancellation hangs', async () => {
  let cancelled = 0;
  const never = new Promise(() => {});
  const reader = {read: () => never, cancel: () => { cancelled++; return never; }};
  await assert.rejects(readOneDriveChunk(reader, 5), /KI-OD-READ-TIMEOUT/);
  assert.equal(cancelled, 1);
  assert.match(source, /await readOneDriveChunk\(u\)/);
});
test('each arriving download chunk gets its own idle deadline', async () => {
  let chunks = 0;
  const reader = {async read() { return {value: ++chunks, done: false}; }};
  assert.equal((await readOneDriveChunk(reader)).value, 1);
  assert.equal((await readOneDriveChunk(reader)).value, 2);
});

test('an offline background reopen waits without sign-in and then restores the same folder online',async()=>{
 const f=rememberedReconnect();
 f.env.navigator={onLine:false};
 f.env.ye=()=>true;
 let signIns=0;
 f.c.prepareAuth=async()=>{signIns++;};
 assert.equal(await f.c.start(),false);
 assert.equal(f.c.phase,'waiting');
 assert.equal(signIns,0);
 f.env.navigator.onLine=true;
 const attempts=[];
 f.c.bindLibrary=async(root,path)=>{attempts.push([root.id,path]);return true;};
 assert.equal(await f.c.start(),true);
 assert.equal(signIns,1);
 assert.deepEqual(attempts,[[f.savedRoot.id,f.binding.path]]);
 assert.equal(f.pickerOpens,0);
});
