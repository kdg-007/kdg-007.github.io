// Run from the repository root. Keep spreadsheet preview out of startup bytes.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const esbuild=require(process.env.KEEPIT_ESBUILD||'esbuild');
if(esbuild.version!=='0.28.2')throw Error('Use esbuild 0.28.2 for the published runtime.');
const root='partners/travelit/thinkit/afda98f5ced9406d0fe5/js/';
// Offline preparation must cache the exact entry URLs used by this release.
const html=readFileSync(root+'../index.html','utf8');
const shellPath=root+'offline-shell.js';
let shell=readFileSync(shellPath,'utf8');
for(const asset of ['js/app-fast.js','css/workspace.css']){
 const url=html.match(new RegExp('(?:src|href)=\"('+asset.replaceAll('.','\\.')+'[^\"]*)\"'))?.[1];
 if(!url)throw Error('Missing release entry '+asset);
 const escaped=asset.replaceAll('.','\\.');
 shell=shell.replace(new RegExp("'\\./"+escaped+"[^']*'"),"'./"+url+"'");
}
writeFileSync(shellPath,shell);
const result=esbuild.buildSync({entryPoints:[root+'app.js'],bundle:true,minify:true,
 format:'esm',target:'es2022',write:false,legalComments:'none',external:['./excel-preview.js*']});
writeFileSync(root+'app-fast.js',result.outputFiles[0].contents);
console.log('TravelIt runtime rebuilt with on-demand Excel preview.');
