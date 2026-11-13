import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync('thinkit/40791585175d0e8d51c4/assets/print-layout.js','utf8');
const settingsKey='thinkit-print-page-settings-v1',px=96/25.4;
function layout(storage=new Map()){
 const nodes=new Map(),events=new Map();
 class Node{
  constructor(tag='div'){this.tag=tag;this.style={};this.children=[];this.dataset={};this.value='';this.checked=false;this.listeners=new Map();this.attrs={};this.classList={toggle(){}};}
  set id(id){this._id=id;nodes.set(id,this);}get id(){return this._id;}
  set innerHTML(html){for(const match of html.matchAll(/<(input|p|select)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){
   const n=new Node(match[1]);n.id=match[3];n.value=match[2].match(/value="([^"]*)"/)?.[1]||'';n.checked=/\bchecked\b/.test(match[2]);
  }nodes.get('dimensionMode').value='fit';}
  setAttribute(k,v){this.attrs[k]=v;}getAttribute(k){return this.attrs[k];}
  append(n){this.children.push(n);}insertBefore(n){this.append(n);}replaceChildren(){this.children=[];}
  querySelector(selector){if(selector==='svg')return diagram;return new Node();}
  addEventListener(name,fn){const rows=this.listeners.get(name)||[];rows.push(fn);this.listeners.set(name,rows);}
  change(value){if(typeof value==='boolean')this.checked=value;else this.value=value;for(const fn of this.listeners.get('change')||[])fn();for(const fn of this.listeners.get('input')||[])fn();}
  get offsetWidth(){return Number.parseFloat(this.style.width)*px;}get offsetHeight(){return Number.parseFloat(this.style.height)*px;}
 }
 for(const id of ['paper','orientation','margins','framing','scale','halign','valign','offsetX','offsetY','diagramSlot','sheet','controls','pageRules','pageInfo','print','warning','scaleValue','stageArea','sheetHost','fit']){const n=new Node();n.id=id;}
 Object.entries({paper:'A4',orientation:'landscape',margins:'10',framing:'content',scale:'100',halign:'center',valign:'center',offsetX:'0',offsetY:'0'}).forEach(([id,value])=>nodes.get(id).value=value);
 nodes.get('diagramSlot').dataset.contentViewBox='0 0 100 50';
 nodes.get('stageArea').clientWidth=1000;nodes.get('stageArea').clientHeight=700;
 const diagram=new Node('svg');let headingHeight=11.5*px;
 const localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)};
 const document={getElementById:id=>nodes.get(id),createElement:tag=>new Node(tag),createElementNS:(_,tag)=>new Node(tag),head:new Node()};
 const window={addEventListener:(name,fn)=>events.set(name,fn),focus(){},print(){}};
 const getComputedStyle=()=>{
  const s=nodes.get('sheet').style,margin=Number.parseFloat(s.padding)*px;
  return {width:String(Number.parseFloat(s.width)*px-(Number.parseFloat(s.paddingLeft)||Number.parseFloat(s.padding))*px-margin),height:String(Number.parseFloat(s.height)*px-(Number.parseFloat(s.paddingTop)||Number.parseFloat(s.padding))*px-margin-headingHeight)};
 };
 vm.runInNewContext(source,{document,window,localStorage,getComputedStyle,requestAnimationFrame:fn=>fn()});
 return {nodes,diagram,events,storage,setHeadingHeight:value=>headingHeight=value};
}
function close(a,b){assert.ok(Math.abs(a-b)<.0001,`${a} differs from ${b}`);}
test('paper rulers and physical artwork retain millimetre geometry independently of preview zoom',()=>{
 const t=layout(),n=id=>t.nodes.get(id);
 n('dimensionMode').change('physical');n('unitMillimeters').change('0.5');
 close(parseFloat(t.diagram.style.width)/px,50);close(parseFloat(t.diagram.style.height)/px,25);
 assert.match(n('artworkSize').textContent,/50.0 × 25.0 mm/);
 const ticks=n('paperRulers').children.filter(c=>c.tag==='line'&&c.attrs.x1===c.attrs.x2);
 assert.ok(ticks.some(c=>c.attrs.x1==='10'));assert.ok(ticks.some(c=>c.attrs.x1==='110'));
 n('stageArea').clientWidth=300;t.events.get('resize')();
 close(parseFloat(t.diagram.style.width)/px,50);close(parseFloat(t.diagram.style.height)/px,25);
 assert.equal(n('paperRulers').getAttribute('width'),'297mm');
 n('unitMillimeters').change('0');assert.equal(n('print').disabled,true);
});
test('paper and ruler choices survive reopening while diagram-specific scale and shifts reset',()=>{
 const first=layout(),n=id=>first.nodes.get(id);
 n('paper').change('A3');n('orientation').change('portrait');n('margins').change('5');n('rulerH').change(false);n('rulerV').change(true);n('rulerPrint').change(true);
 n('dimensionMode').change('physical');n('unitMillimeters').change('2');n('offsetX').change('30');
 const next=layout(first.storage),m=id=>next.nodes.get(id);
 assert.equal(m('paper').value,'A3');assert.equal(m('orientation').value,'portrait');assert.equal(m('rulerH').checked,false);assert.equal(m('rulerPrint').checked,true);
 assert.equal(m('sheet').style.paddingLeft,'11mm');assert.equal(m('sheet').style.paddingTop,undefined);
 assert.equal(m('dimensionMode').value,'fit');assert.equal(m('offsetX').value,'0');
});
test('fit recalculates available space before printing and after late header changes',()=>{
 const t=layout(),height=parseFloat(t.diagram.style.height);
 t.setHeadingHeight(700);t.events.get('beforeprint')();
 assert.ok(parseFloat(t.diagram.style.height)<height);
 assert.equal(t.nodes.get('warning').hidden,true);
});
test('invalid stored preferences do not alter a fresh page or block printing',()=>{
 for(const value of ['{broken',JSON.stringify({version:1,paper:'A0',orientation:'diagonal',margins:'-999',rulerH:'false'}),JSON.stringify({version:99,paper:'A2'})]){
  const t=layout(new Map([[settingsKey,value]]));assert.equal(t.nodes.get('paper').value,'A4');assert.equal(t.nodes.get('rulerH').checked,true);assert.equal(t.nodes.get('print').disabled,false);
 }
});
