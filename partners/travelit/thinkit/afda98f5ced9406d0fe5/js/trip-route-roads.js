/** Main roads (motorway to tertiary) across a trip's whole area, so the drive
 * between stop areas also has an offline road map. One bounded request to the
 * same OpenStreetMap exporter TravelIt uses for local road maps. */
import {buildAtlasFromRoadGeoJSON} from './atlas-pack-tools.js';
import {ROAD_EXPORT_ENDPOINT} from './road-region-download.js';

const MAX_BYTES=6*1024*1024,MAX_SPAN=1.5;
export function tripRoadBounds(points,padDegrees=0.05){
  const ok=points.filter(p=>Number.isFinite(p?.lat)&&Number.isFinite(p?.lng));
  if(ok.length<2)throw Error('Pin at least two places to save the roads between them.');
  const b={minLat:Math.min(...ok.map(p=>p.lat))-padDegrees,maxLat:Math.max(...ok.map(p=>p.lat))+padDegrees,minLng:Math.min(...ok.map(p=>p.lng))-padDegrees,maxLng:Math.max(...ok.map(p=>p.lng))+padDegrees};
  if(b.maxLat-b.minLat>MAX_SPAN||b.maxLng-b.minLng>MAX_SPAN)throw Error('This trip covers too wide an area for one main-road map. Save maps around each stop instead.');
  return b;
}
export async function downloadMainRoads({bounds,name,fetcher=fetch,signal}){
  const box=[bounds.minLat,bounds.minLng,bounds.maxLat,bounds.maxLng].map(v=>v.toFixed(6)).join(',');
  const query='[out:json][timeout:60][maxsize:8388608];way["highway"~"^(motorway|trunk|primary|secondary|tertiary)(_link)?$"]('+box+');out tags geom('+box+');';
  const response=await fetcher(ROAD_EXPORT_ENDPOINT,{method:'POST',body:new URLSearchParams({data:query}),signal,cache:'no-store'});
  if(!response.ok)throw Error(response.status===429?'The map exporter is busy. Wait before trying again.':'The map exporter could not complete this request (HTTP '+response.status+').');
  const text=await response.text();
  if(new TextEncoder().encode(text).length>MAX_BYTES)throw Error('The main roads for this trip are too detailed for one offline map.');
  const data=JSON.parse(text);
  if(data.remark||!Array.isArray(data.elements)||data.elements.length>50000)throw Error('The exporter returned an incomplete map. Retry later.');
  const features=[];
  for(const way of data.elements){
    if(way.type!=='way'||!Array.isArray(way.geometry)||!way.tags?.highway)continue;
    let line=[];const finish=()=>{if(line.length>1)features.push({type:'Feature',properties:{highway:way.tags.highway,name:String(way.tags.name||way.tags.ref||'').slice(0,70)},geometry:{type:'LineString',coordinates:line}});line=[]};
    for(const p of way.geometry){if(Number.isFinite(p?.lat)&&Number.isFinite(p?.lon))line.push([p.lon,p.lat]);else finish()}
    finish();
  }
  return buildAtlasFromRoadGeoJSON({type:'FeatureCollection',features},{name,license:'Open Database License (ODbL) 1.0',attribution:'© OpenStreetMap contributors · https://www.openstreetmap.org/copyright',sourceUrl:'https://www.openstreetmap.org/'});
}
