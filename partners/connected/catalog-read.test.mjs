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

const readAhead=vm.runInNewContext('('+text.slice(text.indexOf('function catalogReadAhead('),text.indexOf('var T = encodeURIComponent'))+')');
test('older folder catalogs overlap downloads with at most four transfers',async()=>{
 const files=Array.from({length:12},(_,i)=>({name:String(i).padStart(10,'0')+'-00000000-0000-4000-8000-'+String(i).padStart(12,'0')+'.json',file:{},size:100,lastModifiedDateTime:new Date(1700000000000+i).toISOString()})).reverse();
 let active=0,peak=0;
 const load=readAhead(new Map(files.map(file=>[file.name,file])),async file=>{
  peak=Math.max(peak,++active);await new Promise(resolve=>setTimeout(resolve,2));active--;return file.name;
 });
 for(const file of files)assert.equal(await load(file),file.name);
 assert.equal(peak,4);
});
test('failed speculative history downloads are retried when verification needs them',async()=>{
 const files=[1,2].map(i=>({name:String(i)+'-00000000-0000-4000-8000-000000000000.json',file:{},size:100,lastModifiedDateTime:'2026-11-19T00:00:00Z'}));
 let attempts=0;
 const load=readAhead(new Map(files.map(file=>[file.name,file])),async file=>{
  if(file===files[1]&&++attempts===1)throw Error('temporary outage');return file.name;
 });
 assert.equal(await load(files[0]),files[0].name);
 assert.equal(await load(files[1]),files[1].name);assert.equal(attempts,2);
});

const legacySource=vm.runInNewContext('('+text.slice(text.indexOf('function legacyCatalogSource('),text.indexOf('function catalogReadAhead('))+')',{
 catalogReadAhead:readAhead,Blob,d:(ok,message)=>{if(!ok)throw Error(message);}
});
test('the initial catalog source overlaps complete byte reads and preserves all entry identities',async()=>{
 const files=Array.from({length:12},(_,i)=>({name:String(i).padStart(10,'0')+'-00000000-0000-4000-8000-'+String(i).padStart(12,'0')+'.json',file:{},size:30,lastModifiedDateTime:new Date(1700000000000+i).toISOString()}));
 let active=0,peak=0,count=0;const calls=[];
 const fs={read:async item=>{calls.push(item.name);peak=Math.max(peak,++active);await new Promise(resolve=>setTimeout(resolve,3));active--;return new Blob([item.name]);}};
 const input=legacySource(fs,files,{libraryId:'same-library'},n=>{count=n;});
 const entries=[];for await(const [name,file] of input.commits.entries())entries.push([name,await(await file.getFile()).text()]);
 assert.equal(peak,4);assert.equal(count,12);assert.equal(calls.length,12);
 assert.deepEqual(entries.map(([name])=>name),files.toReversed().map(f=>f.name));
 assert.ok(entries.every(([name,bytes])=>name===bytes));
 const open=text.slice(text.indexOf('  async open() {',text.indexOf('Y = "keepit-cloud.json"')),text.indexOf('  async persistCheckpoint()'));
 assert.match(open,/legacyCatalogSource\(this\.fs,await this\.fs\.children/,'Cold open must use the exercised source');
 assert.match(open,/A\.prototype\.readHead\.call\(legacy\)/,'Cold open retains the canonical checksum and chain validator');
});
test('a null initial history result retries once and fails closed if no original bytes exist',async()=>{
 const item={name:'0000000000-00000000-0000-4000-8000-000000000000.json',file:{},size:1};let calls=0;
 const fs={read:async()=>{calls++;return null;}};
 const input=legacySource(fs,[item],{});
 for await(const [,file] of input.commits.entries())await assert.rejects(()=>file.getFile(),/KI-OD-NULL-HISTORY/);
 assert.equal(calls,2);
});
const traceFactory=vm.runInNewContext('('+text.slice(text.indexOf('function createConnectionTrace('),text.indexOf('function legacyCatalogSource('))+')',{Date});
test('connection reports separate wall time from overlapping request work and cannot retain private input',async()=>{
 let clock=0;const trace=traceFactory(()=>clock);trace.begin();trace.phase('auth');clock=20;trace.phase('legacy-history');
 trace.phase('https://private.example/token=SECRET');
 const jobs=[];let release;
 const gate=new Promise(r=>release=r);
 for(let i=0;i<4;i++)jobs.push(trace.measure('file-read',async()=>{await gate;return new Blob(['bytes']);}));
 clock=120;release();await Promise.all(jobs);trace.phase('workspace');clock=150;trace.finish('connected');clock=9999;
 const report=JSON.parse(JSON.stringify(trace.snapshot()));
 assert.equal(report.totalMs,150);assert.deepEqual(report.phases.map(p=>p.durationMs),[20,100,30]);
 assert.equal(report.requests['file-read'].peak,4);assert.equal(report.requests['file-read'].bytes,20);assert.equal(report.requests['file-read'].totalMs,400);
 assert.doesNotMatch(JSON.stringify(report),/SECRET|https?:/);
 report.requests['file-read'].count=99;assert.equal(trace.snapshot().requests['file-read'].count,4);
});
test('failed timing operations retain the original error while recording no error text',async()=>{
 const trace=traceFactory(()=>0);trace.begin();trace.phase('drive');const error=Error('Bearer SECRET owner@example.test');
 await assert.rejects(()=>trace.measure('graph',async()=>{throw error;}),e=>e===error);
 trace.finish('error');const report=trace.snapshot();assert.equal(report.requests.graph.failed,1);assert.equal(report.outcome,'error');assert.doesNotMatch(JSON.stringify(report),/SECRET|owner@example/);
});
