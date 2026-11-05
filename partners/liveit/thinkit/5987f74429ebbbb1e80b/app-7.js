
/* LiveIt W15 integration gate: both owners unconnected by default. No transport. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.LiveItIntegrationGate=api;
})(typeof window!=='undefined'?window:undefined,function(){
'use strict';
const NO_KEEPIT=Object.freeze({state:'not_connected',open:false,create:false,copy:false,link:false,sync:false,reason:'Approved KeepIt host unavailable'});
const NO_TRAVELIT=Object.freeze({state:'not_connected',display:false,upsert:false,tombstone:false,publish:false,readOnly:true,
 reason:'No trusted TravelIt transport configured; staging events are not a live calendar'});
function create({associationRepository,KeepItPort,TravelItStaging}={}){
 if(!associationRepository||typeof associationRepository.listNoteAssociations!=='function')throw Error('LiveIt local note-association repository required');
 if(!KeepItPort||typeof KeepItPort.KeepItNoteOpenPort!=='function')throw Error('W5F module missing');
 if(!TravelItStaging||typeof TravelItStaging.TravelItProjectionStagingPort!=='function')throw Error('W6 staging module missing');
 // No host is passed. Future KeepIt integration requires a new, owner-approved
 // build and explicit proof of host identity, authorization and native readback.
 const keepit=new KeepItPort.KeepItNoteOpenPort({associationRepository});
 const travel=NO_TRAVELIT;
 return Object.freeze({
  capabilities(){return Object.freeze({keepit:Object.freeze({...keepit.capabilities()}),travelit:travel});},
  async openKeepItNote(request){return keepit.openAssociation(request);},
  // Do not expose W6's staging receiver or a mutation method from this runtime.
  listTravelItForDay(day,workspace){
    if(!['work','personal'].includes(workspace)||typeof day!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(day))throw Error('Invalid travel view query');
    return Object.freeze([]);
  }
 });
}
return Object.freeze({create,NO_KEEPIT,NO_TRAVELIT});
});

