import {CALENDAR_SOURCE,CALENDAR_TAG,eventNoteId,readEventEnvelope} from '../liveit/thinkit/connected-w18e-c15396/calendar-contract.mjs?v=keepit-links-1';

const caches=new WeakMap();
export async function readCalendarNotes(library,decode){
 await library.reload();
 const items=(await library.list()).filter(item=>item.source===CALENDAR_SOURCE&&item.tags?.includes(CALENDAR_TAG)&&!item.duplicateOf);
 const cache=caches.get(library)||new Map();
 caches.set(library,cache);
 const rows=[],unavailableIds=[];
 let cursor=0,unavailable=0;
 await Promise.all(Array.from({length:Math.min(items.length,4)},async()=>{
  while(cursor<items.length){
   const item=items[cursor++],key=[item.digest,item.version,item.trashedAt].join('|');
   try{
    let entry=cache.get(item.id);
    if(entry?.key!==key){
     const note=await decode(await library.original(item.id));
     const record=readEventEnvelope(note.exportMetadata?.notes||'');
     if(note.noteId!==item.id||await eventNoteId(record.id)!==item.id)throw Error('Calendar note identity changed.');
     entry={key,row:{record:item.trashedAt?{...record,archived:true}:record,itemId:item.id,version:item.version,digest:item.digest}};
     cache.set(item.id,entry);
    }
    rows.push(structuredClone(entry.row));
   }catch{unavailable++;unavailableIds.push(item.id);}
  }
 }));
 return {rows,unavailable,unavailableIds};
}
