/** Dedicated read-only worker; terminated when the preview is cancelled or closed. */
import {readExcelWorkbook} from './excel-reader.js';
import {planExcelImport} from './excel-import-plan.js';
self.onmessage=async({data})=>{
 const {requestId,buffer}=data;
 try{
  self.postMessage({requestId,status:'Reading workbook…'});
  const fileDigest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))].map(b=>b.toString(16).padStart(2,'0')).join('');
  const workbook=readExcelWorkbook(buffer),plan=planExcelImport(workbook);plan.fileDigest=fileDigest;
  self.postMessage({requestId,plan});
 }catch(error){self.postMessage({requestId,error:error.message||'Unable to read this workbook.'});}
};
