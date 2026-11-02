import {mountViewerControls,visiblePages,spreadLayout,spreadRasterScale,SPREAD_GAP} from '/assets/viewer-controls-VMQYLPAJ.js';
/* MyLibrary UI-03: focused PDF reader. Presentation/controller module; no storage or backup writes.
   Imports the SAME compiled PdfReader class as library-app.js and adds reader-only behaviors.
   Re-renders PDF pages when zoom changes; never merely stretches the old canvas.
   /assets/chunk-QZNFWMJO.js is substituted by scripts/build.mjs. */
const $ = id => document.getElementById(id);
const surface = $('preview');
const pdfBar = $('pdf-controls');
const pageInput = $('pdf-page-input');
const pageTotal = $('pdf-page-total');
const zoomLabel = $('pdf-zoom-label');
const zoomFit = $('pdf-fit');
const zoomIn = $('pdf-zoom-in');
const zoomOut = $('pdf-zoom-out');
const feedback = $('pdf-reader-feedback');
let reader = null;
let updating = false;
let lastError = '';
let fullControls=null;
const spreadButton=document.createElement('button');spreadButton.type='button';spreadButton.textContent='Two pages';spreadButton.setAttribute('aria-label','Show two PDF pages side by side');pdfBar?.append(spreadButton);
spreadButton.onclick=()=>setSpread(reader?.pageStep===2?1:2);
async function setSpread(count){if(!readerAvailable())return;await action(async()=>{reader.pageStep=count;reader.page=visiblePages(reader.page,reader.doc.numPages,count)[0];reader.zoom='fit-page';await reader.render();surface.scrollTo(0,0);});}
const bound = (v, min, max) => Math.min(max, Math.max(min, v));
const zoomSteps = [.025, .05, .075, .1, .15, .2, .25, .4, .5, .6, .75, 1, 1.25, 1.5, 2, 2.5, 3, 4];
const readerAvailable = () => !!reader?.doc && $('item-dialog')?.open;
function update() {
  const ok = readerAvailable();
  const n = ok ? reader.doc.numPages : 0;
  spreadButton.disabled=!ok||updating;spreadButton.textContent=reader?.pageStep===2?'Single page':'Two pages';spreadButton.setAttribute('aria-pressed',String(reader?.pageStep===2));
  if (pageInput && document.activeElement !== pageInput) pageInput.value = ok ? String(reader.page) : '';
  if (pageInput) { pageInput.max = String(n); pageInput.disabled = !ok || updating; }
  if (pageTotal) pageTotal.textContent = `${reader?.pageEnd>reader?.page?'– '+reader.pageEnd+' ':''}of ${n || '—'}`;
  const val = reader?.zoom;
  if (zoomLabel) zoomLabel.textContent = val === 'fit' || !ok ? 'Fit width' : val === 'fit-page' ? 'Fit page' : `${Math.round(Number(val) * 100)}%`;
  for (const el of [zoomFit, zoomIn, zoomOut]) if (el) el.disabled = !ok || updating;
  if (zoomFit) zoomFit.setAttribute('aria-pressed', String(val === 'fit'));
  fullControls?.sync();
  if (feedback && !lastError) feedback.textContent = ok ? 'Pinch or use + / − to zoom. Drag to pan when enlarged.' : '';
}
function distance(touches) { const a = touches[0], b = touches[1]; return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY); }
async function moveToPage(value) {
  if (!readerAvailable()) return;
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 1 || n > reader.doc.numPages) {
    lastError = `Enter a page from 1 to ${reader.doc.numPages}.`;
    feedback.textContent = lastError;
    update(); return;
  }
  lastError = '';
  await action(async () => { reader.page = visiblePages(n,reader.doc.numPages,reader.pageStep)[0]; await reader.render(); surface.scrollTo({ top: 0, left: 0 }); });
}
function fitScale() {
  if (!readerAvailable()) return 1;
  return Number(reader.lastPageFitScale || 1);
}
function presentScale() { return reader?.zoom === 'fit' ? fitScale() : reader?.zoom==='fit-page'?Number(reader.lastPageFitAllScale||1):Number(reader?.zoom || 1); }
async function setZoom(value, focalClient = null) {
  if (!readerAvailable()) return;
  const zoom = ['fit','fit-page'].includes(value) ? value : bound(Number(value), .025, 4);
  if (!['fit','fit-page'].includes(zoom) && !Number.isFinite(zoom)) return;
  const rect = surface.getBoundingClientRect();
  const anchorX = focalClient ? bound(focalClient.x - rect.left, 0, surface.clientWidth) : surface.clientWidth / 2;
  const anchorY = focalClient ? bound(focalClient.y - rect.top, 0, surface.clientHeight) : surface.clientHeight / 2;
  const oldX = surface.scrollWidth > 0 ? (surface.scrollLeft + anchorX) / surface.scrollWidth : .5;
  const oldY = surface.scrollHeight > 0 ? (surface.scrollTop + anchorY) / surface.scrollHeight : .5;
  lastError = '';
  await action(async () => {
    reader.zoom = zoom;
    await reader.render();
    surface.scrollLeft = bound(oldX * surface.scrollWidth - anchorX, 0, Math.max(0, surface.scrollWidth - surface.clientWidth));
    surface.scrollTop = bound(oldY * surface.scrollHeight - anchorY, 0, Math.max(0, surface.scrollHeight - surface.clientHeight));
  });
}
async function action(fn) {
  if (!readerAvailable() || updating) return;
  updating = true; update();
  try { await fn(); }
  catch (err) { lastError = err?.message || 'PDF navigation did not complete.'; if (feedback) feedback.textContent = lastError; }
  finally { updating = false; update(); }
}
zoomFit?.addEventListener('click', () => setZoom('fit'));
zoomIn?.addEventListener('click', () => {
  const scale = presentScale();
  const next = zoomSteps.find(s => s >= scale * 1.2 - .001) || 4;
  setZoom(next);
});
zoomOut?.addEventListener('click', () => {
  const scale = presentScale();
  const next = [...zoomSteps].reverse().find(s => s < scale - .001) || .025;
  setZoom(next);
});
pageInput?.addEventListener('change', () => moveToPage(pageInput.value));
pageInput?.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); moveToPage(pageInput.value); pageInput.blur(); } });

window.addEventListener('mylibrary:pdf-layout-changed', () => {
  if (!readerAvailable() || updating) return;
  // Refit only fit-to-width; preserve explicit user zoom levels and source page.
  if (['fit','fit-page'].includes(reader.zoom)) action(() => reader.render());
});

// UI-05 gesture contract: no toolbar in immersive mode. The document is
// swipe-navigable when fitted; at high zoom, touch movement pans the drawing.
// At an enlarged page's horizontal edge, a deliberate outward swipe can turn
// pages, but ordinary movement inside a drawing must never turn the page.
let pinch = null;
let swipe = null;
let blockSwipeUntilRelease = false;
const isImmersive = () => $('item-dialog')?.classList.contains('pdf-fullscreen');
const oneFinger = event => event.touches.length === 1 ? event.touches[0] : null;
function pinchCenter(touches) {
  return { x: (touches[0].clientX + touches[1].clientX) / 2,
           y: (touches[0].clientY + touches[1].clientY) / 2 };
}
function clearPinchVisual() {
  if (!surface) return;
  const canvas = surface.querySelector('.pdf-spread')||surface.querySelector('canvas');
  if (canvas) { canvas.style.transform = ''; canvas.style.transformOrigin = ''; canvas.style.willChange = ''; }
}
surface?.addEventListener('touchstart', event => {
  if (!readerAvailable()) return;
  if (event.touches.length === 2) {
    blockSwipeUntilRelease = true;
    swipe = null;
    clearPinchVisual();
    pinch = { distance: distance(event.touches), zoom: presentScale(), center: pinchCenter(event.touches), ratio: 1 };
    return;
  }
  if (event.touches.length !== 1 || pinch || blockSwipeUntilRelease) return;
  const finger = oneFinger(event);
  swipe = {
    x: finger.clientX, y: finger.clientY, started: Date.now(),
    left: surface.scrollLeft, top: surface.scrollTop,
    maxLeft: Math.max(0, surface.scrollWidth - surface.clientWidth),
    canPanX: surface.scrollWidth > surface.clientWidth + 12,
    cancel: false,
  };
}, { passive: true });
surface?.addEventListener('touchmove', event => {
  if (!readerAvailable()) return;
  if (event.touches.length === 2 && pinch) {
    event.preventDefault();
    pinch.ratio = bound(distance(event.touches) / Math.max(1, pinch.distance), .25, 4);
    pinch.center = pinchCenter(event.touches);
    // Smooth visual feedback during the gesture; render a sharp page on release.
    const canvas = surface.querySelector('.pdf-spread')||surface.querySelector('canvas');
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const x = bound(pinch.center.x - rect.left, 0, rect.width);
      const y = bound(pinch.center.y - rect.top, 0, rect.height);
      canvas.style.transformOrigin = `${x}px ${y}px`;
      canvas.style.transform = `scale(${pinch.ratio})`;
      canvas.style.willChange = 'transform';
    }
  } else if (swipe && event.touches.length === 1) {
    event.preventDefault();
    const finger = event.touches[0];
    surface.scrollLeft = swipe.left - (finger.clientX - swipe.x);
    surface.scrollTop = swipe.top - (finger.clientY - swipe.y);
  } else if (swipe) swipe.cancel = true;
}, { passive: false });
surface?.addEventListener('touchend', event => {
  if (pinch) {
    if (event.touches.length < 2) {
      const prior = pinch;
      pinch = null;
      clearPinchVisual();
      const proposed = bound(prior.zoom * prior.ratio, .025, 4);
      if (Math.abs(proposed / prior.zoom - 1) > .04) setZoom(proposed, prior.center);
    }
    if (!event.touches.length) blockSwipeUntilRelease = false;
    return;
  }
  if (!event.touches.length && blockSwipeUntilRelease) { blockSwipeUntilRelease = false; swipe = null; return; }
  if (!swipe || !readerAvailable() || updating || event.touches.length) return;
  const previous = swipe; swipe = null;
  if (previous.cancel || event.changedTouches.length !== 1) return;
  const touch = event.changedTouches[0];
  const dx = touch.clientX - previous.x;
  const dy = touch.clientY - previous.y;
  const elapsed = Date.now() - previous.started;
  // Prevent vertical scrolling or slow drags being misinterpreted as page turns.
  if (elapsed > 1000 || Math.abs(dx) < (previous.canPanX ? 125 : 65) ||
      Math.abs(dx) < Math.abs(dy) * 1.5) return;
  if (previous.canPanX) {
    // At high zoom, navigation only works from the starting horizontal edge.
    // Interior swipes always pan; a small scroll offset tolerance avoids jitter.
    if (dx > 0 && previous.left > 3) return;
    if (dx < 0 && previous.left < previous.maxLeft - 3) return;
  }
  moveToPage(reader.page + (dx < 0 ? 1 : -1)*(reader.pageStep||1));
}, { passive: true });
surface?.addEventListener('touchcancel', () => {
  swipe = null; pinch = null; blockSwipeUntilRelease = false; clearPinchVisual();
}, { passive: true });

const controlsHost=document.createElement('div');controlsHost.className='viewer-controls-host';$('item-dialog').append(controlsHost);
fullControls=mountViewerControls({container:controlsHost,viewport:surface,active:()=>readerAvailable()&&isImmersive(),immersive:isImmersive,getState:()=>({ready:readerAvailable(),page:reader?.page||1,total:reader?.doc?.numPages||0,zoom:presentScale(),supportsSpread:true,pageStep:reader?.pageStep||1,pageEnd:reader?.pageEnd||reader?.page||1}),onAction:async(action,value,point)=>{if(action==='page')await moveToPage(value);else if(action==='zoom')await setZoom(value,point);else if(action==='fitPage')await setZoom('fit-page');else if(action==='fitWidth')await setZoom('fit');else if(action==='spread')await setSpread(value);},onExit:()=>$('pdf-fullscreen').click()});
new MutationObserver(()=>{fullControls.sync();fullControls.reveal();}).observe($('item-dialog'),{attributes:true,attributeFilter:['class','open']});

// The compiled library app loads its PDF engine lazily. Attach to that one class,
// rather than opening an independent PDF document and consuming memory twice.
(async () => {
  try {
    const { PdfReader } = await import('/assets/chunk-QZNFWMJO.js');
    const oldLoad = PdfReader.prototype.load;
    const oldClose = PdfReader.prototype.close;
    PdfReader.prototype.load = async function(...args) {
      const result = await oldLoad.apply(this, args);
      reader = this;
      surface.classList.add('pdf-readable');
      lastError = '';
      this.lastPageFitScale ||= 1;
      update();
      return result;
    };
    PdfReader.prototype.close = async function(...args) {
      if (reader === this) { reader = null; surface.classList.remove('pdf-readable'); lastError = ''; update(); }
      const result=await oldClose.apply(this,args);if(this.spreadHost){this.viewport.append(this.canvas);for(const canvas of this.spreadHost.querySelectorAll('canvas')){canvas.width=0;canvas.height=0;}this.spreadHost.remove();this.spreadHost=null;}this.pageStep=1;this.pageEnd=1;return result;
    };
    // A safe rerender: separate canvas pixel resolution from CSS display size,
    // retain full document dimensions when large sheets hit the raster-memory cap.
    PdfReader.prototype.step=async function(delta){if(this.doc){this.page=visiblePages(this.page+delta*(this.pageStep||1),this.doc.numPages,this.pageStep)[0];await this.render();}};
    PdfReader.prototype.render = async function() {
      if (!this.doc) throw new Error('No PDF is open.');
      const serial=++this.serial,doc=this.doc,pages=[];
      if(this.renderTask){this.renderTask.cancel();try{await this.renderTask.promise;}catch{}this.renderTask=null;}
      const numbers=visiblePages(this.page,doc.numPages,this.pageStep);this.page=numbers[0];this.pageEnd=numbers.at(-1);
      try{
        for(const number of numbers){pages.push(await doc.getPage(number));if(serial!==this.serial)return;}
        const bases=pages.map(page=>page.getViewport({scale:1})),spacing=getComputedStyle(this.viewport);
        const width=Math.max(1,this.viewport.clientWidth-(parseFloat(spacing.paddingLeft)||0)-(parseFloat(spacing.paddingRight)||0)),height=Math.max(1,this.viewport.clientHeight-(parseFloat(spacing.paddingTop)||0)-(parseFloat(spacing.paddingBottom)||0));
        const layout=spreadLayout(bases,width,height,this.zoom,SPREAD_GAP);this.lastPageFitScale=layout.fitWidth;this.lastPageFitAllScale=layout.fitPage;
        const rasterScale=spreadRasterScale(bases,layout.scale,window.devicePixelRatio||1);
        if(!this.spreadHost){this.spreadHost=document.createElement('div');this.spreadHost.className='pdf-spread';this.canvas.before(this.spreadHost);this.spreadHost.append(this.canvas);}
        const host=this.spreadHost;while(host.children.length<pages.length)host.append(document.createElement('canvas'));
        while(host.children.length>pages.length){const extra=host.lastElementChild;extra.width=0;extra.height=0;extra.remove();}
        host.style.width=layout.width+'px';host.style.height=layout.height+'px';
        for(let index=0;index<pages.length;index++){
          if(serial!==this.serial)return;
          const page=pages[index],canvas=host.children[index],viewport=page.getViewport({scale:rasterScale}),box=layout.boxes[index];
          canvas.width=Math.max(1,Math.ceil(viewport.width));canvas.height=Math.max(1,Math.ceil(viewport.height));canvas.style.width=box.width+'px';canvas.style.height=box.height+'px';canvas.style.left=box.left+'px';canvas.hidden=false;canvas.setAttribute('aria-label',`PDF page ${numbers[index]} of ${doc.numPages}`);
          this.renderTask=page.render({canvasContext:canvas.getContext('2d'),viewport});await this.renderTask.promise;
        }
        if(serial===this.serial){this.renderTask=null;const limited=rasterScale+.001<layout.scale*Math.min(window.devicePixelRatio||1,2);this.onStatus(limited?'Display detail capped to protect device memory. Download original for finer inspection.':'PDF page ready',this.page,doc.numPages);update();}
      }catch(error){if(serial===this.serial&&error?.name!=='RenderingCancelledException')throw error;}
      finally{for(const page of pages)page.cleanup();}
    };
    update();
  } catch (err) {
    if (feedback) feedback.textContent = 'Advanced PDF controls unavailable. Basic preview and Download original remain available.';
    console.warn('UI-03 PDF controls unavailable:', err);
  }
})();
