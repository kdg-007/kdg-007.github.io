import assert from 'node:assert/strict';
import {planTripDependencies,normalizeStopDependencies} from '../js/trip-dependencies.js';
import {downloadRoadRegion,roadRegionBounds,ROAD_EXPORT_ENDPOINT} from '../js/road-region-download.js';
import {normalizeStop} from '../js/domain.js';
const trip={id:'trip',startDate:'2026-12-01',endDate:'2026-12-05'};
const predecessor={id:'a',tripId:'trip',title:'Predecessor',date:trip.startDate,time:'10:00',durationMinutes:60};
for(const [type,time] of [['FS','11:15'],['SS','10:15'],['FF','10:45'],['SF','09:45']]){
 const successor={...predecessor,id:'b',title:'Successor',time:'08:00',durationMinutes:30,dependencies:[{id:'a',type,lagMinutes:15}]};
 const plan=planTripDependencies([successor,predecessor],trip);assert.equal(plan.issues.length,0);assert.equal(plan.updates[0].time,time);
 assert.deepEqual(normalizeStop(successor,trip).dependencies,successor.dependencies);
}
const chain={...predecessor,id:'b',time:'09:00',dependencies:[{id:'a',type:'FS'}]};
assert.throws(()=>planTripDependencies([{...predecessor,dependencies:[{id:'b'}]},chain],trip),/cycle/);
assert.equal(planTripDependencies([predecessor,{...chain,fixed:true}],trip).updates.length,0);
assert.match(planTripDependencies([predecessor,{...chain,fixed:true}],trip).issues[0],/fixed booking/);
assert.equal(planTripDependencies([predecessor,{...chain,time:'15:00'}],trip).updates.length,0);
assert.ok(planTripDependencies([{...chain,dependencies:[{id:'missing'}]}],trip).issues.length);
assert.throws(()=>normalizeStopDependencies([{id:'a'},{id:'a'}]),/distinct/);
const crossing=planTripDependencies([{...predecessor,time:'23:50',durationMinutes:30},chain],trip);
assert.equal(crossing.updates[0].date,'2026-12-02');assert.equal(crossing.updates[0].time,'00:20');
console.log('TRAVELIT_TYPED_DEPENDENCIES_FIXED_BOOKINGS_CYCLES_AND_MIDNIGHT_PASS');
const response={elements:[{type:'way',tags:{highway:'residential',name:'Sample road'},geometry:[{lat:14.6,lon:120.98},{lat:14.601,lon:120.981}]}]};
const atlas=await downloadRoadRegion({latitude:14.6,longitude:120.98,radiusKm:1,name:'Sample region',fetcher:async(url,options)=>{
 assert.equal(url,ROAD_EXPORT_ENDPOINT);assert.equal(options.method,'POST');assert.match(options.body.get('data'),/way\["highway"\]/);return new Response(JSON.stringify(response));
}});
assert.ok(atlas.featureCount>0);assert.match(atlas.attribution,/OpenStreetMap/);assert.match(atlas.license,/ODbL/);
assert.throws(()=>roadRegionBounds(14,121,10),/radius/);
await assert.rejects(()=>downloadRoadRegion({latitude:14.6,longitude:120.98,radiusKm:1,name:'Bad',fetcher:async()=>new Response(JSON.stringify({...response,remark:'timeout'}))}),/incomplete/);
await assert.rejects(()=>downloadRoadRegion({latitude:14.6,longitude:120.98,radiusKm:1,name:'Busy',fetcher:async()=>new Response('',{status:429})}),/busy/);
console.log('TRAVELIT_BOUNDED_ROAD_DOWNLOAD_VALIDATION_AND_ATTRIBUTION_PASS');
