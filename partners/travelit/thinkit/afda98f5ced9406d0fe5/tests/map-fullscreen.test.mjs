import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMapFullscreen} from '../js/map-fullscreen.js';
const observers=[];globalThis.MutationObserver=class{constructor(callback){this.callback=callback;observers.push(this);}observe(){}};
function fixture(mode){
 const listeners=new Map(),button={textContent:'',setAttribute(name,value){this[name]=value;}},doc={documentElement:{dataset:{workspaceView:'map'}},fullscreenEnabled:!!mode,fullscreenElement:null,querySelectorAll:()=>[button],querySelector:()=>null,addEventListener(name,work){listeners.set(name,work);}};
 doc.documentElement.requestFullscreen=async()=>{if(mode==='rejected')throw Error('blocked by browser');doc.fullscreenElement=doc.documentElement;};
 doc.exitFullscreen=async()=>{doc.fullscreenElement=null;listeners.get('fullscreenchange')?.();};
 return {doc,button,emit:(type,event)=>listeners.get(type)?.(event)};
}
test('map expansion and a visible exit work without native fullscreen',async()=>{
 const f=fixture(),controller=createMapFullscreen({document:f.doc});await controller.toggle();assert.equal(controller.active(),true);assert.equal(f.button.textContent,'Exit full screen');
 await controller.toggle();assert.equal(controller.active(),false);assert.equal(f.button['aria-pressed'],'false');
});
test('a refused native request keeps the expanded map and Escape exits it',async()=>{
 const f=fixture('rejected'),controller=createMapFullscreen({document:f.doc});await controller.toggle();assert.equal(controller.active(),true);
 let prevented=false;f.emit('keydown',{key:'Escape',preventDefault(){prevented=true;}});assert.equal(controller.active(),false);assert.equal(prevented,true);
});
test('native fullscreen exit resets the map controls',async()=>{
 const f=fixture('native'),controller=createMapFullscreen({document:f.doc});await controller.toggle();assert.equal(controller.active(),true);
 await f.doc.exitFullscreen();assert.equal(controller.active(),false);assert.equal(f.button.textContent,'Full screen');
});
test('changing away from Map exits expansion without changing trip data',async()=>{
 const f=fixture(),controller=createMapFullscreen({document:f.doc});await controller.toggle();f.doc.documentElement.dataset.workspaceView='trips';observers.at(-1).callback();
 assert.equal(controller.active(),false);
});
