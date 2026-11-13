import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {itineraryGantt} from '../js/itinerary-gantt.js';
import {reorderFlexibleStops,itineraryOrder} from '../js/travel-planning.js';
const trip={id:'trip',startDate:'2026-12-05',endDate:'2026-12-10'};
const stop={id:'a',tripId:'trip',title:'Activity',date:'2026-12-07',time:'10:00',durationMinutes:60,kind:'Activity'};
test('whole-trip Gantt includes blank days before and after scheduled activities',()=>{
 const model=itineraryGantt([stop],{scope:'trip',trip});assert.equal(model.span,6*1440);assert.equal(model.ticks[0].label,'12-05');assert.equal(model.ticks.at(-1).label,'12-11');
 assert.equal(model.rows[0].startLabel,'12-07 10:00');assert.equal(model.rows[0].endLabel,'12-07 11:00');assert.ok(model.rows[0].left>33&&model.rows[0].left<50);
});
test('overnight activity bars and labels preserve the next-day finish',()=>{
 const overnight={...stop,time:'23:30',durationMinutes:120},model=itineraryGantt([overnight],{scope:'day',day:stop.date,trip});
 assert.equal(model.rows[0].endLabel,'01:30 (+1d)');assert.equal(model.last-model.first,1530);assert.equal(model.rows[0].left+model.rows[0].width,100);
 assert.match(model.ticks.at(-1).label,/12-08/);
});
test('flexible activities remain visible even if no activity has a start time',()=>{
 const model=itineraryGantt([{...stop,time:''}],{scope:'trip',trip});assert.equal(model.rows.length,1);assert.equal(model.rows[0].left,null);assert.equal(model.rows[0].startLabel,'Flexible');assert.equal(model.span,8640);
});
test('long and year-crossing trips have a bounded axis with unambiguous dates',()=>{
 const model=itineraryGantt([],{scope:'trip',trip:{...trip,startDate:'2026-12-30',endDate:'2027-12-30'}});assert.ok(model.ticks.length<=12);assert.equal(model.ticks[0].position,0);assert.equal(model.ticks.at(-1).position,100);assert.equal(model.timelineWidth,2400);
 const crossed=itineraryGantt([{...stop,date:'2026-12-31',time:'23:00',durationMinutes:120}],{scope:'trip',trip:{...trip,startDate:'2026-12-30',endDate:'2027-01-02'}});assert.equal(crossed.rows[0].endLabel,'01-01 01:00');
});
test('reordering flexible entries preserves timed bookings and Excel metadata',()=>{
 const rows=[{...stop,id:'timed',fixed:true},{...stop,id:'fixed',time:'',fixed:true},{...stop,id:'a',time:'',sortOrder:10,importSource:{code:'1.01'}},{...stop,id:'b',time:'',sortOrder:20,dependencies:[{id:'a'}]}];const before=JSON.stringify(rows);
 const changed=reorderFlexibleStops(rows,trip.id,'b',-1);assert.deepEqual(changed.map(s=>s.id),['b','a']);assert.equal(JSON.stringify(rows),before);assert.deepEqual(changed[1].importSource,{code:'1.01'});assert.deepEqual(changed[0].dependencies,[{id:'a'}]);assert.throws(()=>reorderFlexibleStops(rows,trip.id,'timed',1));assert.throws(()=>reorderFlexibleStops(rows,trip.id,'fixed',1));
});
const source=readFileSync(new URL('../js/app.js',import.meta.url),'utf8'),snippet=source.slice(source.indexOf('function durationLabel('),source.indexOf('const peso='));
function view(entries,scope='day'){
 const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
 const env={itineraryGantt,ganttScope:scope,selected:()=>trip,state:{chosenDay:stop.date},esc,pad:n=>String(n).padStart(2,'0'),action:(label,action,classes='',extra='')=>`<button data-action="${action}" ${extra}>${label}</button>`,menu:(label,body)=>`<details><summary>${label}</summary>${body}</details>`};
 const api=vm.runInNewContext(snippet+';({renderActivitiesTable,renderGantt})',env);return {table:api.renderActivitiesTable(entries),gantt:api.renderGantt(entries)};
}
test('actual views show safe titles, source codes and accessible flexible-order controls',()=>{
 const rows=[{...stop,title:'<img src=x>',time:'',importSource:{code:'1.01'}},{...stop,id:'b',time:''}],rendered=view(rows);
 assert.match(rendered.table,/move-flex-up:a"[^>]*disabled/);assert.match(rendered.table,/move-flex-down:b"[^>]*disabled/);assert.match(rendered.table,/move-flex-down:a"[^>]*>/);assert.match(rendered.table,/1\.01/);assert.doesNotMatch(rendered.table,/<img/);
 assert.match(rendered.gantt,/Flexible/);assert.match(rendered.gantt,/scope="row"/);assert.doesNotMatch(rendered.gantt,/Add start times to show/);
 assert.doesNotMatch(view([{...stop,fixed:true}]).table,/move-flex-/);
});
