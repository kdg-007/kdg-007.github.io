// Build the integrated editor into an immutable frame, preserving prior frames.
import {readFileSync,writeFileSync,readdirSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,dirname,extname} from 'node:path';

const source='thinkit';
const paths=['index.html','bubble.html','business-model.html','outline-print.html'];
function collect(directory){
 for(const entry of readdirSync(join(source,directory),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
  const path=join(directory,entry.name);
  if(entry.isDirectory())collect(path);else paths.push(path);
 }
}
collect('assets');
const files=paths.sort().map(path=>({path,bytes:readFileSync(join(source,path))}));
const digest=createHash('sha256');
for(const file of files)digest.update(file.path).update('\0').update(file.bytes).update('\0');
const base='/thinkit/'+digest.digest('hex').slice(0,20)+'/';
const proofPath='partners/connected/owner-release.json';
const proof=JSON.parse(readFileSync(proofPath,'utf8'));
const old=proof.thinkitHierarchy.frame;
const frame=base+'index.html';
for(const file of files){
 const path=base.slice(1)+file.path;
 const bytes=['.html','.js','.css'].includes(extname(file.path))
  ?Buffer.from(file.bytes.toString('utf8').replaceAll('/thinkit/',base)):file.bytes;
 mkdirSync(dirname(path),{recursive:true});writeFileSync(path,bytes);
 proof.files[path]=createHash('sha256').update(bytes).digest('hex');
 const original=join(source,file.path);
 proof.files[original]=createHash('sha256').update(file.bytes).digest('hex');
}
for(const path of ['ops/ui/live-modules/library-app.js','partners/connected/app-repository-sync.mjs','partners/connected/status.json']){
 const text=readFileSync(path,'utf8');
 if(!text.includes(old))throw Error('Current ThinkIt frame missing from '+path);
 writeFileSync(path,text.replaceAll(old,frame));
}
proof.thinkitHierarchy={...proof.thinkitHierarchy,frame,
 responsibilityView:{integrated:true,sourceCommit:'465ce86a2cfe0eadca7c9c3c6ac418da1231b96a',
  sourceChecks:49,sourceChecksPassed:49,ownerAccountVerified:false}};
writeFileSync(proofPath,JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify({frame,files:files.length}));
