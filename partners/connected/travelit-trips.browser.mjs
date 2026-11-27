// The redesigned TravelIt trips workspace: import a whole workbook, edit a stop,
// attach KeepIt items (through a stand-in for the KeepIt host bridge), see them on
// the timeline, tick packing, record spending, and keep it all after a reload.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,statSync} from 'node:fs';
import {extname,join,resolve,sep} from 'node:path';
import {chromium,webkit} from 'playwright';

const root=resolve('.'),base='/partners/travelit/thinkit/afda98f5ced9406d0fe5/';
const fixture=join(root,base,'tests/fixtures-sample-trip.xlsx');
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.json':'application/json'};
const server=createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://x').pathname);if(p.endsWith('/'))p+='index.html';const f=resolve(root,'.'+p);
  try{assert.ok(f.startsWith(root+sep));statSync(f);res.writeHead(200,{'content-type':types[extname(f)]||'application/octet-stream','cache-control':'no-store'}).end(readFileSync(f))}catch{res.writeHead(404).end()}});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const origin='http://127.0.0.1:'+server.address().port;
const photo=Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=','base64');

async function run(engine){
  const browser=await engine.launch({headless:true});
  try{
    const context=await browser.newContext({viewport:{width:1180,height:820}});
    await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
    await context.addInitScript(()=>{
      const scope='sha256:'+'a'.repeat(64),items=[{scope,itemId:'11111111-1111-4111-8111-111111111111',kind:'file',title:'Hotel booking.pdf'},{scope,itemId:'22222222-2222-4222-8222-222222222222',kind:'note',title:'Pier sketch'}];
      globalThis.__opened=[];globalThis.__added=0;
      window.travelItKeepItLinks={async list(){return items},async open(r){globalThis.__opened.push(r.title)},
        async thumbnail(r){if(r.kind==='note'||/\.pdf$/.test(r.title))return null;const c=document.createElement('canvas');c.width=80;c.height=60;c.getContext('2d').fillRect(0,0,80,60);return new Promise(ok=>c.toBlob(ok,'image/jpeg'))},
        async addFile(file,{title}){globalThis.__added++;const it={scope,itemId:'33333333-3333-4333-8333-00000000000'+globalThis.__added,kind:'file',title};items.push(it);return it}};
    });
    const page=await context.newPage(),errors=[];
    const tab=async name=>{await page.locator('.tabs a',{hasText:name}).click();await page.locator('#view h1',{hasText:name}).waitFor()};page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
    await page.goto(origin+base+'trips.html');await page.locator('html[data-travelit-trips=ready]').waitFor();
    assert.match(await page.locator('#view').innerText(),/No trips yet/);

    // Import every sheet of the workbook.
    const [chooser]=await Promise.all([page.waitForEvent('filechooser'),page.getByRole('button',{name:'Import spreadsheet'}).first().click()]);
    await chooser.setFiles(fixture);await page.waitForURL(/#trip\/.+\/plan$/);
    assert.equal(await page.locator('.stop .what').count(),6,'all stops imported');
    assert.match(await page.locator('.stop',{hasText:'Morning swim'}).innerText(),/Optional \/ weather/,'priority from Activity Links');

    // Edit a stop: change its time, attach a KeepIt note and add a new photo.
    await page.locator('.stop .what',{hasText:'Boat tour'}).click();await page.locator('#sheet[open]').waitFor();
    await page.locator('#sheet [name=time]').fill('10:00');
    await page.locator('[data-sact=att-pick]').click();await page.locator('#att-items label',{hasText:'Pier sketch'}).locator('input').check();await page.locator('[data-sact=att-add]').click();
    const [pick]=await Promise.all([page.waitForEvent('filechooser'),page.locator('[data-sact=att-photo]').click()]);
    await pick.setFiles({name:'pier.jpg',mimeType:'image/jpeg',buffer:photo});
    await page.locator('#att-list').getByText('pier.jpg').waitFor();
    await page.locator('#sheet button[value=save]').click();await page.locator('#sheet').waitFor({state:'hidden'});
    const boat=page.locator('.stop',{hasText:'Boat tour'});
    assert.match(await boat.innerText(),/10:00/);assert.equal(await boat.locator('.thumbs > *').count(),2,'two KeepIt items linked');
    await boat.locator('img.thumb').waitFor();

    // Timeline shows readable blocks with the attached photo.
    await page.getByRole('button',{name:'Timeline'}).click();
    const block=page.locator('.tl-block',{hasText:'Boat tour'});
    assert.match(await block.innerText(),/10:00[\s\S]*Boat tour[\s\S]*Boat pier/);
    await block.locator('img:not([hidden])').waitFor();
    await block.click();await page.locator('#sheet[open]').waitFor();await page.getByRole('button',{name:'Close'}).click();

    // Map lists the trip's places; a place without coordinates can be pinned.
    await page.locator('.tabs a',{hasText:'Map'}).click();await page.locator('#map .leaflet-marker-icon').first().waitFor();
    assert.equal(await page.locator('#map .leaflet-marker-icon').count(),2);
    const hotel=page.locator('.place',{hasText:'Lake hotel'});await hotel.getByRole('button',{name:'Set pin on map'}).click();
    await page.locator('#map').click({position:{x:200,y:200}});await page.getByText('Pin saved').waitFor();
    assert.equal(await page.locator('#map .leaflet-marker-icon').count(),3,'new pin shows');

    // Packing, spending, booking reference and journal persist.
    await tab('Packing');assert.equal(await page.locator('.money').innerText(),'1/3');
    await page.locator('label',{hasText:'Swimwear'}).click();await page.locator('.money',{hasText:'2/3'}).waitFor();
    await page.locator('.tabs a',{hasText:'Today'}).click();await page.locator('[data-form=spend]').waitFor();await page.locator('[data-form=spend] [name=amt]').fill('250');await page.locator('[data-form=spend] [name=note]').fill('Ice cream');await page.locator('[data-form=spend] button').click();await page.getByText('₱250 added').waitFor();
    await tab('Budget');assert.match(await page.locator('#view').innerText(),/No amount yet:[\s\S]*Fuel/);
    const breakfast=page.locator('tr',{hasText:'Breakfast'}).locator('[data-act=actual]');await breakfast.fill('700');await breakfast.press('Tab');await page.locator('.money',{hasText:'₱950'}).first().waitFor();
    await tab('Bookings');await page.getByRole('button',{name:'Edit'}).first().click();await page.locator('#sheet [name=confirmation]').fill('LK-2030');await page.locator('#sheet button[value=save]').click();await page.getByText('Reference: LK-2030').waitFor();
    await tab('Journal');await page.locator('[data-act=journal-text]').first().fill('Calm lake, great pancakes.');await page.getByText('Journal saved').waitFor();

    await page.reload();await page.locator('html[data-travelit-trips=ready]').waitFor();
    assert.equal(await page.locator('[data-act=journal-text]').first().inputValue(),'Calm lake, great pancakes.');
    await tab('Budget');assert.equal(await page.locator('.money').first().innerText(),'₱950');
    await tab('Plan');await page.getByRole('button',{name:'List',exact:true}).click();assert.equal(await page.locator('.stop',{hasText:'Boat tour'}).locator('.thumbs > *').count(),2);

    // Classic screens read the same records.
    await page.goto(origin+base+'index.html?view=trips');await page.locator('html[data-travelit-ready="true"]').waitFor();
    assert.match(await page.locator('body').innerText(),/Lake weekend/);
    assert.deepEqual(errors,[]);
    console.log(engine.name()+': TravelIt trips workspace import, edit, attach, timeline, map, packing, budget and journal pass');
  }finally{await browser.close()}
}
try{for(const engine of process.env.STABILITY_CHROMIUM_ONLY?[chromium]:[chromium,webkit])await run(engine)}
finally{server.close()}
