import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const text=readFileSync(new URL('../../ops/ui/live-modules/onedrive-connection.js',import.meta.url),'utf8');
const methods=text.slice(text.indexOf('  async readHead() {'),text.indexOf('  async readVerifiedHead() {'));
const create=read=>{const object=vm.runInNewContext('new (class {'+methods+'})',{structuredClone});object.readVerifiedHead=read;return object;};
const gate=()=>{let release;return {wait:new Promise(resolve=>release=resolve),release:()=>release()};};
test('gallery, calendar and polling share one catalog verification and receive independent snapshots',async()=>{
 const g=gate();let reads=0;const reader=create(async()=>{reads++;await g.wait;return {revision:1,items:[{title:'Original'}]};});
 const waiting=[reader.readHead(),reader.readHead(),reader.readHead()];assert.equal(reads,1);g.release();const [a,b,c]=await Promise.all(waiting);
 a.items[0].title='Changed locally';assert.equal(b.items[0].title,'Original');assert.equal(c.revision,1);assert.equal(reader.catalogRead,null);
});
test('save verification waits for an earlier read and then checks the new head',async()=>{
 const g=gate();let reads=0,active=0,peak=0;const reader=create(async()=>{const revision=++reads;peak=Math.max(peak,++active);if(revision===1)await g.wait;active--;return {revision};});
 const old=reader.readHead(),fresh=reader.readCatalogHead({fresh:true});assert.equal(reads,1);g.release();
 assert.equal((await old).revision,1);assert.equal((await fresh).revision,2);assert.equal(peak,1);
});
test('an interrupted read is released so later refresh and save verification can recover',async()=>{
 const g=gate();let reads=0;const reader=create(async()=>{if(++reads===1){await g.wait;throw Error('offline');}return {revision:2};});
 const old=reader.readHead(),fresh=reader.readCatalogHead({fresh:true});g.release();await assert.rejects(old,/offline/);assert.equal((await fresh).revision,2);
 assert.equal((await reader.readHead()).revision,2);assert.equal(reader.catalogRead,null);
});
