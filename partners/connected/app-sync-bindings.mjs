// A receipt belongs to the tab that acknowledged its payload. Reading another
// tab's receipt while capturing our older editor would silently rebase old data.
export function createSyncBindings({storage,session,key}){
 const prefix=key+':project:',sessionKey=key+':tab';
 const parse=value=>{try{return JSON.parse(value||'null');}catch{return null;}};
 const valid=value=>value&&typeof value.scope==='string'&&typeof value.key==='string'&&typeof value.identity==='string'&&typeof value.revision==='string'&&typeof value.digest==='string';
 const address=value=>value.scope+':'+encodeURIComponent(value.identity);
 const receipts=new Map();
 let active=parse(storage.getItem(key));
 if(!valid(active))active=null;
 for(let index=0;index<storage.length;index++){
  const name=storage.key(index);
  if(name?.startsWith(prefix)){
   const value=parse(storage.getItem(name));
   if(valid(value)&&name===prefix+address(value))receipts.set(address(value),value);
  }
 }
 if(active&&!receipts.has(address(active)))receipts.set(address(active),active);
 // Keep the same baseline across a reload of this tab, including after another
 // tab saves. Session storage is optional; in-memory isolation still applies.
 let previous;
 try{previous=parse(session?.getItem(sessionKey));}catch{}
 if(previous?.version===1&&Array.isArray(previous.receipts)){
  for(const entry of previous.receipts){
   if(!Array.isArray(entry)||entry.length!==2)continue;
   const [id,value]=entry;
   if(value===null||valid(value)&&id===address(value))receipts.set(id,value);
  }
  active=valid(previous.active)?previous.active:null;
 }
 const checkpoint=()=>{
  try{session?.setItem(sessionKey,JSON.stringify({version:1,active,receipts:[...receipts]}));}catch{}
 };
 checkpoint();
 return Object.freeze({
  load(identity,scope){
   if(identity===undefined)return active&&{...active};
   const id=scope+':'+encodeURIComponent(identity);
   if(receipts.has(id)){const value=receipts.get(id);return value&&{...value};}
   // Preserve the different-folder warning rather than copying local work into
   // a newly selected library without an explicit Save as new file operation.
   if(active?.identity===identity)return {...active};
   return null;
  },
  save(value){
   if(value!==null&&!valid(value))throw Error('Invalid KeepIt save receipt.');
   if(value){
    storage.setItem(prefix+address(value),JSON.stringify(value));
    storage.setItem(key,JSON.stringify(value));
    receipts.set(address(value),{...value});
   }else{
    storage.setItem(key,'null');
    if(active)receipts.set(address(active),null);
   }
   active=value&&{...value};checkpoint();
  }
 });
}
