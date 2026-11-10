import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {eventRecord,eventSignature,eventNoteId,eventEnvelope,readEventEnvelope} from '../liveit/thinkit/connected-w18e-c15396/calendar-contract.mjs';
const root='partners/liveit/thinkit/connected-w18e-c15396/';
function load(name){const context={module:{exports:{}},crypto,structuredClone};vm.createContext(context);vm.runInContext(readFileSync(root+'keepit-reference.js','utf8'),context);vm.runInContext(readFileSync(root+name,'utf8'),context);return context.module.exports;}
const C=load('app-0.js'),W=load('app-3.js');
const event={id:'li-12345678-1234-4234-8234-123456789012',workspace:'personal',type:'event',body:'ASEAN Summit',date:'2026-11-16',time:'12:00',endDate:'2026-11-20',allDay:true,repeat:'none',categories:[],createdAt:'2026-11-09T00:00:00Z',opId:'operation-1'};
assert.equal(C.eventSignature(event),eventSignature(event));for(const day of ['2026-11-16','2026-11-18','2026-11-20'])assert.equal(W.occurrenceOn(event,day).id,event.id);assert.equal(W.occurrenceOn(event,'2026-11-21'),null);
assert.equal(W.occurrenceOn({...event,date:'2026-12-31',endDate:'2027-01-02',repeat:'yearly'},'2028-01-01').id,event.id);
assert.equal(W.occurrenceOn({...event,date:'2024-02-29',endDate:'2024-02-29',repeat:'yearly'},'2025-02-28'),null);
assert.equal(W.occurrenceOn({...event,allDay:false,time:'09:00',endTime:'00:00'},'2026-11-20'),null);
assert.throws(()=>eventRecord({...event,endDate:'2026-11-15'}));assert.throws(()=>eventRecord({...event,allDay:false,endDate:event.date,endTime:'11:00'}));assert.equal(C.validEventRange({...event,endDate:'2026-11-15'}),false);
assert.equal(await eventNoteId(event.id),await eventNoteId(event.id));assert.notEqual(await eventNoteId(event.id),await eventNoteId(event.id+'x'));
const file={scope:'sha256:'+'a'.repeat(64),itemId:'01234567-89ab-4def-8123-0123456789ab',kind:'file',title:'Presentation'};
const note={...file,itemId:'11234567-89ab-4def-8123-0123456789ab',kind:'note',title:'Meeting notes'};
const linked={...event,keepItLinks:[file,note]};
assert.equal(C.eventSignature(linked),eventSignature(linked));
assert.deepEqual(readEventEnvelope(JSON.stringify(eventEnvelope(linked))).keepItLinks,[file,note]);
assert.equal(eventSignature({...event,keepItLinks:[]}),eventSignature(event));
assert.throws(()=>eventRecord({...event,keepItLinks:[file,file]}),/Duplicate KeepIt link/);
assert.throws(()=>eventRecord({...event,keepItLinks:[{...file,scope:'https://example.invalid'}]}),/Invalid KeepIt link/);
assert.throws(()=>eventRecord({...event,keepItLinks:Array(21).fill(file)}),/Invalid KeepIt links/);
const data=C.seed();
const created=C.create(data,{...linked,type:'note'});
assert.equal(JSON.stringify(created.keepItLinks),JSON.stringify([file,note]));
C.update(data,created.id,created.workspace,{keepItLinks:[note]});
assert.equal(JSON.stringify(created.keepItLinks),JSON.stringify([note]));
C.update(data,created.id,created.workspace,{keepItLinks:[]});
assert.equal(Object.hasOwn(created,'keepItLinks'),false);
console.log('LIVEIT_KEEPIT_REFERENCE_ROUNDTRIP_AND_VALIDATION_PASS');
console.log('LIVEIT_CALENDAR_RANGE_CONTRACT_AND_STABLE_NOTE_ID_PASS');

const {tripSpans}=await import('./travel-calendar.mjs');
const {travelWorkspaceKey}=await import('./app-repository-store.mjs');
const spanVersion={revision:'f'.repeat(64),payload:JSON.stringify({format:'travelit-local-backup',schemaVersion:6,records:[
 {type:'trip',id:'legacy-id',data:{id:'legacy-id',title:'A scheduled trip',startDate:'2026-12-30',endDate:'2027-01-02',timezone:'Asia/Manila',notes:'Private notes'}},
 {type:'stop',id:'entry',data:{title:'Private booking'}}
]})};
const [span]=await tripSpans(spanVersion);
assert.equal(span.endDateExclusive,'2027-01-03');assert.equal(span.workspace,'personal');
assert.equal(span.visibility,'private');assert.equal(span.editAuthority,'travelit');
assert.doesNotMatch(JSON.stringify(span),/Private notes|Private booking/);
assert.deepEqual(await tripSpans(spanVersion),[span]);
assert.equal(travelWorkspaceKey('a'.repeat(64)),travelWorkspaceKey('a'.repeat(64)));
assert.notEqual(travelWorkspaceKey('a'.repeat(64)),travelWorkspaceKey('b'.repeat(64)));
console.log('TRAVELIT_PERSONAL_TRIP_SPAN_PRIVACY_AND_STABLE_WORKSPACE_PASS');

const {readCalendarNotes}=await import('./liveit-calendar-read.mjs');
const {CALENDAR_SOURCE,CALENDAR_TAG}=await import('../liveit/thinkit/connected-w18e-c15396/calendar-contract.mjs');
const originalItems=[];
const bodies=new Map();
for(let n=0;n<7;n++){
 const row={...event,id:'fixture-'+n},id=await eventNoteId(row.id);
 originalItems.push({id,digest:'digest'+n,version:1,source:CALENDAR_SOURCE,tags:[CALENDAR_TAG]});
 bodies.set(id,{noteId:id,exportMetadata:{notes:n===2?'corrupt':JSON.stringify(eventEnvelope(row))}});
}
let requests=0,active=0,peak=0;
const library={async reload(){},async list(){return originalItems;},async original(id){
 requests++;active++;peak=Math.max(peak,active);
 await new Promise(resolve=>setTimeout(resolve,5));active--;return bodies.get(id);
}};
const decoded=await readCalendarNotes(library,note=>note);
assert.equal(decoded.rows.length,6);assert.equal(decoded.unavailable,1);assert.equal(peak,4);
await readCalendarNotes(library,note=>note);assert.equal(requests,8);
console.log('LIVEIT_CALENDAR_BOUNDED_READS_AND_PARTIAL_CATALOG_RECOVERY_PASS');
