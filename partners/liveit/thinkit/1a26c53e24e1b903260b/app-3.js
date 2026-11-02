
/* LiveIt W12 local-domain features. Annual occurrences are visual projections of the
   SAME canonical event ID, never new records or external calendar sync. Feb 29 skips
   non-leap years; overdue and completion semantics are NOT inferred from recurrence. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.LiveItW12=api;})(typeof window!=='undefined'?window:undefined,function(){
  'use strict';
  const DATE=/^\d{4}-\d{2}-\d{2}$/;
  function validDate(x){if(typeof x!=='string'||!DATE.test(x))return false;const d=new Date(x+'T12:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===x;}
  function validClock(x){return typeof x==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(x);}
  function occurrenceOn(record,day){
    if(!record||record.type!=='event'||record.archived||!validDate(day)||!validDate(record.date))return null;
    if(record.repeat==='yearly'){
      if(day<record.date||day.slice(5)!==record.date.slice(5))return null;
      // Feb-29 doesn't silently move to Feb-28 or Mar-01.
      return {...record,date:day,occurrenceDate:day,repeat:'yearly'};
    }
    return record.date===day?record:null;
  }
  function listEvents(records,day,workspace){if(!['work','personal'].includes(workspace))return [];
    return (Array.isArray(records)?records:[]).filter(x=>x&&x.workspace===workspace).flatMap(x=>{const row=occurrenceOn(x,day);return row?[row]:[];});
  }
  function dueReminders(records,day,workspace){return (Array.isArray(records)?records:[]).filter(x=>x&&x.workspace===workspace&&!x.archived&&!x.complete&&['task','reminder'].includes(x.type)&&x.dueDate===day);}
  function uniqueName(names,candidate,except=''){return !names.some(x=>x.toLocaleLowerCase()===candidate.toLocaleLowerCase()&&x.toLocaleLowerCase()!==except.toLocaleLowerCase());}
  function manageSpace(data,scope,action,oldName,newName){
    if(!['work','personal'].includes(scope)||!data||!data.spaces||!Array.isArray(data.spaces[scope]))throw new Error('Invalid Quick Space workspace');
    if(!['rename','remove'].includes(action))throw new Error('Invalid Quick Space operation');
    const names=data.spaces[scope],idx=names.indexOf(oldName);
    if(idx<0)throw new Error('Quick Space no longer exists');
    if(action==='rename'){
      if(typeof newName!=='string'||!newName.trim()||newName.length>40||/[\u0000-\u001f]/.test(newName))throw new Error('Invalid Quick Space name');
      const target=newName.trim();
      if(!uniqueName(names,target,oldName))throw new Error('A Quick Space with that name already exists');
      names[idx]=target;
      for(const row of data.records.filter(x=>x.workspace===scope)){row.categories=[...new Set(row.categories.map(x=>x===oldName?target:x))];}
    }else{
      names.splice(idx,1);
      // Records remain; removal means untag, not delete or archive the content.
      for(const row of data.records.filter(x=>x.workspace===scope)){row.categories=row.categories.filter(x=>x!==oldName);}
    }
    return true;
  }
  return {validDate,validClock,occurrenceOn,listEvents,dueReminders,manageSpace,uniqueName};
});
