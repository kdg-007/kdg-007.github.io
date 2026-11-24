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
  function slider(label,min,max,value,step){
    const field=document.createElement('label'),input=document.createElement('input');
    field.textContent=label;input.type='range';Object.assign(input,{min,max,step,value});
    field.append(input);toolbar.append(field);return input;
  }
  const width=slider('Thickness',.2,5,1,.05), opacity=slider('Opacity',.01,1,1,.01);
  const hex=document.createElement('input');
  hex.setAttribute('aria-label','Hex ink color');hex.maxLength=7;hex.size=7;hex.value=color.value;
  hex.oninput=()=>{if(/^#?[0-9a-f]{6}$/i.test(hex.value))color.value='#'+hex.value.replace('#','');};
  hex.onblur=()=>hex.value=color.value;
  color.oninput=()=>hex.value=color.value;toolbar.append(hex);
  function millimetres(label,value){
    const input=document.createElement('input');
    input.type='number'; input.min='1'; input.step='any'; input.value=value;
    input.setAttribute('aria-label',label+' in millimetres');
    const field=document.createElement('label');field.append(label+' mm ',input);field.hidden=true;toolbar.append(field);
    return input;
  }
  const palette=document.createElement('details'),summary=document.createElement('summary');
  summary.textContent='Color wheel';palette.append(summary);
  const wheel=document.createElement('canvas');wheel.width=wheel.height=112;wheel.setAttribute('aria-label','Hue and saturation');
  wheel.style.cssText='width:112px;height:112px;touch-action:none;border-radius:50%;background:radial-gradient(circle,white,transparent 70%),conic-gradient(from 90deg,red,yellow,lime,cyan,blue,magenta,red)';
  const brightness=document.createElement('input');brightness.type='range';brightness.min=0;brightness.max=100;brightness.value=100;brightness.setAttribute('aria-label','Color brightness');
  let hue=0,saturation=1;
  function wheelColor(){
    const v=brightness.value/100;
    const channel=n=>{const k=(n+hue/60)%6;return Math.round(255*v*(1-saturation*Math.max(0,Math.min(k,4-k,1)))).toString(16).padStart(2,'0');};
    hex.value=color.value='#'+channel(5)+channel(3)+channel(1);
  }
  function sampleWheel(e){const b=wheel.getBoundingClientRect(),x=(e.clientX-b.left)/b.width*2-1,y=(e.clientY-b.top)/b.height*2-1;
    hue=(Math.atan2(y,x)*180/Math.PI+360)%360;saturation=Math.min(1,Math.hypot(x,y));wheelColor();}
  wheel.onpointerdown=e=>{wheel.setPointerCapture(e.pointerId);sampleWheel(e);};
  wheel.onpointermove=e=>{if(wheel.hasPointerCapture(e.pointerId))sampleWheel(e);};
  brightness.oninput=wheelColor;palette.append(wheel,brightness);toolbar.append(palette);
  const paperWidth=millimetres('Width',210),paperHeight=millimetres('Height',297);
  toolbar.append(tool,color);
  const canvas = document.createElement('canvas');
  canvas.width = 1500;
  canvas.height = 950;
  canvas.style.cssText = 'width:100%;display:block;touch-action:none;background:white;cursor:crosshair';
  canvas.setAttribute('aria-label','Drawing surface. Use a pen or mouse.');
  const ctx = canvas.getContext('2d');
  const plane=document.createElement('div');
  plane.style.cssText='position:relative;margin:0 auto;transform-origin:center;touch-action:none';
  const background = document.createElement('canvas');
  background.width = canvas.width;
  background.height = canvas.height;
  const base = background.getContext('2d');
  base.fillStyle = 'white';
  base.fillRect(0,0,background.width,background.height);
  const saved=await readPage(original);
  const raster=original && (!saved || saved.basePNG);
  let basePNG=saved?.basePNG;
  if(original&&!saved)basePNG=await new Promise((resolve,reject)=>{
    const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(original);
  });
  if (raster) {
    const url = basePNG;
    if(typeof url!=='string'||!url.startsWith('data:image/png;base64,'))throw Error('Invalid drawing background.');
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      background.width=image.naturalWidth; background.height=image.naturalHeight; base.drawImage(image,0,0);
    } finally { /* The background uses a self-contained PNG data URL. */ }
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
    plane.style.width='min(100%, '+Math.round(mm[0]*3.78)+'px)';canvas.style.width='100%';
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
    for(const layer of layers){
      if(!layer.visible)continue;
      const surface=layer.surface;
      if(surface.width!==canvas.width||surface.height!==canvas.height){surface.width=canvas.width;surface.height=canvas.height;layer.dirty=true;}
      if(layer.dirty){
        const ink=surface.getContext('2d');ink.clearRect(0,0,surface.width,surface.height);
        for(const stroke of strokes){
          if((stroke.layer??0)!==layer.id||!stroke.points.length)continue;
          if(stroke.tool==='Straight line')mark(ink,stroke,stroke.points[0],stroke.points.at(-1));
          else stroke.points.forEach((p,i)=>mark(ink,stroke,stroke.points[i-1],p));
        }
        layer.dirty=false;
      }
      ctx.drawImage(surface,0,0);
    }
  }
  const strokes = saved?.strokes || [];
  const layers=(saved?.layers?.length?saved.layers:[{id:0,name:'Layer 1',visible:true}]).map(l=>({...l,surface:document.createElement('canvas'),dirty:true}));
  let current=layers.find(l=>l.id===saved?.activeLayer)||layers[0];
  const layerMenu=choice('Active layer',[]);
  const visibility=button('Hide layer',()=>{current.visible=!current.visible;changed=true;refreshLayers();repaint();});
  function refreshLayers(){
    layerMenu.replaceChildren(...layers.map(l=>new Option(l.name+(l.visible?'':' (hidden)'),String(l.id))));
    layerMenu.value=String(current.id);visibility.textContent=current.visible?'Hide layer':'Show layer';
  }
  layerMenu.onchange=()=>{current=layers.find(l=>String(l.id)===layerMenu.value);refreshLayers();};
  button('Add layer',()=>{const id=Math.max(...layers.map(l=>l.id))+1;current={id,name:'Layer '+(id+1),visible:true,surface:document.createElement('canvas'),dirty:true};layers.push(current);changed=true;refreshLayers();repaint();});
  button('Rename layer',()=>{const name=prompt('Layer name',current.name)?.trim();if(name){current.name=name;changed=true;refreshLayers();}});
  function reorder(step){
    const index=layers.indexOf(current),target=index+step;
    if(target<0||target>=layers.length)return;
    layers.splice(index,1);layers.splice(target,0,current);refreshLayers();changed=true;repaint();
  }
  button('Raise layer',()=>reorder(1));button('Lower layer',()=>reorder(-1));
  refreshLayers();
  let active = null, saving = false;
  function mark(ctx,stroke,from,to) {
    ctx.globalCompositeOperation=stroke.tool==='Eraser'?'destination-out':'source-over';
    ctx.strokeStyle = ctx.fillStyle = stroke.color;
    ctx.globalAlpha=stroke.opacity??(stroke.tool==='Highlighter'?.22:stroke.tool==='Pencil'?.7:1);
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
    ctx.globalAlpha=1;ctx.globalCompositeOperation="source-over";
  }
  function point(event) {
    const local=localPoint(event);
    const pressure = event.pointerType === 'pen' ? event.pressure : 0.5;
    const weight = active.tool === 'Eraser' ? 32 : active.tool === 'Marker' ? 12 + Math.hypot(event.tiltX||0,event.tiltY||0)/4 : active.tool==='Highlighter'?24:2+8*pressure;
    const next = {x:local.x*canvas.width/plane.clientWidth,y:local.y*canvas.height/plane.clientHeight,width:weight*Number(width.value)};
    if(rulerOn){
      const rad=edgeAngle*Math.PI/180, ux=Math.cos(rad),uy=Math.sin(rad);
      const ox=edgeX*canvas.width,oy=edgeY*canvas.height;
      const dot=(next.x-ox)*ux+(next.y-oy)*uy;
      next.x=ox+dot*ux;next.y=oy+dot*uy;
    }
    if(active.tool!=='Straight line')mark(current.surface.getContext('2d'),active,active.points.at(-1),next);
    active.points.push(next);
    if(active.tool==='Straight line')current.dirty=true;
    schedulePaint();
  }
  let frame=0;
  function schedulePaint(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;repaint();});}
  canvas.onpointerdown = event => {
    if (!current.visible || saving || active || event.pointerType === 'touch' || event.button !== 0) return;
    canvas.setPointerCapture(event.pointerId);
    active = {id:event.pointerId,layer:current.id,opacity:Number(opacity.value),tool:tool.value,color:tool.value==='Eraser'?'#ffffff':color.value,points:[]};
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
    const removed=strokes.pop();if(!removed)return;layers.find(l=>l.id===(removed.layer??0)).dirty=true;redoStack.push(removed); redo.disabled=false;
    repaint();
    undo.disabled=!strokes.length;insert.disabled=false;
  });
  const redoStack=[];
  const redo=button('Redo',()=>{if(active||saving||!redoStack.length)return;const restored=redoStack.pop();layers.find(l=>l.id===(restored.layer??0)).dirty=true;strokes.push(restored);redo.disabled=!redoStack.length;undo.disabled=false;repaint();});
  redo.disabled=true;
  const status = document.createElement('span');
  status.setAttribute('role','status');
  const insert = button(original?'Update drawing':'Insert drawing',async()=>{
    if(saving) return;
    active=null;
    saving=true; insert.disabled=true;
    try {
      repaint();
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
      if(!blob) throw Error('Could not encode the drawing.');
      const result=packPage(blob,{version:1,basePNG,mm,size:size.value,guide:guide.value,strokes,layers:layers.map(({id,name,visible})=>({id,name,visible})),activeLayer:current.id});
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
  if(raster&&!saved){size.value='Custom';paperWidth.value=String(background.width/6);paperHeight.value=String(background.height/6);}
  for(const el of [size,paperWidth,paperHeight,guide]) el.onchange=()=>{
    if(saving)return;
    const oldWidth=canvas.width,oldHeight=canvas.height;
    if(!paper()){insert.disabled=true;return;}
    for(const stroke of [...strokes,...redoStack])for(const p of stroke.points){p.x*=canvas.width/oldWidth;p.y*=canvas.height/oldHeight;}
    layers.forEach(l=>l.dirty=true);changed=true;insert.disabled=false;status.textContent='';repaint();
  };
  paper();repaint();insert.disabled=false;undo.disabled=!strokes.length;
  toolbar.style.cssText+=';flex:none;max-height:36dvh;overflow:auto';
  for(const control of toolbar.querySelectorAll('select,input,button')){control.style.width='auto';control.style.minHeight='40px';}
  button('Export PNG',()=>canvas.toBlob(blob=>{
    if(!blob)return;const url=URL.createObjectURL(blob);const a=document.createElement('a');
    a.href=url;a.download='KeepIt sketch.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
  }));
  dialog.style.userSelect=dialog.style.webkitUserSelect='none';
  dialog.style.webkitTouchCallout='none';
  sheet.onselectstart=sheet.oncontextmenu=e=>{e.preventDefault();};
  sheet.style.touchAction='none';
  let zoom=1,angle=0,panX=0,panY=0;
  function transform(){plane.style.transform='translate('+panX+'px,'+panY+'px) rotate('+angle+'rad) scale('+zoom+')';}
  function localPoint(e){
    const rect=plane.getBoundingClientRect(),dx=e.clientX-rect.left-rect.width/2,dy=e.clientY-rect.top-rect.height/2;
    return {x:plane.clientWidth/2+(dx*Math.cos(angle)+dy*Math.sin(angle))/zoom,y:plane.clientHeight/2+(-dx*Math.sin(angle)+dy*Math.cos(angle))/zoom};
  }
  const fingers=new Map(); let previous=null;
  function pair(){
    const [a,b]=fingers.values();return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,d:Math.hypot(b.x-a.x,b.y-a.y),a:Math.atan2(b.y-a.y,b.x-a.x)};
  }
  sheet.addEventListener('pointerdown',e=>{
    if(e.pointerType!=='touch'||e.target.closest('[data-ruler]'))return;
    e.preventDefault();sheet.setPointerCapture(e.pointerId);fingers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    previous=fingers.size===2?pair():null;
  });
  sheet.onpointermove=e=>{
    if(!fingers.has(e.pointerId))return;
    fingers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(fingers.size!==2)return;
    const now=pair();
    if(previous&&!active&&previous.d>2){
      const rect=plane.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
      const next=Math.max(.25,Math.min(6,zoom*now.d/previous.d)),delta=now.a-previous.a;
      const x=cx-previous.x,y=cy-previous.y;
      panX+=now.x+(x*Math.cos(delta)-y*Math.sin(delta))*next/zoom-cx;
      panY+=now.y+(x*Math.sin(delta)+y*Math.cos(delta))*next/zoom-cy;
      zoom=next;angle+=delta;transform();
    }
    previous=now;
  };
  sheet.onpointerup=sheet.onpointercancel=e=>{fingers.delete(e.pointerId);previous=null;};
  button('Reset view',()=>{zoom=1;angle=panX=panY=0;transform();sheet.scrollTop=0;});
  let rulerOn=false,edgeX=.5,edgeY=.5,edgeAngle=0,drag=null,lastTap=null;
  const edge=document.createElement('div'),handle=document.createElement('button');
  edge.dataset.ruler=''; edge.hidden=true;edge.style.cssText='position:absolute;width:80%;height:34px;transform-origin:50% 0;background:repeating-linear-gradient(90deg,#51728488 0 1px,transparent 1px 8px) top/100% 8px no-repeat,#b7d8eabf;border-top:2px solid #165b77;touch-action:none;text-align:center;color:#142c36';
  handle.type='button';handle.textContent='↻';handle.setAttribute('aria-label','Rotate straightedge');handle.style.cssText='position:absolute;right:0;top:0;width:44px;height:34px;touch-action:none';
  const degrees=document.createElement('span');edge.append(degrees,handle);
  function showEdge(){edge.style.left=edgeX*100+'%';edge.style.top=edgeY*100+'%';edge.style.transform='translateX(-50%) rotate('+edgeAngle+'deg)';degrees.textContent=Math.round((edgeAngle%360+360)%360)+'°';}
  const toggle=button('Ruler',()=>{rulerOn=!rulerOn;edge.hidden=!rulerOn;toggle.setAttribute('aria-pressed',String(rulerOn));showEdge();});
  edge.onpointerdown=e=>{if(drag)return;e.preventDefault();edge.setPointerCapture(e.pointerId);drag={id:e.pointerId,start:localPoint(e),x:edgeX,y:edgeY,rotate:e.target===handle,moved:false};};
  edge.onpointermove=e=>{if(drag?.id!==e.pointerId)return;const p=localPoint(e),dx=p.x-drag.start.x,dy=p.y-drag.start.y;
    if(Math.hypot(dx,dy)*zoom<4&&!drag.moved)return;drag.moved=true;
    if(drag.rotate)edgeAngle=Math.atan2(p.y-edgeY*plane.clientHeight,p.x-edgeX*plane.clientWidth)*180/Math.PI;
    else {edgeX=Math.max(0,Math.min(1,drag.x+dx/plane.clientWidth));edgeY=Math.max(0,Math.min(1,drag.y+dy/plane.clientHeight));}showEdge();};
  edge.onpointerup=e=>{if(drag?.id!==e.pointerId)return;
    if(!drag.moved&&lastTap&&performance.now()-lastTap.time<400&&Math.hypot(e.clientX-lastTap.x,e.clientY-lastTap.y)<24){edgeAngle+=90;showEdge();lastTap=null;}
    else lastTap=drag.moved?null:{time:performance.now(),x:e.clientX,y:e.clientY};drag=null;};
  edge.onpointercancel=()=>{drag=null;lastTap=null;};
  tool.onchange=()=>{opacity.value=tool.value==='Highlighter'?.22:tool.value==='Pencil'?.7:1;};
  plane.append(canvas,edge);sheet.append(plane);dialog.append(toolbar,status,sheet);
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
