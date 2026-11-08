/** TravelIt packing templates. Local defaults only; no remote service. */
import {normalizePacking} from './domain.js';
export const PACKING_TEMPLATES=Object.freeze({
 'Every trip':[['Essentials','ID and booking references',1],['Essentials','Emergency contact list',1],['Electronics','Phone chargers',1],['Electronics','Power bank',1],['Personal care','Toiletries',1],['Personal care','Personal medicines and first-aid kit',1],['Clothing','Change of clothes',1],['Family','Drinking water',1]],
 'Swimming':[['Clothing','Swimwear',1],['Clothing','Swim towel',1],['Family','Swim goggles',1],['Essentials','Wet bag',1],['Clothing','Pool sandals',1]],
 'Staycation':[['Essentials','Hotel reservation reference',1],['Clothing','Sleepwear',1],['Clothing','Lounge clothes',1],['Family','Books and games',1],['Electronics','Device chargers',1]],
 'Camping':[['Essentials','Tent and groundsheet',1],['Essentials','Sleeping bag and mat',1],['Essentials','Headlamp and spare batteries',1],['Family','Cooking kit and food storage',1],['Family','Drinking water',1],['Essentials','Rubbish bags',1],['Clothing','Weather layer',1]],
 'Cultural immersion':[['Clothing','Modest clothing for local visits',1],['Clothing','Comfortable walking shoes',1],['Essentials','Small cash and local contact details',1],['Essentials','Notebook',1],['Family','Reusable water bottle',1]],
 'Countryside':[['Clothing','Walking shoes',1],['Clothing','Sun hat',1],['Personal care','Insect repellent',1],['Family','Drinking water',1],['Essentials','Offline route reference',1]],
 'Mountain':[['Clothing','Warm layer',1],['Clothing','Rain jacket',1],['Clothing','Trail shoes',1],['Essentials','Headlamp',1],['Family','Water and trail snacks',1]],
 'City':[['Clothing','Comfortable walking shoes',1],['Essentials','Transit and accommodation details',1],['Essentials','Small day bag',1],['Family','Reusable water bottle',1]],
 'Rainy weather':[['Clothing','Rain jacket',1],['Essentials','Dry bag',1],['Clothing','Spare socks',2],['Essentials','Umbrella',1]],
 'With children':[['Family','Child clothing and spare outfit',1],['Family','Child snacks and drinking water',1],['Family','Comfort item and travel activities',1],['Personal care','Wipes and small towel',1],['Family','Age-appropriate personal flotation device for water activities',1]],

  'Family road trip':[
    ['Essentials','Driver’s license',1],['Essentials','Vehicle registration and insurance copies',1],['Electronics','Phone chargers',2],['Electronics','Power bank',1],['Family','Drinking water',1],['Family','Travel snacks',1],['Personal care','First-aid kit',1],['Clothing','Change of clothes',1]
  ],
  'Beach vacation':[
    ['Clothing','Swimwear',1],['Clothing','Beach towels',2],['Personal care','Sunscreen',1],['Personal care','After-sun lotion',1],['Family','Swim goggles',1],['Family','Waterproof bag',1],['Electronics','Waterproof phone pouch',1],['Essentials','Hotel reservation reference',1]
  ],
  'International flight':[
    ['Essentials','Original passport',1],['Essentials','Visa or entry permit if required',1],['Essentials','Flight booking reference',1],['Essentials','Travel insurance details',1],['Electronics','Travel adapters',1],['Essentials','Accommodation confirmation',1],['Clothing','Carry-on change of clothes',1],['Personal care','Travel-size toiletries',1]
  ],
  'Hiking day trip':[
    ['Essentials','Route plan and emergency contact',1],['Family','Water and trail snacks',1],['Clothing','Weather layer',1],['Personal care','First-aid kit',1],['Essentials','Headlamp',1],['Essentials','Offline navigation prepared',1]
  ],
  'Diving trip':[
    ['Essentials','Certification and operator information',1],['Personal care','Reef-safe sun protection',1],['Clothing','Swimwear',1],['Essentials','Operator and emergency contact',1],['Family','Dry bag',1],['Electronics','Waterproof camera',1]
  ]
});
export const labelKey = v=>String(v||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('en');
/** Build only not-yet-listed items for a trip. Never reset packed statuses or generate duplicate IDs on retries. */
export function prepareTemplateImport(templateName,trip,current=[],now='2026-10-30T00:00:00.000Z',idFactory){
  if(!Object.hasOwn(PACKING_TEMPLATES,templateName))throw Error('Unknown packing template.');
  if(!trip?.id)throw Error('Select a trip before applying a template.');
  if(typeof idFactory!=='function')throw Error('ID generator is required.');
  const seen=new Set(current.filter(x=>x.tripId===trip.id).map(x=>labelKey(x.label)));
  const prepared=[];
  for(const [category,label,quantity] of PACKING_TEMPLATES[templateName]){
    const k=labelKey(label);if(seen.has(k))continue;seen.add(k);
    prepared.push(normalizePacking({id:idFactory(),label,category,quantity,owner:'',packed:false},trip,now));
  }
  return {items:prepared,skipped:PACKING_TEMPLATES[templateName].length-prepared.length};
}

// Combine one or more activities with an environment and party profile.
export const TEMPLATE_GROUPS=Object.freeze({
 'Essentials':{'Every trip':'Every trip','Family road trip':'Family road trip','International flight':'International flight','With children':'With children'},
 'Activities':{'Swimming':'Swimming','Diving':'Diving trip','Staycation':'Staycation','Hiking':'Hiking day trip','Camping':'Camping','Cultural immersion':'Cultural immersion'},
 'Environment':{'Beach':'Beach vacation','Countryside':'Countryside','Mountain':'Mountain','City':'City','Rainy weather':'Rainy weather'}
});

export function prepareTemplateSet(names,trip,current,now,idFactory){
 if(!Array.isArray(names)||!names.length)throw Error('Choose at least one packing template.');
 const items=[];let skipped=0;for(const name of [...new Set(names)]){const next=prepareTemplateImport(name,trip,[...current,...items],now,idFactory);items.push(...next.items);skipped+=next.skipped;}return {items,skipped};
}
