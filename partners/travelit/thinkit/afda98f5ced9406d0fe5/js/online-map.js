/** Interactive street-map view. Only visible tiles are requested, using normal
 * browser HTTP caching. No tile downloading, prefetching or offline caching. */
const coordinates=p=>Number.isFinite(p?.lat)&&Number.isFinite(p?.lng)&&Math.abs(p.lat)<=85&&Math.abs(p.lng)<=180;
export function onlineMapMarkup({places,annotations,draft,action}){
 const count=places.filter(coordinates).length;
 return `<div class="section-head"><div><h2>Map</h2><p>${count} saved place${count===1?'':'s'} · ${annotations.length} annotation${annotations.length===1?'':'s'}</p></div><div class="action-line">${action('Fit saved places','street-map-fit')}${action('Philippines','street-map-ph')}${action('Offline maps','map-mode:offline')}</div></div><div class="map-toolbar" aria-label="Map annotation tools">${action('Add note pin','start-map:pin')}${action('Sketch route','start-map:line')}${action('Outline area','start-map:area')}</div>${draft?`<div class="map-editing" role="status"><strong>${{pin:'Place a note pin',line:'Sketch a route',area:'Outline an area'}[draft.kind]}</strong> · Click the map to add ${draft.kind==='pin'?'a marker':'points'}. ${draft.points.length} point(s).<div class="action-line">${action('Save annotation','finish-map','button button-primary button-small')}${action('Undo point','undo-map')}${action('Cancel','cancel-map')}</div></div>`:''}<div class="street-map-frame"><div id="street-map" role="region" aria-label="Interactive street map with saved places" tabindex="0"></div></div><div class="street-map-status" id="street-map-status" role="status" aria-live="polite" data-state="loading">Loading street map…</div><p class="map-caption">Street map needs internet. Saved pins and annotations stay on this device. Route sketches are drawings; use a saved place’s Waze link for directions.</p>`;
}
export function mountOnlineMap({container,status,places,annotations,draft,viewport,onViewport,onPlace,onAnnotation,onPoint}){
 const L=window.L;
 if(!L){status.dataset.state='unavailable';status.textContent='Street map could not start. Reload online, or open Offline maps.';return ()=>{};}
 const map=L.map(container,{minZoom:2,maxZoom:19,zoomControl:true,attributionControl:true,maxBounds:[[-85,-180],[85,180]],maxBoundsViscosity:1});
 const pins=places.filter(coordinates);
 const allPoints=[...pins,...annotations.flatMap(a=>a.points||[]),...(draft?.points||[])].filter(coordinates);
 if(viewport)map.setView([viewport.lat,viewport.lng],viewport.zoom);
 else if(allPoints.length)map.fitBounds(L.latLngBounds(allPoints.map(p=>[p.lat,p.lng])),{padding:[40,40],maxZoom:13});
 else map.fitBounds([[4.5,116],[21,127]],{padding:[12,12]});
 let disposed=false,loaded=0,failed=0,timer;
 const setStatus=(mode,message)=>{if(disposed)return;status.dataset.state=mode;status.textContent=message;};
 const layer=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
  minZoom:2,maxZoom:19,keepBuffer:0,updateWhenIdle:true,detectRetina:false,
  attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
 });
 const unavailable=()=>setStatus('unavailable','Street map unavailable. Check your internet connection, then Retry, or open Offline maps for imported maps.');
 const armTimeout=()=>{clearTimeout(timer);timer=setTimeout(()=>{if(!loaded)unavailable();},12000);};
 layer.on('loading',()=>{loaded=0;failed=0;setStatus('loading','Loading street map…');armTimeout();});
 layer.on('tileload',()=>{loaded++;setStatus('ready','Street map loaded · OpenStreetMap');});
 layer.on('tileerror',()=>{failed++;});
 layer.on('load',()=>{clearTimeout(timer);if(!loaded)unavailable();else if(failed)setStatus('partial','Some map tiles could not load. Check your connection or Retry.');});
 layer.addTo(map);armTimeout();
 function accessible(shape,label,callback){
  shape.on('click',e=>{L.DomEvent.stopPropagation(e);callback();});
  const element=shape.getElement();
  if(element){element.setAttribute('tabindex','0');element.setAttribute('role','button');element.setAttribute('aria-label',label);
   L.DomEvent.on(element,'keydown',e=>{if(e.key==='Enter'||e.key===' '){L.DomEvent.stop(e);callback();}});}
 }
 for(const place of pins){const marker=L.circleMarker([place.lat,place.lng],{radius:8,color:'#fff',weight:3,fillColor:'#267e78',fillOpacity:1,bubblingMouseEvents:false}).addTo(map);
  const text=document.createElement('span');text.textContent=place.name;marker.bindTooltip(text,{direction:'top'});
  accessible(marker,'Open '+place.name,()=>onPlace(place.id));}
 function draw(annotation,isDraft=false){
  const points=(annotation.points||[]).filter(coordinates).map(p=>[p.lat,p.lng]);if(!points.length)return;
  const options={color:isDraft?'#217fc8':'#a7652c',weight:3,dashArray:annotation.kind==='pin'?null:'7 5',fillOpacity:.2,bubblingMouseEvents:false};
  const shape=annotation.kind==='pin'?L.circleMarker(points[0],{...options,radius:7,fillOpacity:1}):annotation.kind==='area'&&points.length>=3?L.polygon(points,options):L.polyline(points,options);
  shape.addTo(map);
  if(isDraft){for(const point of points)L.circleMarker(point,{radius:4,color:'#217fc8',fillOpacity:1,interactive:false}).addTo(map);}
  else accessible(shape,'Open annotation '+annotation.label,()=>onAnnotation(annotation.id));
 }
 for(const annotation of annotations)draw(annotation);
 if(draft){draw(draft,true);map.on('click',event=>onPoint({lat:event.latlng.lat,lng:event.latlng.lng}));container.classList.add('map-is-drawing');}
 const remember=()=>{const center=map.getCenter();onViewport({lat:center.lat,lng:center.lng,zoom:map.getZoom()});};
 map.on('moveend',remember);remember();
 return ()=>{remember();disposed=true;clearTimeout(timer);map.remove();};
}
