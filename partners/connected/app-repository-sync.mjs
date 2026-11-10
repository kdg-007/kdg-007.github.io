import {APP_FOLDERS,createAppRepository,hashText,newFileKey,travelWorkspaceKey,findTravelWorkspace} from './app-repository-store.mjs?v=trip-sync-1';
import {mountTravelCalendar} from './travel-calendar.mjs?v=1';

const FRAMES={
 thinkit:'/thinkit/36f8901ec722db162bcf/index.html',
 liveit:'/partners/liveit/thinkit/connected-w18e-c15396/index.html',
 travelit:'/partners/travelit/thinkit/afda98f5ced9406d0fe5/index.html'
};
const request=req=>new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
let cache;
async function cacheRecords(mode,work){
 if(!cache){
  const open=indexedDB.open('keepit-app-file-copies-v1',1);
  open.onupgradeneeded=()=>open.result.createObjectStore('files',{keyPath:'cacheKey'}).createIndex('scopeKey','scopeKey');
  cache=request(open).catch(error=>{cache=null;throw error;});
 }
 const db=await cache, tx=db.transaction('files',mode);
 const done=new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('Local copy transaction failed.'));});
 try{const value=await work(tx.objectStore('files'));await done;return value;}
 catch(error){await done.catch(()=>{});throw error;}
}
function make(tag,label,into){const element=document.createElement(tag);element.textContent=label;into.append(element);return element;}

export function mountAppRepository({getLibrary}){
 const app=new URL(location.href).searchParams.get('connected-app'),folder=APP_FOLDERS[app];
 if(!Object.hasOwn(FRAMES,app)||!folder)return;
 const settingsKey=`keepit-app-file-binding-v1:${app}`;
 const loadBinding=()=>{try{return JSON.parse(localStorage.getItem(settingsKey)||'null');}catch{return null;}};
 const saveBinding=value=>localStorage.setItem(settingsKey,JSON.stringify(value));
 const scopeKey=`${settingsKey}:scope`;
 const appFrame=()=>{
  const frame=[...document.querySelectorAll('iframe')].find(node=>new URL(node.src,location.href).pathname===FRAMES[app]);
  try{if(frame?.contentWindow.location.origin===location.origin&&frame.contentWindow.location.pathname===FRAMES[app])return frame;}catch{}
  return null;
 };
 const adapter=()=>appFrame()?.contentWindow?.keepItAppFiles;
 const syncTravelCalendar=app==='liveit'?mountTravelCalendar({frame:appFrame,getLibrary}):null;
 const connected=async()=>{
  const library=getLibrary();
  if(!library?.isCloud||library.readOnly)throw Error('Connect your KeepIt folder to browse or sync files on OneDrive.');
  const scope=await hashText(JSON.stringify([library.fs.homeId,library.fs.driveId,library.root.item.id]));
  const isCurrent=()=>getLibrary()===library;
  if(!isCurrent())throw Error('The selected KeepIt folder changed.');
  localStorage.setItem(scopeKey,scope);
  return {scope,repo:createAppRepository({app,library,isCurrent}),isCurrent};
 };
 const remember=async(scope,envelope)=>cacheRecords('readwrite',async store=>{
  const scopeKey=`${app}:${scope}`,prefix=`${scopeKey}:${envelope.key}:`;
  await request(store.put({cacheKey:prefix+envelope.revision,scopeKey,scope,app,...envelope}));
  if(envelope.parent!=='root')await request(store.delete(prefix+envelope.parent));
 });
 const localFiles=scope=>cacheRecords('readonly',store=>request(store.index('scopeKey').getAll(`${app}:${scope}`)));
 const panel=document.createElement('dialog');panel.className='settings-dialog';panel.setAttribute('aria-label',`${folder} files in KeepIt`);
 panel.style.cssText='width:min(480px,92vw);max-height:82dvh;overflow:auto;padding:18px';
 make('h2',`${folder} files`,panel);
 make('p',`KeepIt / ${folder}`,panel);
 const status=make('p','Choose a file to open, or save your current work here.',panel);status.setAttribute('role','status');
 const controls=make('div','',panel);controls.style.cssText='display:flex;flex-wrap:wrap;gap:8px';
 const action=(label,run,into=controls)=>{
  const button=make('button',label,into);button.type='button';button.className='secondary';
  button.addEventListener('click',()=>void run());return button;
 };
 const list=make('div','',panel);list.style.cssText='display:grid;gap:8px;margin-top:14px';
 document.body.append(panel);
 let task=null;
 function run(work,{quiet=false}={}){
  if(task)return task;
  task=Promise.resolve().then(work).catch(error=>{
   status.textContent=error.message||'App file operation failed.';
   adapter()?.syncStatus?.(status.textContent);
   if(!quiet)console.warn('KeepIt app files:',error.message);
  }).finally(()=>{task=null;});
  return task;
 }
 async function snapshot(){const client=adapter();if(!client)throw Error(`${folder} is still opening.`);return client.capture();}
 async function browse(){
  list.replaceChildren();
  const binding=loadBinding();
  let cloud;
  try{cloud=await connected();}catch(error){
   const scope=binding?.scope||localStorage.getItem(scopeKey);
   if(!scope)throw error;
   const copies=await localFiles(scope);
   for(const row of copies.filter(copy=>!copies.some(next=>next.key===copy.key&&next.parent===copy.revision))){
    action(`${row.title} · local copy`,()=>run(()=>openCopy(row,scope)),list);
   }
   status.textContent=copies.length?'Showing copies saved on this device.':'Connect to KeepIt to browse files.';
   return;
  }
  const files=await cloud.repo.list();
  for(const file of files)action(file.title,()=>run(async()=>{
   const heads=await cloud.repo.heads(file.key);
   if(!heads.length)throw Error('This file has no complete revision yet.');
   if(heads.length===1){const version=await cloud.repo.open(file.key,heads[0].id);await openCopy(version,cloud.scope,cloud.isCurrent);return;}
   list.replaceChildren();status.textContent='Conflicting versions were preserved. Choose a version to open.';
   for(const head of heads)action(`Open version ${head.modified||head.id.slice(0,8)}`,()=>run(async()=>{
    await openCopy(await cloud.repo.open(file.key,head.id),cloud.scope,cloud.isCurrent);
   }),list);
  }),list);
  for(const row of (await localFiles(cloud.scope)).filter(row=>row.localOnly))action(row.title,()=>run(()=>openCopy(row,cloud.scope,cloud.isCurrent)),list);
  status.textContent=files.length?'Choose a file in KeepIt.':'This folder is empty. Save your current work to create its first file.';
 }
 async function openCopy(version,scope,isCurrent=()=>true,{background=false}={}){
  const client=adapter();if(!client)throw Error(`${folder} is still opening.`);
  if(version.kind==='map'){
   if(!isCurrent())throw Error('The selected KeepIt folder changed.');
   await remember(scope,version);await client.installMap(version.payload);
   status.textContent=`Installed “${version.title}” for offline use on this device.`;return;
  }
  const current=await client.capture({opening:true}), binding=loadBinding();
  const currentDigest=current&&await hashText(current.payload);
  if(current&&!current.empty&&!(binding?.scope===scope&&binding.key===version.key&&binding.digest===currentDigest)){
   if(background)return false;
   if(!window.confirm(`Open “${version.title}” in ${folder}? Your current work will be kept as a local recovery copy.`))return;
   const key=newFileKey(current.title), revision=await hashText(current.payload);
   await remember(scope,{key,title:`${current.title} (local recovery)`,payload:current.payload,revision,parent:'root',localOnly:true});
  }
  if(!isCurrent())throw Error('The selected KeepIt folder changed.');
  await remember(scope,version);
  if(!isCurrent())throw Error('The selected KeepIt folder changed.');
  const applied=await client.open(version.payload,current?.token);
  saveBinding(version.localOnly?null:{scope,key:version.key,revision:version.revision,digest:await hashText(applied.payload),identity:applied.identity});
  status.textContent=`Opened “${version.title}” in ${folder}.`;
  if(!background)panel.close();
  return true;
 }
 let lastRead=0;
 async function sync({newFile=false,quiet=false}={}){
  let binding=loadBinding();
  if(!newFile&&!binding&&app!=='travelit'){if(quiet)return;throw Error('Use Save current work to create a KeepIt file first.');}
  const client=adapter();if(!client){if(quiet)return;throw Error(`${folder} is still opening.`);}
  const current=await client.capture();if(!current){if(quiet)return;throw Error('Open a saved workspace or project first.');}
  if(!newFile&&!binding&&app==='travelit'){
   if(quiet&&Date.now()-lastRead<15000)return;
   lastRead=Date.now();
   const cloud=await connected(), found=await findTravelWorkspace(cloud.repo);
   if(found.state==='ready'){
    const digest=await hashText(current.payload);
    if(current.empty){if(await openCopy(found.version,cloud.scope,cloud.isCurrent,{background:true}))adapter()?.syncStatus?.('Trips opened from KeepIt.');return;}
    if(digest===found.version.digest){
     saveBinding({scope:cloud.scope,key:found.version.key,revision:found.version.revision,digest,identity:current.identity});
     adapter()?.syncStatus?.('Trips saved in KeepIt.');return;
    }
    adapter()?.syncStatus?.('Trips are saved on this device. Open TravelIt files to review the KeepIt workspace.');
    if(!quiet)throw Error('This device has its own trips. Open the KeepIt workspace explicitly to keep a local recovery copy.');
    return;
   }
   if(found.state==='review'){
    adapter()?.syncStatus?.('Open TravelIt files to choose a KeepIt workspace.');
    if(!quiet)throw Error('Choose which TravelIt workspace to open from KeepIt.');
    return;
   }
   if(current.empty){adapter()?.syncStatus?.('No saved TravelIt workspace found in KeepIt.');return;}
   const key=travelWorkspaceKey(cloud.scope);
   if(!cloud.isCurrent())return;
   binding={scope:cloud.scope,key,revision:'root',digest:'',identity:current.identity};
   saveBinding(binding);
  }
  if(!newFile&&binding.identity!==current.identity){if(quiet)return;throw Error('Save this work as a new KeepIt file.');}
  const digest=await hashText(current.payload);
  const clean=!newFile&&digest===binding.digest;
  if(clean&&quiet&&Date.now()-lastRead<(app==='travelit'?15000:60000))return;
  const cloud=await connected();
  if(!newFile&&cloud.scope!==binding.scope)throw Error('This file is linked to a different KeepIt folder.');
  if(clean){
   lastRead=Date.now();
   const heads=await cloud.repo.heads(binding.key);
   if(heads.length===1&&heads[0].id!==binding.revision){
    const newer=await cloud.repo.open(binding.key,heads[0].id);
    if(await openCopy(newer,cloud.scope,cloud.isCurrent,{background:true}))adapter()?.syncStatus?.('Trips updated from KeepIt.');
   }else if(heads.length!==1)status.textContent='Review the file versions in KeepIt before continuing.';
   else{
    if(!quiet)status.textContent=`Up to date with KeepIt / ${folder}.`;
    client.syncStatus?.('Trips saved in KeepIt.');
   }
   return;
  }
  if(newFile&&!(binding?.scope===cloud.scope&&binding.identity===current.identity&&binding.revision==='root')){
   binding={scope:cloud.scope,key:newFileKey(current.title),revision:'root',digest:'',identity:current.identity};
   saveBinding(binding);
  }
  const result=await cloud.repo.save({key:binding.key,parent:binding.revision,title:current.title,payload:current.payload});
  if(result.envelope)await remember(cloud.scope,result.envelope);
  if(result.conflict){
   status.textContent='KeepIt has a newer or conflicting version. Your local edits are intact. Refresh files to review, or save as a new file.';
   client.syncStatus?.('TravelIt needs a sync review. Open TravelIt files.');
   return;
  }
  if(!cloud.isCurrent())throw Error('The selected KeepIt folder changed.');
  saveBinding({...binding,revision:result.envelope.revision,digest});
  status.textContent=`Saved and verified in KeepIt / ${folder}.`;
  client.syncStatus?.('Trips saved in KeepIt.');
 }
 action('Save current work as new file',()=>run(async()=>{await sync({newFile:true});const result=status.textContent;await browse();status.textContent=result;}));
 action('Sync edits now',()=>run(()=>sync()));
 if(app==='travelit')action('Save an offline map',()=>run(async()=>{
  const client=adapter(),maps=await client?.listMaps();
  if(!maps?.length)throw Error('Install an offline map in TravelIt first.');
  list.replaceChildren();status.textContent='Choose an installed map to save in KeepIt.';
  for(const map of maps)action(map.name,()=>run(async()=>{
   const cloud=await connected(),payload=await client.captureMap(map.id),title=map.name;
   const result=await cloud.repo.save({key:newFileKey(title),parent:'root',title,payload,kind:'map'});
   if(result.conflict)throw Error('The map file changed. Try again.');
   await remember(cloud.scope,result.envelope);await browse();status.textContent=`Saved and verified “${title}” in KeepIt / TravelIt.`;
  }),list);
 }));
 action('Refresh files',()=>run(browse));
 action('Close',()=>panel.close());
 const openPanel=()=>{panel.showModal();void run(browse);};
 function install(){
  const menu=document.getElementById('connected-apps-list');
  if(!menu||menu.querySelector('[data-keepit-app-files]'))return;
  const button=action(`${folder} files`,()=>{
   menu.hidden=true;document.getElementById('connected-apps-toggle')?.setAttribute('aria-expanded','false');openPanel();
  },menu);
  button.dataset.keepitAppFiles='true';
 }
 const observer=new MutationObserver(()=>{install();if(document.querySelector('[data-keepit-app-files]'))observer.disconnect();});
 observer.observe(document.body,{childList:true,subtree:true});install();
 function auto(force=false){
  if(!navigator.onLine||document.hidden)return;
  if(syncTravelCalendar)void syncTravelCalendar(force);
  if(getLibrary()?.isCloud)void run(()=>sync({quiet:true}),{quiet:true});
  else if(app==='travelit'&&['signin','choose-folder','error'].includes(window.keepItConnectionState?.phase))adapter()?.syncStatus?.('Trips on this device. Connect to the same KeepIt library to sync.');
 }
 const resume=()=>{lastRead=0;auto(true);};
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)resume();});
 window.addEventListener('focus',resume);
 window.addEventListener('online',resume);
 window.addEventListener('keepit-library-ready',resume);
 window.addEventListener('connected-workspace-ready',resume);
 window.addEventListener('keepit-connection-state',event=>{if(['connected','signin','choose-folder','error'].includes(event.detail?.phase))resume();});
 window.addEventListener('storage',event=>{if(event.key==='keepit-app-file-binding-v1:travelit')resume();});
 if(app==='travelit')document.addEventListener('travelit-workspace-change',()=>{if(task)void task.then(resume);else resume();});
 setInterval(auto,15000);
}
