/** Dedicated read-only worker; terminated when the preview is cancelled or closed. */
import {readExcelWorkbook} from './excel-reader.js';
import {planExcelImport} from './excel-import-plan.js';
self.onmessage=({data})=>{
 const {requestId,buffer}=data;
 try{
  self.postMessage({requestId,status:'Reading workbook…'});
  const workbook=readExcelWorkbook(buffer),plan=planExcelImport(workbook);
  self.postMessage({requestId,plan});
 }catch(error){self.postMessage({requestId,error:error.message||'Unable to read this workbook.'});}
};
