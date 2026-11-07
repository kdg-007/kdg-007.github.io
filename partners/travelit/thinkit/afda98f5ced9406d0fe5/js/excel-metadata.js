/** Versioned metadata survives every ordinary edit and backup. No storage access. */
export function importMetadata(value,kind){
 if(value===undefined)return undefined;
 if(!value||value.version!==1||typeof value.batchId!=='string'||value.batchId.length>100)throw Error('Invalid Excel import metadata.');
 const text=(v,max)=>typeof v==='string'&&v.length<=max;
 if(kind==='trip'){
  if(value.scope!=='itinerary-and-place-details'||!Number.isInteger(value.activityCount)||value.activityCount<1||value.activityCount>5000||!Number.isInteger(value.placeCount)||value.placeCount<0||value.placeCount>5000||value.createdKeys?.length!==1+value.activityCount+value.placeCount||!Number.isFinite(Date.parse(value.importedAt))||!/^[a-f0-9]{64}$/.test(value.semanticDigest)||!/^[a-f0-9]{64}$/.test(value.fileDigest)||!text(value.filename,255)||!text(value.importedAt,40)||!Array.isArray(value.createdKeys)||!value.createdKeys.length||value.createdKeys.length>10001||new Set(value.createdKeys).size!==value.createdKeys.length||value.createdKeys.some(k=>!/^\b(trip|stop|place):[^:]{1,100}$/.test(k)))throw Error('Invalid Excel import receipt.');
 }else{
  if(!text(value.code,80)||!text(value.originalType,100)||!text(value.flag,100)||!Number.isInteger(value.row)||value.row<1||!text(value.sheet,100)||!Array.isArray(value.predecessors)||value.predecessors.length>5000||value.predecessors.some(p=>!text(p,80)))throw Error('Invalid Excel activity source.');
  const d=value.detail;if(d&&(!text(d.title,150)||!text(d.area,500)||!text(d.notes,2000)||!text(d.decision,2000)||!text(d.mapUrl,2000)||!text(d.researchUrl,2000)))throw Error('Invalid Excel place details.');
  for(const url of [d?.mapUrl,d?.researchUrl].filter(Boolean)){let u;try{u=new URL(url);}catch{throw Error('Invalid Excel source link.');}if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw Error('Invalid Excel source link.');}
 }
 if(JSON.stringify(value).length>(kind==='trip'?1500000:25000))throw Error('Excel import metadata is too large.');
 return JSON.parse(JSON.stringify(value));
}
