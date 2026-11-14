// Reproducible, content-addressed owner modules. Original bundles stay intact.
// Uses the repository's release esbuild version (0.28.2), supplied by QA.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {transformSync,version}=require(process.env.KEEPIT_ESBUILD||'esbuild');
if(version!=='0.28.2')throw Error('Use the reviewed esbuild 0.28.2 runtime.');
const proofPath='partners/connected/owner-release.json',proof=JSON.parse(readFileSync(proofPath));
const source=name=>readFileSync('ops/ui/live-modules/'+name+'.js','utf8');
function emit(prefix,text){
 const bytes=transformSync(text,{minify:true,format:'esm',target:'es2022'}).code;
 const path='assets/'+prefix+'-'+createHash('sha256').update(bytes).digest('hex').slice(0,12)+'.js';
 writeFileSync(path,bytes);return path;
}
// The original SHA-pinned bundle remains untouched. New content-addressed modules
// update BOTH the transfer URL validator and its provider consumer. The owner
// service worker caches hashed assets, so changing an old chunk in place would
// leave previously installed iPhones running the rejected-host policy.
function emitPatchedChunk(prefix,base,oldText,newText){
 const original=readFileSync(base,'utf8');
 if(original.split(oldText).length!==2)throw Error('Unexpected pinned transfer host module: '+base);
 const bytes=original.replace(oldText,newText);
 const path='assets/'+prefix+'-'+createHash('sha256').update(bytes).digest('hex').slice(0,12)+'.js';
 writeFileSync(path,bytes);
 return path;
}
const paths={};
paths.auth=emit('keepit-auth-live',source('auth'));
paths.transfer=emitPatchedChunk('keepit-transfer-hosts','assets/chunk-VUEURUCM.js',
 'var i=["1drv.com","storage.live.com","files.onedrive.live.com","usercontent.microsoft"],c=["my.microsoftpersonalcontent.com","api.onedrive.com"]',
 'var i=["1drv.com","storage.live.com","files.onedrive.live.com","usercontent.microsoft","livefilestore.com","my.microsoftpersonalcontent.com"],c=["api.onedrive.com"]');
paths.provider=emitPatchedChunk('keepit-graph-provider','assets/chunk-7XPOT35Y.js',
 'from"./chunk-VUEURUCM.js"','from"./'+paths.transfer.split('/')[1]+'"');
const connectionSource=source('onedrive-connection');
for(const file of ['./chunk-VUEURUCM.js','./chunk-7XPOT35Y.js','./AUTH_MODULE.js']){
 if(connectionSource.split(file).length!==2)throw Error('Unrecognized owner connection import: '+file);
}
paths.connection=emit('keepit-onedrive-connect',connectionSource
 .replace('./AUTH_MODULE.js','./'+paths.auth.split('/')[1])
 .replace('./chunk-VUEURUCM.js','./'+paths.transfer.split('/')[1])
 .replace('./chunk-7XPOT35Y.js','./'+paths.provider.split('/')[1]));
paths.ui=emit('keepit-note-ui',source('note-ui'));
paths.link=emit('keepit-note-link',readFileSync('assets/keepit-note-link-256bd3efc430.js','utf8').replace('./keepit-note-ui-db4948167388.js','./'+paths.ui.split('/')[1]));
paths.entry=emit('library-app',source('library-app').replaceAll('./keepit-note-link-256bd3efc430.js','./'+paths.link.split('/')[1]).replaceAll('./keepit-onedrive-connect-7eae6a4687c3.js','./'+paths.connection.split('/')[1]));
const superseded=[proof.entry.replace(/^\//,''),'assets/library-app-bd256253b2c7.js',...Object.keys(proof.files).filter(p=>/^assets\/(?:keepit-note-ui-|keepit-note-link-|keepit-auth-live-|keepit-onedrive-connect-|keepit-transfer-hosts-|keepit-graph-provider-)/.test(p))];
for(const path of superseded)delete proof.files[path];
let html=readFileSync('partners/connected/index.html','utf8');
// Microsoft's consumer OneDrive signed-download endpoints can differ from the Graph
// metadata hostname. Keep CSP narrow, allowing documented Microsoft file hosts;
// do not add wildcard Internet access or weaken script/object directives.
const fileHosts='https://my.microsoftpersonalcontent.com https://api.onedrive.com';
const allowedHosts='https://my.microsoftpersonalcontent.com https://*.my.microsoftpersonalcontent.com https://*.livefilestore.com https://api.onedrive.com';
if(!html.includes(allowedHosts)){
 if(!html.includes(fileHosts))throw Error('Expected OneDrive CSP anchor not found');
 html=html.replace(fileHosts,allowedHosts);
}
html=html.replaceAll(proof.entry,'/'+paths.entry).replaceAll('//assets/','/assets/');
writeFileSync('partners/connected/index.html',html);
proof.entry='/'+paths.entry;
for(const path of Object.values(paths))proof.files[path]=createHash('sha256').update(readFileSync(path)).digest('hex');
for(const path of ['partners/connected/connected-nav.js','partners/connected/connected-nav.css','partners/design/app-appearance.js','partners/design/app-appearance.css'])proof.files[path]=createHash('sha256').update(readFileSync(path)).digest('hex');
for(const path of Object.keys(proof.files))proof.files[path]=createHash('sha256').update(readFileSync(path)).digest('hex');
// Pin the full transitive compiled dependency graph, including older shared
// editor entry points still used by portable-note tools.
let grew=true;
while(grew){grew=false;for(const path of Object.keys(proof.files).filter(p=>p.startsWith('assets/')&&p.endsWith('.js'))){
 for(const match of readFileSync(path,'utf8').matchAll(/["'](\.\/[^"']+\.js)["']/g)){
  const dep='assets/'+match[1].slice(2);if(!proof.files[dep]){proof.files[dep]=createHash('sha256').update(readFileSync(dep)).digest('hex');grew=true;}
 }
}}
writeFileSync(proofPath,JSON.stringify(proof,null,2)+'\n');
writeFileSync('ops/ui/LIVE_STABILITY_MODULES.json',JSON.stringify({schema:'keepit.live-stability-modules.v1',baseline:'a87af0c10621aa233ca0ea8c30f52421f17e98bc',esbuild:version,paths},null,2)+'\n');
console.log(JSON.stringify(paths));
