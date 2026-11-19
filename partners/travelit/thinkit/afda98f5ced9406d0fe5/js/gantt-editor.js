import {itineraryGantt} from './itinerary-gantt.js';

const h=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const localEnd=(stop)=>{
 if(!stop.time)return '—';
 const start=Date.parse(stop.date+'T00:00:00Z')/60000+Number(stop.time.slice(0,2))*60+Number(stop.time.slice(3));
 const duration=Number(stop.durationMinutes||0);
 if(!Number.isFinite(start)||!Number.isFinite(duration)||duration<0||duration>10080)return '—';
 const end=new Date((start+duration)*60000).toISOString();
 return end.slice(11,16)+(end.slice(0,10)!==stop.date?' +'+Math.round((Date.parse(end.slice(0,10))-Date.parse(stop.date))/86400000)+'d':'');
};
export const ganttTicks=(model,scope)=>{
 const shown=model.ticks.filter((tick,i)=>i===0||i===model.ticks.length-1||scope==='trip'||tick.position%25<1);
 return shown.map(tick=>{
  const short=scope==='trip'?tick.label.slice(-2):tick.label.slice(-5);
  return `<span class="gantt-fit-tick" style="left:${tick.position}%"><span class="gantt-fit-long">${h(tick.label)}</span><span class="gantt-fit-short">${h(short)}</span></span>`;
 }).join('');
};
export const ganttGridLines=model=>model.ticks.map(tick=>`<span class="gantt-fit-gridline" style="left:${tick.position}%"></span>`).join('');
export function renderFitGantt(entries,{trip,day,scope='day',allStops=entries,
 showDependencies=false,fullscreen=false,savePending=false,issues=[]}={}){
 const model=itineraryGantt(entries,{trip,day,scope});
 const lines=ganttTicks(model,scope);
 // Grid lines and bars share itineraryGantt's exact normalized clock.
 const gridLines=ganttGridLines(model);
 const rowMarkup=model.rows.map(row=>{
  const stop=row.stop,dependency=stop.dependencies?.[0]||null,rest=(stop.dependencies?.length||0)-1;
  const selectable=showDependencies?allStops.filter(candidate=>candidate.id!==stop.id).map(candidate=>
   `<option value="${h(candidate.id)}" ${candidate.id===dependency?.id?'selected':''}>${h(candidate.title)} · ${h(candidate.date)}</option>`).join(''):'';
  const bar=row.start===null?'<span class="gantt-flexible">No start</span>':
   `<span class="gantt-fit-bar" role="img" aria-label="${h(stop.title)}: ${h(row.startLabel)}–${h(row.endLabel)}" style="left:${row.left}%;width:${row.width}%"></span>`;
  return `<div class="gantt-fit-row" data-gantt-stop="${h(stop.id)}">
   <div class="gantt-fit-details">
    <input class="gantt-fit-name" type="text" maxlength="150" aria-label="Activity name for ${h(stop.title)}" title="${h(stop.title)}" data-gantt-field="title" value="${h(stop.title)}">
    <button class="gantt-fit-more" type="button" data-action="edit-stop:${h(stop.id)}" aria-label="Details for ${h(stop.title)}" title="Open activity details">⋯</button>
    <label><span>Date</span><input aria-label="Date for ${h(stop.title)}" type="date" min="${h(trip.startDate)}" max="${h(trip.endDate)}" data-gantt-field="date" value="${h(stop.date)}"></label>
    <label><span>Start</span><input aria-label="Start for ${h(stop.title)}" type="time" data-gantt-field="time" value="${h(stop.time)}" ${dependency&&!stop.fixed?'readonly title="Start is calculated from predecessors"':''}></label>
    <label><span>Min</span><input aria-label="Duration for ${h(stop.title)}" title="Duration in minutes" type="number" min="0" max="10080" step="1" inputmode="numeric" data-gantt-field="durationMinutes" value="${h(stop.durationMinutes||0)}"></label>
    <label><span>End</span><output data-gantt-end>${h(localEnd(stop))}</output></label>
   </div>
   ${showDependencies?`<div class="gantt-dependency-fields" title="${rest>0?`Includes ${rest} additional predecessors. Open Details to edit all.`:'Predecessor, relationship and lag in minutes'}">
    <select aria-label="Predecessor for ${h(stop.title)}" data-gantt-field="predecessor"><option value="">None</option>${selectable}</select>
    <select aria-label="Dependency type for ${h(stop.title)}" data-gantt-field="dependencyType">${[['FS','Finish to start'],['SS','Start to start'],['FF','Finish to finish'],['SF','Start to finish']].map(([type,label])=>`<option value="${type}" title="${label}" ${(dependency?.type||'FS')===type?'selected':''}>${type}</option>`).join('')}</select>
    <input aria-label="Dependency lag for ${h(stop.title)}" data-gantt-field="lagMinutes" title="Lag in minutes" type="number" min="-10080" max="10080" step="1" value="${h(dependency?.lagMinutes||0)}">
   </div>`:''}
   <div class="gantt-fit-track" role="presentation" aria-label="Full ${h(scope)} timescale">
    <span class="gantt-fit-lines" aria-hidden="true">${gridLines}</span>
    ${bar}
   </div>
  </div>`;
 }).join('');
 return `<section class="gantt-fit${showDependencies?' gantt-fit-with-deps':''}" aria-label="Editable itinerary Gantt chart">
  <div class="gantt-fit-toolbar">
   <div class="gantt-fit-actions">
    <button type="button" class="button button-small" data-action="gantt-toggle-deps" aria-pressed="${showDependencies}">${showDependencies?'Hide':'Show'} dependencies</button>
    <button type="button" class="button button-small" data-action="gantt-fullscreen" aria-pressed="${fullscreen}">${fullscreen?'Exit full screen':'Full screen'}</button>
    <button type="button" class="button button-primary button-small" data-action="gantt-save" ${savePending&&!issues.length?'':'disabled'}>Save schedule</button>
   </div>
  </div>
  ${issues.length?`<p class="alert red gantt-fit-issues" role="alert">${issues.map(h).join(' · ')}</p>`:''}
  <div class="gantt-fit-grid" role="group" aria-label="Schedule editor and full-fit timeline">
   <div class="gantt-fit-heading"><div class="gantt-fit-details gantt-fit-column-heads"><span>Activity</span><span></span><span>Date</span><span>Start</span><span>Min</span><span>End</span></div>
    ${showDependencies?'<div class="gantt-fit-dependency-head">Dependency</div>':''}
    <div class="gantt-fit-axis" role="img" aria-label="${scope==='trip'?'Complete trip dates':'Complete selected day'}">${lines}</div></div>
   ${rowMarkup||'<p class="empty-inline">No activities in this period.</p>'}
  </div>
  <p id="gantt-save-status" role="status">${savePending?'Unsaved schedule edits':''}</p>
 </section>`;
}
export function ganttEndLabel(stop){return localEnd(stop);}
