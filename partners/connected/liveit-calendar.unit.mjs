import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {eventRecord,eventSignature,eventNoteId} from '../liveit/thinkit/connected-w18e-c15396/calendar-contract.mjs';
const root='partners/liveit/thinkit/connected-w18e-c15396/';
function load(name){const context={module:{exports:{}},crypto,structuredClone};vm.runInNewContext(readFileSync(root+name,'utf8'),context);return context.module.exports;}
const C=load('app-0.js'),W=load('app-3.js');
const event={id:'li-12345678-1234-4234-8234-123456789012',workspace:'personal',type:'event',body:'ASEAN Summit',date:'2026-11-16',time:'12:00',endDate:'2026-11-20',allDay:true,repeat:'none',categories:[],createdAt:'2026-11-09T00:00:00Z',opId:'operation-1'};
assert.equal(C.eventSignature(event),eventSignature(event));for(const day of ['2026-11-16','2026-11-18','2026-11-20'])assert.equal(W.occurrenceOn(event,day).id,event.id);assert.equal(W.occurrenceOn(event,'2026-11-21'),null);
assert.equal(W.occurrenceOn({...event,date:'2026-12-31',endDate:'2027-01-02',repeat:'yearly'},'2028-01-01').id,event.id);
assert.equal(W.occurrenceOn({...event,date:'2024-02-29',endDate:'2024-02-29',repeat:'yearly'},'2025-02-28'),null);
assert.equal(W.occurrenceOn({...event,allDay:false,time:'09:00',endTime:'00:00'},'2026-11-20'),null);
assert.throws(()=>eventRecord({...event,endDate:'2026-11-15'}));assert.throws(()=>eventRecord({...event,allDay:false,endDate:event.date,endTime:'11:00'}));assert.equal(C.validEventRange({...event,endDate:'2026-11-15'}),false);
assert.equal(await eventNoteId(event.id),await eventNoteId(event.id));assert.notEqual(await eventNoteId(event.id),await eventNoteId(event.id+'x'));
console.log('LIVEIT_CALENDAR_RANGE_CONTRACT_AND_STABLE_NOTE_ID_PASS');
