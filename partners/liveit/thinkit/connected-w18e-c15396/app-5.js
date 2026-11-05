/*
 * LiveIt W17I-D — fail-closed KeepIt native-note OPEN contract (first-party seam).
 * This module does NOT authorize a host and has NO transport, token, note writer,
 * or production binding. Only a vetted KeepIt-owned caller may supply host and
 * independently verifiable host trust. No runtime auto-discovery is performed.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.LiveItKeepItPort=api;
})(typeof window!=='undefined'?window:undefined,function(){
'use strict';
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const SCOPE=/^sha256:[a-f0-9]{64}$/;
const NONE=Object.freeze({state:'not_connected',open:false,create:false,copy:false,link:false,sync:false,reason:'No KeepIt-approved host is installed'});
const safePlain=x=>Boolean(x&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype);
function validateReference(ref){
  if(!safePlain(ref)||ref.provider!=='keepit'||ref.version!==1||!SCOPE.test(ref.scope)||
    !UUID.test(ref.itemId)||!Number.isSafeInteger(ref.revision)||ref.revision<0)
    throw new Error('Invalid KeepIt reference-v1');
  // This validates syntax only. KeepIt must authorize every request separately.
  return ref;
}
function safeAssociation(a){
  if(!safePlain(a)||a.appId!=='liveit'||a.state!=='active'||a.copySemantics!=='shared-reference'||
     !['personal','work'].includes(a.workspace)||a.workspaceId!==a.workspace||
     typeof a.entityId!=='string'||!a.entityId||typeof a.id!=='string'||!UUID.test(a.id))
    throw new Error('Invalid or inactive LiveIt association');
  validateReference(a.noteReference);
  return a;
}
function trustedCapabilities(c,scope=null,epoch=null){
  if(!safePlain(c)||c.consumer!=='liveit'||c.contractMajor!==1||c.sessionState!=='authorized'||
     !SCOPE.test(c.scope)||c.openNativeNote!==true)return false;
  // sessionEpoch is optional in v1; when offered, pin it for this handshake.
  if(c.sessionEpoch!==undefined && (typeof c.sessionEpoch!=='string'||
       !/^[A-Za-z0-9:_-]{1,128}$/.test(c.sessionEpoch)))return false;
  if(scope!==null && c.scope!==scope)return false;
  if(scope!==null && epoch===null && c.sessionEpoch!==undefined)return false;
  if(epoch!==null && c.sessionEpoch!==epoch)return false;
  return true;
}
class KeepItNoteOpenPort {
  constructor({associationRepository,host=null,verifyHost=null}={}){
    if(!associationRepository||typeof associationRepository.listNoteAssociations!=='function')
      throw new Error('Association repository required');
    this.repository=associationRepository;
    this.host=host;
    this.verifyHost=verifyHost;
    this.status=NONE;
    this._ready=false;
    this._generation=0;
    this._hostEpoch=null;
  }
  capabilities(){return {...this.status};}
  disconnect(){
    ++this._generation;
    this._ready=false;
    this._hostEpoch=null;
    this.status=NONE;
  }
  _isCurrent(generation,host){return this._generation===generation&&this.host===host&&this._ready;}
  async negotiate(){
    this.disconnect();
    const generation=this._generation,host=this.host;
    if(!host||typeof this.verifyHost!=='function'||typeof host.describeCapabilities!=='function'||
       typeof host.openNativeNote!=='function')return this.capabilities();
    try{
      if(await this.verifyHost(host)!==true || generation!==this._generation||this.host!==host)
        return this.capabilities();
      const c=await host.describeCapabilities({consumer:'liveit',contractMajor:1});
      if(generation!==this._generation||this.host!==host)return this.capabilities();
      if(!trustedCapabilities(c)){
        this.status=Object.freeze({state:'unsupported_or_unauthorized',open:false,create:false,
          copy:false,link:false,sync:false,reason:'KeepIt host unavailable, untrusted or incompatible'});
        return this.capabilities();
      }
      // Check host identity *again* after asynchronous capability discovery.
      if(await this.verifyHost(host)!==true||generation!==this._generation||this.host!==host)
        return this.capabilities();
      this._hostEpoch=c.sessionEpoch??null;
      this.status=Object.freeze({state:'available_for_open_only',open:true,create:false,
        copy:false,link:false,sync:false,contractMajor:1,scope:c.scope,
        reason:'Editor can be requested; saving and cloud synchronization are unverified'});
      this._ready=true;
      return this.capabilities();
    }catch{
      if(generation===this._generation)this.disconnect();
      return this.capabilities();
    }
  }
  async _recheck(generation,host){
    if(!this._isCurrent(generation,host))throw new Error('KeepIt authorization changed; reopen after reconnect');
    try{
      const trusted=await this.verifyHost(host);
      if(trusted!==true||!this._isCurrent(generation,host))throw new Error('Trust no longer valid');
      const c=await host.describeCapabilities({consumer:'liveit',contractMajor:1});
      if(!this._isCurrent(generation,host)||!trustedCapabilities(c,this.status.scope,this._hostEpoch))
        throw new Error('KeepIt library or authorization epoch changed');
      if(await this.verifyHost(host)!==true||!this._isCurrent(generation,host))
        throw new Error('Trust changed during verification');
    }catch{
      if(generation===this._generation)this.disconnect();
      throw new Error('KeepIt host/library authorization changed; local note reference retained');
    }
  }
  async openAssociation({workspace,entityId,associationId,requestId}={}){
    if(!['personal','work'].includes(workspace)||typeof entityId!=='string'||!entityId||
       !UUID.test(associationId)||typeof requestId!=='string'||
       !/^[-a-zA-Z0-9_:.]{1,128}$/.test(requestId))throw new Error('Invalid open request');
    if(!this._ready||!this.status.open)throw new Error('KeepIt is not connected or open unavailable');
    const generation=this._generation,host=this.host;
    // An asynchronous record query may complete after a workspace/library switch.
    // Never forward the request to KeepIt on the strength of an earlier handshake.
    const rows=await this.repository.listNoteAssociations(workspace,{entityId});
    const a=rows.find(r=>r.id===associationId);
    if(!a)throw new Error('Association missing or not authorized in this workspace');
    safeAssociation(a);
    if(a.workspace!==workspace||a.entityId!==entityId||a.noteReference.revision===0)
      throw new Error('Invalid owner or uncommitted note association; local draft retained');
    await this._recheck(generation,host);
    const ref=a.noteReference;
    if(ref.scope!==this.status.scope)throw new Error('Different KeepIt library; reconnect original library');
    const req=Object.freeze({consumer:'liveit',contractMajor:1,requestId,
      owner:Object.freeze({appId:'liveit',workspace,entityId,associationId}),
      reference:Object.freeze({provider:'keepit',version:1,scope:ref.scope,itemId:ref.itemId,revision:ref.revision})});
    let response;
    try{response=await host.openNativeNote(req);}
    catch{throw new Error('KeepIt editor could not be opened; local note link retained');}
    // A delayed success cannot be trusted if account/host changed in the interim.
    await this._recheck(generation,host);
    if(!safePlain(response)||response.requestId!==requestId||response.status!=='opened'||
       !safePlain(response.reference)||response.reference.scope!==ref.scope||
       response.reference.itemId!==ref.itemId||response.reference.provider!=='keepit'||
       response.reference.version!==1||!Number.isSafeInteger(response.reference.revision)||
       response.reference.revision<ref.revision)
      throw new Error('KeepIt host response does not match requested note identity');
    // Authoritative native editor opening does not imply a cloud save or publish.
    return Object.freeze({status:'editor_opened',saveStatus:'unverified',requestId,
      associationId,itemId:ref.itemId,nativeRevision:response.reference.revision,linkedLocally:true});
  }
  async createNote(){throw new Error('KeepIt create unavailable; durable reservation/readback contract not verified');}
  async copyNote(){throw new Error('KeepIt independent-copy capability unavailable');}
  async syncNote(){throw new Error('KeepIt sync unavailable; only KeepIt may commit a native note');}
}
return Object.freeze({KeepItNoteOpenPort,validateReference,safeAssociation,NONE});
});
