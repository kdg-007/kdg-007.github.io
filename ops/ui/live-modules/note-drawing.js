// Notes store a lossless PNG so existing readers and offline note packages can display ink.
export async function drawNote(original, commit) {
  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-label', 'Note drawing');
  dialog.style.cssText = 'width:min(860px,96vw);max-height:94dvh;overflow:auto;padding:12px;box-sizing:border-box';
  const toolbar = document.createElement('div');
  toolbar.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-bottom:8px';
  const tool = document.createElement('select');
  tool.setAttribute('aria-label','Drawing tool');
  for (const name of ['Pen','Marker','Eraser']) tool.add(new Option(name,name));
  const color = document.createElement('input');
  color.type = 'color';
  color.value = '#173449';
  color.setAttribute('aria-label','Ink color');
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
  if (original) {
    const url = URL.createObjectURL(original);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      base.drawImage(image,0,0,background.width,background.height);
    } finally { URL.revokeObjectURL(url); }
  }
  ctx.drawImage(background,0,0);
  const strokes = [];
  let active = null, saving = false;
  function mark(stroke,from,to) {
    ctx.strokeStyle = ctx.fillStyle = stroke.color;
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
  }
  function point(event) {
    const bounds = canvas.getBoundingClientRect();
    const pressure = event.pointerType === 'pen' ? event.pressure : 0.5;
    const width = active.tool === 'Eraser' ? 32 : active.tool === 'Marker' ? 12 + Math.hypot(event.tiltX||0,event.tiltY||0)/4 : 2+8*pressure;
    const next = {x:(event.clientX-bounds.left)*canvas.width/bounds.width,y:(event.clientY-bounds.top)*canvas.height/bounds.height,width};
    mark(active,active.points.at(-1),next);
    active.points.push(next);
  }
  canvas.onpointerdown = event => {
    if (saving || active || event.pointerType === 'touch' || event.button !== 0) return;
    canvas.setPointerCapture(event.pointerId);
    active = {id:event.pointerId,tool:tool.value,color:tool.value==='Eraser'?'#ffffff':color.value,points:[]};
    strokes.push(active);
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
    strokes.pop();
    ctx.drawImage(background,0,0);
    for(const stroke of strokes) stroke.points.forEach((p,i)=>mark(stroke,stroke.points[i-1],p));
    undo.disabled = insert.disabled = !strokes.length;
  });
  const status = document.createElement('span');
  status.setAttribute('role','status');
  const insert = button(original?'Update drawing':'Insert drawing',async()=>{
    if(saving || active) return;
    saving=true; insert.disabled=true;
    try {
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
      if(!blob) throw Error('Could not encode the drawing.');
      await commit(new File([blob],'KeepIt drawing.png',{type:'image/png'}));
      dialog.close();
    } catch(err){status.textContent=err.message; insert.disabled=false;}
    finally {saving=false;}
  });
  function discard(){return !saving && (!strokes.length || confirm('Discard these drawing changes?'));}
  button('Cancel',()=>{if(discard()) dialog.close();});
  insert.disabled=undo.disabled=true;
  dialog.oncancel=e=>{if(!discard())e.preventDefault();};
  dialog.onclose=()=>dialog.remove();
  dialog.append(toolbar,canvas,status);
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
    }) : editor.chain().focus().insertContentAt(pos,{type:'figure',attrs,content:[]}).run();
    if (!ok) throw Error('Could not insert the drawing.');
  });
}
