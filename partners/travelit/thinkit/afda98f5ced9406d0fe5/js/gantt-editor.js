import {itineraryGantt} from './itinerary-gantt.js';

const h=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const localEnd=(stop)=>{
 if(!stop.time)return '—';
 const start=Date.parse(stop.date+'T00:00:00Z')/60000+Number(stop.time.slice(0,2))*60+Number(stop.time.slice(3));
 const end=new Date((start+Number(stop.durationMinutes||0))*60000).toISOString();
 return end.slice(11,16)+(end.slice(0,10)!==stop.date?' +'+Math.round((Date.parse(end.slice(0,10))-Date.parse(stop.date))/86400000)+'d':'');
};
const ticks=(model,scope)=>{
 const shown=model.ticks.filter((tick,i)=>i===0||i===model.ticks.length-1||scope==='trip'||tick.position%25<1);
 return shown.map(tick=>{
  const short=scope==='trip'?tick.label.slice(-2):tick.label.slice(-5);
  return `<span class="gantt-fit-tick" style="left:${tick.position}%"><span class="gantt-fit-long">${h(tick.label)}</span><span class="gantt-fit-short">${h(short)}</span></span>`;
 }).join('');
};
export function renderFitGantt(entries,{trip,day,scope='day',allStops=entries,
 showDependencies=false,fullscreen=false,savePending=false,issues=[]}={}){
 if(!entries.length)return '<p class="empty-inline">No activities in this period.</p>';
 const model=itineraryGantt(entries,{trip,day,scope});
 const lines=ticks(model,scope);
 // Grid lines and bars share itineraryGantt's exact normalized clock.
 const gridLines=model.ticks.map(tick=>`<span class="gantt-fit-gridline" style="left:${tick.position}%"></span>`).join('');
 const rowMarkup=model.rows.map(row=>{
  const stop=row.stop,dependency=stop.dependencies?.[0]||null,rest=(stop.dependencies?.length||0)-1;
  const selectable=allStops.filter(candidate=>candidate.id!==stop.id).map(candidate=>
   `<option value="${h(candidate.id)}" ${candidate.id===dependency?.id?'selected':''}>${h(candidate.title)} · ${h(candidate.date)}</option>`).join('');
  const bar=row.start===null?'<span class="gantt-flexible">No start</span>':
   `<span class="gantt-fit-bar" role="img" aria-label="${h(stop.title)}: ${h(row.startLabel)}–${h(row.endLabel)}" style="left:${row.left}%;width:${row.width}%"></span>`;
  return `<div class="gantt-fit-row" data-gantt-stop="${h(stop.id)}">
   <div class="gantt-fit-details">
    <button class="gantt-fit-name" type="button" data-action="edit-stop:${h(stop.id)}" title="Open full activity details">${h(stop.title)}</button>
    <div class="gantt-fit-fields">
     <label title="Local date">Date<input aria-label="Date for ${h(stop.title)}" type="date" min="${h(trip.startDate)}" max="${h(trip.endDate)}" data-gantt-field="date" value="${h(stop.date)}"></label>
     <label title="Local start, or derived from predecessor">Start<input aria-label="Start for ${h(stop.title)}" type="time" data-gantt-field="time" value="${h(stop.time)}" ${dependency?'readonly title="Dependency start is calculated from predecessors"':''}></label>
     <label title="Duration in minutes">Min<input aria-label="Duration for ${h(stop.title)}" type="number" min="0" max="10080" step="1" inputmode="numeric" data-gantt-field="durationMinutes" value="${h(stop.durationMinutes||0)}"></label>
     <label title="End calculated from start and duration">End<output data-gantt-end>${h(localEnd(stop))}</output></label>
    </div>
    ${showDependencies?`<div class="gantt-dependency-fields">
     <label>After<select aria-label="Predecessor for ${h(stop.title)}" data-gantt-field="predecessor"><option value="">Manual start</option>${selectable}</select></label>
     <label>Link<select aria-label="Dependency type for ${h(stop.title)}" data-gantt-field="dependencyType">${['FS','SS','FF','SF'].map(type=>`<option value="${type}" ${(dependency?.type||'FS')===type?'selected':''}>${type}</option>`).join('')}</select></label>
     <label>Lag (min)<input aria-label="Dependency lag for ${h(stop.title)}" data-gantt-field="lagMinutes" type="number" min="-10080" max="10080" step="1" value="${h(dependency?.lagMinutes||0)}"></label>
     ${rest>0?`<small>+${rest} more predecessor(s); open activity details to edit all</small>`:''}
    </div>`:''}
   </div>
   <div class="gantt-fit-track" role="presentation" aria-label="Full ${h(scope)} timescale">
    ${gridLines}
    ${bar}
   </div>
  </div>`;
 }).join('');
 return `<section class="gantt-fit" aria-label="Editable itinerary Gantt chart">
  <div class="gantt-fit-toolbar">
   <strong>Gantt schedule <small>· all times visible</small></strong>
   <div class="gantt-fit-actions">
    <button type="button" class="button button-small" data-action="gantt-toggle-deps" aria-pressed="${showDependencies}">${showDependencies?'Hide':'Show'} dependencies</button>
    <button type="button" class="button button-small" data-action="gantt-fullscreen" aria-pressed="${fullscreen}">${fullscreen?'Exit full screen':'Full screen'}</button>
    <button type="button" class="button button-primary button-small" data-action="gantt-save" ${savePending?'':'disabled'}>Save schedule</button>
   </div>
  </div>
  <p class="gantt-fit-help">Edit date, start and duration here. End is calculated. Dependency starts are previewed and applied only when you save.</p>
  ${issues.length?`<p class="alert red gantt-fit-issues" role="alert">${issues.map(h).join(' · ')}</p>`:''}
  <div class="gantt-fit-grid" role="group" aria-label="Schedule editor and full-fit timeline">
   <div class="gantt-fit-heading"><span>Activities and schedule fields</span><div class="gantt-fit-axis" role="img" aria-label="${scope==='trip'?'Complete trip dates':'Complete selected day'}">${lines}</div></div>
   ${rowMarkup}
  </div>
  <p id="gantt-save-status" role="status">${savePending?'Unsaved schedule edits · Save schedule to commit atomically.':'Changes are saved only when you select Save schedule.'}</p>
 </section>`;
}
export function ganttEndLabel(stop){return localEnd(stop);}
