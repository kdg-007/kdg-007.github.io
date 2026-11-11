import {buildAtlasFromRoadGeoJSON} from './atlas-pack-tools.js';
export const ROAD_EXPORT_ENDPOINT='https://overpass-api.de/api/interpreter';
const MAX_BYTES=6*1024*1024;
export function roadRegionBounds(latitude,longitude,radiusKm){
 const lat=Number(latitude),lng=Number(longitude),radius=Number(radiusKm);
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>80||Math.abs(lng)>179||!Number.isFinite(radius)||radius<0.5||radius>5)throw Error('Choose a valid location and a radius from 0.5 to 5 km.');
 const dy=radius/111.32,dx=radius/(111.32*Math.cos(lat*Math.PI/180));
 return {minLat:lat-dy,maxLat:lat+dy,minLng:lng-dx,maxLng:lng+dx};
}
async function readBounded(response){
 if(!response.ok)throw Error(response.status===429?'The map exporter is busy. Wait before trying again.':'The map exporter could not complete this request (HTTP '+response.status+').');
 if(Number(response.headers.get('content-length'))>MAX_BYTES)throw Error('This region has too much detail. Choose a smaller radius.');
 if(!response.body?.getReader){const body=await response.text();if(new TextEncoder().encode(body).length>MAX_BYTES)throw Error('Choose a smaller map region.');return JSON.parse(body);}
 const reader=response.body.getReader(),chunks=[];let bytes=0;
 try{
  while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>MAX_BYTES){await reader.cancel();throw Error('This region has too much detail. Choose a smaller radius.');}chunks.push(part.value);}
 }finally{reader.releaseLock();}
 const all=new Uint8Array(bytes);let position=0;for(const chunk of chunks){all.set(chunk,position);position+=chunk.length;}
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(all));
}
export async function downloadRoadRegion({latitude,longitude,radiusKm,name,fetcher=fetch,signal}){
 const bounds=roadRegionBounds(latitude,longitude,radiusKm);
 const box=[bounds.minLat,bounds.minLng,bounds.maxLat,bounds.maxLng].map(value=>value.toFixed(6)).join(',');
 const query='[out:json][timeout:25][maxsize:8388608];way["highway"]('+box+');out tags geom('+box+');';
 const response=await fetcher(ROAD_EXPORT_ENDPOINT,{method:'POST',body:new URLSearchParams({data:query}),signal,cache:'no-store'});
 const data=await readBounded(response);
 if(data.remark||!Array.isArray(data.elements)||data.elements.length>50000)throw Error('The exporter returned an incomplete map. Choose a smaller radius or retry later.');
 const features=[];
 for(const way of data.elements){
  if(way.type!=='way'||!Array.isArray(way.geometry)||!way.tags?.highway)continue;
  let line=[];
  const finish=()=>{if(line.length>1)features.push({type:'Feature',properties:{highway:way.tags.highway,name:String(way.tags.name||'').slice(0,70)},geometry:{type:'LineString',coordinates:line}});line=[];};
  for(const point of way.geometry){
   if(Number.isFinite(point?.lat)&&Number.isFinite(point?.lon)&&Math.abs(point.lat)<=90&&Math.abs(point.lon)<=180)line.push([point.lon,point.lat]);else finish();
  }
  finish();
 }
 return buildAtlasFromRoadGeoJSON({type:'FeatureCollection',features},{name:name.trim()||'Offline road map',license:'Open Database License (ODbL) 1.0',attribution:'© OpenStreetMap contributors · https://www.openstreetmap.org/copyright',sourceUrl:'https://overpass-api.de/'});
}
