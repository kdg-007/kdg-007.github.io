// KeepIt owns the selected library. These app folders sit outside its gallery catalog.
export const APP_FOLDERS = Object.freeze({thinkit:'ThinkIt',liveit:'LiveIt',travelit:'TravelIt'});
export const MAX_FILE_BYTES = 32 * 1024 * 1024;
const uuid = '[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}';
const keyPattern = new RegExp(`^${uuid}--[a-z0-9-]{1,60}$`);
const revisionPattern = /^([0-9a-f]{64})--(root|[0-9a-f]{64})\.json$/;
const encoder = new TextEncoder();

export async function hashText(text) {
 const bytes = await crypto.subtle.digest('SHA-256', encoder.encode(text));
 return Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2,'0')).join('');
}
export function newFileKey(title) {
 const label = title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60) || 'workspace';
 return `${crypto.randomUUID()}--${label}`;
}
export function fileLabel(key) { return key.slice(38).replaceAll('-',' '); }

export function createAppRepository({app, library, isCurrent}) {
 if(!Object.hasOwn(APP_FOLDERS,app)||!library?.isCloud||library.readOnly)throw Error('Connect a writable KeepIt OneDrive folder.');
 const fs = library.fs, rootId = library.root.item.id;
 const assertCurrent = () => { if(!isCurrent())throw Error('The selected KeepIt folder changed. Reopen the app files panel.'); };
 const folder = async (parent,name,create=false) => {
  assertCurrent();
  const item = create ? await fs.folder(parent,name) : await fs.child(parent,name);
  assertCurrent();
  if(item&&!item.folder)throw Error(`KeepIt folder “${name}” conflicts with a file.`);
  return item;
 };
 const appFolder = create => folder(rootId,APP_FOLDERS[app],create);
 const fileFolder = async (key,create=false) => {
  if(!keyPattern.test(key))throw Error('Invalid app file identity.');
  const parent=await appFolder(create);
  return parent&&folder(parent.id,key,create);
 };
 const getHeads = async directory => {
  if(!directory)return [];
  assertCurrent();
  const entries=await fs.children(directory.id);
  assertCurrent();
  const versions=entries.flatMap(item=>{
   const match=item.file&&revisionPattern.exec(item.name);
   return match?[{id:match[1],parent:match[2],item}]:[];
  });
  const parents=new Set(versions.map(revision=>revision.parent));
  return versions.filter(revision=>!parents.has(revision.id));
 };
 const read = async (key, head) => {
  assertCurrent();
  const blob = await fs.read(head.item,{cache:false,max:MAX_FILE_BYTES});
  assertCurrent();
  const envelope = JSON.parse(await blob.text());
  if(envelope?.schema!=='keepit-app-file-v1'||envelope.app!==app||envelope.key!==key||envelope.parent!==head.parent||envelope.revision!==head.id||typeof envelope.title!=='string'||typeof envelope.payload!=='string')throw Error('App file metadata could not be verified.');
  const digest=await hashText(envelope.payload);
  if(!['workspace','map'].includes(envelope.kind)||(envelope.kind==='map'&&app!=='travelit')||envelope.digest!==digest||head.id!==await hashText(JSON.stringify([app,key,head.parent,envelope.kind,envelope.title,digest])))throw Error('App file integrity check failed.');
  return envelope;
 };
 return Object.freeze({
  async list(){
   const directory=await appFolder(false);
   if(!directory)return [];
   const entries=await fs.children(directory.id);
   assertCurrent();
   return entries.filter(item=>item.folder&&keyPattern.test(item.name)).map(item=>({key:item.name,title:fileLabel(item.name)})).sort((a,b)=>a.title.localeCompare(b.title));
  },
  async heads(key){
   const directory=await fileFolder(key);
   return (await getHeads(directory)).map(({id,item})=>({id,modified:item.lastModifiedDateTime||''}));
  },
  async openSingle(key){
   const heads=await getHeads(await fileFolder(key));
   if(heads.length!==1)return {state:'review'};
   const version=await read(key,heads[0]);
   return version.kind==='workspace'?{state:'ready',version}:{state:'review'};
  },
  async open(key,revision){
   const directory=await fileFolder(key);
   const heads=await getHeads(directory);
   const head=heads.find(candidate=>candidate.id===revision);
   if(!head)throw Error('The app file changed. Refresh its versions and try again.');
   return read(key,head);
  },
  async save({key,parent,title,payload,kind='workspace'}){
   if(!['workspace','map'].includes(kind)||(kind==='map'&&app!=='travelit')||(parent!=='root'&&!/^[0-9a-f]{64}$/.test(parent))||typeof title!=='string'||typeof payload!=='string')throw Error('Invalid app file save request.');
   if(encoder.encode(payload).byteLength>MAX_FILE_BYTES)throw Error('This app file exceeds the 32 MiB sync limit.');
   title=title.slice(0,150);
   const digest=await hashText(payload), revision=await hashText(JSON.stringify([app,key,parent,kind,title,digest]));
   const name=`${revision}--${parent}.json`;
   const envelope={schema:'keepit-app-file-v1',app,key,parent,revision,title,kind,digest,payload};
   const blob=new Blob([JSON.stringify(envelope)],{type:'application/json'});
   if(blob.size>MAX_FILE_BYTES)throw Error('This app file exceeds the 32 MiB sync limit.');
   const directory=await fileFolder(key,parent==='root');
   if(!directory)throw Error('The KeepIt file folder was removed. Save a new copy to preserve local changes.');
   const heads=await getHeads(directory);
   const same=heads.find(head=>head.id===revision);
   if(same)return {envelope:await read(key,same),conflict:heads.length>1};
   if(parent==='root'?heads.length!==0:heads.length!==1||heads[0].id!==parent)return {conflict:true};
   assertCurrent();
   await fs.create(directory.id,name,blob);
   assertCurrent();
   const item=await fs.child(directory.id,name);
   if(!item)throw Error('KeepIt could not read back the uploaded app file.');
   const verified=await read(key,{id:revision,parent,item});
   const current=await getHeads(directory);
   return {envelope:verified,conflict:current.length!==1||current[0].id!==revision};
  }
 });
}

// A stable first workspace identity also keeps simultaneous first saves
// within the same revision history, where forks can be reviewed explicitly.
export function travelWorkspaceKey(scope) {
 if(!/^[0-9a-f]{64}$/.test(scope))throw Error('Invalid KeepIt folder identity.');
 return scope.slice(0,8)+'-'+scope.slice(8,12)+'-5'+scope.slice(13,16)+'-8'+scope.slice(17,20)+'-'+scope.slice(20,32)+'--travelit-workspace';
}
export async function findTravelWorkspace(repo,key){
 const keys=key?[key]:(await repo.list()).map(row=>row.key).filter(key=>key.endsWith('--travelit-workspace'));
 if(!keys.length)return {state:'absent'};
 if(keys.length!==1)return {state:'review'};
 return repo.openSingle(keys[0]);
}
