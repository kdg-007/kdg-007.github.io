import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
const source=readFileSync(new URL('../../ops/ui/live-modules/onedrive-connection.js',import.meta.url),'utf8');
const classSource=source.slice(source.indexOf('var ve = class {')+9,source.indexOf('\nexport {',source.indexOf('var ve = class {'))).replace(/;\s*$/,'');
function fixture(){
 const nodes=new Map();
 const node=()=>({hidden:false,disabled:false,textContent:'',children:[],open:false,append(child){this.children.push(child);},replaceChildren(){this.children=[];},before(){},setAttribute(){},addEventListener(){},querySelectorAll(){return [...nodes.values()];},close(){this.open=false;},showModal(){this.open=true;}});
 const get=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);};
 let requests=0,responses=[];
 class Auth{constructor(){this.reconnectRequired=false;this.invalidations=0;}account(){return {homeAccountId:'owner'};}invalidateToken(){this.invalidations++;}async token(){return 'renewed';}}
 class FS{constructor(auth,{fetcher}){this.fetcher=fetcher;this.homeId='owner';}async initialize(){return {id:'root',name:'OneDrive'};}}
 const env={x:class{},ae:Auth,ne:'id',q:false,O:class{},S:()=>({homeId:'owner',path:'KeepIt'}),H:error=>error.message,
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
 assert.deepEqual(f.c.lastNetworkFailure,{kind:'transfer'});
 assert.doesNotMatch(JSON.stringify(f.c.lastNetworkFailure),/PRIVATE-SIGNATURE|files\\.1drv\\.com|Bearer/);
});
test('Graph transport failures are distinguished from signed-file download failures',async()=>{
 const f=fixture();await f.c.connectFiles();
 f.env.fetch=async()=>{throw Error('Simulated Graph network failure');};
 await assert.rejects(()=>f.c.fs.fetcher('https://graph.microsoft.com/v1.0/me/drive'),/Simulated Graph network failure/);
 assert.deepEqual(f.c.lastNetworkFailure,{kind:'graph'});
});
