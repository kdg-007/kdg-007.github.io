import assert from 'node:assert/strict';
import {createAppRepository,newFileKey} from './app-repository-store.mjs';

const tree = new Map([['keepit',[]]]);
const child = async (parent,name) => tree.get(parent)?.find(item=>item.name===name)||null;
let writeBarrier=null;
const writable=new Set(['keepit']);
const fs={child,allow(id){writable.add(id);},async children(id){return [...tree.get(id)];},async folder(parent,name){
 assert.ok(writable.has(parent),'parent directory has a session write grant');
 const prior=await child(parent,name);if(prior){fs.allow(prior.id);return prior;}
 const id=parent+'/'+name,item={id,name,folder:{}};tree.set(id,[]);tree.get(parent).push(item);fs.allow(id);return item;
},async create(parent,name,blob){
 assert.ok(writable.has(parent),'revision directory has a session write grant');
 if(writeBarrier)await writeBarrier();
 const prior=await child(parent,name);if(prior)return prior;
 const item={id:parent+'/'+name,name,file:{},blob};tree.get(parent).push(item);return item;
},async read(item){return item.blob;}};
const library={isCloud:true,root:{item:{id:'keepit'}},fs};
let current=true;
const repo=app=>createAppRepository({app,library,isCurrent:()=>current});
const think=repo('thinkit'), travel=repo('travelit'), live=repo('liveit');
assert.deepEqual(await think.list(),[]);assert.deepEqual(tree.get('keepit'),[]);
const key=newFileKey('Project model'),seed={key,parent:'root',title:'Project model',payload:'editable model'};
const first=await think.save(seed);assert.equal(first.conflict,false);
assert.deepEqual((await think.list()).map(file=>file.key),[key]);
assert.deepEqual(await travel.list(),[]);assert.deepEqual(await live.list(),[]);
assert.equal((await think.open(key,first.envelope.revision)).payload,seed.payload);
assert.equal((await think.save(seed)).envelope.revision,first.envelope.revision,'A retry must reuse its verified revision');
writable.clear();writable.add('keepit');
const reconnected=await think.save({...seed,parent:first.envelope.revision,payload:'edit after reconnect'});
assert.equal(reconnected.conflict,false);
assert.equal(reconnected.envelope.payload,'edit after reconnect');
let arrivals=0,release;
const gate=new Promise(resolve=>{release=resolve;});
writeBarrier=()=>{if(++arrivals===2)release();return gate;};
const edit={...seed,parent:reconnected.envelope.revision};
const versions=await Promise.all([think.save({...edit,payload:'phone edit'}),think.save({...edit,payload:'Mac edit'})]);
writeBarrier=null;
const heads=await think.heads(key);assert.equal(heads.length,2);
assert.deepEqual(new Set(await Promise.all(heads.map(async head=>(await think.open(key,head.id)).payload))),new Set(['phone edit','Mac edit']));
assert.equal((await think.save({...edit,payload:'stale edit'})).conflict,true);assert.equal(versions[1].conflict,true);
const map=await travel.save({key:newFileKey('Offline map'),parent:'root',title:'Offline map',payload:'map data',kind:'map'});
assert.equal(map.envelope.kind,'map');assert.equal((await travel.list()).length,1);
assert.deepEqual(tree.get('keepit').map(item=>item.name),['ThinkIt','TravelIt']);
current=false;await assert.rejects(()=>think.list(),/folder changed/);
console.log('KEEPIT_APP_FOLDER_SCOPES_READBACK_RETRY_CONFLICT_PASS');
