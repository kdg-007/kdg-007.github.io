// A private ancillary PNG chunk retains editable paper and strokes alongside the preview.
const chunkType = new TextEncoder().encode('kiNt');
function crc32(bytes){
  let value=0xffffffff;
  for(const byte of bytes){value^=byte;for(let i=0;i<8;i++)value=(value>>>1)^((value&1)?0xedb88320:0);}
  return (value^0xffffffff)>>>0;
}
export function packPage(png,page){
  const json=new TextEncoder().encode(JSON.stringify(page));
  const chunk=new Uint8Array(json.length+12), view=new DataView(chunk.buffer);
  view.setUint32(0,json.length);chunk.set(chunkType,4);chunk.set(json,8);
  view.setUint32(chunk.length-4,crc32(chunk.subarray(4,-4)));
  return new Blob([png.slice(0,-12),chunk,png.slice(-12)],{type:'image/png'});
}
export async function readPage(png){
  if(!png)return null;
  const bytes=new Uint8Array(await png.arrayBuffer()),view=new DataView(bytes.buffer);
  for(let i=8;i+12<=bytes.length;){
    const length=view.getUint32(i),end=i+length+12;
    if(end>bytes.length)break;
    if(chunkType.every((b,j)=>bytes[i+4+j]===b)){
      if(crc32(bytes.subarray(i+4,end-4))!==view.getUint32(end-4))break;
      try {
        const page=JSON.parse(new TextDecoder().decode(bytes.subarray(i+8,end-4)));
        if(page.version===1 && Array.isArray(page.mm)&&page.mm.length===2&&page.mm.every(v=>Number.isFinite(v)&&v>=1)&&Array.isArray(page.strokes)&&page.strokes.every(s=>Array.isArray(s.points)&&s.points.length&&s.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.width)&&p.width>0)))return page;
      } catch{}
      break;
    }
    i=end;
  }
  return null;
}
// Notes store a lossless PNG so existing readers and offline note packages can display ink.
export async function drawNote(original, commit) {
  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-label', 'Note drawing');
  dialog.style.cssText = 'position:fixed;inset:0;margin:0;width:100%;height:100dvh;max-width:none;max-height:none;padding:max(10px,env(safe-area-inset-top)) 12px max(10px,env(safe-area-inset-bottom));box-sizing:border-box;display:flex;flex-direction:column;background:#e4e7e9;color:#172d39';
  const toolbar = document.createElement('div');
  toolbar.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-bottom:8px';
  const tool = document.createElement('select');
  tool.setAttribute('aria-label','Drawing tool');
  for (const name of ['Pen','Pencil','Highlighter','Marker','Straight line','Eraser']) tool.add(new Option(name,name));
  const color = document.createElement('input');
  color.type = 'color';
  color.value = '#173449';
  color.setAttribute('aria-label','Ink color');
  const sizes = {A4:[210,297],A3:[297,420],A5:[148,210],Letter:[215.9,279.4],Legal:[215.9,355.6]};
  function choice(label,options) {
    const el=document.createElement('select');
    el.setAttribute('aria-label',label);
    for(const value of options) el.add(new Option(value,value));
    toolbar.append(el);
    return el;
  }
  const size=choice('Paper size',[...Object.keys(sizes),'Custom']);
  const guide=choice('Paper guides',['Plain','Ruled','Grid']);
  const width=choice('Line width',['Fine','Medium','Broad']);
  function millimetres(label,value){
    const input=document.createElement('input');
    input.type='number'; input.min='1'; input.step='any'; input.value=value;
    input.setAttribute('aria-label',label+' in millimetres');
    const field=document.createElement('label');field.append(label+' mm ',input);field.hidden=true;toolbar.append(field);
    return input;
  }
  const paperWidth=millimetres('Width',210),paperHeight=millimetres('Height',297);
  toolbar.append(tool,color);
  const canvas = document.createElement('canvas');
  canvas.width = 1500;
  canvas.height = 950;
  canvas.style.cssText = 'width:100%;display:block;touch-action:none;background:white;cursor:crosshair';
  canvas.setAttribute('aria-label','Drawing surface. Use a pen or mouse.');
  const ctx = canvas.getContext('2d');
  const background = document.createElement('canvas');
  background.width = canvas.width;
  background.height = canvas.height;
  const base = background.getContext('2d');
  base.fillStyle = 'white';
  base.fillRect(0,0,background.width,background.height);
  const saved=await readPage(original);
  const raster=original && !saved;
  if (raster) {
    const url = URL.createObjectURL(original);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      background.width=image.naturalWidth; background.height=image.naturalHeight; base.drawImage(image,0,0);
    } finally { URL.revokeObjectURL(url); }
  }
  const sheet=document.createElement('div');
  sheet.style.cssText='flex:1;min-height:0;overflow:auto;padding:8px;overscroll-behavior:contain';
  canvas.style.cssText='display:block;margin:0 auto;background:white;touch-action:none;box-shadow:0 2px 12px #24354744';
  let mm=[210,297], changed=false;
  function paper(){
    const custom=size.value==='Custom';
    paperWidth.parentElement.hidden=paperHeight.parentElement.hidden=!custom;
    const dims=custom?[paperWidth.valueAsNumber,paperHeight.valueAsNumber]:sizes[size.value];
    if(!dims.every(v=>Number.isFinite(v)&&v>=1)) {status.textContent='Enter positive paper dimensions in mm.';return false;}
    mm=dims;
    const scale=Math.min(6,3072/Math.max(...dims));
    canvas.width=Math.max(1,Math.round(mm[0]*scale));canvas.height=Math.max(1,Math.round(mm[1]*scale));
    canvas.style.width='min(100%, '+Math.round(mm[0]*3.78)+'px)';
    return true;
  }
  function repaint(){
    ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);
    const spacing=(guide.value==='Grid'?5:8)*canvas.height/mm[1];
    if(guide.value!=='Plain' && spacing>=2){
      ctx.beginPath();ctx.strokeStyle='#c5d9e5';ctx.lineWidth=1;
      for(let y=spacing;y<canvas.height;y+=spacing){ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);}
      if(guide.value==='Grid')for(let x=spacing;x<canvas.width;x+=spacing){ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);}
      ctx.stroke();
    }
    if(raster)ctx.drawImage(background,0,0,canvas.width,canvas.height);
    for(const stroke of strokes){
      const points=stroke.points;
      if(stroke.tool==='Straight line'){mark(stroke,points[0],points.at(-1));continue;}
      points.forEach((p,i)=>mark(stroke,points[i-1],p));
    }
  }
  const strokes = saved?.strokes || [];
  let active = null, saving = false;
  function mark(stroke,from,to) {
    ctx.strokeStyle = ctx.fillStyle = stroke.color;
    ctx.globalAlpha=stroke.tool==='Highlighter'?.22:stroke.tool==='Pencil'?.7:1;
    ctx.lineWidth = to.width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (!from) {
      ctx.arc(to.x,to.y,to.width/2,0,2*Math.PI);
      ctx.fill();
    } else {
      ctx.moveTo(from.x,from.y);
      ctx.lineTo(to.x,to.y);
      ctx.stroke();
    }
    ctx.globalAlpha=1;
  }
  function point(event) {
    const bounds = canvas.getBoundingClientRect();
    const pressure = event.pointerType === 'pen' ? event.pressure : 0.5;
    const weight = active.tool === 'Eraser' ? 32 : active.tool === 'Marker' ? 12 + Math.hypot(event.tiltX||0,event.tiltY||0)/4 : active.tool==='Highlighter'?24:2+8*pressure;
    const next = {x:(event.clientX-bounds.left)*canvas.width/bounds.width,y:(event.clientY-bounds.top)*canvas.height/bounds.height,width:weight*({Fine:.65,Medium:1,Broad:1.8}[width.value])};
    mark(active,active.points.at(-1),next);
    active.points.push(next);
    if(active.tool==='Straight line') repaint();
  }
  canvas.onpointerdown = event => {
    if (saving || active || event.pointerType === 'touch' || event.button !== 0) return;
    canvas.setPointerCapture(event.pointerId);
    active = {id:event.pointerId,tool:tool.value,color:tool.value==='Eraser'?'#ffffff':color.value,points:[]};
    redoStack.length=0;redo.disabled=true;strokes.push(active);
    point(event);
    undo.disabled = false;
    insert.disabled = false;
  };
  canvas.onpointermove = event => {
    if (active?.id !== event.pointerId) return;
    const samples = event.getCoalescedEvents?.();
    for (const sample of samples?.length?samples:[event]) point(sample);
  };
  canvas.onlostpointercapture = canvas.onpointercancel = canvas.onpointerup = event => { if (active?.id === event.pointerId) active = null; };
  function button(label,action) {
    const el = document.createElement('button');
    el.type='button'; el.textContent=label; el.onclick=action;
    toolbar.append(el);
    return el;
  }
  const undo = button('Undo',()=>{
    if(saving || active) return;
    redoStack.push(strokes.pop()); redo.disabled=false;
    repaint();
    undo.disabled=!strokes.length;insert.disabled=false;
  });
  const redoStack=[];
  const redo=button('Redo',()=>{if(active||saving||!redoStack.length)return;strokes.push(redoStack.pop());redo.disabled=!redoStack.length;undo.disabled=false;repaint();});
  redo.disabled=true;
  const status = document.createElement('span');
  status.setAttribute('role','status');
  const insert = button(original?'Update drawing':'Insert drawing',async()=>{
    if(saving) return;
    active=null;
    saving=true; insert.disabled=true;
    try {
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
      if(!blob) throw Error('Could not encode the drawing.');
      const result=raster?blob:packPage(blob,{version:1,mm,size:size.value,guide:guide.value,strokes});
      await commit(new File([result],'KeepIt drawing.png',{type:'image/png'}));
      dialog.returnValue='inserted';
      dialog.close('inserted');
    } catch(err){status.textContent=err.message; insert.disabled=false;}
    finally {saving=false;}
  });
  function discard(){return !saving && (!changed && !strokes.length || confirm('Discard these drawing changes?'));}
  button('Cancel',()=>{if(discard()) dialog.close();});
  insert.disabled=undo.disabled=true;
  dialog.oncancel=e=>{if(!discard())e.preventDefault();};
  dialog.onclose=()=>dialog.remove();
  if(saved){size.value=saved.size in sizes?saved.size:'Custom';guide.value=saved.guide;paperWidth.value=saved.mm[0];paperHeight.value=saved.mm[1];}
  if(raster){size.value='Custom';paperWidth.value=String(background.width/6);paperHeight.value=String(background.height/6);}
  for(const el of [size,paperWidth,paperHeight,guide]) el.onchange=()=>{
    if(saving)return;
    const oldWidth=canvas.width,oldHeight=canvas.height;
    if(!paper()){insert.disabled=true;return;}
    for(const stroke of [...strokes,...redoStack])for(const p of stroke.points){p.x*=canvas.width/oldWidth;p.y*=canvas.height/oldHeight;}
    changed=true;insert.disabled=false;status.textContent='';repaint();
  };
  paper();repaint();insert.disabled=false;undo.disabled=!strokes.length;
  toolbar.style.cssText+=';flex:none;max-height:36dvh;overflow:auto';
  for(const control of toolbar.querySelectorAll('select,input,button')){control.style.width='auto';control.style.minHeight='40px';}
  button('Export PNG',()=>canvas.toBlob(blob=>{
    if(!blob)return;const url=URL.createObjectURL(blob);const a=document.createElement('a');
    a.href=url;a.download='KeepIt sketch.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
  }));
  sheet.append(canvas);dialog.append(toolbar,status,sheet);
  document.body.append(dialog);
  dialog.showModal();
}

export async function editDrawing({editor,assets,selection,insertPosition,makeAsset,canEdit}) {
  const previous = selection && assets.get(selection.node.attrs.assetId);
  const replace = previous?.name === 'KeepIt drawing.png';
  const pos = replace ? selection.pos : insertPosition();
  await drawNote(replace ? previous.blob : null, async file => {
    const asset = await makeAsset(file);
    if (!canEdit()) throw Error('Reopen the note to save this drawing.');
    if (replace && editor.state.doc.nodeAt(pos)?.attrs.assetId !== previous.id) throw Error('The selected drawing changed.');
    assets.set(asset.id,asset);
    const attrs = replace ? {...selection.node.attrs,assetId:asset.id} : {assetId:asset.id,alt:file.name,width:100,align:'center'};
    const ok = replace ? editor.commands.command(({tr,dispatch})=>{
      if (dispatch) tr.setNodeMarkup(pos,undefined,attrs);
      return true;
    }) : editor.commands.command(({tr,dispatch})=>{
      const cursor=tr.doc.resolve(Math.min(tr.doc.content.size,Math.max(0,pos)));
      const at=cursor.depth?cursor.after(1):cursor.pos;
      if(dispatch)tr.insert(at,editor.schema.nodes.figure.create(attrs));
      return true;
    });
    if (!ok) throw Error('Could not insert the drawing.');
  });
}
