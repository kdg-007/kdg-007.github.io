// Portable, credential-free event data shared by LiveIt and its KeepIt host.
export const CALENDAR_SOURCE='https://kdg-007.github.io/partners/connected/?connected-app=liveit#calendar-v1';
export const CALENDAR_TAG='LiveIt calendar';
export function validDay(x){return typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T12:00:00Z'))&&new Date(x+'T12:00:00Z').toISOString().slice(0,10)===x;}
const clock=x=>typeof x==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(x);
export function eventRecord(raw){
 if(!raw||raw.type!=='event'||!['work','personal'].includes(raw.workspace)||typeof raw.id!=='string'||!/^[a-z0-9:_-]{1,128}$/i.test(raw.id)||typeof raw.body!=='string'||!raw.body.trim()||raw.body.length>65536||!validDay(raw.date))throw Error('Invalid calendar event.');
 const endDate=raw.endDate||raw.date,endTime=raw.endTime||'',allDay=raw.allDay===true,time=raw.time||'12:00';
 if(!validDay(endDate)||endDate<raw.date||!clock(time)||(endTime&&!clock(endTime))||(!allDay&&endTime&&endDate===raw.date&&endTime<=time))throw Error('The event end must follow its start.');
 if(raw.repeat==='yearly'&&Date.parse(endDate)-Date.parse(raw.date)>366*86400000)throw Error('Yearly events may span at most one year.');
 if(!['none','yearly',undefined].includes(raw.repeat))throw Error('Invalid event recurrence.');
 if(!Array.isArray(raw.categories)||raw.categories.length>100||raw.categories.some(x=>typeof x!=='string'||x.length>512))throw Error('Invalid event categories.');
 if(typeof raw.createdAt!=='string'||!Number.isFinite(Date.parse(raw.createdAt))||typeof raw.opId!=='string'||!raw.opId)throw Error('Invalid event identity.');
 return {id:raw.id,workspace:raw.workspace,type:'event',body:raw.body,date:raw.date,time,endDate,endTime,allDay,repeat:raw.repeat||'none',categories:[...raw.categories],archived:raw.archived===true,complete:false,inbox:false,dueDate:'',remindAt:'',occurredOn:'',createdAt:raw.createdAt,opId:raw.opId};
}
export const eventSignature=raw=>JSON.stringify(eventRecord(raw));
export async function eventNoteId(id){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('LiveIt calendar v1:'+id));const h=[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-5'+h.slice(13,16)+'-8'+h.slice(17,20)+'-'+h.slice(20,32);}
export function eventEnvelope(record){return {format:'liveit-calendar-event-1',record:eventRecord(record)};}
export function readEventEnvelope(text){const value=JSON.parse(text);if(value?.format!=='liveit-calendar-event-1')throw Error('Unsupported LiveIt calendar note.');return eventRecord(value.record);}
