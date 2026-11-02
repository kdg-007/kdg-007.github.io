
/* LiveIt W5F: proposed, capability-gated KeepIt native editor OPEN seam.
   No installed host, no HTTP, tokens, editor implementation, cloud writer, or production route.
   The KeepIt owner must approve host trust and implement/rename negotiated methods.
   This source is a pure coordination prototype; NOT an installed KeepIt SDK. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.LiveItKeepItPort=api;})(typeof window!=='undefined'?window:undefined,function(){
'use strict';
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const SCOPE=/^sha256:[a-f0-9]{64}$/;
const NONE=Object.freeze({state:'not_connected',open:false,create:false,copy:false,link:false,sync:false,reason:'No KeepIt-approved host is installed'});
const safePlain=x=>Boolean(x&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype);
function validateReference(ref){
  if(!safePlain(ref)||ref.provider!=='keepit'||ref.version!==1||!SCOPE.test(ref.scope)||!UUID.test(ref.itemId)||
  !Number.isSafeInteger(ref.revision)||ref.revision<0)throw new Error('Invalid KeepIt reference-v1');
  // This checks syntax, NOT authorization. Native host must independently confirm access.
  return ref;
}
function safeAssociation(a){
 if(!safePlain(a)||a.appId!=='liveit'||a.state!=='active'||a.copySemantics!=='shared-reference'||
 !['personal','work'].includes(a.workspace)||a.workspaceId!==a.workspace||typeof a.entityId!=='string'||
 typeof a.id!=='string'||!UUID.test(a.id))throw new Error('Invalid or inactive LiveIt association');
 validateReference(a.noteReference);return a;
}
const copy=x=>JSON.parse(JSON.stringify(x));
class KeepItNoteOpenPort {
 constructor({associationRepository,host=null,verifyHost=null}={}){
   if(!associationRepository||typeof associationRepository.listNoteAssociations!=='function')throw new Error('Association repository required');
   this.repository=associationRepository;this.host=host;this.verifyHost=verifyHost;
   this.status=NONE;this._ready=false;
 }
 capabilities(){return {...this.status};}
 disconnect(){this._ready=false;this.status=NONE;}
 async negotiate(){
   this.disconnect();
   if(!this.host||typeof this.verifyHost!=='function'||typeof this.host.describeCapabilities!=='function'||typeof this.host.openNativeNote!=='function')return this.capabilities();
   let approved=false;
   try{approved=(await this.verifyHost(this.host))===true;}catch{return this.capabilities();}
   if(!approved)return this.capabilities();
   let c;try{c=await this.host.describeCapabilities({consumer:'liveit',contractMajor:1});}catch{return this.capabilities();}
   if(!safePlain(c)||c.consumer!=='liveit'||c.contractMajor!==1||c.sessionState!=='authorized'||
      !SCOPE.test(c.scope)||c.openNativeNote!==true){
     this.status=Object.freeze({state:'unsupported_or_unauthorized',open:false,create:false,copy:false,link:false,sync:false,
       reason:'KeepIt host unavailable, untrusted or incompatible'});return this.capabilities();
   }
   this.status=Object.freeze({state:'available_for_open_only',open:true,create:false,copy:false,link:false,sync:false,
     contractMajor:1,scope:c.scope,reason:'Editor can be requested; saving and cloud sync are not verified'});
   this._ready=true;return this.capabilities();
 }
 async openAssociation({workspace,entityId,associationId,requestId}){
   if(!['personal','work'].includes(workspace)||typeof entityId!=='string'||!entityId||!UUID.test(associationId)||
      typeof requestId!=='string'||!/^[-a-zA-Z0-9_:.]{1,128}$/.test(requestId))throw new Error('Invalid open request');
   if(!this._ready||!this.status.open)throw new Error('KeepIt is not connected or open capability unavailable');
   // The trusted-host identity must still be valid when the user clicks Open.
   if(typeof this.verifyHost!=='function'||(await this.verifyHost(this.host))!==true){this.disconnect();throw new Error('KeepIt host trust expired');}
   const rows=await this.repository.listNoteAssociations(workspace,{entityId});
   const a=rows.find(r=>r.id===associationId);
   if(!a)throw new Error('Association missing or not authorized in this workspace');
   safeAssociation(a);
   if(a.workspace!==workspace||a.entityId!==entityId)throw new Error('Cross-workspace or wrong-owner association');
   const ref=a.noteReference;
   if(ref.revision===0)throw new Error('KeepIt note is not yet committed; retain local draft and request recovery');
   if(ref.scope!==this.status.scope)throw new Error('Different KeepIt library; reconnect original library');
   const req=Object.freeze({consumer:'liveit',contractMajor:1,requestId,owner:Object.freeze({appId:'liveit',workspace,entityId,associationId}),
     reference:Object.freeze({provider:'keepit',version:1,scope:ref.scope,itemId:ref.itemId,revision:ref.revision})});
   // Host authorization is NOT delegated to the syntactically valid reference.
   let response;try{response=await this.host.openNativeNote(req);}catch(err){throw new Error('KeepIt editor could not be opened; local note link retained');}
   if(!safePlain(response)||response.requestId!==requestId||response.status!=='opened'||
      !safePlain(response.reference)||response.reference.scope!==ref.scope||response.reference.itemId!==ref.itemId||
      response.reference.provider!=='keepit'||response.reference.version!==1||
      !Number.isSafeInteger(response.reference.revision)||response.reference.revision<ref.revision)
      throw new Error('KeepIt host response does not match requested note identity');
   // Never infer a repository/cloud commit from editor OPEN acknowledgement.
   return Object.freeze({status:'editor_opened',saveStatus:'unverified',requestId,associationId,itemId:ref.itemId,
      nativeRevision:response.reference.revision,linkedLocally:true});
 }
 async createNote(){throw new Error('KeepIt create capability unavailable; no durable reservation and readback contract');}
 async copyNote(){throw new Error('KeepIt independent-copy capability unavailable');}
 async syncNote(){throw new Error('KeepIt sync capability unavailable; only the KeepIt owner may commit');}
}
return {KeepItNoteOpenPort,validateReference,safeAssociation,NONE};
});

