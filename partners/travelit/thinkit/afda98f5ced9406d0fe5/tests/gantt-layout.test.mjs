import assert from 'node:assert/strict';
import test from 'node:test';
import {itineraryGantt} from '../js/itinerary-gantt.js';

const trip={startDate:'2026-12-05',endDate:'2026-12-10'};
const stops=[
 {id:'a',date:'2026-12-05',time:'07:00',durationMinutes:75,title:'Drive'},
 {id:'b',date:'2026-12-05',time:'18:30',durationMinutes:60,title:'Dinner'}
];
test('daily wall-clock labels stay legible and midnight endpoint is compact',()=>{
 const model=itineraryGantt(stops,{scope:'day',trip,day:'2026-12-05'});
 assert.equal(model.span,1440);
 assert.ok(model.timelineWidth>=1100,
   '13 two-hour ticks must not be squeezed into a 600px time axis');
 assert.equal(model.ticks[0].label,'00:00');
 assert.equal(model.ticks.at(-1).label,'00:00 +1d');
 assert.equal(model.ticks.at(-1).position,100);
 assert.ok(model.ticks.every((t,i)=>!i||t.position>model.ticks[i-1].position));
 const minPixels=Math.min(...model.ticks.slice(1).map((t,i)=>
   model.timelineWidth*(t.position-model.ticks[i].position)/100));
 assert.ok(minPixels>=90,'Labels need sufficient physical tick separation');
 const dinner=model.rows.find(r=>r.stop.id==='b');
 assert.equal(dinner.startLabel,'18:30');assert.equal(dinner.endLabel,'19:30');
 assert.ok(dinner.left>75&&dinner.left<80);
});
test('late activity extends day view without crushing the last axis tick',()=>{
 const model=itineraryGantt([
  {id:'late',date:'2026-12-05',time:'23:15',durationMinutes:150}
 ],{scope:'day',trip,day:'2026-12-05'});
 assert.ok(model.span>1440);
 assert.equal(model.ticks.at(-1).position,100);
 assert.ok(model.ticks.every((t,i)=>!i||t.position>model.ticks[i-1].position));
 assert.match(model.rows[0].endLabel,/\(\+1d\)/);
 assert.ok(model.rows[0].left+model.rows[0].width<=100.001);
});
test('multi-day view retains day labels and bounded axis width',()=>{
 const model=itineraryGantt(stops,{scope:'trip',trip});
 assert.equal(model.ticks[0].label,'12-05');
 assert.ok(model.ticks.some(t=>t.label==='12-10'));
 assert.ok(model.timelineWidth>=900&&model.timelineWidth<=3600);
 assert.ok(model.rows[0].startLabel.startsWith('12-05'));
});