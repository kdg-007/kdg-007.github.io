// Trip workbook export round trip and the main-roads offline map download.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readTripWorkbook} from '../js/trip-workbook-import.js';
import {exportTripWorkbook,itineraryHtml} from '../js/trip-workbook-export.js';
import {tripRoadBounds,downloadMainRoads} from '../js/trip-route-roads.js';
import {downloadRoadBox,viewPieces} from '../js/trip-route-roads.js';
import {prepareRegionAtlas} from '../js/region-atlas.js';

const sample=new Uint8Array(readFileSync(new URL('./fixtures-sample-trip.xlsx',import.meta.url)));

test('an exported trip imports again with the same contents',async()=>{
  const a=readTripWorkbook(sample);
  const {blob,filename}=exportTripWorkbook({trip:a.trip,stops:a.stops,places:a.places,packing:a.packing,expenses:a.expenses});
  assert.match(filename,/^Lake_weekend_TravelIt_2030-03-01\.xlsx$/);
  const b=readTripWorkbook(new Uint8Array(await blob.arrayBuffer()));
  const view=r=>({counts:r.report.counts,stops:r.stops.map(s=>[s.code,s.title,s.date,s.time,s.durationMinutes,s.activityType,s.priority||'',r.places.find(p=>p.id===s.placeId)?.name||'']),
    costs:r.expenses.map(e=>[e.label,e.group,e.plannedPhp,e.actualPhp,!!e.amountPending]),packing:r.packing.map(p=>[p.label,p.quantity,p.unit,p.owner,p.group,p.packed]),
    bookings:r.trip.bookings.map(x=>[x.name,x.checkIn,x.checkOut,x.status]),shopping:r.trip.shopping.map(x=>[x.name,x.plannedQty,x.pricePhp]),pins:r.places.map(p=>[p.name,p.lat,p.lng])});
  assert.deepEqual(view(b),view(a));
});

test('the shared itinerary is a read-only page with every stop and escaped text',()=>{
  const a=readTripWorkbook(sample),html=itineraryHtml({trip:{...a.trip,title:'Lake <weekend>'},stops:a.stops,places:a.places});
  assert.match(html,/^<!DOCTYPE html>/);assert.ok(!html.includes('<weekend>'));assert.match(html,/Lake &lt;weekend&gt;/);
  for(const s of a.stops)assert.ok(html.includes(s.title.replace(/&/g,'&amp;').replace(/'/g,'&#39;')),s.title);
  assert.ok(!/<script/i.test(html),'no script in the shared page');
});

test('main roads across the trip area become an offline atlas',async()=>{
  const bounds=tripRoadBounds([{lat:14.5,lng:121.28},{lat:14.75,lng:121.72}]);
  assert.ok(bounds.minLat<14.5&&bounds.maxLng>121.72);
  assert.throws(()=>tripRoadBounds([{lat:14.5,lng:121}]),/at least two/);
  assert.throws(()=>tripRoadBounds([{lat:10,lng:120},{lat:14,lng:124}]),/too wide/);
  let query='';
  const fetcher=async(url,{body})=>{query=body.get('data');return new Response(JSON.stringify({elements:[
    {type:'way',tags:{highway:'primary',ref:'N601'},geometry:[{lat:14.52,lon:121.3},{lat:14.6,lon:121.45},{lat:14.62,lon:121.6}]},
    {type:'way',tags:{highway:'secondary',name:'Infanta road'},geometry:[{lat:14.62,lon:121.6},{lat:14.74,lon:121.65}]}]}),{status:200})};
  const atlas=await downloadMainRoads({bounds,name:'Trip · main roads',fetcher});
  assert.match(query,/motorway\|trunk\|primary\|secondary\|tertiary/);assert.ok(!/residential/.test(query),'only main roads are requested');
  const {manifest,tiles}=await prepareRegionAtlas(atlas);
  assert.equal(manifest.name,'Trip · main roads');assert.ok(tiles.length>=3,'the roads cross several map cells');
  await assert.rejects(downloadMainRoads({bounds,name:'x',fetcher:async()=>new Response('',{status:502})}),/HTTP 502/);
});

test('a saved view is split into pieces of at most 10 km and larger views are refused',()=>{
  const b={minLat:14.50,maxLat:14.67,minLng:121.00,maxLng:121.18};// about 19 × 19 km
  const pieces=viewPieces(b);assert.equal(pieces.length,4);
  assert.throws(()=>viewPieces({minLat:14,maxLat:14.5,minLng:121,maxLng:121.5}),/Zoom in/);
});
test('a view piece downloads every street in its box',async()=>{
  let query='';
  const fetcher=async(url,{body})=>{query=body.get('data');return new Response(JSON.stringify({elements:[{type:'way',tags:{highway:'residential',name:'Mabini St'},geometry:[{lat:14.55,lon:121.05},{lat:14.551,lon:121.052}]}]}))};
  const atlas=await downloadRoadBox({bounds:{minLat:14.54,maxLat:14.56,minLng:121.04,maxLng:121.06},name:'Test',fetcher});
  assert.match(query,/way\["highway"\]\(14\.540000,121\.040000,14\.560000,121\.060000\)/);
  assert.ok(JSON.stringify(atlas).includes('Mabini St'));
});
