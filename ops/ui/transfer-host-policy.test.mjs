// Pure compiled-asset security contract. No Microsoft account, network or user files.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const {paths}=JSON.parse(readFileSync('ops/ui/LIVE_STABILITY_MODULES.json','utf8'));
for(const key of ['transfer','provider','connection','entry']){
 assert.match(paths[key],/^assets\/[a-z0-9-]+-[a-f0-9]{12}\.js$/i,'Only deterministic compiler assets may be imported');
}
const chunk=await import(pathToFileURL(resolve(paths.transfer)).href);
const validate=chunk.g;
assert.equal(typeof validate,'function');
for(const host of [
 'storage.live.com','a.storage.live.com','file.files.1drv.com',
 'download.livefilestore.com','a.b.livefilestore.com',
 'my.microsoftpersonalcontent.com','a.my.microsoftpersonalcontent.com',
 'api.onedrive.com'
])assert.equal(validate('https://'+host+'/download/signed').hostname,host,'Expected approved Microsoft domain: '+host);
for(const url of [
 'https://livefilestore.com.attacker.test/download',
 'https://evil.example/download',
 'https://user:password@download.livefilestore.com/secret',
 'http://download.livefilestore.com/file',
 'https://download.livefilestore.com:8443/file'
])assert.throws(()=>validate(url),/KeepIt could not verify the OneDrive transfer address|TRANSFER_HOST/,'Rejected noncanonical transfer URL');
const provider=readFileSync(paths.provider,'utf8');
const connection=readFileSync(paths.connection,'utf8');
assert.ok(provider.includes('./'+paths.transfer.split('/')[1]),'Provider must use the same updated URL validator');
assert.ok(connection.includes('./'+paths.transfer.split('/')[1]),'Connection must use updated URL validator');
assert.ok(connection.includes('./'+paths.provider.split('/')[1]),'Connection must use updated Graph provider');
assert.ok(!connection.includes('./chunk-VUEURUCM.js'),'Owner connection still references stale cached validator');
assert.ok(!connection.includes('./chunk-7XPOT35Y.js'),'Owner connection still references stale cached provider');
const html=readFileSync('partners/connected/index.html','utf8');
const policy=html.match(/Content-Security-Policy" content="([^"]+)"/)?.[1]||'';
const connectSrc=policy.split(';').map(s=>s.trim()).find(s=>s.startsWith('connect-src '))||'';
for(const entry of ['https://graph.microsoft.com','https://*.livefilestore.com','https://*.my.microsoftpersonalcontent.com'])
 assert.ok(connectSrc.includes(entry),'Missing allowed Microsoft transport domain: '+entry);
assert.ok(!/(?:^|\s)https:\/\/\*(?:\s|$)/.test(connectSrc),'Do not permit generic all-HTTPS network access');
console.log('KEEPIT_PINNED_TRANSFER_DOMAIN_ALLOWLIST_AND_CSP_PASS');
