
/* ThinkIt↔KeepIt integration — WP1 migration core.
 * Production KeepIt adapter is deliberately NOT included. Works on detached
 * deep copies and will NEVER access OneDrive, browser storage, or remote APIs.
 * MIT-style permission to integrate into user's own applications.
 */
(function(root, factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.ThinkItKeepItMigration=api;
})(typeof globalThis!=='undefined'?globalThis:this, function(){
  'use strict';
  const CONTRACT='thinkit-keepit-note-v1';
  class MigrationBlocked extends Error {
    constructor(code,message,receipts=[]){super(message);this.name='MigrationBlocked';this.code=code;this.receipts=receipts.map(x=>({...x}));}
  }
  const validId=x=>typeof x==='string'&&x.length>=1&&x.length<=256&&/^[a-zA-Z0-9_.:\-]+$/.test(x);
  const assert=(v,code,message)=>{if(!v)throw new MigrationBlocked(code,message)};
  const clone=x=>JSON.parse(JSON.stringify(x));
  const hex=b=>Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('');
  async function sha256(text){
    const buf=new TextEncoder().encode(text);
    if(typeof globalThis!=='undefined'&&globalThis.crypto?.subtle) return hex(await globalThis.crypto.subtle.digest('SHA-256',buf));
    if(typeof require==='function') return require('node:crypto').createHash('sha256').update(buf).digest('hex');
    throw new MigrationBlocked('CRYPTO_UNAVAILABLE','SHA-256 is required. No weak digest fallback is permitted.');
  }
  function getTopics(project){
    assert(project&&project.format==='DIAGRAMIT'&&Array.isArray(project.pages),'INVALID_PROJECT','Expected an editable ThinkIt/DiagramIt project JSON.');
    const tasks=[], seen=new Set();
    for(const pg of project.pages){
      if(pg.mode!=='mind')continue;
      assert(validId(pg.id),'INVALID_PAGE','Mind Map page ID missing/invalid.');
      assert(Array.isArray(pg.nodes),'INVALID_TOPICS','Mind Map page has no topic array.');
      for(const node of pg.nodes){
        assert(validId(node.id),'INVALID_TOPIC','Topic ID missing/invalid.');
        const identity=`${pg.id}\u0000${node.id}`;
        assert(!seen.has(identity),'DUPLICATE_TOPIC','Repeated topic ID in one page.');seen.add(identity);
        const body=node.noteHtml;
        assert(body==null||typeof body==='string','INVALID_CONTENT','Topic note must be HTML text.');
        if(node.keepitNote){
          assert(!body||!body.trim(),'DUAL_AUTHORITY',`Topic ${node.id} contains both an external reference and an editable embedded body.`);
          continue;
        }
        if(typeof body==='string'&&body.trim())tasks.push({pageId:pg.id,topicId:node.id,subject:node.label||'Untitled topic',html:body});
      }
    }
    return tasks;
  }
  function validateContext(c){
    assert(c&&c.contract===CONTRACT,'BAD_BRIDGE','KeepIt bridge contract mismatch.');
    assert(c.verified===true,'UNVERIFIED_HOST','KeepIt host did not attest a verified, owner-authenticated session.');
    assert(c.storageReady===true,'STORE_UNAVAILABLE','KeepIt local draft/revision store is not ready.');
    assert(validId(c.libraryId)&&validId(c.accountBinding),'UNBOUND_LIBRARY','Account and library binding are required.');
    assert(typeof c.noteSchema==='string'&&c.noteSchema.length>0,'UNKNOWN_SCHEMA','KeepIt native note schema was not reported.');
    assert(c.guardedWrite===true,'UNSAFE_WRITE','KeepIt must guarantee guarded, idempotent note writes.');
    return c;
  }
  const hex64=x=>typeof x==='string'&&/^[a-f0-9]{64}$/i.test(x);
  async function preview(project){
    const tasks=getTopics(project);const result=[];
    for(const t of tasks)result.push({pageId:t.pageId,topicId:t.topicId,subject:t.subject,sourceSha256:await sha256(t.html),bytes:new TextEncoder().encode(t.html).length});
    return {notes:result,count:result.length,embeddedBytes:result.reduce((a,b)=>a+b.bytes,0)};
  }
  async function externalize(project,adapter,options={}){
    const originals=getTopics(project);
    assert(adapter&&['getContext','stageSource','prepareNative','createNote','readNote'].every(k=>typeof adapter[k]==='function'),
      'ADAPTER_INCOMPLETE','KeepIt adapter must implement context, durable staging, native conversion, save and readback.');
    const context=validateContext(await adapter.getContext());
    assert(!options.expectedLibraryId||options.expectedLibraryId===context.libraryId,'WRONG_LIBRARY','The selected KeepIt library changed.');
    const migrationReceipts=[], refs=new Map(), digestWork=[];
    // Preflight all notes and hashes before any KeepIt write.
    for(const t of originals){
      const sourceSha256=await sha256(t.html);
      const idempotencyKey=await sha256([CONTRACT,project.id,t.pageId,t.topicId,sourceSha256].join('\u0000'));
      digestWork.push({...t,sourceSha256,idempotencyKey});
    }
    for(const t of digestWork){
      let stage,prepared,saved,readback;
      try{
        stage=await adapter.stageSource({libraryId:context.libraryId,accountBinding:context.accountBinding,sourceHtml:t.html,
          subject:t.subject,sourceSha256:t.sourceSha256,idempotencyKey:t.idempotencyKey});
        assert(stage&&stage.durable===true&&validId(stage.stageId)&&stage.sourceSha256===t.sourceSha256,'STAGE_NOT_DURABLE',`Source for ${t.topicId} was not durably staged.`);
        prepared=await adapter.prepareNative({stageId:stage.stageId,sourceSha256:t.sourceSha256,
          noteSchema:context.noteSchema,subject:t.subject});
        assert(prepared&&prepared.nativeSchema===context.noteSchema&&hex64(prepared.nativeDigest)&&
          prepared.sourceSha256===t.sourceSha256&&prepared.assetsVerified===true&&prepared.formulasVerified===true&&prepared.captionsVerified===true,
          'CONVERSION_UNVERIFIED',`KeepIt conversion could not preserve the note and assets for ${t.topicId}.`);
        saved=await adapter.createNote({libraryId:context.libraryId,accountBinding:context.accountBinding,
          idempotencyKey:t.idempotencyKey,stageId:stage.stageId,prepared});
        assert(saved&&saved.libraryId===context.libraryId&&validId(saved.itemId)&&
          Number.isSafeInteger(saved.revision)&&saved.revision>=1&&saved.nativeDigest===prepared.nativeDigest&&
          saved.durable===true,'UNVERIFIED_COMMIT',`KeepIt could not verify a durable native note commit for ${t.topicId}.`);
        readback=await adapter.readNote({libraryId:context.libraryId,itemId:saved.itemId,expectedRevision:saved.revision});
        assert(readback&&readback.libraryId===context.libraryId&&readback.itemId===saved.itemId&&
          readback.revision===saved.revision&&readback.nativeDigest===prepared.nativeDigest&&
          readback.assetsVerified===true,'READBACK_MISMATCH',`Readback failed for KeepIt note ${saved.itemId}.`);
        const ref={libraryId:context.libraryId,itemId:saved.itemId,revision:saved.revision,nativeDigest:saved.nativeDigest,noteSchema:context.noteSchema};
        refs.set(`${t.pageId}\u0000${t.topicId}`,ref);
        migrationReceipts.push({pageId:t.pageId,topicId:t.topicId,sourceSha256:t.sourceSha256,idempotencyKey:t.idempotencyKey,...ref,verified:true});
      }catch(e){
        if(e instanceof MigrationBlocked)throw new MigrationBlocked(e.code,e.message,migrationReceipts);
        throw new MigrationBlocked('KEEPIT_WRITE_FAILED',`KeepIt migration failed for ${t.topicId}: ${e?.message||'unknown failure'}`,migrationReceipts);
      }
    }
    // No source mutation until every note has been verified by KeepIt readback.
    const candidate=clone(project);
    for(const pg of candidate.pages){if(pg.mode!=='mind')continue;for(const node of pg.nodes){
      const ref=refs.get(`${pg.id}\u0000${node.id}`);
      if(ref){node.keepitNote=ref;delete node.noteHtml;}
    }}
    return {project:candidate,receipts:migrationReceipts,verifiedCount:migrationReceipts.length,sourceRetained:true,
      warning:'Compact map is NOT a complete backup of external KeepIt notes. Keep the original JSON until a separately verified full-library backup exists.'};
  }
  // Editing a previously linked note. The caller MUST keep its local editor draft
  // until the source has been durably staged and a new native revision verified.
  // A stale expectedRevision is never auto-retried with last-write-wins.
  async function saveLinked(ref,html,adapter,{subject='Untitled topic',expectedLibraryId}={}){
    assert(ref&&validId(ref.libraryId)&&validId(ref.itemId)&&Number.isSafeInteger(ref.revision)&&ref.revision>=1&&hex64(ref.nativeDigest),
      'INVALID_REF','Cannot edit an invalid KeepIt note reference.');
    assert(typeof html==='string','INVALID_CONTENT','KeepIt note source must be HTML text.');
    assert(expectedLibraryId===ref.libraryId,'WRONG_LIBRARY','Choose the original KeepIt library before editing.');
    assert(adapter&&['getContext','stageSource','prepareNative','saveNote','readNote'].every(k=>typeof adapter[k]==='function'),
      'ADAPTER_INCOMPLETE','KeepIt edit adapter must support version-guarded saves and readback.');
    const c=validateContext(await adapter.getContext());
    assert(c.libraryId===ref.libraryId&&c.noteSchema===ref.noteSchema,'WRONG_LIBRARY','Note reference and KeepIt session do not match.');
    const sourceSha256=await sha256(html);
    const idempotencyKey=await sha256([CONTRACT,ref.libraryId,ref.itemId,String(ref.revision),sourceSha256].join('\u0000'));
    const stage=await adapter.stageSource({libraryId:c.libraryId,accountBinding:c.accountBinding,
      itemId:ref.itemId,expectedRevision:ref.revision,sourceHtml:html,sourceSha256,idempotencyKey,subject});
    assert(stage&&stage.durable===true&&validId(stage.stageId)&&stage.sourceSha256===sourceSha256,
      'STAGE_NOT_DURABLE','Edited note has not been stored as a recoverable KeepIt draft.');
    const prepared=await adapter.prepareNative({stageId:stage.stageId,sourceSha256,noteSchema:c.noteSchema,subject});
    assert(prepared&&prepared.nativeSchema===c.noteSchema&&hex64(prepared.nativeDigest)&&prepared.sourceSha256===sourceSha256&&
      prepared.assetsVerified===true&&prepared.formulasVerified===true&&prepared.captionsVerified===true,
      'CONVERSION_UNVERIFIED','Edited note conversion did not verify every image/formula/caption.');
    let receipt;
    try{receipt=await adapter.saveNote({libraryId:ref.libraryId,itemId:ref.itemId,expectedRevision:ref.revision,
      accountBinding:c.accountBinding,stageId:stage.stageId,idempotencyKey,prepared});}
    catch(e){throw new MigrationBlocked(e?.code==='VERSION_CONFLICT'?'VERSION_CONFLICT':'KEEPIT_WRITE_FAILED',
      `KeepIt did not commit the edit: ${e?.message||'unknown error'}`);}
    assert(receipt&&receipt.libraryId===ref.libraryId&&receipt.itemId===ref.itemId&&
      Number.isSafeInteger(receipt.revision)&&receipt.revision>ref.revision&&receipt.durable===true&&receipt.nativeDigest===prepared.nativeDigest,
      'UNVERIFIED_COMMIT','An updated KeepIt revision was not verified.');
    const readback=await adapter.readNote({libraryId:ref.libraryId,itemId:ref.itemId,expectedRevision:receipt.revision});
    assert(readback&&readback.itemId===ref.itemId&&readback.libraryId===ref.libraryId&&readback.revision===receipt.revision&&
      readback.nativeDigest===prepared.nativeDigest&&readback.assetsVerified===true,
      'READBACK_MISMATCH','New KeepIt note revision failed independent readback.');
    return {ref:{...ref,revision:receipt.revision,nativeDigest:receipt.nativeDigest},sourceSha256,
      draftStaged:true,verified:true,warning:'Update the topic reference only after the KeepIt save is verified. Preserve local draft until then.'};
  }
  async function resolve(ref,adapter,expectedLibraryId){
    assert(ref&&validId(ref.libraryId)&&validId(ref.itemId)&&Number.isSafeInteger(ref.revision)&&ref.revision>=1&&hex64(ref.nativeDigest),
      'INVALID_REF','KeepIt note reference is invalid.');
    assert(ref.libraryId===expectedLibraryId,'WRONG_LIBRARY','The selected KeepIt library does not match this note reference.');
    const context=validateContext(await adapter.getContext());
    assert(context.libraryId===expectedLibraryId,'WRONG_LIBRARY','KeepIt session points to another library.');
    const result=await adapter.readNote({libraryId:ref.libraryId,itemId:ref.itemId,expectedRevision:ref.revision});
    assert(result&&result.itemId===ref.itemId&&result.libraryId===ref.libraryId&&result.revision===ref.revision&&
      result.nativeDigest===ref.nativeDigest&&result.assetsVerified===true,'NOTE_NOT_VERIFIED',
      'The referenced KeepIt note could not be verified. Do not substitute an empty note.');
    return result;
  }
  return Object.freeze({CONTRACT,MigrationBlocked,preview,externalize,resolve,saveLinked,sha256,getTopics,validateContext});
});

/* ThinkIt v0.9.21 — guarded local-to-KeepIt sync orchestration.
 * No live KeepIt endpoint or user credentials are included. Adapter is supplied
 * only by a separately verified, owner-authorized KeepIt host integration.
 * Acknowledgement is contingent on KeepIt's independent native-note readback.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ThinkItKeepItSync=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const validId=x=>typeof x==='string'&&x.length>0&&x.length<=256&&/^[a-zA-Z0-9_.:\-]+$/.test(x);
function sameContext(a,b){return a.libraryId===b.libraryId&&a.accountBinding===b.accountBinding&&a.noteSchema===b.noteSchema;}
const scopeOf=r=>({projectId:r.projectId,pageId:r.pageId,topicId:r.topicId});
function requireBinding(binding,ctx,migration){
  migration.validateContext(ctx);
  if(!binding||!validId(binding.libraryId)||!validId(binding.accountBinding)||!sameContext(ctx,binding))throw Error('KeepIt authenticated library/account does not match the selected binding');
  return ctx;
}
async function synchronize({projectId,binding,adapter,vault,migration,onVerified=()=>{},maxNotes=50}={}){
  if(!validId(projectId))throw Error('Missing ThinkIt project ID');
  if(!vault||!['list','claim','acknowledge','release'].every(k=>typeof vault[k]==='function'))throw Error('Durable local vault not ready');
  if(!migration||!['validateContext','externalize','saveLinked'].every(k=>typeof migration[k]==='function'))throw Error('Note conversion/verification engine missing');
  if(!adapter||typeof adapter.getContext!=='function')throw Error('KeepIt is not connected; your local notes remain safe');
  if(!Number.isSafeInteger(maxNotes)||maxNotes<1||maxNotes>500)throw Error('Invalid batch size');
  const context=requireBinding(binding,await adapter.getContext(),migration);
  const pending=await vault.list(projectId);
  const out={scanned:pending.length,verified:0,retainedNewer:0,retryable:0,needsAttention:0,busy:0,skipped:0,details:[]};
  for(const current of pending.slice(0,maxNotes)){
    if(!['awaiting-keepit','sending-to-keepit'].includes(current.state)){out.skipped++;continue;}
    const scope=scopeOf(current),claim=await vault.claim(scope,binding);
    if(claim.status!=='claimed'){if(claim.status==='busy')out.busy++;else if(claim.status==='needs-attention')out.needsAttention++;else out.skipped++;continue;}
    const {record,leaseToken}=claim;
    try{
      let ref;
      if(record.keepitNote){
        const result=await migration.saveLinked(record.keepitNote,record.html,adapter,{subject:record.subject||'Untitled topic',expectedLibraryId:binding.libraryId});
        if(!result.verified||result.sourceSha256!==record.sha256)throw Error('Edited source readback mismatch');
        ref=result.ref;
      }else{
        const one={format:'DIAGRAMIT',version:3,id:record.projectId,pages:[{id:record.pageId,mode:'mind',nodes:[{id:record.topicId,label:record.subject||'Untitled topic',noteHtml:record.html}]}]};
        const result=await migration.externalize(one,adapter,{expectedLibraryId:binding.libraryId});
        if(result.verifiedCount!==1||result.receipts[0].sourceSha256!==record.sha256)throw Error('New note readback mismatch');
        ref=((r)=>({libraryId:r.libraryId,itemId:r.itemId,revision:r.revision,nativeDigest:r.nativeDigest,noteSchema:r.noteSchema}))(result.receipts[0]);
      }
      if(ref.libraryId!==context.libraryId)throw Error('KeepIt response switched libraries');
      const receipt=await vault.acknowledge(scope,leaseToken,record.localRevision,record.sha256,ref,binding);
      if(receipt.status==='verified'){
        out.verified++;
        // A caller may update the project reference, but MUST NOT remove the
        // in-project body or local recovery source based on this callback.
        try{await onVerified({scope,ref,localRevision:record.localRevision,sourceSha256:record.sha256,html:record.html});}
        catch(e){out.details.push({scope,status:'verified-ref-callback-error',reason:String(e.message||e)})}
      }else if(receipt.status==='newer-local-pending')out.retainedNewer++;
      else {out.needsAttention++;out.details.push({scope,status:receipt.status})}
    }catch(error){
      const conflict=error.code==='VERSION_CONFLICT'||error.code==='WRONG_LIBRARY'||error.code==='DUAL_AUTHORITY';
      const release=await vault.release(scope,leaseToken,error.message,{conflict});
      if(release.status!=='stale-claim'){if(conflict)out.needsAttention++;else out.retryable++;}
      out.details.push({scope,status:conflict?'needs-attention':'retryable',reason:String(error.message||error).slice(0,200)});
    }
  }
  return out;
}
return Object.freeze({synchronize,requireBinding,scopeOf});
});

