import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','..');
const code=fs.readFileSync(path.join(root,'thinkit/assets/swimlane-view.js'),'utf8');
const module={exports:{}};
vm.runInNewContext(code,{module,globalThis:{}},{filename:'swimlane-view.js'});
const S=module.exports;

class MockElement {
  constructor(tag,attributes={},text=''){
    this.tagName=tag;this.attributes={...attributes};this.textContent=text;
    this.children=[];this.ownerDocument=doc;this.listeners={};this.disabled=false;
    this.scrollLeft=0;this.scrollTop=0;this.style={};
  }
  setAttribute(name,value){this.attributes[name]=String(value)}
  getAttribute(name){return this.attributes[name]??null}
  removeAttribute(name){delete this.attributes[name]}
  appendChild(node){this.children.push(node);return node}
  replaceChildren(...items){this.children=items}
  insertBefore(node,first){
    const i=this.children.indexOf(first);
    this.children.splice(i===-1?0:i,0,node);
  }
  cloneNode(deep){
    const clone=new MockElement(this.tagName,{...this.attributes},this.textContent);
    if(deep)for(const child of this.children)clone.appendChild(child.cloneNode(true));
    return clone;
  }
  querySelectorAll(selector){
    const matches=[];
    const walk=(node,withinMarker=false)=>{
      for(const child of node.children){
        if(selector==='.sw1-activity'&&(child.attributes.class||'').split(/\s+/).includes('sw1-activity'))matches.push(child);
        if(selector==='marker path'&&withinMarker&&child.tagName==='path')matches.push(child);
        walk(child,withinMarker||child.tagName==='marker');
      }
    };
    walk(this);return matches;
  }
  querySelector(selector){
    if(selector==='.sw1-scroll svg'){
      const scroll=this.querySelectorAll('.sw1-scroll')[0];
      return scroll?.children.find(x=>x.tagName==='svg')||null;
    }
    const found=[];
    const search=node=>{for(const child of node.children){
      if(selector.startsWith('.')&&child.className.split(/\s+/).includes(selector.slice(1)))found.push(child);
      search(child);
    }};
    search(this);return found[0]||null;
  }
  addEventListener(name,callback){this.listeners[name]=callback}
  get className(){return this.attributes.class||''}
  set className(value){this.attributes.class=String(value)}
}
const doc={
  createElementNS:(_ns,tag)=>new MockElement(tag),
  createElement:tag=>new MockElement(tag)
};
function fixture(){
  const svg=new MockElement('svg',{width:'850',height:'500',viewBox:'0 0 850 500'});
  const defs=svg.appendChild(new MockElement('defs'));
  const marker=defs.appendChild(new MockElement('marker',{id:'sw1Arrow'}));
  marker.appendChild(new MockElement('path',{fill:'var(--line-strong)',d:'M 0 0 L 8 4 L 0 8 z'}));
  const lane=svg.appendChild(new MockElement('g',{'aria-hidden':'true'}));
  lane.appendChild(new MockElement('rect',{class:'sw1-lane',x:'8',y:'56',width:'830',height:'152'}));
  const node=svg.appendChild(new MockElement('g',{class:'sw1-activity',role:'button',tabindex:'0','aria-pressed':'true'}));
  node.appendChild(new MockElement('title',{},'Owner & Architect < approval authority >'));
  return svg;
}
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;');
class Serializer {
  serializeToString(element){
    const attrs=Object.entries(element.attributes).map(([k,v])=>' '+k+'="'+esc(v)+'"').join('');
    return '<'+element.tagName+attrs+'>'+esc(element.textContent)+
      element.children.map(child=>this.serializeToString(child)).join('')+
      '</'+element.tagName+'>';
  }
}

test('SW4 exports a complete self-styled SVG clone and never alters the live diagram',()=>{
  const svg=fixture(),before=new Serializer().serializeToString(svg);
  const xml=S.standaloneSvg(svg,Serializer);
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.ok(xml.includes('<svg'));
  assert.ok(xml.includes('viewBox="0 0 850 500"'));
  assert.ok(xml.includes('xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(xml.includes('.sw1-activity-box{fill:white;stroke:#405969;'));
  assert.ok(xml.includes('.sw1-link.cross-lane{stroke:#007b87;'));
  assert.ok(xml.includes('fill="#405969"'), 'Arrow marker must not depend on ThinkIt theme CSS');
  assert.ok(!xml.includes('var(--line-strong)'), 'Portable SVG must not retain a host theme variable');
  assert.ok(xml.includes('Owner &amp; Architect &lt; approval authority &gt;'), 'Source text must be safely escaped');
  assert.ok(xml.includes('role="img"'));
  assert.ok(xml.includes('ThinkIt responsibility swimlane snapshot'));
  assert.ok(xml.includes('not necessarily formal handoffs'));
  assert.ok(xml.includes('Activity order is not a schedule'));
  assert.ok(!xml.includes('role="button"'), 'Snapshot must not advertise a dead editor button');
  assert.ok(!xml.includes('tabindex="0"'));
  assert.equal(new Serializer().serializeToString(svg),before);
});
test('SW4 fails closed when the SVG is missing or serialization is unavailable',()=>{
  assert.throws(()=>S.standaloneSvg(null,Serializer),/unavailable/);
  assert.throws(()=>S.standaloneSvg(fixture(),null),/unavailable/);
  assert.throws(()=>S.standaloneSvg({},Serializer),/unavailable/);
});
test('SW4 export control is disabled for a valid empty responsibility view',()=>{
  const loaded={exports:{}};
  vm.runInNewContext(code,{module:loaded,globalThis:{},document:doc},{filename:'swimlane-view.js'});
  const root=new MockElement('div');
  const model={visibleCount:0,lanes:[],links:[],handoffs:0,assignedCount:0,projectedCount:0,
    unclassifiedCount:0,groupMode:'literal',width:850,height:200,dense:false,
    focusOptions:[],depthMode:'next',sourceNodeCount:0,disclaimer:'Display only.'};
  loaded.exports.render(root,model,{onGroupMode:()=>{}});
  const tools=root.querySelector('.sw3-view-tools');
  assert.ok(tools);
  const exportButton=tools.querySelector('.sw4-export-svg');
  assert.ok(exportButton);
  assert.equal(exportButton.disabled,true);
  assert.equal(exportButton.textContent,'Export current view · SVG');
});

test('SW4 unassigned warnings count activities, not WBS summaries or decision/terminal symbols',()=>{
  const nodes=[
    {id:'phase',shape:'subprocess',label:'Phase',flowActivity:{responsible:''}},
    {id:'gate',shape:'decision',label:'Decision',flowActivity:{responsible:''}},
    {id:'end',shape:'terminator',label:'End',flowActivity:{responsible:''}},
    {id:'needs-owner',shape:'process',label:'Unassigned task',flowActivity:{responsible:''}},
    {id:'owned',shape:'process',label:'Assigned task',flowActivity:{responsible:'Architect'}}
  ];
  const page={mode:'flow',nodes,edges:[]};
  const before=JSON.stringify(page);
  const projection={visibleNodeIds:nodes.map(n=>n.id),edgeViews:[]};
  const original=S.project(page,projection);
  assert.equal(original.visibleCount,5);
  assert.equal(original.unassignedCount,1);
  const reviewed=S.project(page,projection,undefined,{groupMode:'categories',resolveCategory:n=>{
    const key=n.shape==='subprocess'?'subprocess':n.shape==='decision'?'decision':
      n.shape==='terminator'?'terminator':n.id==='needs-owner'?'unassigned':'reviewed';
    return {key:'meta:'+key,label:key,status:key};
  }});
  assert.equal(reviewed.visibleCount,5);
  assert.equal(reviewed.unassignedCount,1);
  assert.equal(JSON.stringify(page),before,'View-only count must preserve source records');
});
