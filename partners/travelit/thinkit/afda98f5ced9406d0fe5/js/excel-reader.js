/** Local, bounded OOXML reader. No storage, network or formula evaluation. */
import {Unzip,UnzipInflate,XMLParser,XMLValidator} from '../vendor/excel/reader-vendors.js';
export const EXCEL_LIMITS=Object.freeze({fileBytes:10*1024*1024,expandedBytes:50*1024*1024,entryBytes:8*1024*1024,entries:1000,sheets:40,cells:250000,activities:5000});
const utf8=new TextDecoder('utf-8',{fatal:true});
const array=value=>value===undefined?[]:Array.isArray(value)?value:[value];
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crcUpdate(crc,data){for(const byte of data)crc=crcTable[(crc^byte)&255]^(crc>>>8);return crc;}
export function inspectExcelArchive(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length>EXCEL_LIMITS.fileBytes)throw Error('Choose an .xlsx workbook no larger than 10 MiB.');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50&&i+22+view.getUint16(i+20,true)===bytes.length){end=i;break;}
 if(end<0)throw Error('This file is not a complete .xlsx ZIP archive.');
 const count=view.getUint16(end+10,true),size=view.getUint32(end+12,true),offset=view.getUint32(end+16,true);
 if(view.getUint16(end+4,true)||view.getUint16(end+6,true)||view.getUint16(end+8,true)!==count||count>EXCEL_LIMITS.entries||count===65535||offset+size!==end)throw Error('Unsupported or oversized workbook archive.');
 const entries=new Map();let at=offset,total=0;
 for(let i=0;i<count;i++){
  if(at+46>end||view.getUint32(at,true)!==0x02014b50)throw Error('Damaged workbook archive directory.');
  const flags=view.getUint16(at+8,true),method=view.getUint16(at+10,true),crc=view.getUint32(at+16,true),compressed=view.getUint32(at+20,true),expanded=view.getUint32(at+24,true),n=view.getUint16(at+28,true),extra=view.getUint16(at+30,true),comment=view.getUint16(at+32,true),local=view.getUint32(at+42,true);
  if(at+46+n+extra+comment>end)throw Error('Damaged workbook archive entry.');
  const name=utf8.decode(bytes.subarray(at+46,at+46+n));
  if(!name||name.startsWith('/')||name.includes('\\')||name.split('/').some(p=>p==='..'||p==='.')||entries.has(name))throw Error('Unsupported or duplicate workbook archive path.');
  if((flags&1)||![0,8].includes(method)||expanded>EXCEL_LIMITS.entryBytes||compressed===0xffffffff||local+30>offset)throw Error('Workbook is encrypted, unsupported or exceeds the per-file size limit.');
  total+=expanded;if(total>EXCEL_LIMITS.expandedBytes)throw Error('Workbook exceeds the 50 MiB expanded size limit.');
  if(view.getUint32(local,true)!==0x04034b50||view.getUint16(local+8,true)!==method)throw Error('Damaged workbook local entry.');
  const ln=view.getUint16(local+26,true),le=view.getUint16(local+28,true),dataAt=local+30+ln+le;
  if(dataAt+compressed>offset||utf8.decode(bytes.subarray(local+30,local+30+ln))!==name)throw Error('Workbook entry range or name is invalid.');
  entries.set(name,{name,expanded,compressed,crc});at+=46+n+extra+comment;
 }
 if(at!==end||!entries.has('[Content_Types].xml')||!entries.has('xl/workbook.xml')||!entries.has('xl/_rels/workbook.xml.rels'))throw Error('This archive is not a supported Excel workbook.');
 if([...entries.keys()].some(name=>/vbaProject\.bin$/i.test(name)))throw Error('Choose an .xlsx workbook without macros.');
 return entries;
}
function expandArchive(bytes,entries){
 const files=new Map(),seen=new Set();let actual=0;
 const zip=new Unzip(file=>{
  const entry=entries.get(file.name);if(!entry||seen.has(file.name))throw Error('Workbook archive entries do not match its directory.');seen.add(file.name);
  let length=0,crc=0xffffffff;const chunks=[],retain=/\.(xml|rels)$/i.test(file.name);
  file.ondata=(error,data,final)=>{
   if(error)throw Error('Workbook compressed data is damaged.');length+=data.length;actual+=data.length;
   if(length>entry.expanded||length>EXCEL_LIMITS.entryBytes||actual>EXCEL_LIMITS.expandedBytes)throw Error('Workbook expanded beyond its declared size.');
   crc=crcUpdate(crc,data);if(retain)chunks.push(data);
   if(final){if(length!==entry.expanded||((crc^0xffffffff)>>>0)!==entry.crc)throw Error('Workbook archive checksum or size does not match.');
    if(retain){const result=new Uint8Array(length);let at=0;for(const chunk of chunks){result.set(chunk,at);at+=chunk.length;}files.set(file.name,result);}}
  };file.start();
 });zip.register(UnzipInflate);
 for(let at=0;at<bytes.length;at+=2048)zip.push(bytes.subarray(at,at+2048),at+2048>=bytes.length);
 if(seen.size!==entries.size)throw Error('Workbook archive is incomplete.');return files;
}
const parser=new XMLParser({ignoreAttributes:false,removeNSPrefix:true,parseTagValue:false,parseAttributeValue:false,trimValues:false,processEntities:false});
function decode(value){return String(value??'').replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_,key)=>{
 if(key[0]==='#'){const code=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1));if(!Number.isInteger(code)||code<1||code>0x10ffff||(code>=0xd800&&code<=0xdfff))throw Error('Invalid XML character.');return String.fromCodePoint(code);}
 return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[key.toLowerCase()];});}
function text(value){if(value===undefined||value===null)return '';if(typeof value!=='object')return decode(value);if(value['#text']!==undefined)return decode(value['#text']);return '';}
function rich(value){if(!value)return '';if(value.t!==undefined)return text(value.t);return array(value.r).map(run=>text(run.t)).join('');}
function xml(files,name){const bytes=files.get(name);if(!bytes)throw Error('Workbook is missing '+name+'.');const source=utf8.decode(bytes);
 if(/<!\s*(DOCTYPE|ENTITY)\b/i.test(source))throw Error('Workbook XML declarations are unsupported.');
 const valid=XMLValidator.validate(source);if(valid!==true)throw Error('Workbook XML is invalid: '+name+'.');return parser.parse(source);
}
function relationshipPath(target){const value=decode(target);if(!value||/^[a-z][a-z\d+.-]*:/i.test(value)||value.startsWith('//')||value.includes('\\'))throw Error('Unsupported external workbook relationship.');return new URL(value,'https://travelit.invalid/xl/workbook.xml').pathname.slice(1);}
export function readExcelWorkbook(input){
 const bytes=input instanceof Uint8Array?input:new Uint8Array(input);const directory=inspectExcelArchive(bytes),files=expandArchive(bytes,directory);
 const workbook=xml(files,'xl/workbook.xml').workbook;const rels=array(xml(files,'xl/_rels/workbook.xml.rels').Relationships?.Relationship);
 const relations=new Map(rels.filter(r=>r['@_TargetMode']!=='External').map(r=>[r['@_Id'],relationshipPath(r['@_Target'])]));
 const sheets=array(workbook?.sheets?.sheet);if(!sheets.length||sheets.length>EXCEL_LIMITS.sheets)throw Error('Workbook must contain 1–40 worksheets.');
 const strings=files.has('xl/sharedStrings.xml')?array(xml(files,'xl/sharedStrings.xml').sst?.si).map(rich):[];
 const styles=files.has('xl/styles.xml')?xml(files,'xl/styles.xml').styleSheet:{};
 const formats=new Map(array(styles?.numFmts?.numFmt).map(f=>[Number(f['@_numFmtId']),decode(f['@_formatCode'])]));
 const styleFormats=array(styles?.cellXfs?.xf).map(style=>formats.get(Number(style['@_numFmtId']))||({14:'mm-dd-yy',20:'h:mm',21:'h:mm:ss',22:'m/d/yy h:mm',46:'[h]:mm:ss'}[Number(style['@_numFmtId'])]||''));
 let cellCount=0;const names=new Set();
 const result=sheets.map(sheet=>{
  const name=decode(sheet['@_name']);if(!name||names.has(name))throw Error('Duplicate or missing worksheet name.');names.add(name);
  const path=relations.get(sheet['@_id']);if(!path)throw Error('Worksheet relationship is missing.');const data=xml(files,path).worksheet;
  const seen=new Set(),rowNumbers=new Set(),rows=[];
  for(const row of array(data?.sheetData?.row)){
   const rowNumber=Number(row['@_r']);if(!Number.isSafeInteger(rowNumber)||rowNumber<1||rowNumber>1048576)throw Error('Invalid worksheet row.');if(rowNumbers.has(rowNumber))throw Error('Duplicate worksheet row.');rowNumbers.add(rowNumber);const cells={};
   for(const cell of array(row.c)){
    const address=cell['@_r'];if(!/^[A-Z]{1,3}[1-9]\d*$/.test(address||'')||Number(address.match(/\d+$/)[0])!==rowNumber||seen.has(address))throw Error('Invalid or duplicate cell address.');const column=address.replace(/\d+$/,'');if([...column].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)>16384)throw Error('Invalid worksheet column.');seen.add(address);
    const hasValue=cell.v!==undefined||cell.is!==undefined,formula=cell.f!==undefined?text(cell.f):null;if(!hasValue&&formula===null)continue;
    if(++cellCount>EXCEL_LIMITS.cells)throw Error('Workbook has too many populated cells.');
    const type=cell['@_t']||'n';let value=null;
    if(type==='s'&&cell.v!==undefined){const ix=Number(text(cell.v));if(!Number.isInteger(ix)||strings[ix]===undefined)throw Error('Invalid shared text cell.');value=strings[ix];}
    else if(type==='inlineStr')value=rich(cell.is);
    else if(hasValue){const raw=text(cell.v);value=type==='n'&&raw!==''?Number(raw):raw;if(type==='n'&&raw!==''&&!Number.isFinite(value))throw Error('Invalid numeric cell.');}
    cells[address.replace(/\d+$/,'')]={address,type,value,formula,format:styleFormats[Number(cell['@_s']||0)]||''};
   }
   if(Object.keys(cells).length)rows.push({number:rowNumber,cells});
  }
  return {name,rows};
 });
 return {date1904:['1','true'].includes(String(workbook?.workbookPr?.['@_date1904'])),sheets:result,cellCount};
}
