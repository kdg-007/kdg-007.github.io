import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {resolve,sep,extname} from 'node:path';

const {chromium,webkit}=createRequire(resolve('package.json'))('playwright');
const root=resolve('.');
const proof=JSON.parse(readFileSync(resolve(root,'partners/connected/owner-release.json')));
const uiPath=Object.keys(proof.files).find(path=>path.startsWith('assets/keepit-note-ui-'));
assert.ok(uiPath,'The owner release must pin the native note editor');
const server=createServer((req,res)=>{
 const path=resolve(root,'.'+new URL(req.url,'http://127.0.0.1').pathname);
 if(!path.startsWith(root+sep)){res.writeHead(403).end();return;}
 try{
  const mime={'.js':'text/javascript','.json':'application/json','.png':'image/png'};
  res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream'}).end(readFileSync(path));
 }catch{res.writeHead(404).end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
try{
 const origin='http://127.0.0.1:'+server.address().port;
 for(const engine of process.env.KEEPIT_BROWSER_ENGINE==='chromium'?[chromium]:[chromium,webkit]){
  const browser=await engine.launch({headless:true});
  try{
   const page=await browser.newPage();
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto(origin+'/partners/connected/status.json');
   const reopened=await page.evaluate(async path=>{
    const {a:NoteUI}=await import('/'+path);
    const {c:NoteWorkspace}=await import('/assets/chunk-O6257ALA.js');
    const {q:packNote}=await import('/assets/chunk-G42SHEZJ.js');
    const {b:hashBlob}=await import('/assets/chunk-ZKN76T53.js');
    const workspace=await new NoteWorkspace({name:'keepit-single-tab-'+crypto.randomUUID()}).open();
    const target='synthetic-local-library', itemId=crypto.randomUUID();
    const reservation=await workspace.reserveThinkItLink({target,projectId:'project',pageId:'page',topicId:'topic',itemId});
    const image=await (await fetch('/fixtures/synthetic-source.png')).blob();
    const asset={id:crypto.randomUUID(),name:'sample.png',mime:'image/png',digest:await hashBlob(image),blob:image};
    const p=text=>({type:'paragraph',content:[{type:'text',text}]});
    const document={type:'doc',content:[
     p('Original note text'),
     {type:'table',content:[{type:'tableRow',content:[{type:'tableCell',content:[p('Keep this table cell')]}]}]},
     {type:'figure',attrs:{assetId:asset.id,alt:'Keep this image',width:50,align:'center'}}
    ]};
    const values={title:'Synthetic linked note',domain:'Aviation',recordType:'Notes',tags:[],customFields:[],source:'',notes:'',favorite:false};
    const draft=await workspace.saveDraft({id:reservation.draftId,itemId,noteId:itemId,target,document,assets:[asset],values,thinkItAuto:true},0);
    const blob=await packNote({noteId:itemId,document,assets:[asset]});
    const item={...values,id:itemId,version:1,digest:await hashBlob(blob),trashedAt:null};
    await workspace.db.operations.add({id:crypto.randomUUID(),target,itemId,draftId:draft.id,state:'saved',item,digest:item.digest,blob});
    const library={getItem:async id=>id===itemId?item:null,original:async()=>blob};
    const schema={version:1,revision:0,categories:['Aviation'],recordTypes:['Notes'],fields:[]};
    const ui=new NoteUI({workspace,getLibrary:()=>library,getTarget:async()=>target,getSchema:()=>schema,getRecords:()=>[],onChange:()=>{}});
    ui.library=library;ui.target=target;
    const [editorSnapshot]=await workspace.drafts(target);
    // A background receipt can finish after the visible editor has read its
    // draft. It must never bump that draft's revision from a second session.
    await ui.resumeThinkItDrafts();
    await ui.editDraft(editorSnapshot);
    window.qaNote={ui,workspace,target,originalId:draft.id,assetDigest:asset.digest};
    return {error:ui.session.error?.message??null,revision:ui.session.revision,expected:editorSnapshot.revision+1};
   },uiPath);
   assert.equal(reopened.error,null,'Opening a draft after a background receipt must remain writable');
   assert.equal(reopened.revision,reopened.expected);
   const dialog=page.getByRole('dialog',{name:'KeepIt note'});
   await dialog.getByRole('textbox',{name:'Subject'}).fill('Latest visible subject');
   await page.evaluate(async()=>{
    const {ui,workspace,target,originalId}=window.qaNote;
    await ui.session.chain;
    const draft=(await workspace.drafts(target)).find(row=>row.id===originalId);
    await workspace.saveDraft({...draft,values:{...draft.values,title:'Competing saved subject'}},draft.revision);
   });
   await dialog.getByRole('textbox',{name:'Subject'}).fill('Unsaved subject to keep');
   await dialog.locator('.note-status').filter({hasText:'saved draft changed while this editor was open'}).waitFor();
   await dialog.locator('summary[aria-label="More note actions"]').click();
   await dialog.getByRole('button',{name:'Save a copy',exact:true}).click();
   await dialog.getByRole('textbox',{name:'Subject'}).filter({visible:true}).waitFor();
   await page.waitForFunction(()=>window.qaNote.ui.session?.draft.values.title==='Unsaved subject to keep (copy)'&&!window.qaNote.ui.session.pending);
   const evidence=await page.evaluate(async()=>{
    const {workspace,target,originalId,assetDigest}=window.qaNote;
    const drafts=await workspace.drafts(target);
    const copy=drafts.find(row=>row.id!==originalId);
    return {original:drafts.find(row=>row.id===originalId).values.title,copy:copy.values.title,table:JSON.stringify(copy.document).includes('Keep this table cell'),image:copy.assets.some(asset=>asset.digest===assetDigest)};
   });
   assert.deepEqual(evidence,{original:'Competing saved subject',copy:'Unsaved subject to keep (copy)',table:true,image:true});
   assert.deepEqual(errors,[]);
   console.log('KEEPIT_SINGLE_TAB_DRAFT_AND_SAFE_COPY_'+engine.name().toUpperCase()+'_PASS');
  }finally{await browser.close();}
 }
}finally{server.close();}
