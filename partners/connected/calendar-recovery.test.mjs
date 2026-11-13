import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {readCalendarNotes} from './liveit-calendar-read.mjs';
import {eventNoteId,eventEnvelope,CALENDAR_SOURCE,CALENDAR_TAG,eventSignature} from '../liveit/thinkit/connected-w18e-c15396/calendar-contract.mjs';

function target(){const listeners=new Map();return {addEventListener(name,fn){listeners.set(name,fn);},removeEventListener(name){listeners.delete(name);},fire(name){return listeners.get(name)?.();}};}
function controller(bridge,library,reader){
 const source=readFileSync('ops/ui/live-modules/library-app.js','utf8').split('function Hi(')[1].split('\nfunction gt(')[0];
 const document={...target(),hidden:false},window=target(),navigator={onLine:true},frame={...target(),contentWindow:{...target(),liveItCalendarAccess:bridge}};
 const saved=[];
 const context={document,window,navigator,queueMicrotask,setInterval:()=>1,clearInterval(){},readCalendarNotes:reader,_e:note=>note,Mt:eventNoteId,Fe:eventSignature,
  _i:async(_,record)=>{saved.push(record.id);return {record,version:1};}};
 vm.createContext(context);const mount=vm.runInContext('(function Hi('+source+')',context);
 return {api:mount({frame,getLibrary:()=>library,getTarget:async()=>'scope'}),document,window,navigator,saved};
}
function bridgeFor(records){
 const pending=records.map(record=>({record,signature:eventSignature(record),receipt:{version:record.version||0}})),acks=[],statuses=[];
 return {acks,statuses,ready:async()=>{},canSync:()=>true,bind:async()=>true,merge:async()=>true,
  pending:()=>[...pending],conflicts:()=>0,status:(phase,message)=>statuses.push({phase,message}),
  ack:async id=>{acks.push(id);pending.splice(pending.findIndex(p=>p.record.id===id),1);},conflict:async()=>{}};
}
const event=id=>({id,workspace:'personal',type:'event',body:'Recovery '+id,date:'2026-12-05',endDate:'2026-12-07',allDay:true,repeat:'none',categories:[],createdAt:'2026-11-13T00:00:00Z',opId:id});

test('unread calendar originals are identified without preventing independent events from saving',async()=>{
 const broken=event('unread'),fresh=event('new'),existing=event('existing');
 const ids=await Promise.all([broken,fresh,existing].map(e=>eventNoteId(e.id)));
 const items=[0,2].map(i=>({id:ids[i],source:CALENDAR_SOURCE,tags:[CALENDAR_TAG],digest:'v1',version:1}));
 const library={isCloud:true,reload:async()=>{},list:async()=>items,original:async id=>{
  if(id===ids[0])throw Error('Original unavailable');
  return {noteId:id,exportMetadata:{notes:JSON.stringify(eventEnvelope(existing))}};
 }};
 const read=await readCalendarNotes(library,n=>n);
 assert.deepEqual(read.unavailableIds,[ids[0]]);
 assert.equal(read.rows.length,1);
 const bridge=bridgeFor([broken,fresh,existing]);
 const c=controller(bridge,library,readCalendarNotes);
 await c.api.sync();
 assert.deepEqual(c.saved,['new']);
 assert.deepEqual(bridge.acks,['new','existing']);
 assert.equal(bridge.pending().length,1);
 assert.equal(bridge.pending()[0].record.id,'unread');
 assert.equal(bridge.statuses.at(-1).phase,'error');
 c.api.dispose();
 // A later readable original resumes normal reconciliation for the pending event.
 library.original=async id=>({noteId:id,exportMetadata:{notes:JSON.stringify(eventEnvelope(id===ids[0]?broken:existing))}});
 const recovered=controller(bridge,library,readCalendarNotes);
 await recovered.api.sync();
 assert.equal(bridge.pending().length,0);
 assert.equal(bridge.statuses.at(-1).phase,'synced');
 recovered.api.dispose();
});

test('background and offline heartbeats wait, then reconnect resumes the same pending event',async()=>{
 let reads=0;
 const bridge=bridgeFor([event('offline')]);
 const c=controller(bridge,{isCloud:true},async()=>{reads++;return {rows:[],unavailable:0,unavailableIds:[]};});
 c.document.hidden=true;await c.api.sync();assert.equal(reads,0);
 c.document.hidden=false;c.navigator.onLine=false;await c.api.sync();assert.equal(reads,0);
 c.navigator.onLine=true;await c.window.fire('online');
 assert.equal(reads,1);assert.deepEqual(c.saved,['offline']);
 c.api.dispose();c.window.fire('online');
 await new Promise(resolve=>setImmediate(resolve));assert.equal(reads,1);
});
