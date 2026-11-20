export function offlineCopyLabel(status) {
 if(status?.pinned&&status.available)return 'Kept offline on this device';
 if(status?.available)return 'Available in this device’s automatic cache';
 if(status?.olderCopy)return 'Older offline copy · connect to update';
 return 'Not saved on this device';
}

export function mountOfflineControls({container,library,itemId,isCurrent=()=>true,onState=()=>{}}) {
 if(typeof library?.offlineStatus!=='function')return null;
 const doc=container.ownerDocument,section=doc.createElement('section');
 section.setAttribute('aria-label','Offline original');section.className='offline-original-controls';
 section.style.cssText='display:flex;flex-wrap:wrap;align-items:center;gap:6px';
 const status=doc.createElement('p'),keep=doc.createElement('button'),remove=doc.createElement('button');
 status.setAttribute('role','status');status.textContent='Checking this device’s copy…';
 status.style.flexBasis='100%';keep.style.minHeight=remove.style.minHeight='44px';
 keep.type=remove.type='button';keep.className=remove.className='secondary';
 keep.textContent='Keep offline on this device';remove.textContent='Remove device copy';
 keep.disabled=remove.disabled=true;remove.hidden=true;
 section.append(status,keep,remove);container.append(section);
 let disposed=false,busy=false,state=null;
 const current=()=>!disposed&&section.isConnected&&isCurrent();
 function paint(){
  keep.hidden=state?.pinned===true&&state.available;remove.hidden=!state?.available&&!state?.olderCopy;
  keep.textContent=state?.olderCopy?'Update offline copy':'Keep offline on this device';
  keep.disabled=remove.disabled=busy;
 }
 async function refresh(known){
  const next=known||await library.offlineStatus(itemId);
  if(!current())return;
  state=next;status.textContent=offlineCopyLabel(state);paint();onState(state);
 }
 async function run(method){
  if(busy||!current())return;
  busy=true;paint();status.textContent=method==='keepOffline'?'Saving verified copy on this device…':'Removing this device’s copy…';
  try{
   if(method==='keepOffline')void globalThis.navigator?.storage?.persist?.().catch(()=>{});
   await refresh(await library[method](itemId));
  }catch(error){if(current())status.textContent=error.message;}
  finally{busy=false;if(current())paint();}
 }
 keep.onclick=()=>run('keepOffline');remove.onclick=()=>run('removeOffline');
 void refresh().catch(error=>{if(current())status.textContent=error.message;});
 return {refresh,dispose(){disposed=true;section.remove();}};
}
