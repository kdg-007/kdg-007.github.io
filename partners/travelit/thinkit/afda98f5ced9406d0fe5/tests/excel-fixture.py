"""Synthetic OOXML only. Contains no user workbook data or real destinations."""
import sys,zipfile
from xml.sax.saxutils import escape

def cell(col,row,value,formula=None,style=None):
    attrs=f' r="{col}{row}"'+(f' s="{style}"' if style else '')
    if isinstance(value,str): return f'<c{attrs} t="inlineStr"><is><t>{escape(value)}</t></is></c>'
    return f'<c{attrs}>'+('' if formula is None else f'<f>{escape(formula)}</f>')+('' if value is None else f'<v>{value}</v>')+'</c>'
def row(number,values):return f'<row r="{number}">'+''.join(cell(chr(65+i),number,v) for i,v in enumerate(values))+'</row>'
mode=sys.argv[2] if len(sys.argv)>2 else 'normal'
counts=[8,9,8,8,8,7];types=['Transport']*14+['Meal']*15+['Prep/Admin']*7+['Free']*6+['Tour']*6
activity=[row(1,['SYNTHETIC IMPORT CHECK | six days']),row(2,['Code','Activity','Duration','Date','Start','Finish','Type','Predecessor'])];details=[row(1,['Code','Day','Activity / destination','Area','Type','Status','Implementation detail / verification','Google Maps search pin','Research / official source','Suggested decision'])]
n=0;r=3;codeList=[]
for day,count in enumerate(counts):
    activity.append(row(r,[f'{day+1}.00',f'DAY {day+1}']));r+=1
    for j in range(count):
        n+=1;code=f'{day+1}.{j+1:02d}';codeList.append(code);start=(6*60+j*60)/1440;finish=start+30/1440
        if mode=='invalid' and n==1:finish=start-30/1440
        activity.append(row(r,[code,f'Sample activity {n}',30/1440,46361+day,start,finish,types[n-1],codeList[-2] if j else '']));r+=1
        flag='Core' if n<=25 else 'Flexible' if n<=36 else 'Booking' if n<=43 else 'Conditional'
        details.append(row(n+1,[code,day+1,f'Sample destination {n}','Sample area',types[n-1],flag,'Verify before travel','https://www.google.com/maps/search/?api=1&query='+('17.7,121.8' if n==1 else 'Sample+destination'),'https://example.org/reference','Review']))
activity += [row(r,['NOTES','Synthetic source note']),row(r+1,['STATUS','Synthetic source status'])]
sheets={'Activity':activity,'Activity Types':[row(1,['Type','Definition']),row(2,['Transport','Moving between stops'])],'Places & Maps':details,'Cost Estimate':[row(1,['Item','Amount']),row(2,['Illustrative allowance',100])],'Hotels & Bookings':[row(1,['Hotel','Status']),row(2,['Sample stay','Inquire'])],'Review & Decisions':[row(1,['Item','Action']),row(2,['Sample item','Review'])]}
parts={'[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>','xl/workbook.xml':'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+''.join(f'<sheet name="{escape(name)}" sheetId="{i}" r:id="rId{i}"/>' for i,name in enumerate(sheets,1))+'</sheets></workbook>','xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+''.join(f'<Relationship Id="rId{i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{i}.xml"/>' for i in range(1,len(sheets)+1))+'</Relationships>'}
for i,rows in enumerate(sheets.values(),1):parts[f'xl/worksheets/sheet{i}.xml']='<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+''.join(rows)+'</sheetData></worksheet>'
if mode=='badxml':parts['xl/workbook.xml']='<workbook><bad></workbook>'
if mode=='entity':parts['xl/workbook.xml']='<!DOCTYPE workbook [<!ENTITY x "test">]>'+parts['xl/workbook.xml']
if mode=='macro':parts['xl/vbaProject.bin']='dummy'
with zipfile.ZipFile(sys.argv[1],'w',zipfile.ZIP_DEFLATED) as out:
    for name,data in parts.items():out.writestr(name,data)
