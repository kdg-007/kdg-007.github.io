import assert from 'node:assert/strict';
import {TEMPLATE_GROUPS,PACKING_TEMPLATES,prepareTemplateSet} from '../js/packing-templates.js';
const trip={id:'trip'},existing=[{id:'existing',tripId:'trip',label:'Swimwear',quantity:2,packed:true}];let n=0;
const before=JSON.stringify(existing),result=prepareTemplateSet(['Every trip','Swimming','Beach vacation','Mountain','Camping'],trip,existing,'2026-11-08T00:00:00Z',()=>String(++n));
assert.equal(new Set(result.items.map(i=>i.label.toLowerCase())).size,result.items.length);assert.equal(JSON.stringify(existing),before);assert.ok(!result.items.some(i=>i.label==='Swimwear'));assert.ok(result.skipped>0);
for(const group of Object.values(TEMPLATE_GROUPS))for(const name of Object.values(group))assert.ok(PACKING_TEMPLATES[name]?.length);
assert.throws(()=>prepareTemplateSet([],trip,existing,'',()=>''));assert.throws(()=>prepareTemplateSet(['Unknown'],trip,existing,'',()=>''));
console.log('TRAVELIT_COMBINED_PACKING_PRESERVATION_PASS');
