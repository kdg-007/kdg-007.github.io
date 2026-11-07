/** Local preview UI. Deliberately receives no database or save functions. */
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link=(label,url)=>url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`:'';
function resultMarkup(plan){
 const s=plan.statistics;
 return `<h3>${esc(plan.trip.title)}</h3><p>${esc(plan.trip.startDate)} — ${esc(plan.trip.endDate)} · Asia/Manila</p>
 <p id="excel-preview-summary"><strong>${s.activityCount} activities · ${s.dayCount} days · ${s.matchedDetails} matched place details</strong></p>
 <p>${s.predecessorCount} predecessor links retained as written; no activities rescheduled. ${s.explicitCoordinates} explicit coordinate(s), unverified. Map search links are retained without locating places automatically.</p>
 <p>${s.errorCount} errors · ${s.warningCount} warnings. Skipped ${plan.skipped.dayHeadings} day headings and ${plan.skipped.footerRows} footer rows.</p>
 <details><summary>Days and categories</summary><ul>${Object.entries(s.dateCounts).map(([date,count])=>`<li>${esc(date)}: ${count} activities</li>`).join('')}</ul><ul>${Object.entries(s.typeCounts).map(([name,count])=>`<li>${esc(name)}: ${count}</li>`).join('')}</ul></details>
 <details><summary>Workbook coverage</summary><ul>${plan.coverage.map(sheet=>`<li><strong>${esc(sheet.name)}</strong>: ${esc(sheet.status)}</li>`).join('')}</ul><p>Costs, bookings and review decisions are not imported in this checkpoint. Blank costs remain unspecified. The workbook’s Gantt graphics are not imported.</p></details>
 ${plan.issues.length?`<details open><summary>Review issues (${plan.issues.length})</summary><ul class="excel-issues">${plan.issues.map(i=>`<li><strong>${esc(i.level.toUpperCase())}</strong> · ${esc(i.sheet)}${i.row?' row '+i.row:''}${i.address?' ('+esc(i.address)+')':''}${i.code?' · '+esc(i.code):''}: ${esc(i.message)}</li>`).join('')}</ul></details>`:'<p>No schedule validation issues found.</p>'}
 <div class="excel-table-wrap" tabindex="0" role="region" aria-label="Workbook activity preview"><table class="excel-preview-table"><caption>Activity preview — source order, 24-hour local time</caption><thead><tr><th>Code / row</th><th>Date</th><th>Start</th><th>Finish</th><th>Minutes</th><th>Activity</th><th>Source type → TravelIt</th><th>Flag</th><th>Predecessor</th><th>Place details</th></tr></thead><tbody>${plan.activities.map(a=>`<tr><td>${esc(a.code)}<small>row ${a.sourceRow}</small></td><td>${esc(a.date)}</td><td>${esc(a.time)}</td><td>${esc(a.finish)}</td><td>${esc(a.durationMinutes)}</td><td>${esc(a.title)}</td><td>${esc(a.sourceType)} → ${esc(a.kind)}</td><td>${esc(a.detail?.flag)}</td><td>${esc(a.predecessors.join(', '))}</td><td>${a.detail?`<details><summary>${esc(a.detail.area||'Details and links')}</summary><p>${esc(a.detail.title)}</p><p>${esc(a.detail.notes)}</p><p>${esc(a.detail.decision)}</p><p>${link('Map search',a.detail.mapUrl)} ${link('Research source',a.detail.researchUrl)}</p></details>`:'No matching details'}</td></tr>`).join('')}</tbody></table></div>`;
}
export function showExcelPreview({openModal,closeModal,setCleanup}){
 openModal('Preview Excel itinerary',`<div class="alert blue">Preview only. Your workbook is read on this device. Nothing is saved to TravelIt or uploaded to OneDrive. Saving a new trip will be added after this checkpoint is verified.</div>
 <p>Choose an .xlsx itinerary with Code, Activity, Date, Start, Finish and Type columns. Maximum 10 MiB. Formulas use saved results; they are never executed.</p>
 <div class="field"><label for="excel-preview-file">Excel itinerary</label><input id="excel-preview-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></div>
 <div class="action-line"><button id="excel-preview-read" type="button" class="button button-primary">Preview workbook</button><button id="excel-preview-cancel" type="button" class="button hidden">Cancel reading</button><button id="excel-preview-close" type="button" class="button">Close preview</button></div>
 <p id="excel-preview-status" role="status" aria-live="polite">Choose a workbook to begin.</p><div id="excel-preview-result"></div>`);
 document.querySelector('#modal-backdrop').classList.add('excel-preview-dialog');
 const root=document.querySelector('#modal-form'),input=root.querySelector('#excel-preview-file'),read=root.querySelector('#excel-preview-read'),cancel=root.querySelector('#excel-preview-cancel'),status=root.querySelector('#excel-preview-status'),result=root.querySelector('#excel-preview-result');
 let worker=null,timer=null,generation=0,closed=false;
 root.addEventListener('submit',e=>e.preventDefault());
 function stop(){generation++;worker?.terminate();worker=null;clearTimeout(timer);timer=null;read.disabled=false;cancel.classList.add('hidden');}
 function fail(message){stop();status.textContent=message;status.classList.add('excel-preview-error');}
 setCleanup(()=>{closed=true;stop();});
 input.addEventListener('change',()=>{stop();result.replaceChildren();status.classList.remove('excel-preview-error');status.textContent='Ready to preview the selected workbook.';});
 cancel.addEventListener('click',()=>{stop();result.replaceChildren();status.textContent='Reading cancelled. Existing trips are unchanged.';});
 root.querySelector('#excel-preview-close').addEventListener('click',()=>closeModal());
 read.addEventListener('click',async()=>{
  stop();result.replaceChildren();status.classList.remove('excel-preview-error');
  const file=input.files?.[0];if(!file)return fail('Choose an .xlsx workbook first.');
  if(!/\.xlsx$/i.test(file.name)||file.size>10*1024*1024)return fail('Choose an .xlsx workbook no larger than 10 MiB.');
  if(!globalThis.Worker)return fail('This browser cannot run the local workbook reader. Try a current browser on your MacBook.');
  const requestId=generation;read.disabled=true;cancel.classList.remove('hidden');status.textContent='Opening workbook…';
  timer=setTimeout(()=>fail('Reading took too long and was stopped. Try a smaller workbook.'),20000);
  try{
   const buffer=await file.arrayBuffer();if(closed||requestId!==generation)return;
   worker=new Worker(new URL('./excel-preview-worker.js',import.meta.url),{type:'module'});
   worker.onerror=event=>{event.preventDefault();if(!closed&&requestId===generation)fail('The workbook reader could not start. Refresh the app and try again.');};
   worker.onmessage=({data})=>{
    if(closed||requestId!==generation||data.requestId!==requestId)return;
    if(data.error)return fail(data.error);
    if(data.status){status.textContent=data.status;return;}
    if(data.plan){stop();result.innerHTML=resultMarkup(data.plan);status.textContent=`Preview ready — ${data.plan.statistics.activityCount} activities. Nothing saved.`;}
   };
   worker.postMessage({requestId,buffer},[buffer]);
  }catch(error){if(!closed&&requestId===generation)fail(error.message||'The workbook could not be read.');}
 });
}
