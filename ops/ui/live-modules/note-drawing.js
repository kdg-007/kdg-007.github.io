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

// ---------------------------------------------------------------------------
// Sketchbook UI (KI-010 / KI-011): full-screen canvas, floating compact chrome
// and a consistent 24-unit outline icon set. The stroke model, PNG payload,
// layers, ruler and gestures are unchanged from release #73.
// ---------------------------------------------------------------------------
const svg = body => '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">' + body + '</svg>';
const ICONS = {
  book: svg('<path d="M12 6.5C10 5 7.5 4.5 4 4.5v14c3.5 0 6 .5 8 2 2-1.5 4.5-2 8-2v-14c-3.5 0-6 .5-8 2z"/><path d="M12 6.5v14"/>'),
  zoomIn: svg('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8M10.5 7.5v6M7.5 10.5h6"/>'),
  zoomOut: svg('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8M7.5 10.5h6"/>'),
  capture: svg('<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><path d="M9 12h6M12 9v6"/>'),
  swap: svg('<path d="M7 7h12l-3.5-3.5M17 17H5l3.5 3.5"/>'),
  guides: svg('<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17" opacity=".6"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  undo: svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
  redo: svg('<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>'),
  layers: svg('<path d="M12 3.5 21 8.5l-9 5-9-5z"/><path d="m3 13 9 5 9-5"/><path d="m3 17.2 9 4.8 9-4.8" opacity=".55"/>'),
  paper: svg('<path d="M6.5 3h7.5l4 4v13.5a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5V3.5a.5.5 0 0 1 .5-.5z"/><path d="M14 3v4h4M9 12h6M9 15.5h6"/>'),
  ruler: svg('<path d="M2.9 16.4 16.4 2.9l4.7 4.7L7.6 21.1z"/><path d="m6.6 12.7 1.9 1.9M9.4 9.9l1.2 1.2M12.2 7.1l1.9 1.9M15 4.3l1.2 1.2"/>'),
  expand: svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  collapse: svg('<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>'),
  more: svg('<circle cx="5" cy="12" r="1.1" fill="currentColor"/><circle cx="12" cy="12" r="1.1" fill="currentColor"/><circle cx="19" cy="12" r="1.1" fill="currentColor"/>'),
  export: svg('<path d="M12 15V3.5M7.5 8 12 3.5 16.5 8"/><path d="M5 13.5V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5.5"/>'),
  eye: svg('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>'),
  eyeOff: svg('<path d="m3.5 3.5 17 17"/><path d="M10.2 5.7A9 9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3 3.8M6.4 6.9C3.9 8.7 2.5 12 2.5 12S6 18.5 12 18.5a8.8 8.8 0 0 0 4.8-1.4"/><path d="M9.9 9.9a2.8 2.8 0 0 0 4.1 4"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  up: svg('<path d="M12 19V5M6.5 10.5 12 5l5.5 5.5"/>'),
  down: svg('<path d="M12 5v14M6.5 13.5 12 19l5.5-5.5"/>'),
  rename: svg('<path d="M4 20h4.2L19 9.2 14.8 5 4 15.8z"/><path d="m13 6.8 4.2 4.2"/>'),
  duplicate: svg('<rect x="8" y="8" width="12.5" height="12.5" rx="2"/><path d="M16 8V5.5a2 2 0 0 0-2-2H5.5a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2H8"/><path d="M14.25 11.5v5.5M11.5 14.25H17"/>'),
  copy: svg('<rect x="8" y="8" width="12.5" height="12.5" rx="2"/><path d="M16 8V5.5a2 2 0 0 0-2-2H5.5a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2H8"/>'),
  paste: svg('<rect x="8.5" y="2.5" width="7" height="4" rx="1"/><path d="M8.5 4.5H7a2 2 0 0 0-2 2V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6.5a2 2 0 0 0-2-2h-1.5"/><path d="M9 13.5h6M9 17h4"/>'),
  merge: svg('<path d="M6 3.5v4.5l6 6 6-6V3.5"/><path d="M12 14v6.5M8.5 17l3.5 3.5 3.5-3.5"/>'),
  toTop: svg('<path d="M5 3.5h14M12 21V8M6.5 13.5 12 8l5.5 5.5"/>'),
  toBottom: svg('<path d="M5 20.5h14M12 3v13M6.5 10.5 12 16l5.5-5.5"/>'),
  trash: svg('<path d="M4 6.5h16M9.5 6.5V4h5v2.5M6 6.5l1 13a1.5 1.5 0 0 0 1.5 1.5h7a1.5 1.5 0 0 0 1.5-1.5l1-13M10 10.5v6.5M14 10.5v6.5"/>'),
  select: svg('<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="m8 12.5 2.8 2.8L16.5 9.5"/>'),
  boxOff: svg('<rect x="4" y="4" width="16" height="16" rx="3.5"/>'),
  boxOn: svg('<rect x="4" y="4" width="16" height="16" rx="3.5" fill="currentColor"/><path d="m8 12.3 2.8 2.8L16.3 9.6" stroke="var(--kd-chrome)" stroke-width="2.2"/>'),
  grip: svg('<g fill="currentColor" stroke="none"><circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/></g>'),
  fitWidth: svg('<path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"/>'),
  fitPage: svg('<path d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4"/><rect x="8.5" y="7" width="7" height="10" rx="1"/>'),
  // Tool glyphs. The `ink` paths take the current ink color, like a real nib.
  Pen: svg('<path d="M12 2.6 17 9.6l-2.2 7.6H9.2L7 9.6z"/><path d="M12 2.6v6.6"/><circle cx="12" cy="11.2" r="1.3"/><rect x="8.6" y="17.2" width="6.8" height="4.3" rx="1"/><path class="ink" d="M12 2.6 13.6 4.9h-3.2z" fill="currentColor" stroke="currentColor" stroke-width="1"/>'),
  Pencil: svg('<path d="M15.5 3.5a1.4 1.4 0 0 1 2 0l3 3a1.4 1.4 0 0 1 0 2L9.5 19.5 3.6 20.4l.9-5.9z"/><path d="m4.5 14.5 5 5M13.5 5.5l5 5"/><path class="ink" d="m4.1 17.4-.5 3 3-.5z" fill="currentColor" stroke="none"/>'),
  Marker: svg('<path d="M14.2 3.3a1.5 1.5 0 0 1 2.1 0l4.4 4.4a1.5 1.5 0 0 1 0 2.1l-8 8-6.5-6.5z"/><path d="m6.2 11.3 6.5 6.5-2.4 1.6-5.7-5.7z"/><path class="ink" d="m4.6 13.7 5.7 5.7-2.2 1.5H4.6a1.5 1.5 0 0 1-1.5-1.5v-3.5z" fill="currentColor" stroke="none"/>'),
  Highlighter: svg('<path d="M15.6 2.9a1.4 1.4 0 0 1 2 0l3.5 3.5a1.4 1.4 0 0 1 0 2l-6.6 6.6-5.5-5.5z"/><path d="m9 9.5 5.5 5.5-2.2 2.2-5.5-5.5z"/><path d="m6.8 11.7 5.5 5.5-2 1.1-4.6-4.6z"/><rect class="ink" x="3.2" y="19.6" width="12.6" height="2.8" rx="1.2"/>'),
  'Straight line': svg('<path d="M6.4 17.6 17.6 6.4"/><circle class="ink" cx="5" cy="19" r="2.2"/><circle class="ink" cx="19" cy="5" r="2.2"/>'),
  Eraser: svg('<path d="M9 20.5 3.6 15.1a1.6 1.6 0 0 1 0-2.2L12.9 3.6a1.6 1.6 0 0 1 2.2 0l5.3 5.3a1.6 1.6 0 0 1 0 2.2L11 20.5z"/><path d="m8.2 8.2 7.6 7.6M11 20.5h9.5"/>'),
};
// Blend modes map to canvas composite operations (all supported by Safari/WebKit).
const BLENDS = [['source-over','Normal'],['multiply','Multiply'],['screen','Screen'],['overlay','Overlay'],['darken','Darken'],['lighten','Lighten'],
  ['color-dodge','Colour dodge'],['color-burn','Colour burn'],['hard-light','Hard light'],['soft-light','Soft light'],['difference','Difference'],
  ['exclusion','Exclusion'],['hue','Hue'],['saturation','Saturation'],['color','Colour'],['luminosity','Luminosity']];
const blendName = value => (BLENDS.find(b => b[0] === value) || BLENDS[0])[1];
// Copied layers stay available for this app session, so a layer can be pasted
// into another drawing or another note.
let layerClipboard = null;
const TOOLS = ['Pen','Pencil','Marker','Highlighter','Straight line','Eraser'];
// Ink and graphite first, then soft architect's-marker tones (Copic / Prismacolor
// style): muted, chalky, easy to layer. Any colour is still one tap away on the wheel.
const SWATCHES = ['#173449','#000000','#9aa3ab','#f5b8c4','#f8c8a0','#f6e08c','#b9e0a8','#9fd8cb','#a8d3f0','#c5b5e8','#e8a6bf','#e9d6b4'];
// How strongly Apple Pencil pressure changes line weight (and pencil softness).
const PRESSURE_DEPTH = {Off: 0, Light: .4, Normal: .75, Strong: 1};
let pressureMode = 'Normal';
// Recent range of Pencil pressure, so a light or a heavy hand both get the full range.
const pressureRange = {lo: .04, hi: .6};
const STYLE = `
.kd{--kd-text:var(--app-text,#1d2d36);--kd-muted:var(--app-muted,#5d6c74);--kd-chrome:var(--app-raised,#ffffff);--kd-line:var(--app-line,#cfd6da);
 --kd-accent:var(--app-accent,#1f6f8b);--kd-accent-on:var(--app-accent-on,#ffffff);--kd-soft:var(--app-soft,#e2ecf0);--kd-desk:var(--app-ground,#e6e9eb);--kd-focus:var(--app-focus,#2a86a8);
 position:fixed;inset:0;margin:0;width:100%;height:100dvh;max-width:none;max-height:none;padding:0;border:0;box-sizing:border-box;
 background:var(--kd-desk);color:var(--kd-text);font:14px/1.3 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;overflow:hidden;
 user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
.kd::backdrop{background:var(--kd-desk)}
.kd *{box-sizing:border-box}
.kd [hidden]{display:none!important}
.kd button,.kd select,.kd input{font:inherit;color:inherit}
.kd-sheet{position:absolute;inset:0;overflow:auto;overscroll-behavior:contain;touch-action:none;
 padding:calc(env(safe-area-inset-top) + 68px) 12px calc(env(safe-area-inset-bottom) + 92px)}
.kd.kd-immersive .kd-sheet{padding-top:calc(env(safe-area-inset-top) + 12px)}
.kd-plane{position:relative;margin:0 auto;transform-origin:center;touch-action:none}
.kd-plane canvas{display:block;width:100%;height:auto;background:repeating-conic-gradient(#d9dee1 0 25%,#fff 0 50%) 0 0/16px 16px;touch-action:none;border-radius:2px;
 box-shadow:0 1px 2px #1b2a3329,0 8px 28px #1b2a331f;cursor:crosshair}
.kd-bar{position:absolute;left:0;right:0;top:calc(env(safe-area-inset-top) + 10px);padding:0 10px;display:flex;align-items:center;gap:8px;pointer-events:none;z-index:2}
.kd-dock{position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom) + 12px);translate:-50% 0;max-width:calc(100% - 20px);display:flex;align-items:flex-end;gap:8px;pointer-events:none;z-index:2}
.kd-pill{pointer-events:auto;display:flex;align-items:center;gap:2px;padding:4px;border-radius:16px;
 background:color-mix(in srgb,var(--kd-chrome) 97%,transparent);
 border:1px solid color-mix(in srgb,var(--kd-line) 70%,transparent);box-shadow:0 1px 2px #0000000f,0 6px 22px #0000001a;transition:opacity .25s}
.kd-dock .kd-pill{overflow-x:auto;scrollbar-width:none;flex-shrink:1;min-width:0}
.kd-dock .kd-pill::-webkit-scrollbar{display:none}
.kd-spacer{flex:1}
.kd-title{padding:0 10px 0 4px;font-weight:600;white-space:nowrap;display:flex;flex-direction:column;line-height:1.15}
.kd-title small{font-weight:400;color:var(--kd-muted);font-size:12px;max-width:32ch;overflow:hidden;text-overflow:ellipsis}
.kd-btn{flex:none;display:inline-grid;place-items:center;width:44px;height:44px;border:0;border-radius:12px;background:transparent;cursor:pointer;color:var(--kd-text);padding:0;transition:background .15s,color .15s,translate .15s}
.kd-btn:hover{background:color-mix(in srgb,var(--kd-text) 7%,transparent)}
.kd-btn:disabled{opacity:.5;cursor:default;background:transparent}
.kd-btn[aria-pressed="true"],.kd-btn[aria-expanded="true"]{background:var(--kd-soft);color:var(--kd-accent)}
.kd-btn:focus-visible,.kd-done:focus-visible,.kd-pop :focus-visible{outline:2px solid var(--kd-focus);outline-offset:1px}
.kd .kd-done{pointer-events:auto;flex:none;height:44px;padding:0 18px;border:0;border-radius:14px;background:var(--kd-accent);color:var(--kd-accent-on);font-weight:600;cursor:pointer;box-shadow:0 6px 18px #0000002a}
.kd .kd-done:disabled{opacity:.5;cursor:default}
.kd-sep{flex:none;width:1px;height:26px;margin:0 4px;background:var(--kd-line)}
.kd-tool{height:52px;align-self:flex-end;border-radius:12px 12px 10px 10px}
.kd-tool svg{width:28px;height:28px}
.kd-tool[aria-checked="true"]{background:var(--kd-soft);color:var(--kd-accent);translate:0 -3px}
.kd-tool[aria-checked="true"]::after{content:"";position:absolute;bottom:4px;width:5px;height:5px;border-radius:50%;background:currentColor}
.kd-tool{position:relative}
/* Ink-coloured parts are filled with the ink and outlined in the icon colour, so they stay visible whatever the ink and scheme. */
.kd svg .ink{fill:var(--kd-ink);stroke:currentColor;stroke-width:1.1}
.kd-swatch-btn{position:relative}
.kd-swatch-btn i{display:block;width:26px;height:26px;border-radius:50%;background:var(--kd-ink);box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--kd-text) 45%,transparent),0 0 0 2px var(--kd-chrome),0 0 0 3.5px color-mix(in srgb,var(--kd-text) 60%,transparent)}
.kd-pop{position:fixed;z-index:5;min-width:240px;max-width:min(340px,calc(100vw - 16px));overflow:auto;padding:12px;border-radius:18px;
 background:var(--kd-chrome);color:var(--kd-text);border:1px solid var(--kd-line);box-shadow:0 18px 50px #0000002e;display:flex;flex-direction:column;gap:12px}
.kd-pop[hidden]{display:none}
.kd-pop h3{margin:0;font-size:13px;font-weight:600;color:var(--kd-muted);text-transform:uppercase;letter-spacing:.04em;display:flex;align-items:center;justify-content:space-between}
.kd-field{display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--kd-muted)}
.kd-field[hidden]{display:none}
.kd-stage{position:absolute;inset:0;overflow:hidden}
.kd-ref{position:absolute;display:flex;flex-direction:column;background:#eef1f3;color:var(--kd-text);z-index:3}
.kd-ref-head{display:flex;align-items:center;gap:2px;padding:calc(env(safe-area-inset-top) + 8px) 8px 6px;background:var(--kd-chrome);border-bottom:1px solid var(--kd-line);min-height:52px}
.kd-ref-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;padding:0 6px}
.kd-ref-pagebox{display:flex;align-items:center;gap:4px;font-size:13px;color:var(--kd-muted);padding:0 4px}
.kd-ref-pageno{width:3.4em;height:34px;border:1px solid var(--kd-line);border-radius:8px;text-align:center;background:var(--kd-chrome)}
.kd-ref-btn[aria-pressed="true"]{background:color-mix(in srgb,var(--kd-accent) 16%,transparent);color:var(--kd-accent)}
.kd-ref-scroll{flex:1;overflow:auto;overscroll-behavior:contain;touch-action:pan-x pan-y;-webkit-overflow-scrolling:touch}
.kd-ref-pages{display:flex;flex-direction:column;align-items:center;gap:12px;padding:12px;min-width:min-content}
.kd-ref-page{position:relative;flex:none;background:#fff;box-shadow:0 1px 4px #0000002e}
.kd-ref-page canvas{position:absolute;inset:0;width:100%;height:100%}
.kd-ref.kd-capturing .kd-ref-scroll{touch-action:none;cursor:crosshair}
.kd-ref.kd-capturing .kd-ref-page{outline:2px dashed color-mix(in srgb,var(--kd-accent) 60%,transparent)}
.kd-marquee{position:absolute;border:2px solid var(--kd-accent);background:color-mix(in srgb,var(--kd-accent) 14%,transparent);pointer-events:none;border-radius:2px}
.kd-divider{position:absolute;z-index:4;background:var(--kd-chrome);border-inline:1px solid var(--kd-line);cursor:col-resize;touch-action:none;display:grid;place-items:center}
.kd-divider::after{content:"";width:4px;height:44px;border-radius:2px;background:var(--kd-line)}
.kd-split-rows .kd-divider{cursor:row-resize;border-inline:0;border-block:1px solid var(--kd-line)}
.kd-split-rows .kd-divider::after{width:44px;height:4px}
.kd-divider:focus-visible{outline:2px solid var(--kd-focus);outline-offset:-2px}
.kd-layer .kd-source{flex:none;min-height:32px;padding:0 8px;border:1px solid var(--kd-line);border-radius:8px;background:none;color:var(--kd-accent);font-size:12px;cursor:pointer}
.kd-hint{margin:6px 10px;color:var(--kd-muted);font-size:13px}
.kd-pdf-list{max-height:min(60vh,420px);overflow:auto}
.kd-field.kd-check{flex-direction:row;align-items:center;gap:10px;color:var(--kd-text)}.kd-check input{width:20px;height:20px;accent-color:#1d5d78}
.kd-field>span{display:flex;justify-content:space-between}
.kd-field b{font-weight:500;color:var(--kd-text);font-variant-numeric:tabular-nums}
.kd-pop select,.kd-pop input[type=number],.kd-pop input[type=text]{min-height:40px;border-radius:10px;border:1px solid var(--kd-line);background:var(--app-surface,#fff);padding:0 10px;color:var(--kd-text);user-select:text;-webkit-user-select:text}
.kd-pop input[type=range]{width:100%;accent-color:var(--kd-accent);min-height:32px}
.kd-row{display:flex;gap:8px;align-items:center}
.kd-row>.kd-field{flex:1;min-width:0}.kd-row>.kd-field input{width:100%}
.kd-swatches{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}
.kd-swatches button{aspect-ratio:1;border-radius:50%;border:0;cursor:pointer;box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--kd-text) 40%,transparent);min-width:32px}
.kd-swatches button[aria-pressed="true"]{box-shadow:inset 0 0 0 1px #0002,0 0 0 2px var(--kd-chrome),0 0 0 4px var(--kd-accent)}
.kd-wheel{width:112px;height:112px;flex:none;touch-action:none;border-radius:50%;cursor:crosshair;
 background:radial-gradient(circle,white,transparent 70%),conic-gradient(from 90deg,red,yellow,lime,cyan,blue,magenta,red)}
.kd-native{width:44px;height:40px;padding:0;border:1px solid var(--kd-line);border-radius:10px;background:none}
.kd-preview{height:44px;border-radius:12px;background:#fff;border:1px solid var(--kd-line)}
.kd-pop.kd-layers-pop{width:min(340px,calc(100vw - 16px));gap:10px}
.kd-layers{display:flex;flex-direction:column;gap:2px;max-height:min(34vh,300px);overflow:auto;overscroll-behavior:contain}
.kd-layer{display:flex;align-items:center;gap:2px;border-radius:12px;padding-left:2px;position:relative;background:var(--kd-chrome)}
.kd-layer.kd-dragging{z-index:2;box-shadow:0 10px 26px #0003;opacity:.95}
.kd-layer.kd-drop-before{box-shadow:inset 0 3px 0 var(--kd-accent)}.kd-layer.kd-drop-after{box-shadow:inset 0 -3px 0 var(--kd-accent)}
.kd-grip{width:28px;cursor:grab;touch-action:none;color:var(--kd-muted)}
.kd-thumb{flex:none;width:30px;height:40px;border-radius:4px;border:1px solid var(--kd-line);
 background:repeating-conic-gradient(#d9dee1 0 25%,#fff 0 50%) 0 0/8px 8px}
.kd-meta{display:block;font-size:11.5px;font-weight:400;color:var(--kd-muted)}
.kd-layer-paper{border-top:1px solid var(--kd-line);border-radius:0 0 12px 12px;padding-top:4px;margin-top:2px}
.kd-props{display:flex;flex-direction:column;gap:10px;border-top:1px solid var(--kd-line);padding-top:10px}
.kd-actions{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:2px}
.kd-actions .kd-btn{width:auto;height:54px;display:flex;flex-direction:column;gap:2px;align-items:center;justify-content:center;font-size:11px;line-height:1.1;text-align:center}
.kd-actions .kd-btn svg{width:22px;height:22px}
.kd-order{display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:13px;color:var(--kd-muted)}
.kd-order>div{display:flex;gap:2px}
.kd-selectbar{display:flex;align-items:center;gap:8px;justify-content:space-between;font-size:13px;color:var(--kd-muted)}
.kd-text-btn{min-height:40px;padding:0 14px;border-radius:10px;border:1px solid var(--kd-line);background:none;font-weight:600;cursor:pointer;color:var(--kd-text)}
.kd .kd-text-btn.kd-primary{background:var(--kd-accent);color:var(--kd-accent-on);border-color:transparent}
.kd-text-btn:disabled{opacity:.45;cursor:default}
.kd-layer[aria-current="true"]{background:var(--kd-soft)}
.kd-layer .kd-name{flex:1;text-align:left;min-height:44px;border:0;background:none;cursor:pointer;padding:0 8px;border-radius:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kd-layer[aria-current="true"]{box-shadow:inset 3px 0 0 var(--kd-accent)}
.kd-layer[aria-current="true"] .kd-name{font-weight:650;color:var(--kd-text)}
.kd-layer.kd-hidden .kd-name{color:var(--kd-muted);text-decoration:line-through}
.kd-seg{display:flex;gap:4px;margin-top:6px}
.kd-seg button{flex:1;min-height:44px;border:1px solid var(--kd-line);border-radius:10px;background:none;color:var(--kd-text);font-weight:600;cursor:pointer}
.kd-seg button[aria-checked="true"]{background:var(--kd-accent);color:var(--kd-accent-on);border-color:var(--kd-accent)}
.kd-menu{display:flex;flex-direction:column;gap:2px;min-width:200px}
.kd-menu button{display:flex;align-items:center;gap:12px;min-height:44px;border:0;background:none;border-radius:10px;padding:0 10px;cursor:pointer;text-align:left}
.kd-menu button:hover,.kd-layer .kd-name:hover{background:color-mix(in srgb,var(--kd-text) 7%,transparent)}
.kd-status{position:absolute;left:50%;top:calc(env(safe-area-inset-top) + 66px);translate:-50% 0;z-index:3;padding:8px 14px;border-radius:12px;background:var(--kd-text);color:var(--kd-chrome);font-size:13px;box-shadow:0 6px 22px #0003;pointer-events:none;max-width:calc(100% - 24px)}
.kd-status:empty{display:none}
.kd-hint{margin:-4px 0 0;font-size:12px;color:var(--kd-muted);font-variant-numeric:tabular-nums}
.kd-confirm{position:absolute;inset:0;z-index:8;display:grid;place-items:center;background:#0005;padding:16px}
.kd-confirm[hidden]{display:none}
.kd-confirm>div{background:var(--kd-chrome);border-radius:20px;padding:20px;max-width:360px;width:100%;display:flex;flex-direction:column;gap:10px;box-shadow:0 20px 60px #0004}
.kd-confirm p{margin:0 0 6px}
.kd-confirm button{min-height:46px;border-radius:12px;border:1px solid var(--kd-line);background:none;font-weight:600;cursor:pointer}
.kd-confirm .kd-primary{background:var(--kd-accent);color:var(--kd-accent-on);border-color:transparent}
.kd-confirm .kd-danger{color:#c0392b}
.kd-edge{position:absolute;width:80%;height:40px;transform-origin:50% 0;touch-action:none;text-align:center;color:#142c36;font:12px/40px system-ui,sans-serif;
 background:repeating-linear-gradient(90deg,#3d5a6a99 0 1px,transparent 1px 8px) top/100% 9px no-repeat,repeating-linear-gradient(90deg,#3d5a6acc 0 1px,transparent 1px 40px) top/100% 14px no-repeat,#dbe8efd9;
 border-top:2px solid #1d5d78;border-radius:0 0 10px 10px;box-shadow:0 6px 18px #1a2f3a33}
.kd-edge[hidden]{display:none}
.kd-edge button{position:absolute;right:0;top:0;width:44px;height:38px;border:0;background:none;color:#1d5d78;display:grid;place-items:center;touch-action:none;cursor:grab}
.kd.kd-narrow .kd-title small{display:none}
.kd.kd-narrow .kd-dock{flex-direction:column-reverse;align-items:center;gap:6px}
.kd.kd-narrow .kd-sheet{padding-bottom:calc(env(safe-area-inset-bottom) + 150px)}
@media (prefers-reduced-motion:reduce){.kd *{transition:none!important}}
`;
function iconButton(label, icon, action, extra = {}) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'kd-btn' + (extra.className ? ' ' + extra.className : '');
  el.innerHTML = ICONS[icon];
  el.setAttribute('aria-label', label);
  el.title = extra.title || label;
  if (action) el.onclick = action;
  return el;
}
function pill(...children) {
  const el = document.createElement('div');
  el.className = 'kd-pill';
  el.append(...children);
  return el;
}

// Notes store a lossless PNG so existing readers and offline note packages can display ink.
export async function drawNote(original, commit) {
  const dialog = document.createElement('dialog');
  dialog.className = 'kd';
  dialog.setAttribute('aria-label', 'Note drawing');
  const style = document.createElement('style');
  style.textContent = STYLE;

  // ---- Ink and tool state -------------------------------------------------
  // Each tool remembers its own size and opacity, so switching from the
  // highlighter back to the pen does not leave the pen translucent.
  const toolState = Object.fromEntries(TOOLS.map(name => [name, {
    width: 1,
    opacity: name === 'Highlighter' ? .45 : 1,
  }]));
  const tool = {value: 'Pen'};
  const color = document.createElement('input');
  color.type = 'color';
  color.value = '#173449';
  color.className = 'kd-native';
  color.setAttribute('aria-label', 'Ink color');
  const hex = document.createElement('input');
  hex.type = 'text';
  hex.setAttribute('aria-label', 'Hex ink color');
  hex.maxLength = 7; hex.size = 8; hex.value = color.value;
  hex.spellcheck = false; hex.autocapitalize = 'off';
  function rangeField(label, min, max, value, step, format) {
    const field = document.createElement('label'), head = document.createElement('span'), out = document.createElement('b'), input = document.createElement('input');
    field.className = 'kd-field';
    input.type = 'range';
    Object.assign(input, {min, max, step, value});
    input.setAttribute('aria-label', label);
    head.append(label, out);
    field.append(head, input);
    out.setAttribute('aria-hidden', 'true');
    const show = () => { out.textContent = format(Number(input.value)); input.setAttribute('aria-valuetext', out.textContent); };
    input.addEventListener('input', show);
    show();
    return {field, input, show};
  }
  const widthField = rangeField('Thickness', .2, 5, 1, .05, v => v.toFixed(2) + '×');
  const opacityField = rangeField('Opacity', .01, 1, 1, .01, v => Math.round(v * 100) + '%');
  const width = widthField.input, opacity = opacityField.input;
  const swatchList = document.createElement('div');
  swatchList.className = 'kd-swatches';
  for (const value of SWATCHES) {
    const b = document.createElement('button');
    b.type = 'button'; b.style.background = value; b.dataset.color = value;
    b.setAttribute('aria-label', 'Use color ' + value);
    b.onclick = () => setColor(value);
    swatchList.append(b);
  }
  function setColor(value, fromHex) {
    color.value = value;
    if (!fromHex) hex.value = value;
    dialog.style.setProperty('--kd-ink', value);
    for (const b of swatchList.children) b.setAttribute('aria-pressed', String(b.dataset.color === value.toLowerCase()));
    drawPreview();
  }
  hex.oninput = () => { if (/^#?[0-9a-f]{6}$/i.test(hex.value)) setColor(('#' + hex.value.replace('#', '')).toLowerCase(), true); };
  hex.onblur = () => { hex.value = color.value; };
  color.oninput = () => setColor(color.value);
  const wheel = document.createElement('canvas');
  wheel.width = wheel.height = 112;
  wheel.className = 'kd-wheel';
  wheel.setAttribute('aria-label', 'Hue and saturation');
  const brightnessField = rangeField('Brightness', 0, 100, 100, 1, v => v + '%');
  const brightness = brightnessField.input;
  brightness.setAttribute('aria-label', 'Color brightness');
  let hue = 0, saturation = 1;
  function wheelColor() {
    const v = brightness.value / 100;
    const channel = n => { const k = (n + hue / 60) % 6; return Math.round(255 * v * (1 - saturation * Math.max(0, Math.min(k, 4 - k, 1)))).toString(16).padStart(2, '0'); };
    setColor('#' + channel(5) + channel(3) + channel(1));
  }
  function sampleWheel(e) {
    const b = wheel.getBoundingClientRect(), x = (e.clientX - b.left) / b.width * 2 - 1, y = (e.clientY - b.top) / b.height * 2 - 1;
    hue = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360; saturation = Math.min(1, Math.hypot(x, y)); wheelColor();
  }
  wheel.onpointerdown = e => { wheel.setPointerCapture(e.pointerId); sampleWheel(e); };
  wheel.onpointermove = e => { if (wheel.hasPointerCapture(e.pointerId)) sampleWheel(e); };
  brightness.addEventListener('input', wheelColor);
  // Live stroke preview so size and opacity are judged visually, not by number.
  const preview = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  preview.setAttribute('class', 'kd-preview');
  preview.setAttribute('viewBox', '0 0 240 44');
  preview.setAttribute('preserveAspectRatio', 'none');
  preview.setAttribute('aria-hidden', 'true');
  const previewPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  previewPath.setAttribute('d', 'M18 30 C60 6 100 6 120 22 S180 38 222 14');
  previewPath.setAttribute('fill', 'none');
  previewPath.setAttribute('stroke-linecap', 'round');
  preview.append(previewPath);
  function drawPreview() {
    const base = {Eraser: 32, Marker: 12, Highlighter: 24}[tool.value] ?? 6;
    previewPath.setAttribute('stroke', tool.value === 'Eraser' ? '#c9d2d7' : color.value);
    previewPath.setAttribute('stroke-width', String(Math.max(1, Math.min(34, base * Number(width.value) * .55))));
    previewPath.setAttribute('stroke-opacity', String(opacity.value));
  }
  width.addEventListener('input', () => { toolState[tool.value].width = Number(width.value); drawPreview(); });
  opacity.addEventListener('input', () => { toolState[tool.value].opacity = Number(opacity.value); drawPreview(); });

  // ---- Paper -------------------------------------------------------------
  const sizes = {A4:[210,297],A3:[297,420],A5:[148,210],Letter:[215.9,279.4],Legal:[215.9,355.6]};
  function select(label, options) {
    const el = document.createElement('select');
    el.setAttribute('aria-label', label);
    for (const value of options) el.add(new Option(value, value));
    return el;
  }
  const size = select('Paper size', [...Object.keys(sizes), 'Custom']);
  const guide = select('Paper guides', ['Plain', 'Ruled', 'Grid', 'Dots']);
  // Guide spacing in millimetres: ruled follows notebook rulings, grid and dots a drafting pitch.
  const GUIDE_MM = {Ruled: {Narrow: 6, Medium: 7.1, Wide: 8.7}, Grid: {Narrow: 4, Medium: 5, Wide: 7}, Dots: {Narrow: 4, Medium: 5, Wide: 7}};
  const guideSpacing = select('Guide spacing', ['Narrow', 'Medium', 'Wide']); guideSpacing.value = 'Medium';
  const guidePrint = document.createElement('input'); guidePrint.type = 'checkbox'; guidePrint.checked = true;
  guidePrint.setAttribute('aria-label', 'Include guides in the note');
  let exportingWithoutGuides = false;
  function millimetres(label, value) {
    const input = document.createElement('input');
    input.type = 'number'; input.min = '1'; input.step = 'any'; input.value = value; input.inputMode = 'decimal';
    input.setAttribute('aria-label', label + ' in millimetres');
    const field = document.createElement('label');
    field.className = 'kd-field';
    field.append(label + ' (mm)', input);
    return input;
  }
  const paperWidth = millimetres('Width', 210), paperHeight = millimetres('Height', 297);
  // Resolution: canvas pixels per inch of paper. Strokes are stored in canvas
  // pixels, so the effective value is saved with the page (`dpi`) and reused on
  // reopen. Pages saved before this setting used min(6 px/mm, 3072 px long edge).
  const RESOLUTIONS = {'Standard · 150 dpi': 150, 'High · 220 dpi': 220, 'Print · 300 dpi': 300, 'Ultra · 400 dpi': 400};
  const MAX_PIXELS = 16e6, MAX_SIDE = 8192; // stays inside iPhone/iPad Safari canvas limits
  const resolution = select('Resolution', [...Object.keys(RESOLUTIONS), 'Custom']);
  const dpiInput = document.createElement('input');
  dpiInput.type = 'number'; dpiInput.min = '72'; dpiInput.max = '600'; dpiInput.step = '1'; dpiInput.inputMode = 'numeric';
  dpiInput.setAttribute('aria-label', 'Resolution in dots per inch');
  const dpiField = document.createElement('label');
  dpiField.className = 'kd-field';
  dpiField.append('Dots per inch (72–600)', dpiInput);
  const pixelInfo = document.createElement('p');
  pixelInfo.className = 'kd-hint';
  let dpi = 300, pxPerMm = 300 / 25.4;
  function setResolutionControls(value) {
    const preset = Object.keys(RESOLUTIONS).find(k => Math.abs(RESOLUTIONS[k] - value) < .01);
    resolution.value = preset || 'Custom';
    dpiInput.value = String(Math.round(value));
    dpiField.hidden = !!preset;
  }
  const customRow = document.createElement('div');
  customRow.className = 'kd-row';
  customRow.append(paperWidth.parentElement, paperHeight.parentElement);

  // ---- Canvas --------------------------------------------------------------
  const canvas = document.createElement('canvas');
  canvas.width = 1500;
  canvas.height = 950;
  canvas.setAttribute('aria-label', 'Drawing surface. Use a pen or mouse.');
  const ctx = canvas.getContext('2d');
  const plane = document.createElement('div');
  plane.className = 'kd-plane';
  const background = document.createElement('canvas');
  background.width = canvas.width;
  background.height = canvas.height;
  const base = background.getContext('2d');
  base.fillStyle = 'white';
  base.fillRect(0, 0, background.width, background.height);
  const saved = await readPage(original);
  const raster = original && (!saved || saved.basePNG);
  let basePNG = saved?.basePNG;
  if (original && !saved) basePNG = await new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(reader.error); reader.readAsDataURL(original);
  });
  if (raster) {
    const url = basePNG;
    if (typeof url !== 'string' || !url.startsWith('data:image/png;base64,')) throw Error('Invalid drawing background.');
    const image = new Image();
    image.src = url; // A self-contained PNG data URL.
    await image.decode();
    background.width = image.naturalWidth; background.height = image.naturalHeight; base.drawImage(image, 0, 0);
  }
  const sheet = document.createElement('div');
  sheet.className = 'kd-sheet';
  const status = document.createElement('div');
  status.className = 'kd-status';
  status.setAttribute('role', 'status');
  let statusTimer = 0;
  function say(text, sticky) {
    clearTimeout(statusTimer);
    status.textContent = text;
    if (text && !sticky) statusTimer = setTimeout(() => { if (status.textContent === text) status.textContent = ''; }, 2600);
  }
  let mm = [210, 297], changed = false, fit = 'width';
  function layoutPlane() {
    const pad = 24;
    const availW = Math.max(120, sheet.clientWidth - pad);
    const cs = getComputedStyle(sheet);
    const availH = Math.max(120, sheet.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom));
    const w = fit === 'page' ? Math.min(availW, availH * mm[0] / mm[1]) : Math.min(availW, 1600);
    plane.style.width = Math.round(w) + 'px';
  }
  function paper() {
    const custom = size.value === 'Custom';
    customRow.hidden = !custom;
    const dims = custom ? [paperWidth.valueAsNumber, paperHeight.valueAsNumber] : sizes[size.value];
    if (!dims.every(v => Number.isFinite(v) && v >= 1)) { say('Enter positive paper dimensions in mm.', true); return false; }
    mm = dims;
    // Cap by total pixels and longest side so large paper never exceeds what
    // mobile Safari can allocate; the page keeps its size, only detail drops.
    const cap = Math.min(Math.sqrt(MAX_PIXELS / (mm[0] * mm[1])), MAX_SIDE / Math.max(...mm));
    pxPerMm = Math.min(dpi / 25.4, cap);
    canvas.width = Math.max(1, Math.round(mm[0] * pxPerMm)); canvas.height = Math.max(1, Math.round(mm[1] * pxPerMm));
    const effective = Math.round(pxPerMm * 25.4);
    pixelInfo.textContent = canvas.width + ' × ' + canvas.height + ' px' + (pxPerMm * 25.4 < dpi - .5 ? ' · kept to ' + effective + ' dpi at this paper size so it opens on iPhone and iPad' : '');
    layoutPlane();
    return true;
  }
  // Paper (white, guides and any legacy raster background) has its own opacity,
  // so a drawing can be exported with a see-through page.
  let paperOpacity = Number.isFinite(saved?.paperOpacity) ? Math.max(0, Math.min(1, saved.paperOpacity)) : 1;
  function renderLayer(layer) {
    const surface = layer.surface;
    if (surface.width !== canvas.width || surface.height !== canvas.height) { surface.width = canvas.width; surface.height = canvas.height; layer.dirty = true; }
    if (!layer.dirty) return surface;
    const ink = surface.getContext('2d'); ink.clearRect(0, 0, surface.width, surface.height);
    if (layer.rasterImg) ink.drawImage(layer.rasterImg, 0, 0, surface.width, surface.height);
    for (const stroke of strokes) {
      if ((stroke.layer ?? 0) !== layer.id || !stroke.points.length) continue;
      if (!stroke.soft && stroke.tool === 'Straight line') mark(ink, stroke, stroke.points[0], stroke.points.at(-1));
      else paintWhole(ink, stroke);
    }
    layer.dirty = false;
    return surface;
  }
  function repaint(box) {
    for (const layer of layers) if (layer.visible && (layer.dirty || layer.surface.width !== canvas.width || layer.surface.height !== canvas.height)) { box = null; break; }
    let X = 0, Y = 0, W = canvas.width, H = canvas.height;
    if (box) {
      X = Math.max(0, Math.floor(box.x0)); Y = Math.max(0, Math.floor(box.y0));
      W = Math.min(canvas.width, Math.ceil(box.x1)) - X; H = Math.min(canvas.height, Math.ceil(box.y1)) - Y;
      if (W <= 0 || H <= 0) return;
    }
    ctx.save();
    if (box) { ctx.beginPath(); ctx.rect(X, Y, W, H); ctx.clip(); }
    ctx.clearRect(X, Y, W, H);
    ctx.globalAlpha = paperOpacity;
    ctx.fillStyle = 'white'; ctx.fillRect(X, Y, W, H);
    const spacing = (GUIDE_MM[guide.value]?.[guideSpacing.value] || 0) * canvas.height / mm[1];
    if (guide.value !== 'Plain' && spacing >= 2 && !exportingWithoutGuides) {
      const y0 = spacing * Math.max(1, Math.ceil(Y / spacing - 1)), x0 = spacing * Math.max(1, Math.ceil(X / spacing - 1));
      if (guide.value === 'Dots') {
        const dot = Math.max(1.5, pxPerMm * .35); ctx.fillStyle = '#9fbccd';
        for (let y = y0; y < canvas.height && y <= Y + H + spacing; y += spacing)
          for (let x = x0; x < canvas.width && x <= X + W + spacing; x += spacing) ctx.fillRect(x - dot / 2, y - dot / 2, dot, dot);
      } else {
        ctx.beginPath(); ctx.strokeStyle = '#c5d9e5'; ctx.lineWidth = Math.max(1, pxPerMm * .12);
        for (let y = y0; y < canvas.height && y <= Y + H + spacing; y += spacing) { ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); }
        if (guide.value === 'Grid') for (let x = x0; x < canvas.width && x <= X + W + spacing; x += spacing) { ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); }
        ctx.stroke();
      }
    }
    if (raster) ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
    for (const layer of layers) {
      if (!layer.visible) continue;
      const surface = renderLayer(layer);
      ctx.globalAlpha = layer.opacity; ctx.globalCompositeOperation = layer.blend;
      ctx.drawImage(surface, X, Y, W, H, X, Y, W, H);
      if (live?.buffered && scratch && active.layer === layer.id) { ctx.globalAlpha = layer.opacity * strokeAlpha(active); ctx.drawImage(scratch, X, Y, W, H, X, Y, W, H); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    // A straight line being dragged is previewed here and written to its layer on release.
    if (active?.tool === 'Straight line' && active.points.length) paintLine(ctx, active);
    ctx.restore();
  }
  const strokes = saved?.strokes || [];
  const blendOk = value => BLENDS.some(b => b[0] === value);
  const layers = (saved?.layers?.length ? saved.layers : [{id: 0, name: 'Layer 1', visible: true}]).map(l => ({
    id: l.id, name: String(l.name ?? 'Layer'), visible: l.visible !== false,
    opacity: Number.isFinite(l.opacity) ? Math.max(0, Math.min(1, l.opacity)) : 1,
    blend: blendOk(l.blend) ? l.blend : 'source-over',
    raster: typeof l.raster === 'string' && l.raster.startsWith('data:image/png;base64,') ? l.raster : null,
    rasterImg: null, surface: document.createElement('canvas'), dirty: true,
    ...(l.source && typeof l.source.name === 'string' && Number.isInteger(l.source.page) ? {source: {itemId: typeof l.source.itemId === 'string' ? l.source.itemId : null, name: l.source.name, page: l.source.page}} : {}),
  }));
  // Merged layers keep their pixels as a PNG; decode them before first paint.
  await Promise.all(layers.filter(l => l.raster).map(async l => {
    const image = new Image(); image.src = l.raster;
    try { await image.decode(); l.rasterImg = image; } catch { l.raster = null; }
  }));
  // Reopen on the saved layer, unless it is hidden: then the top visible layer.
  const savedLayer = layers.find(l => l.id === saved?.activeLayer);
  let current = savedLayer?.visible ? savedLayer : [...layers].reverse().find(l => l.visible) || savedLayer || layers[0];
  let active = null, saving = false;
  function mark(ctx, stroke, from, to) {
    ctx.globalCompositeOperation = stroke.tool === 'Eraser' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = ctx.fillStyle = stroke.color;
    ctx.globalAlpha = stroke.opacity ?? (stroke.tool === 'Highlighter' ? .22 : stroke.tool === 'Pencil' ? .7 : 1);
    ctx.lineWidth = to.width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (!from) {
      ctx.arc(to.x, to.y, to.width / 2, 0, 2 * Math.PI);
      ctx.fill();
    } else {
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  // ---- Stroke renderer (KI-012) -------------------------------------------
  // New strokes are smoothed (curves through the midpoints of the pen samples)
  // and filled as one shape per batch, so a translucent pen, pencil or marker
  // has the same opacity along its whole length, with no beads at the samples.
  // Translucent strokes are drawn opaque into a scratch layer and laid onto the
  // page layer once, at the stroke's opacity.
  const TAU = 2 * Math.PI;
  // Marker and highlighter have a flat chisel tip (thick one way, thin the other,
  // like an architect's marker); the pencil has paper grain; the pen is round.
  const CHISEL = {Marker: .42, Highlighter: .36}, CHISEL_ANGLE = -.6;
  // Pencil model: graphite only catches the raised "tooth" of the paper, so light
  // pressure leaves a sparse, broken, grainy line and heavy pressure fills the
  // tooth in. Tilting the pencil lays the side of the lead down: a wide, soft
  // shading stroke. Pressure picks one of PENCIL_LEVELS tooth thresholds.
  const PENCIL_LEVELS = 8, TOOTH = 256;
  let tooth = null; const levelMasks = [], patternCache = new Map();
  function buildTooth() {
    let seed = 0x9e3779b9;                           // fixed seed: a reopened drawing has the same grain
    const rand = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const n = TOOTH, white = new Float32Array(n * n); for (let i = 0; i < white.length; i++) white[i] = rand();
    let coarse = white;
    for (let pass = 0; pass < 2; pass++) {            // wrap-around box blur: soft paper fibres
      const next = new Float32Array(n * n);
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        let sum = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sum += coarse[((y + dy + n) % n) * n + (x + dx + n) % n];
        next[y * n + x] = sum / 9;
      }
      coarse = next;
    }
    const mixed = Array.from(coarse, (v, i) => .72 * v + .28 * white[i]);
    const order = mixed.map((v, i) => i).sort((a, b) => mixed[a] - mixed[b]);
    tooth = new Float32Array(n * n); order.forEach((index, rank) => { tooth[index] = rank / (n * n); });   // uniform 0..1
  }
  function pencilPattern(ctx, color, level) {
    const key = color + level; let pattern = patternCache.get(key);
    if (pattern) return pattern;
    if (!tooth) buildTooth();
    if (!levelMasks[level]) {
      const mask = document.createElement('canvas'); mask.width = mask.height = TOOTH;
      const g = mask.getContext('2d'), image = g.createImageData(TOOTH, TOOTH);
      const threshold = 1 - (.08 + .84 * level / (PENCIL_LEVELS - 1));
      for (let i = 0; i < tooth.length; i++) image.data[i * 4 + 3] = Math.round(255 * .92 * Math.max(0, Math.min(1, (tooth[i] - threshold) / .32 + .3)));   // soft grains, like graphite
      g.putImageData(image, 0, 0); levelMasks[level] = mask;
    }
    const tile = document.createElement('canvas'); tile.width = tile.height = TOOTH;
    const g = tile.getContext('2d'); g.fillStyle = color; g.fillRect(0, 0, TOOTH, TOOTH);
    g.globalCompositeOperation = 'destination-in'; g.drawImage(levelMasks[level], 0, 0);
    pattern = ctx.createPattern(tile, 'repeat'); patternCache.set(key, pattern);
    return pattern;
  }
  const strokeAlpha = stroke => stroke.opacity ?? (stroke.tool === 'Highlighter' ? .22 : stroke.tool === 'Pencil' ? .7 : 1);
  const isBuffered = stroke => stroke.soft && stroke.tool !== 'Eraser' && stroke.tool !== 'Straight line' && strokeAlpha(stroke) < .999;
  let scratch = null;
  function scratchLayer() {
    if (!scratch || scratch.width !== canvas.width || scratch.height !== canvas.height) { scratch = document.createElement('canvas'); scratch.width = canvas.width; scratch.height = canvas.height; }
    return scratch;
  }
  // Draws points [from, to) of a stroke (and, when final, the closing segment).
  // Returns the area touched, or null.
  function paintStroke(ctx, stroke, from, to, final) {
    const P = stroke.points; let box = null;
    const pencil = stroke.tool === 'Pencil', flat = CHISEL[stroke.tool];
    ctx.save();
    ctx.globalCompositeOperation = stroke.tool === 'Eraser' ? 'destination-out' : 'source-over';
    ctx.globalAlpha = 1;
    const plain = new Path2D(), levels = new Map();
    const stamp = (x, y, r, q, tl, az) => {
      let path = plain, reach = r;
      if (pencil) {
        const level = Math.max(0, Math.min(PENCIL_LEVELS - 1, Math.round(q ?? 4)));
        path = levels.get(level); if (!path) levels.set(level, path = new Path2D());
      }
      if (pencil && tl > .04) {                       // side of the lead: long axis along the lean
        reach = r * (1 + 4.5 * Math.pow(tl, 1.3));
        path.moveTo(x + reach * Math.cos(az), y + reach * Math.sin(az)); path.ellipse(x, y, reach, r, az, 0, TAU);
      } else if (flat) {
        path.moveTo(x + r * Math.cos(CHISEL_ANGLE), y + r * Math.sin(CHISEL_ANGLE)); path.ellipse(x, y, r, r * flat, CHISEL_ANGLE, 0, TAU);
      } else { path.moveTo(x + r, y); path.arc(x, y, r, 0, TAU); }
      box = union(box, {x0: x - reach - 1, y0: y - reach - 1, x1: x + reach + 1, y1: y + reach + 1});
    };
    const curve = (S, C, E, wS, wE, aS, aE) => {
      const len = Math.hypot(C.x - S.x, C.y - S.y) + Math.hypot(E.x - C.x, E.y - C.y);
      const steps = Math.max(1, Math.ceil(len / Math.max(.7, Math.min(wS, wE) * (flat || 1) * .16)));
      for (let k = 0; k <= steps; k++) {
        const t = k / steps, u = 1 - t, near = t < .5 ? aS : aE;
        stamp(u * u * S.x + 2 * u * t * C.x + t * t * E.x, u * u * S.y + 2 * u * t * C.y + t * t * E.y, Math.max(.4, (wS + (wE - wS) * t) / 2),
          (aS.q ?? 4) + ((aE.q ?? 4) - (aS.q ?? 4)) * t, (aS.tl ?? 0) + ((aE.tl ?? 0) - (aS.tl ?? 0)) * t, near.az ?? 0);
      }
    };
    const mid = (p, q) => ({x: (p.x + q.x) / 2, y: (p.y + q.y) / 2});
    for (let i = from; i < to; i++) {
      if (i === 0) { stamp(P[0].x, P[0].y, Math.max(.4, P[0].width / 2), P[0].q, P[0].tl, P[0].az); continue; }
      const S = i === 1 ? P[0] : mid(P[i - 2], P[i - 1]), E = mid(P[i - 1], P[i]);
      curve(S, P[i - 1], E, i === 1 ? P[0].width : (P[i - 2].width + P[i - 1].width) / 2, (P[i - 1].width + P[i].width) / 2, P[i - 1], P[i]);
    }
    if (final && P.length > 1) {
      const n = P.length, S = mid(P[n - 2], P[n - 1]);
      curve(S, S, P[n - 1], (P[n - 2].width + P[n - 1].width) / 2, P[n - 1].width, P[n - 1], P[n - 1]);
    }
    if (pencil) for (const [level, path] of levels) { ctx.fillStyle = pencilPattern(ctx, stroke.color, level); ctx.fill(path); }
    else { ctx.fillStyle = stroke.color; ctx.fill(plain); }
    ctx.restore();
    return box;
  }
  function paintLine(ctx, stroke) {
    const a = stroke.points[0], b = stroke.points.at(-1);
    ctx.save(); ctx.strokeStyle = stroke.color; ctx.globalAlpha = strokeAlpha(stroke); ctx.lineWidth = b.width; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore();
  }
  // Whole stroke onto a layer surface (reopen, undo, merge).
  function paintWhole(ink, stroke) {
    if (!stroke.soft) { stroke.points.forEach((p, i) => mark(ink, stroke, stroke.points[i - 1], p)); return; }
    if (stroke.tool === 'Straight line') { paintLine(ink, stroke); return; }
    if (!isBuffered(stroke)) { paintStroke(ink, stroke, 0, stroke.points.length, true); return; }
    const sc = scratchLayer(), sctx = sc.getContext('2d');
    const box = paintStroke(sctx, stroke, 0, stroke.points.length, true);
    if (!box) return;
    layBuffer(ink, box, strokeAlpha(stroke));
  }
  function layBuffer(ink, box, alpha) {
    const x = Math.max(0, Math.floor(box.x0)), y = Math.max(0, Math.floor(box.y0)), w = Math.min(canvas.width, Math.ceil(box.x1)) - x, h = Math.min(canvas.height, Math.ceil(box.y1)) - y;
    if (w <= 0 || h <= 0) return;
    ink.save(); ink.globalAlpha = alpha; ink.drawImage(scratch, x, y, w, h, x, y, w, h); ink.restore();
    scratch.getContext('2d').clearRect(x, y, w, h);
  }
  // Apple Pencil pressure -> 0..1 (light writing is ~0.05-0.3, so the usable range is stretched).
  function pressureShape(p) {
    if (p > 0) {
      pressureRange.hi = Math.max(p, pressureRange.hi * .998 + p * .002); pressureRange.lo = Math.min(p, pressureRange.lo * .998 + p * .002);
      if (pressureRange.hi - pressureRange.lo < .3) { const mid = (pressureRange.hi + pressureRange.lo) / 2; pressureRange.lo = Math.max(0, mid - .15); pressureRange.hi = pressureRange.lo + .3; }
    }
    return Math.max(0, Math.min(1, (p - pressureRange.lo) / (pressureRange.hi - pressureRange.lo)));
  }
  const pen = {down: 0, up: 0, cancel: 0, replaced: 0, lost: 0, samples: 0, errors: 0, lastError: '', pMin: 1, pMax: 0, maxGap: 0, rawPen: 0, rawStylus: 0, viaTouch: 0, rawTouch: 0, rawMouse: 0, ignored: {}};
  const ignore = why => { pen.ignored[why] = (pen.ignored[why] || 0) + 1; };
  const union = (a, b) => !a ? b : !b ? a : {x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1)};
  const guarded = (name, fn) => (...args) => { try { return fn(...args); } catch (error) { pen.errors++; pen.lastError = name + ': ' + (error?.message || error); } };
  // The pointer handlers only record what the pen did; nothing slow runs in
  // them, so a busy frame can never make the page miss the next stroke. Drawing
  // happens once per frame from the recorded samples. `live` is the working
  // state of the stroke being drawn and is never saved.
  let live = null;
  // Tilt arrives as tiltX/tiltY or, in WebKit, possibly only as altitude/azimuth angles.
  const tiltOf = e => {
    if (e.tiltX || e.tiltY) return [e.tiltX, e.tiltY];
    if (typeof e.altitudeAngle !== 'number' || e.altitudeAngle >= Math.PI / 2 - .001) return [0, 0];
    const lean = (Math.PI / 2 - e.altitudeAngle) * 180 / Math.PI, az = e.azimuthAngle || 0;
    return [lean * Math.cos(az), lean * Math.sin(az)];
  };
  const sampleOf = e => { const [tiltX, tiltY] = tiltOf(e); return {clientX: e.clientX, clientY: e.clientY, pressure: e.pressure, tiltX, tiltY, pointerType: e.pointerType, t: e.timeStamp}; };
  function addSample(sample, rect) {
    const local = localPoint(sample, rect);
    const depth = PRESSURE_DEPTH[pressureMode] ?? .75;
    let shaped = null;
    if (sample.pointerType === 'pen') {
      pen.samples++;
      let p = sample.pressure;
      if (p > 0) { pen.pMin = Math.min(pen.pMin, p); pen.pMax = Math.max(pen.pMax, p); }
      else p = live.p ?? .3;                        // some contact samples report 0
      live.p = live.p == null ? p : live.p * .55 + p * .45;   // smooth jitter
      shaped = pressureShape(live.p);
    }
    const f = shaped == null || depth === 0 ? 1 : (1 - .8 * depth) + 1.6 * depth * shaped;
    // Pen speed also shapes the line (slow = fuller, fast = finer, like ink), and
    // a stroke eases in, so writing looks hand-drawn even if the pen reports flat pressure.
    if (live.prev && sample.t > live.prev.t) {
      const v = Math.hypot(sample.clientX - live.prev.clientX, sample.clientY - live.prev.clientY) / Math.max(1, sample.t - live.prev.t);
      live.v = live.v == null ? v : live.v * .7 + v * .3;
    }
    live.prev = sample; live.n = (live.n || 0) + 1;
    const dynamic = (live.v == null ? 1 : 1.2 - .5 * Math.min(1, live.v / 2.2)) * Math.min(1, .5 + .17 * live.n);
    const toolName = active.tool;
    const weight = toolName === 'Eraser' ? 32
      : toolName === 'Marker' ? (14 + Math.hypot(sample.tiltX, sample.tiltY) / 4) * (1 + (f - 1) * .5)
      : toolName === 'Highlighter' ? 26
      : toolName === 'Pencil' ? 4.6 * (1 + (f - 1) * .55) * (1 + (dynamic - 1) * .5)
      : 6 * f * dynamic;
    const next = {x: local.x * canvas.width / plane.clientWidth, y: local.y * canvas.height / plane.clientHeight, width: Math.round(weight * Number(width.value) * pxPerMm / 6 * 100) / 100};
    if (rulerOn) {
      const rad = edgeAngle * Math.PI / 180, ux = Math.cos(rad), uy = Math.sin(rad);
      const ox = edgeX * canvas.width, oy = edgeY * canvas.height;
      const dot = (next.x - ox) * ux + (next.y - oy) * uy;
      next.x = ox + dot * ux; next.y = oy + dot * uy;
    }
    if (toolName === 'Pencil') {
      // Pressure sets how much of the paper's tooth the graphite fills; lean sets the shading width.
      next.q = Math.round(Math.max(0, Math.min(PENCIL_LEVELS - 1, shaped == null || depth === 0 ? 4 : 4 + (shaped - .5) * 14 * depth)) * 10) / 10;
      const lean = Math.min(1, Math.hypot(sample.tiltX, sample.tiltY) / 75), azimuth = Math.atan2(sample.tiltY, sample.tiltX);
      live.lean = live.lean == null ? lean : live.lean * .6 + lean * .4;
      if (live.lean > .04) { next.tl = Math.round(live.lean * 100) / 100; next.az = Math.round(azimuth * 100) / 100; }
    }
    active.points.push(next);
  }
  // Turns the recorded samples into ink. Returns the page area changed.
  function flush(final) {
    if (!active || !live) return null;
    const rect = plane.getBoundingClientRect();
    for (const sample of live.queue.splice(0)) addSample(sample, rect);
    if (active.tool === 'Straight line') {
      const a = active.points[0], b = active.points.at(-1);
      if (!a || !b) return null;
      const pad = b.width / 2 + 3, now = {x0: Math.min(a.x, b.x) - pad, y0: Math.min(a.y, b.y) - pad, x1: Math.max(a.x, b.x) + pad, y1: Math.max(a.y, b.y) + pad};
      const box = union(live.line, now); live.line = now; return box;
    }
    const target = live.buffered ? scratchLayer().getContext('2d') : current.surface.getContext('2d');
    const box = paintStroke(target, active, live.painted, active.points.length, final);
    live.painted = active.points.length;
    live.area = union(live.area, box);
    return box;
  }
  let frame = 0, pendingBox = null, pendingFull = false, lastFrame = 0;
  function requestFrame() {
    if (frame) return;
    frame = requestAnimationFrame(now => {
      frame = 0;
      if (active && lastFrame) pen.maxGap = Math.max(pen.maxGap, Math.round(now - lastFrame));
      lastFrame = active ? now : 0;
      const full = pendingFull; let box = pendingBox; pendingBox = null; pendingFull = false;
      if (active) box = union(box, guarded('draw', flush)(false) ?? null);
      repaint(full ? null : box);
    });
  }
  // A box repaints just that part of the page; no box repaints it all.
  function schedulePaint(box) {
    if (!box) pendingFull = true; else pendingBox = union(pendingBox, box);
    requestFrame();
  }
  // A stroke ends on lift, cancel or when a new pen contact starts, and the
  // pen is followed anywhere on the dialog, so a missed lift can never swallow
  // the next stroke.
  function endStroke() {
    if (!active) return;
    const stroke = active, state = live;
    guarded('finish', flush)(true);
    active = null; live = null; dialog.classList.remove('kd-inking');
    const layer = layers.find(l => l.id === stroke.layer);
    if (layer?.surface) {
      if (stroke.tool === 'Straight line') paintLine(layer.surface.getContext('2d'), stroke);
      else if (state?.buffered && state.area) layBuffer(layer.surface.getContext('2d'), state.area, strokeAlpha(stroke));
    }
    schedulePaint(stroke.tool === 'Straight line' ? state?.line : state?.area);
  }
  function beginStroke(sample, id, t0, touchId) {
    if (saving) return ignore('saving');
    if (!current.visible) { say('“' + current.name + '” is hidden. Show it in Layers to draw on it.'); return; }
    if (active) { pen.replaced++; endStroke(); }
    closePops();
    pen.down++;
    active = {id, layer: current.id, opacity: Number(opacity.value), tool: tool.value, color: tool.value === 'Eraser' ? '#ffffff' : color.value, soft: 1, points: []};
    // Working fields stay out of the saved drawing (not enumerable).
    Object.defineProperties(active, {t0: {value: t0, writable: true}, touchId: {value: touchId, writable: true}});
    live = {queue: [sample], painted: 0, area: null, line: null, p: null, buffered: isBuffered(active)};
    redoStack.length = 0; strokes.push(active); history.push({stroke: active}); changed = true;
    dialog.classList.add('kd-inking');
    refreshHistory();
    requestFrame();
  }
  canvas.onpointerdown = guarded('down', event => {
    if (event.pointerType === 'touch') return;
    if (event.pointerType === 'mouse' && event.button !== 0) return ignore('button');
    if (active?.touchId != null && event.timeStamp - active.t0 < 400) return;    // this contact is already being drawn from touch events
    event.preventDefault();
    beginStroke(sampleOf(event), event.pointerId, event.timeStamp);
    showBadge();
  });
  dialog.addEventListener('pointermove', guarded('move', event => {
    if (!live || active?.id !== event.pointerId || event.timeStamp < active.t0) return;
    const samples = event.getCoalescedEvents?.();
    for (const sample of samples?.length ? samples : [event]) live.queue.push(sampleOf(sample));
    requestFrame();
  }), true);
  const lift = guarded('lift', event => { if (active?.id === event.pointerId && event.timeStamp >= active.t0) { if (event.type === 'pointercancel') pen.cancel++; else pen.up++; endStroke(); } });
  dialog.addEventListener('pointerup', lift, true);
  dialog.addEventListener('pointercancel', lift, true);
  // Independent count of every contact the page was given, to compare with strokes drawn.
  dialog.addEventListener('pointerdown', e => { if (e.pointerType === 'pen') pen.rawPen++; else if (e.pointerType === 'touch') pen.rawTouch++; else pen.rawMouse++; showBadge(); }, true);
  // Compact record of the last contacts, for More > Pen check.
  const trace = [];
  const note = (type, e) => { trace.push(Math.round(e.timeStamp) % 100000 + ' ' + type + ' #' + e.pointerId + ' p' + (e.pressure ?? 0).toFixed(2)); if (trace.length > 40) trace.shift(); };
  for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'lostpointercapture', 'gotpointercapture']) dialog.addEventListener(type, e => { if (e.pointerType !== 'touch') note(type.replace('pointer', ''), e); }, true);
  // Second route for the Pencil: if the pointer events do not start a stroke for a
  // stylus touch, the stroke is drawn from the touch events instead.
  const sampleOfTouch = (t, e) => {
    const lean = (Math.PI / 2 - (t.altitudeAngle ?? Math.PI / 2)) * 180 / Math.PI, az = t.azimuthAngle ?? 0;
    return {clientX: t.clientX, clientY: t.clientY, pressure: t.force || 0, tiltX: lean * Math.cos(az), tiltY: lean * Math.sin(az), pointerType: 'pen', t: e.timeStamp};
  };
  const waiting = new Map(), endedTouches = new Set();
  dialog.addEventListener('touchstart', e => {
    for (const t of e.changedTouches) {
      if (t.touchType !== 'stylus') continue;
      pen.rawStylus++; showBadge(); endedTouches.delete(t.identifier);
      // Only the paper can start a stroke: a Pencil touch on a panel, button or the ruler must not draw.
      if (t.target !== canvas) continue;
      const started = e.timeStamp, queue = [sampleOfTouch(t, e)], id = t.identifier; waiting.set(id, queue);
      setTimeout(() => {
        waiting.delete(id);
        if (active && active.t0 >= started - 60) return;       // the pointer events already started it
        if (endedTouches.has(id) && queue.length < 2) return;
        pen.viaTouch++;
        beginStroke(queue[0], 'touch' + id, started, id);
        for (const extra of queue.slice(1)) live.queue.push(extra);
        if (endedTouches.has(id)) endStroke();
        showBadge();
      }, 35);
    }
  }, {capture: true, passive: true});
  dialog.addEventListener('touchmove', e => {
    for (const t of e.changedTouches) {
      if (t.touchType !== 'stylus') continue;
      if (waiting.has(t.identifier)) waiting.get(t.identifier).push(sampleOfTouch(t, e));
      else if (live && active?.touchId === t.identifier) { live.queue.push(sampleOfTouch(t, e)); requestFrame(); }
    }
  }, {capture: true, passive: true});
  const touchEnd = e => { for (const t of e.changedTouches) { if (t.touchType !== 'stylus') continue; endedTouches.add(t.identifier); if (active?.touchId === t.identifier) endStroke(); } };
  dialog.addEventListener('touchend', touchEnd, {capture: true, passive: true});
  dialog.addEventListener('touchcancel', touchEnd, {capture: true, passive: true});
  // Small live readout beside the paper size: pointer contacts / touch contacts / strokes drawn.
  let description = '';
  function showBadge() { titleSmall.textContent = description + (pen.rawPen || pen.rawStylus ? ' · ✎ ' + pen.rawPen + '/' + pen.rawStylus + '/' + pen.down : ''); }
  function penReport() {
    const p = pen.pMax ? pen.pMin.toFixed(2) + '–' + pen.pMax.toFixed(2) : 'none';
    const skipped = Object.entries(pen.ignored).map(([k, v]) => k + ' ' + v).join(', ') || 'none';
    return 'Pencil contacts ' + pen.rawPen + ' (touch events ' + pen.rawStylus + ', drawn from touch ' + pen.viaTouch + ')' + ' · strokes ' + pen.down + ' · lifted ' + pen.up + ' · cancelled ' + pen.cancel + ' · replaced ' + pen.replaced + ' · finger touches ' + pen.rawTouch + ' · pressure ' + p + ' · slowest frame ' + pen.maxGap + ' ms · errors ' + pen.errors + (pen.lastError ? ' (' + pen.lastError + ')' : '') + ' · skipped ' + skipped + ' · last: ' + trace.slice(-14).join(' | ');
  }

  // ---- History -------------------------------------------------------------
  // One history for strokes and layer changes. Strokes already in a reopened
  // drawing stay undoable, as before. Layer changes store before/after states.
  const history = strokes.map(stroke => ({stroke}));
  const redoStack = [];
  function snapshot() {
    return {layers: layers.map(l => ({...l})), strokes: strokes.slice(), current: current.id, paperOpacity};
  }
  function restore(state) {
    layers.splice(0, layers.length, ...state.layers.map(l => ({...l, dirty: true})));
    strokes.splice(0, strokes.length, ...state.strokes);
    paperOpacity = state.paperOpacity;
    current = layers.find(l => l.id === state.current) || layers.at(-1);
    selecting = false; selected.clear();
  }
  function commitState(before) {
    history.push({before, after: snapshot()}); redoStack.length = 0; changed = true;
    refreshHistory(); refreshLayers(); repaint();
  }
  function knownStrokes() {
    const all = new Set(strokes);
    for (const entry of [...history, ...redoStack]) {
      if (entry.stroke) all.add(entry.stroke);
      else for (const s of [...entry.before.strokes, ...entry.after.strokes]) all.add(s);
    }
    return all;
  }
  function doUndo() {
    if (saving || active || !history.length) return;
    const entry = history.pop();
    if (entry.stroke) {
      const at = strokes.lastIndexOf(entry.stroke); if (at >= 0) strokes.splice(at, 1);
      (layers.find(l => l.id === (entry.stroke.layer ?? 0)) || current).dirty = true;
    } else restore(entry.before);
    redoStack.push(entry); changed = true;
    repaint(); refreshHistory(); refreshLayers();
  }
  function doRedo() {
    if (active || saving || !redoStack.length) return;
    const entry = redoStack.pop();
    if (entry.stroke) {
      strokes.push(entry.stroke);
      (layers.find(l => l.id === (entry.stroke.layer ?? 0)) || current).dirty = true;
    } else restore(entry.after);
    history.push(entry); changed = true;
    repaint(); refreshHistory(); refreshLayers();
  }
  const undo = iconButton('Undo', 'undo', doUndo, {title: 'Undo (⌘Z)'});
  const redo = iconButton('Redo', 'redo', doRedo, {title: 'Redo (⇧⌘Z)'});
  function refreshHistory() { undo.disabled = !history.length; redo.disabled = !redoStack.length; }

  // ---- Popovers ------------------------------------------------------------
  const pops = [];
  function popover(title, anchor) {
    const pop = document.createElement('div');
    pop.className = 'kd-pop'; pop.hidden = true;
    pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', title);
    const h = document.createElement('h3'); h.textContent = title; pop.append(h);
    pop.anchor = anchor;
    anchor.setAttribute('aria-expanded', 'false');
    anchor.setAttribute('aria-haspopup', 'dialog');
    anchor.addEventListener('click', () => (pop.hidden ? openPop(pop) : closePops()));
    pops.push(pop);
    return pop;
  }
  function placePop(pop) {
    const r = pop.anchor.getBoundingClientRect(), vw = innerWidth, vh = innerHeight, m = 8;
    pop.style.left = pop.style.top = pop.style.bottom = '';
    const w = pop.offsetWidth;
    pop.style.left = Math.max(m, Math.min(vw - w - m, r.left + r.width / 2 - w / 2)) + 'px';
    if (r.top > vh / 2) { pop.style.bottom = (vh - r.top + m) + 'px'; pop.style.maxHeight = (r.top - 2 * m) + 'px'; }
    else { pop.style.top = (r.bottom + m) + 'px'; pop.style.maxHeight = (vh - r.bottom - 2 * m) + 'px'; }
  }
  function openPop(pop) {
    closePops();
    pop.hidden = false; pop.anchor.setAttribute('aria-expanded', 'true');
    placePop(pop);
  }
  function closePops() {
    for (const pop of pops) {
      // Return keyboard focus to the button that opened the panel.
      if (!pop.hidden && pop.contains(document.activeElement)) pop.anchor.focus({preventScroll: true});
      pop.hidden = true; pop.anchor.setAttribute('aria-expanded', 'false');
    }
  }
  dialog.addEventListener('pointerdown', e => {
    if (pops.some(p => !p.hidden && (p.contains(e.target) || p.anchor.contains(e.target)))) return;
    if (pops.some(p => !p.hidden)) closePops();
  }, true);

  // ---- Tool dock -----------------------------------------------------------
  const toolGroup = document.createElement('div');
  toolGroup.setAttribute('role', 'radiogroup');
  toolGroup.setAttribute('aria-label', 'Drawing tool');
  toolGroup.style.display = 'flex';
  const toolButtons = TOOLS.map(name => {
    const b = iconButton(name, name, () => selectTool(name), {className: 'kd-tool'});
    b.setAttribute('role', 'radio');
    toolGroup.append(b);
    return b;
  });
  function selectTool(name) {
    tool.value = name;
    for (const b of toolButtons) { const on = b.getAttribute('aria-label') === name; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; }
    width.value = toolState[name].width; opacity.value = toolState[name].opacity;
    widthField.show(); opacityField.show(); drawPreview();
  }
  toolGroup.addEventListener('keydown', e => {
    const step = {ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1}[e.key];
    if (!step) return;
    e.preventDefault();
    const next = TOOLS[(TOOLS.indexOf(tool.value) + step + TOOLS.length) % TOOLS.length];
    selectTool(next); toolButtons[TOOLS.indexOf(next)].focus();
  });
  const inkButton = iconButton('Ink color and size', 'close', null, {className: 'kd-swatch-btn'});
  inkButton.innerHTML = '<i></i>';
  const inkPop = popover('Ink', inkButton);
  const wheelRow = document.createElement('div'); wheelRow.className = 'kd-row'; wheelRow.style.alignItems = 'center';
  const wheelSide = document.createElement('div'); wheelSide.style.cssText = 'display:flex;flex-direction:column;gap:8px;flex:1;min-width:0';
  const hexRow = document.createElement('div'); hexRow.className = 'kd-row'; hex.style.flex = '1'; hex.style.minWidth = '0';
  hexRow.append(color, hex);
  wheelSide.append(hexRow, brightnessField.field);
  wheelRow.append(wheel, wheelSide);
  const pressureField = document.createElement('div'); pressureField.className = 'kd-field';
  const pressureHead = document.createElement('span'); pressureHead.textContent = 'Pencil pressure';
  const pressureSeg = document.createElement('div'); pressureSeg.className = 'kd-seg'; pressureSeg.setAttribute('role', 'radiogroup'); pressureSeg.setAttribute('aria-label', 'Pencil pressure');
  for (const name of Object.keys(PRESSURE_DEPTH)) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = name; b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(name === pressureMode));
    b.onclick = () => { pressureMode = name; for (const o of pressureSeg.children) o.setAttribute('aria-checked', String(o === b)); };
    pressureSeg.append(b);
  }
  pressureField.append(pressureHead, pressureSeg);
  inkPop.append(swatchList, wheelRow, preview, widthField.field, opacityField.field, pressureField);

  // ---- Layers ----------------------------------------------------------------
  // List (top layer first) with drag-to-reorder, thumbnails, visibility and a
  // paper row; properties for the current layer (name, opacity, blend); actions
  // (duplicate, copy, paste, merge down, top/bottom, delete); and a select mode
  // for merging or deleting several layers at once. Structural and property
  // changes are undoable.
  const layersButton = iconButton('Layers', 'layers');
  const layersPop = popover('Layers', layersButton);
  layersPop.classList.add('kd-layers-pop');
  const layerList = document.createElement('div');
  layerList.className = 'kd-layers';
  layerList.setAttribute('role', 'list');
  let selecting = false, paperSelected = false;
  const selected = new Set();
  const nextId = () => Math.max(-1, ...layers.map(l => l.id)) + 1;
  const newLayer = (props = {}) => ({id: nextId(), name: 'Layer', visible: true, opacity: 1, blend: 'source-over', raster: null, rasterImg: null,
    ...props, surface: document.createElement('canvas'), dirty: true});
  const cloneStroke = (stroke, layerId, sx = 1, sy = 1, sw = 1) => ({...stroke, id: undefined, layer: layerId,
    points: stroke.points.map(p => ({...p, x: p.x * sx, y: p.y * sy, width: p.width * sw}))});
  function layerRecord(l) {
    if (l.rasterImg && !l.raster) {
      // Merged pixels are encoded once, when first needed.
      const c = document.createElement('canvas'); c.width = l.rasterImg.width; c.height = l.rasterImg.height;
      c.getContext('2d').drawImage(l.rasterImg, 0, 0); l.raster = c.toDataURL('image/png');
    }
    return {id: l.id, name: l.name, visible: l.visible, opacity: l.opacity, blend: l.blend, ...(l.raster ? {raster: l.raster} : {}), ...(l.source ? {source: l.source} : {})};
  }
  function insertAbove(target, layer) { layers.splice(layers.indexOf(target) + 1, 0, layer); }

  const addLayer = iconButton('Add layer', 'plus', () => {
    const before = snapshot(), id = nextId();
    const layer = newLayer({name: 'Layer ' + (id + 1)});
    insertAbove(current, layer); current = layer; paperSelected = false; commitState(before);
  });
  const selectToggle = iconButton('Select layers', 'select', () => { selecting = !selecting; selected.clear(); refreshLayers(); });
  layersPop.querySelector('h3').append(Object.assign(document.createElement('span'), {style: 'display:flex;gap:2px'}));
  layersPop.querySelector('h3 span').append(selectToggle, addLayer);

  function duplicateLayer(layer) {
    const before = snapshot();
    const copy = newLayer({name: layer.name + ' copy', visible: layer.visible, opacity: layer.opacity, blend: layer.blend, raster: layer.raster, rasterImg: layer.rasterImg});
    insertAbove(layer, copy);
    for (const stroke of strokes.filter(s => (s.layer ?? 0) === layer.id)) strokes.push(cloneStroke(stroke, copy.id));
    current = copy; commitState(before); say('Duplicated “' + layer.name + '”');
  }
  function copyLayer(layer) {
    layerClipboard = {name: layer.name, opacity: layer.opacity, blend: layer.blend, raster: layer.raster, rasterImg: layer.rasterImg,
      width: canvas.width, height: canvas.height, pxPerMm,
      strokes: strokes.filter(s => (s.layer ?? 0) === layer.id).map(s => cloneStroke(s, null))};
    // Also offer the layer's pixels to other apps, where the browser allows it.
    try {
      const surface = renderLayer(layer);
      navigator.clipboard?.write?.([new ClipboardItem({'image/png': new Promise(resolve => surface.toBlob(resolve, 'image/png'))})]).catch(() => {});
    } catch {}
    refreshLayers(); say('Copied “' + layer.name + '”. Paste it here or in another drawing.');
  }
  function pasteLayer() {
    const clip = layerClipboard; if (!clip) return;
    const before = snapshot();
    const layer = newLayer({name: clip.name + ' (pasted)', opacity: clip.opacity, blend: clip.blend, raster: clip.raster, rasterImg: clip.rasterImg});
    insertAbove(current, layer);
    const sx = canvas.width / clip.width, sy = canvas.height / clip.height, sw = pxPerMm / clip.pxPerMm;
    for (const stroke of clip.strokes) strokes.push(cloneStroke(stroke, layer.id, sx, sy, sw));
    current = layer; commitState(before);
  }
  function deleteLayers(ids) {
    if (ids.size >= layers.length) { say('A drawing needs at least one layer.'); return; }
    const before = snapshot(), index = layers.indexOf(current);
    for (let i = layers.length - 1; i >= 0; i--) if (ids.has(layers[i].id)) layers.splice(i, 1);
    for (let i = strokes.length - 1; i >= 0; i--) if (ids.has(strokes[i].layer ?? 0)) strokes.splice(i, 1);
    current = layers[Math.min(Math.max(0, index - 1), layers.length - 1)];
    selecting = false; selected.clear(); commitState(before);
  }
  // Merging composites the chosen layers (bottom to top, with their own opacity
  // and blend modes) into one layer of pixels, so the result looks exactly as it
  // did. The merged layer keeps the bottom layer's name and blend mode; new ink
  // can still be added on top of it. Undo restores the separate layers.
  function mergeLayers(ids) {
    const chosen = layers.filter(l => ids.has(l.id));
    if (chosen.length < 2) { say('Select two or more layers to merge.'); return; }
    if (chosen.some(l => !l.visible)) { say('Show hidden layers before merging them.'); return; }
    const before = snapshot(), bottom = chosen[0];
    const pixels = document.createElement('canvas'); pixels.width = canvas.width; pixels.height = canvas.height;
    const g = pixels.getContext('2d');
    chosen.forEach((layer, i) => {
      g.globalAlpha = layer.opacity; g.globalCompositeOperation = i === 0 ? 'source-over' : layer.blend;
      g.drawImage(renderLayer(layer), 0, 0);
    });
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    const merged = newLayer({name: bottom.name, opacity: 1, blend: bottom.blend, rasterImg: pixels});
    merged.id = bottom.id;
    for (let i = strokes.length - 1; i >= 0; i--) if (ids.has(strokes[i].layer ?? 0)) strokes.splice(i, 1);
    const at = layers.indexOf(bottom);
    for (let i = layers.length - 1; i >= 0; i--) if (ids.has(layers[i].id)) layers.splice(i, 1);
    layers.splice(Math.min(at, layers.length), 0, merged);
    current = merged; selecting = false; selected.clear(); commitState(before);
    say('Merged ' + chosen.length + ' layers into “' + merged.name + '”');
  }
  function moveLayer(layer, toIndex) {
    const from = layers.indexOf(layer); toIndex = Math.max(0, Math.min(layers.length - 1, toIndex));
    if (from === toIndex) return;
    const before = snapshot();
    layers.splice(from, 1); layers.splice(toIndex, 0, layer); commitState(before);
  }
  function toggleLayer(layer) {
    const hadFocus = layerList.contains(document.activeElement);
    const before = snapshot();
    layer.visible = !layer.visible; commitState(before);
    if (hadFocus) layerList.querySelector('[data-layer="' + layer.id + '"] .kd-eye')?.focus();
  }

  // Properties of the current layer (or of the paper when its row is chosen).
  const props = document.createElement('div'); props.className = 'kd-props';
  const nameInput = document.createElement('input');
  nameInput.type = 'text'; nameInput.maxLength = 60; nameInput.setAttribute('aria-label', 'Layer name');
  const nameField = document.createElement('label'); nameField.className = 'kd-field'; nameField.append('Name', nameInput);
  const layerOpacity = rangeField('Layer opacity', 0, 1, 1, .01, v => Math.round(v * 100) + '%');
  const blend = select('Blend mode', []);
  for (const [value, label] of BLENDS) blend.add(new Option(label, value));
  const blendField = document.createElement('label'); blendField.className = 'kd-field'; blendField.append('Blend mode', blend);
  const paperOpacityField = rangeField('Background opacity', 0, 1, 1, .01, v => Math.round(v * 100) + '%');
  let pendingBefore = null;
  const beginEdit = () => { pendingBefore ??= snapshot(); };
  const endEdit = () => { if (pendingBefore) { const before = pendingBefore; pendingBefore = null; commitState(before); } };
  nameInput.addEventListener('focus', beginEdit);
  nameInput.addEventListener('input', () => { beginEdit(); current.name = nameInput.value || 'Layer'; refreshRowsOnly(); });
  nameInput.addEventListener('change', endEdit);
  nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') nameInput.blur(); });
  layerOpacity.input.addEventListener('input', () => { beginEdit(); current.opacity = Number(layerOpacity.input.value); repaint(); refreshRowsOnly(); });
  layerOpacity.input.addEventListener('change', endEdit);
  blend.addEventListener('change', () => { beginEdit(); current.blend = blend.value; repaint(); endEdit(); });
  paperOpacityField.input.addEventListener('input', () => { beginEdit(); paperOpacity = Number(paperOpacityField.input.value); repaint(); refreshRowsOnly(); });
  paperOpacityField.input.addEventListener('change', endEdit);
  const paperHint = document.createElement('p'); paperHint.className = 'kd-hint';
  paperHint.textContent = 'Lower it to draw on a see-through page; the inserted image keeps the transparency.';

  const act = (label, icon, fn, caption) => {
    const b = iconButton(label, icon, () => fn());
    if (caption) b.append(caption);
    return b;
  };
  const duplicateButton = act('Duplicate layer', 'duplicate', () => duplicateLayer(current), 'Duplicate');
  const copyButton = act('Copy layer', 'copy', () => copyLayer(current), 'Copy');
  const pasteButton = act('Paste layer', 'paste', pasteLayer, 'Paste');
  const mergeDownButton = act('Merge down', 'merge', () => { const below = layers[layers.indexOf(current) - 1]; if (below) mergeLayers(new Set([below.id, current.id])); }, 'Merge down');
  const raiseLayer = act('Raise layer', 'up', () => moveLayer(current, layers.indexOf(current) + 1));
  const lowerLayer = act('Lower layer', 'down', () => moveLayer(current, layers.indexOf(current) - 1));
  const topButton = act('Move layer to top', 'toTop', () => moveLayer(current, layers.length - 1));
  const bottomButton = act('Move layer to bottom', 'toBottom', () => moveLayer(current, 0));
  const deleteButton = act('Delete layer', 'trash', () => deleteLayers(new Set([current.id])), 'Delete');
  const actions = document.createElement('div'); actions.className = 'kd-actions';
  actions.append(duplicateButton, copyButton, pasteButton, mergeDownButton, deleteButton);
  const order = document.createElement('div'); order.className = 'kd-order';
  const orderButtons = document.createElement('div');
  orderButtons.append(topButton, raiseLayer, lowerLayer, bottomButton);
  order.append('Stacking order', orderButtons);

  const selectBar = document.createElement('div'); selectBar.className = 'kd-selectbar';
  const selectCount = document.createElement('span');
  const mergeSelected = Object.assign(document.createElement('button'), {type: 'button', className: 'kd-text-btn kd-primary', textContent: 'Merge'});
  mergeSelected.onclick = () => mergeLayers(new Set(selected));
  const deleteSelected = Object.assign(document.createElement('button'), {type: 'button', className: 'kd-text-btn', textContent: 'Delete'});
  deleteSelected.onclick = () => deleteLayers(new Set(selected));
  const doneSelecting = Object.assign(document.createElement('button'), {type: 'button', className: 'kd-text-btn', textContent: 'Done'});
  doneSelecting.onclick = () => { selecting = false; selected.clear(); refreshLayers(); };
  mergeSelected.setAttribute('aria-label', 'Merge selected layers');
  deleteSelected.setAttribute('aria-label', 'Delete selected layers');
  selectBar.append(selectCount, Object.assign(document.createElement('span'), {style: 'flex:1'}), deleteSelected, mergeSelected, doneSelecting);
  layersPop.append(layerList, props);

  function thumbnail(source, opacity = 1) {
    const t = document.createElement('canvas'); t.className = 'kd-thumb';
    const h = 40, w = Math.max(16, Math.min(40, Math.round(h * canvas.width / canvas.height)));
    t.width = w * 2; t.height = h * 2; t.style.width = w + 'px';
    const g = t.getContext('2d'); g.globalAlpha = opacity;
    if (source === 'paper') { g.fillStyle = '#fff'; g.fillRect(0, 0, t.width, t.height); }
    else g.drawImage(source, 0, 0, t.width, t.height);
    return t;
  }
  function layerRow(layer) {
    const row = document.createElement('div');
    row.className = 'kd-layer' + (layer.visible ? '' : ' kd-hidden');
    row.setAttribute('role', 'listitem');
    row.setAttribute('aria-current', String(!paperSelected && layer === current));
    row.dataset.layer = String(layer.id);
    const grip = iconButton('Reorder ' + layer.name, 'grip', null, {className: 'kd-grip', title: 'Drag to reorder'});
    grip.addEventListener('pointerdown', e => startDrag(e, row, layer));
    grip.addEventListener('keydown', e => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); moveLayer(layer, layers.indexOf(layer) + (e.key === 'ArrowUp' ? 1 : -1)); layerList.querySelector('[data-layer="' + layer.id + '"] .kd-grip')?.focus(); }
    });
    const name = document.createElement('button');
    name.type = 'button'; name.className = 'kd-name';
    const meta = [layer.blend !== 'source-over' ? blendName(layer.blend) : '', layer.opacity < 1 ? Math.round(layer.opacity * 100) + '%' : '', layer.source ? 'from PDF' : layer.rasterImg ? 'merged' : ''].filter(Boolean).join(' · ');
    name.append(layer.name, Object.assign(document.createElement('span'), {className: 'kd-meta', textContent: meta}));
    name.setAttribute('aria-label', (selecting ? 'Toggle selection of ' : 'Select ') + layer.name + (layer.visible ? '' : ' (hidden)'));
    name.onclick = () => {
      if (selecting) { selected.has(layer.id) ? selected.delete(layer.id) : selected.add(layer.id); refreshLayers(); return; }
      current = layer; paperSelected = false; refreshLayers();
    };
    const eye = iconButton((layer.visible ? 'Hide ' : 'Show ') + layer.name, layer.visible ? 'eye' : 'eyeOff', () => toggleLayer(layer), {className: 'kd-eye'});
    row.append(grip);
    if (selecting) {
      const box = iconButton('Selected: ' + layer.name, selected.has(layer.id) ? 'boxOn' : 'boxOff', () => name.onclick());
      box.setAttribute('role', 'checkbox'); box.setAttribute('aria-checked', String(selected.has(layer.id)));
      row.append(box);
    }
    row.append(thumbnail(renderLayer(layer), layer.opacity), name);
    if (layer.source) {
      const link = document.createElement('button'); link.type = 'button'; link.className = 'kd-source';
      link.textContent = 'p. ' + layer.source.page; link.title = 'Show page ' + layer.source.page + ' of ' + layer.source.name;
      link.setAttribute('aria-label', 'Show page ' + layer.source.page + ' of ' + layer.source.name);
      link.onclick = () => { closePops(); showSource(layer.source); };
      row.append(link);
    }
    row.append(eye);
    return row;
  }
  function paperRow() {
    const row = document.createElement('div');
    row.className = 'kd-layer kd-layer-paper';
    row.setAttribute('role', 'listitem');
    row.setAttribute('aria-current', String(paperSelected));
    const name = document.createElement('button');
    name.type = 'button'; name.className = 'kd-name';
    name.append('Background', Object.assign(document.createElement('span'), {className: 'kd-meta', textContent: 'Paper · ' + Math.round(paperOpacity * 100) + '%'}));
    name.setAttribute('aria-label', 'Select background');
    name.onclick = () => { if (!selecting) { paperSelected = true; refreshLayers(); } };
    row.append(Object.assign(document.createElement('span'), {style: 'width:28px;flex:none'}), thumbnail('paper', paperOpacity), name);
    return row;
  }
  function refreshRowsOnly() {
    layerList.replaceChildren(...[...layers].reverse().map(layerRow), paperRow());
  }
  function refreshLayers() {
    if (!layers.includes(current)) current = layers.at(-1);
    refreshRowsOnly();
    // Properties: background, select mode, or the current layer.
    if (selecting) {
      selectCount.textContent = selected.size + ' selected';
      mergeSelected.disabled = selected.size < 2; deleteSelected.disabled = !selected.size || selected.size >= layers.length;
      props.replaceChildren(selectBar);
    } else if (paperSelected) {
      paperOpacityField.input.value = paperOpacity; paperOpacityField.show();
      props.replaceChildren(paperOpacityField.field, paperHint);
    } else {
      if (document.activeElement !== nameInput) nameInput.value = current.name;
      layerOpacity.input.value = current.opacity; layerOpacity.show(); blend.value = current.blend;
      props.replaceChildren(nameField, layerOpacity.field, blendField, actions, order);
    }
    selectToggle.setAttribute('aria-pressed', String(selecting));
    const index = layers.indexOf(current);
    raiseLayer.disabled = topButton.disabled = index === layers.length - 1;
    lowerLayer.disabled = bottomButton.disabled = mergeDownButton.disabled = index === 0;
    deleteButton.disabled = layers.length < 2;
    pasteButton.disabled = !layerClipboard;
    pasteButton.title = layerClipboard ? 'Paste “' + layerClipboard.name + '” as a new layer' : 'Paste layer (copy a layer first)';
    layersButton.title = 'Layers — drawing on “' + current.name + '”' + (current.visible ? '' : ' (hidden)');
    if (!layersPop.hidden) placePop(layersPop);
  }
  // Drag a row by its grip to change the stacking order (top of list = on top).
  function startDrag(e, row, layer) {
    if (selecting) return;
    e.preventDefault();
    // The list can be rebuilt while dragging (a thumbnail finishing after a paste),
    // which removes the grip and its pointer capture. Follow the pointer on the
    // window and look the rows up afresh so the drop always lands.
    const pointerId = e.pointerId, startY = e.clientY;
    try { e.currentTarget.setPointerCapture(pointerId); } catch {}
    const rowsNow = () => [...layerList.querySelectorAll('.kd-layer:not(.kd-layer-paper)')];
    const rowOf = () => layerList.querySelector('.kd-layer[data-layer="' + layer.id + '"]');
    const from = () => rowsNow().indexOf(rowOf());
    let target = from();
    rowOf()?.classList.add('kd-dragging');
    const move = ev => {
      if (ev.pointerId !== pointerId) return;
      const rows = rowsNow(), dragged = rowOf(), origin = rows.indexOf(dragged);
      if (dragged) { dragged.classList.add('kd-dragging'); dragged.style.transform = 'translateY(' + (ev.clientY - startY) + 'px)'; }
      target = rows.length - 1;
      for (let i = 0; i < rows.length; i++) {
        if (rows[i] === dragged) continue;
        const r = rows[i].getBoundingClientRect();
        if (ev.clientY < r.top + r.height / 2) { target = i > origin ? i - 1 : i; break; }
      }
      rows.forEach((r, i) => { r.classList.toggle('kd-drop-before', i === target && target < origin); r.classList.toggle('kd-drop-after', i === target && target > origin); });
    };
    const end = ev => {
      if (ev.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', move, true); window.removeEventListener('pointerup', end, true); window.removeEventListener('pointercancel', end, true);
      const origin = from();
      rowsNow().forEach(r => { r.style.transform = ''; r.classList.remove('kd-dragging', 'kd-drop-before', 'kd-drop-after'); });
      // Display order is top-first; the layers array is bottom-first.
      if (ev.type === 'pointerup' && origin >= 0 && target !== origin) moveLayer(layer, layers.length - 1 - target); else refreshLayers();
    };
    window.addEventListener('pointermove', move, true); window.addEventListener('pointerup', end, true); window.addEventListener('pointercancel', end, true);
  }
  layersButton.addEventListener('click', () => refreshLayers());
  refreshLayers();

  const paperButton = iconButton('Paper', 'paper');
  const paperPop = popover('Paper', paperButton);
  const sizeField = document.createElement('label'); sizeField.className = 'kd-field'; sizeField.append('Size', size);
  const guideField = document.createElement('label'); guideField.className = 'kd-field'; guideField.append('Guides', guide);
  const spacingField = document.createElement('label'); spacingField.className = 'kd-field'; spacingField.append('Spacing', guideSpacing);
  const printField = document.createElement('label'); printField.className = 'kd-field kd-check'; printField.append(guidePrint, 'Include guides in the note');
  const resolutionField = document.createElement('label'); resolutionField.className = 'kd-field'; resolutionField.append('Resolution', resolution);
  paperPop.append(sizeField, guideField, spacingField, printField, customRow, resolutionField, dpiField, pixelInfo);
  // One tap cycles the guides; the Paper panel has spacing and export options.
  const GUIDE_CYCLE = ['Plain', 'Ruled', 'Grid', 'Dots'];
  const guidesButton = iconButton('Guides', 'guides', () => {
    guide.value = GUIDE_CYCLE[(GUIDE_CYCLE.indexOf(guide.value) + 1) % GUIDE_CYCLE.length];
    guide.dispatchEvent(new Event('change'));
  });
  function showGuides() {
    guidesButton.setAttribute('aria-label', 'Guides: ' + guide.value);
    guidesButton.title = 'Guides: ' + guide.value + ' — tap to change';
    guidesButton.setAttribute('aria-pressed', String(guide.value !== 'Plain'));
    spacingField.hidden = guide.value === 'Plain';
  }

  let rulerOn = false, edgeX = .5, edgeY = .5, edgeAngle = 0, drag = null, lastTap = null;
  const edge = document.createElement('div'), handle = document.createElement('button');
  edge.dataset.ruler = ''; edge.hidden = true; edge.className = 'kd-edge';
  handle.type = 'button'; handle.innerHTML = svg('<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v4.5h-4.5"/>');
  handle.setAttribute('aria-label', 'Rotate straightedge');
  const degrees = document.createElement('span'); edge.append(degrees, handle);
  function showEdge() { edge.style.left = edgeX * 100 + '%'; edge.style.top = edgeY * 100 + '%'; edge.style.transform = 'translateX(-50%) rotate(' + edgeAngle + 'deg)'; degrees.textContent = Math.round((edgeAngle % 360 + 360) % 360) + '°'; }
  const toggle = iconButton('Ruler', 'ruler', () => {
    rulerOn = !rulerOn; edge.hidden = !rulerOn;
    if (rulerOn) {
      // Place the straightedge in the middle of what is on screen, not the page centre.
      const view = sheet.getBoundingClientRect(), p = localPoint({clientX: view.left + view.width / 2, clientY: view.top + view.height / 2});
      edgeX = Math.max(.1, Math.min(.9, p.x / plane.clientWidth)); edgeY = Math.max(.02, Math.min(.95, p.y / plane.clientHeight));
    } toggle.setAttribute('aria-pressed', String(rulerOn)); showEdge(); }, {title: 'Ruler — double-tap it to turn 90°'});
  toggle.setAttribute('aria-pressed', 'false');
  edge.onpointerdown = e => { if (drag) return; e.preventDefault(); edge.setPointerCapture(e.pointerId); drag = {id: e.pointerId, start: localPoint(e), x: edgeX, y: edgeY, rotate: handle.contains(e.target), moved: false}; };
  edge.onpointermove = e => {
    if (drag?.id !== e.pointerId) return; const p = localPoint(e), dx = p.x - drag.start.x, dy = p.y - drag.start.y;
    if (Math.hypot(dx, dy) * zoom < 4 && !drag.moved) return; drag.moved = true;
    if (drag.rotate) edgeAngle = Math.atan2(p.y - edgeY * plane.clientHeight, p.x - edgeX * plane.clientWidth) * 180 / Math.PI;
    else { edgeX = Math.max(0, Math.min(1, drag.x + dx / plane.clientWidth)); edgeY = Math.max(0, Math.min(1, drag.y + dy / plane.clientHeight)); }
    showEdge();
  };
  edge.onpointerup = e => {
    if (drag?.id !== e.pointerId) return;
    if (!drag.moved && lastTap && performance.now() - lastTap.time < 400 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 24) { edgeAngle += 90; showEdge(); lastTap = null; }
    else lastTap = drag.moved ? null : {time: performance.now(), x: e.clientX, y: e.clientY};
    drag = null;
  };
  edge.onpointercancel = () => { drag = null; lastTap = null; };

  // ---- View: zoom, rotate, pan, fit and full screen -----------------------
  let zoom = 1, angle = 0, panX = 0, panY = 0;
  function transform() { plane.style.transform = 'translate(' + panX + 'px,' + panY + 'px) rotate(' + angle + 'rad) scale(' + zoom + ')'; }
  function localPoint(e, rect = plane.getBoundingClientRect()) {
    const dx = e.clientX - rect.left - rect.width / 2, dy = e.clientY - rect.top - rect.height / 2;
    return {x: plane.clientWidth / 2 + (dx * Math.cos(angle) + dy * Math.sin(angle)) / zoom, y: plane.clientHeight / 2 + (-dx * Math.sin(angle) + dy * Math.cos(angle)) / zoom};
  }
  function setFit(mode) { fit = mode; zoom = 1; angle = panX = panY = 0; transform(); layoutPlane(); sheet.scrollTop = 0; closePops(); }
  const moreButton = iconButton('More', 'more');
  const morePop = popover('View', moreButton);
  const menu = document.createElement('div'); menu.className = 'kd-menu';
  function menuItem(label, icon, action) {
    const b = document.createElement('button'); b.type = 'button'; b.innerHTML = ICONS[icon]; b.append(label); b.onclick = action; menu.append(b); return b;
  }
  menuItem('Fit width', 'fitWidth', () => setFit('width'));
  menuItem('Fit whole page', 'fitPage', () => setFit('page'));
  menuItem('Pen check', 'select', () => { closePops(); say(penReport()); });
  menuItem('Export PNG', 'export', () => {
    closePops();
    canvas.toBlob(blob => {
      if (!blob) return; const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = 'KeepIt sketch.png'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
    });
  });
  morePop.append(menu);

  // Full screen: the sketchbook already covers the app; this also removes the
  // browser's own chrome where the platform allows it (Mac, iPad), and always
  // lets the page run up to the top edge. iPhone Safari falls back to the
  // in-app immersive view.
  const fullscreenTarget = () => document.fullscreenElement || document.webkitFullscreenElement;
  const fullscreenButton = iconButton('Full screen', 'expand', () => setImmersive(!dialog.classList.contains('kd-immersive')));
  fullscreenButton.setAttribute('aria-pressed', 'false');
  async function setImmersive(on) {
    dialog.classList.toggle('kd-immersive', on);
    fullscreenButton.setAttribute('aria-pressed', String(on));
    fullscreenButton.innerHTML = ICONS[on ? 'collapse' : 'expand'];
    fullscreenButton.setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen');
    fullscreenButton.title = fullscreenButton.getAttribute('aria-label');
    try {
      if (on && !fullscreenTarget()) await (dialog.requestFullscreen?.call(dialog, {navigationUI: 'hide'}) ?? dialog.webkitRequestFullscreen?.call(dialog));
      else if (!on && fullscreenTarget() === dialog) await (document.exitFullscreen?.call(document) ?? document.webkitExitFullscreen?.call(document));
    } catch { /* Not available here (e.g. iPhone Safari); the immersive layout still applies. */ }
    requestAnimationFrame(layoutPlane);
  }
  const onFullscreenChange = () => { if (!fullscreenTarget() && dialog.classList.contains('kd-immersive')) setImmersive(false); };
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);

  // ---- Save / close ----------------------------------------------------------
  const insert = document.createElement('button');
  insert.type = 'button'; insert.className = 'kd-done';
  insert.setAttribute('aria-label', original ? 'Update drawing' : 'Insert drawing');
  insert.textContent = original ? 'Update' : 'Insert';
  insert.title = (original ? 'Update the drawing in your note' : 'Insert the drawing into your note') + ' (⌘↩)';
  insert.onclick = async () => {
    if (saving) return;
    active = null;
    saving = true; insert.disabled = true; closePops(); say('Saving to note…', true);
    try {
      exportingWithoutGuides = !guidePrint.checked;
      repaint();
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      exportingWithoutGuides = false;
      if (!blob) throw Error('Could not encode the drawing.');
      const result = packPage(blob, {version: 1, basePNG, mm, size: size.value, guide: guide.value, guideSpacing: guideSpacing.value, guidePrint: guidePrint.checked, ...(reference ? {reference: {...reference}} : {}), dpi: pxPerMm * 25.4, paperOpacity, strokes, layers: layers.map(layerRecord), activeLayer: current.id});
      await commit(new File([result], 'KeepIt drawing.png', {type: 'image/png'}), {reference: reference && {...reference}});
      dialog.returnValue = 'inserted';
      dialog.close('inserted');
    } catch (err) { say(err.message, true); insert.disabled = false; }
    finally { saving = false; }
  };
  // Leaving with unsaved ink asks first: save, discard or keep drawing.
  const confirmBox = document.createElement('div');
  confirmBox.className = 'kd-confirm'; confirmBox.hidden = true;
  confirmBox.setAttribute('role', 'alertdialog'); confirmBox.setAttribute('aria-label', 'Unsaved drawing');
  const confirmCard = document.createElement('div');
  const confirmText = document.createElement('p');
  confirmText.textContent = original ? 'Update the drawing in your note before closing?' : 'Insert this drawing into your note before closing?';
  const confirmSave = document.createElement('button'); confirmSave.type = 'button'; confirmSave.className = 'kd-primary'; confirmSave.textContent = original ? 'Update drawing' : 'Insert drawing';
  const confirmDiscard = document.createElement('button'); confirmDiscard.type = 'button'; confirmDiscard.className = 'kd-danger'; confirmDiscard.textContent = 'Discard changes';
  const confirmStay = document.createElement('button'); confirmStay.type = 'button'; confirmStay.textContent = 'Keep drawing';
  confirmSave.onclick = () => { confirmBox.hidden = true; insert.click(); };
  confirmDiscard.onclick = () => { confirmBox.hidden = true; dialog.close(); };
  confirmStay.onclick = () => { confirmBox.hidden = true; };
  confirmCard.append(confirmText, confirmSave, confirmDiscard, confirmStay);
  confirmBox.append(confirmCard);
  function requestClose() {
    if (saving) return;
    closePops();
    if (!changed) { dialog.close(); return; }
    confirmBox.hidden = false; confirmStay.focus();
  }
  const closeButton = iconButton('Cancel', 'close', requestClose, {title: 'Close without saving (Esc)'});
  // Escape steps back one level: confirmation, then popover, then close.
  // Handled on keydown because browsers may force-close a dialog after a
  // repeated, prevented 'cancel'. The cancel handler covers other close requests.
  function escapeStep() {
    if (!confirmBox.hidden) { confirmBox.hidden = true; return; }
    if (pops.some(p => !p.hidden)) { closePops(); return; }
    requestClose();
  }
  dialog.oncancel = e => { e.preventDefault(); escapeStep(); };
  dialog.onclose = () => {
    document.removeEventListener('fullscreenchange', onFullscreenChange);
    document.removeEventListener('keydown', onEscape, true);
    document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
    if (fullscreenTarget() === dialog) (document.exitFullscreen?.call(document) ?? document.webkitExitFullscreen?.call(document))?.catch?.(() => {});
    resize.disconnect();
    refToken++; dropTask(refTask); refTask = null; refDoc = null;
    dialog.remove();
  };
  // Shortcuts apply only to the sketchbook and never while typing in a field.
  // Captured at document level so Escape works even when focus has left the
  // dialog's subtree (e.g. after a layer row re-renders).
  // Shortcuts are also captured at document level, so they keep working if
  // focus falls back to the page body.
  const onEscape = e => {
    if (!dialog.open) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); escapeStep(); return; }
    onShortcut(e);
  };
  document.addEventListener('keydown', onEscape, true);
  function onShortcut(e) {
    if (e.target.closest?.('input,select,textarea') || !confirmBox.hidden) return;
    const mod = e.metaKey || e.ctrlKey, key = e.key.toLowerCase();
    if (mod && key === 'z') { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); }
    else if (mod && key === 'y') { e.preventDefault(); doRedo(); }
    else if (mod && key === 'enter') { e.preventDefault(); insert.click(); }
  }

  // ---- Assemble --------------------------------------------------------------
  const title = document.createElement('div');
  title.className = 'kd-title';
  const titleSmall = document.createElement('small');
  title.append(original ? 'Edit drawing' : 'New drawing', titleSmall);
  // ---- PDF beside the note (split screen) ---------------------------------
  // A PDF from the library (or this device) opens in a reader pane next to the
  // page. Fingers and the Pencil scroll and zoom the reader; only the page takes
  // ink. A region of the PDF can be captured onto the page as a new layer, and
  // the drawing remembers the PDF and page so reopening it returns there.
  const stage = document.createElement('div'); stage.className = 'kd-stage';
  const refPane = document.createElement('section'); refPane.className = 'kd-ref'; refPane.hidden = true;
  refPane.setAttribute('aria-label', 'PDF beside the note');
  const refHead = document.createElement('div'); refHead.className = 'kd-ref-head';
  const refName = document.createElement('strong'); refName.className = 'kd-ref-name';
  const refPage = document.createElement('input'); refPage.type = 'number'; refPage.min = '1'; refPage.inputMode = 'numeric';
  refPage.setAttribute('aria-label', 'PDF page'); refPage.className = 'kd-ref-pageno';
  const refCount = document.createElement('span'); refCount.className = 'kd-ref-count';
  const refScroll = document.createElement('div'); refScroll.className = 'kd-ref-scroll'; refScroll.tabIndex = 0;
  refScroll.setAttribute('aria-label', 'PDF pages');
  const refPages = document.createElement('div'); refPages.className = 'kd-ref-pages'; refScroll.append(refPages);
  const divider = document.createElement('div'); divider.className = 'kd-divider'; divider.hidden = true;
  divider.setAttribute('role', 'separator'); divider.setAttribute('aria-label', 'Resize the PDF and the page'); divider.tabIndex = 0;
  const marquee = document.createElement('div'); marquee.className = 'kd-marquee'; marquee.hidden = true;
  let reference = null, refDoc = null, refTask = null, refSlots = [], refZoom = 1, refBase = 1, refSide = 'left', refSplit = .5, capturing = false, refToken = 0;
  const refButton = (label, icon, action) => { const b = iconButton(label, icon, action); b.classList.add('kd-ref-btn'); return b; };
  const zoomOut = refButton('Zoom out', 'zoomOut', () => setRefZoom(refZoom / 1.25));
  const zoomIn = refButton('Zoom in', 'zoomIn', () => setRefZoom(refZoom * 1.25));
  const captureButton = refButton('Capture a region onto the page', 'capture', () => setCapturing(!capturing));
  captureButton.setAttribute('aria-pressed', 'false');
  const swapButton = refButton('Swap sides', 'swap', () => { refSide = refSide === 'left' ? 'right' : 'left'; layoutSplit(); remember(); });
  const closeRef = refButton('Close the PDF', 'close', () => closeReference());
  const pageBox = document.createElement('span'); pageBox.className = 'kd-ref-pagebox'; pageBox.append(refPage, refCount);
  refHead.append(refName, pageBox, zoomOut, zoomIn, captureButton, swapButton, closeRef);
  refPane.append(refHead, refScroll, marquee);

  const pdfButton = iconButton('PDF beside', 'book');
  const pdfPop = popover('PDF beside the note', pdfButton);
  const pdfList = document.createElement('div'); pdfList.className = 'kd-menu kd-pdf-list'; pdfPop.append(pdfList);
  const pdfFile = document.createElement('input'); pdfFile.type = 'file'; pdfFile.accept = 'application/pdf,.pdf'; pdfFile.hidden = true;
  pdfFile.onchange = () => { const file = pdfFile.files?.[0]; pdfFile.value = ''; if (file) openReference({name: file.name.replace(/\.pdf$/i, ''), blob: file}); };
  pdfButton.addEventListener('click', () => { if (!pdfPop.hidden) fillPdfList(); });
  async function fillPdfList() {
    const rows = [];
    const add = (label, icon, action) => { const b = document.createElement('button'); b.type = 'button'; b.innerHTML = ICONS[icon]; b.append(label); b.onclick = action; rows.push(b); };
    const source = globalThis.keepitPdfLibrary;
    pdfList.replaceChildren(Object.assign(document.createElement('p'), {className: 'kd-hint', textContent: 'Loading your PDFs…'}));
    let items = [];
    try { items = source ? await source.list() : []; } catch (err) { items = []; }
    for (const item of items) add(item.name, 'book', () => { closePops(); openReference({itemId: item.id, name: item.name}); });
    if (!items.length) rows.push(Object.assign(document.createElement('p'), {className: 'kd-hint', textContent: source ? 'No PDFs in this library yet.' : 'Open your KeepIt library to list its PDFs.'}));
    add('From this device…', 'export', () => { closePops(); pdfFile.click(); });
    if (reference) add('Close the PDF', 'close', () => { closePops(); closeReference(); });
    pdfList.replaceChildren(...rows);
  }

  // The same PDF.js build, worker and font data the library preview already ships.
  async function loadPdfJs() {
    const lib = await import('./chunk-WRLX6ZEL.js');
    lib.GlobalWorkerOptions.workerSrc = '/assets/pdf.worker-bb422f608044.mjs';
    return {lib, base: '/vendor/pdfjs/'};
  }
  async function openReference(ref, {quiet = false} = {}) {
    const token = ++refToken;
    try {
      say('Opening ' + ref.name + '…', true);
      let blob = ref.blob;
      if (!blob) {
        const source = globalThis.keepitPdfLibrary;
        if (!source) throw Error('Open your KeepIt library to show ' + ref.name + '.');
        blob = await source.read(ref.itemId);
      }
      const {lib, base} = await loadPdfJs();
      const task = lib.getDocument({data: new Uint8Array(await blob.arrayBuffer()), isEvalSupported: false, enableXfa: false, maxImageSize: 16e6,
        cMapUrl: base + 'cmaps/', cMapPacked: true, standardFontDataUrl: base + 'standard_fonts/', wasmUrl: base + 'wasm/'});
      const doc = await task.promise;
      if (token !== refToken || !dialog.open) { dropTask(task); return; }
      dropTask(refTask);
      refTask = task; refDoc = doc;
      reference = {itemId: ref.itemId || null, name: ref.name, page: Math.max(1, Math.min(doc.numPages, ref.page || 1))};
      refZoom = ref.zoom > 0 ? ref.zoom : 1; refSide = ref.side === 'right' ? 'right' : 'left';
      refSplit = ref.split > .15 && ref.split < .85 ? ref.split : .5;
      refName.textContent = ref.name; refName.title = ref.name;
      refPage.max = String(doc.numPages); refCount.textContent = '/ ' + doc.numPages;
      const first = await doc.getPage(1);
      const view = first.getViewport({scale: 1});
      refSlots = [];
      const sizes = await Promise.all(Array.from({length: doc.numPages}, (_, i) => i === 0 ? view : doc.getPage(i + 1).then(p => p.getViewport({scale: 1})).catch(() => view)));
      if (token !== refToken) return;
      refPages.replaceChildren();
      sizes.forEach((v, i) => {
        const slot = document.createElement('div'); slot.className = 'kd-ref-page'; slot.dataset.page = String(i + 1);
        slot.setAttribute('aria-label', 'Page ' + (i + 1));
        refPages.append(slot); refSlots.push({slot, w: v.width, h: v.height, canvas: null, scale: 0, task: null});
      });
      refPane.hidden = divider.hidden = false; dialog.classList.add('kd-split');
      pdfButton.setAttribute('aria-pressed', 'true');
      layoutSplit();
      refBase = Math.max(.2, (refScroll.clientWidth - 24) / Math.max(...refSlots.map(s => s.w)));
      sizeSlots();
      goToPage(reference.page);
      if (!quiet) changed = true;
      remember(); say('');
    } catch (err) {
      if (token === refToken) say(err.message || 'Could not open the PDF.', true);
    }
  }
  function closeReference() {
    refToken++; setCapturing(false);
    dropTask(refTask); refTask = null; refDoc = null; reference = null; refSlots = []; refPages.replaceChildren();
    refPane.hidden = divider.hidden = true; dialog.classList.remove('kd-split');
    pdfButton.setAttribute('aria-pressed', 'false');
    layoutSplit();
  }
  // PDF.js frees a document through its loading task.
  function dropTask(task) { try { task?.destroy()?.catch?.(() => {}); } catch {} }
  function remember() { if (reference) reference = {...reference, zoom: refZoom, side: refSide, split: refSplit}; }
  // Side by side on wide screens; stacked (PDF on top) on phones.
  function layoutSplit() {
    const W = dialog.clientWidth, H = dialog.clientHeight, gap = 14;
    for (const el of [stage, refPane, divider]) el.style.left = el.style.right = el.style.top = el.style.bottom = el.style.width = el.style.height = '';
    if (!reference) { adapt(); return; }
    const rows = W < 700;
    dialog.classList.toggle('kd-split-rows', rows); swapButton.hidden = rows;
    if (rows) {
      const h = Math.round(Math.max(160, Math.min(H - 260, H * refSplit)));
      Object.assign(refPane.style, {left: '0', right: '0', top: '0', height: h + 'px'});
      Object.assign(divider.style, {left: '0', right: '0', top: h + 'px', height: gap + 'px'});
      Object.assign(stage.style, {top: h + gap + 'px'});
    } else {
      const w = Math.round(Math.max(260, Math.min(W - 340, W * refSplit)));
      const near = refSide === 'left' ? 'left' : 'right', far = near === 'left' ? 'right' : 'left';
      Object.assign(refPane.style, {[near]: '0', top: '0', bottom: '0', width: w + 'px'});
      Object.assign(divider.style, {[near]: w + 'px', top: '0', bottom: '0', width: gap + 'px'});
      stage.style[near] = w + gap + 'px'; stage.style[far] = '0';
    }
    divider.setAttribute('aria-orientation', rows ? 'horizontal' : 'vertical');
    divider.setAttribute('aria-valuenow', String(Math.round(refSplit * 100)));
    adapt();
    if (refSlots.length) { const page = reference.page; refBase = Math.max(.2, (refScroll.clientWidth - 24) / Math.max(...refSlots.map(s => s.w))); sizeSlots(); goToPage(page); }
  }
  divider.onpointerdown = e => {
    e.preventDefault(); divider.setPointerCapture(e.pointerId);
    const move = ev => {
      const rect = dialog.getBoundingClientRect(), rows = dialog.classList.contains('kd-split-rows');
      let f = rows ? (ev.clientY - rect.top) / rect.height : (ev.clientX - rect.left) / rect.width;
      if (!rows && refSide === 'right') f = 1 - f;
      refSplit = Math.max(.2, Math.min(.8, f)); layoutSplit();
    };
    const end = () => { divider.removeEventListener('pointermove', move); divider.removeEventListener('pointerup', end); divider.removeEventListener('pointercancel', end); remember(); };
    divider.addEventListener('pointermove', move); divider.addEventListener('pointerup', end); divider.addEventListener('pointercancel', end);
  };
  divider.onkeydown = e => {
    const step = {ArrowLeft: -.05, ArrowUp: -.05, ArrowRight: .05, ArrowDown: .05}[e.key]; if (!step) return;
    e.preventDefault(); refSplit = Math.max(.2, Math.min(.8, refSplit + (refSide === 'right' && !dialog.classList.contains('kd-split-rows') ? -step : step))); layoutSplit(); remember();
  };

  function sizeSlots() {
    for (const s of refSlots) {
      s.slot.style.width = Math.round(s.w * refBase * refZoom) + 'px';
      s.slot.style.height = Math.round(s.h * refBase * refZoom) + 'px';
    }
    queueRender();
  }
  function setRefZoom(z, focus) {
    if (!refSlots.length) return;
    const old = refZoom; refZoom = Math.max(.5, Math.min(5, z));
    const fx = focus ? focus.x : refScroll.clientWidth / 2, fy = focus ? focus.y : refScroll.clientHeight / 2;
    const x = (refScroll.scrollLeft + fx) * refZoom / old - fx, y = (refScroll.scrollTop + fy) * refZoom / old - fy;
    sizeSlots(); refScroll.scrollLeft = x; refScroll.scrollTop = y; remember();
  }
  function goToPage(n) {
    const s = refSlots[n - 1]; if (!s) return;
    refScroll.scrollTop = s.slot.offsetTop - 8; trackPage();
  }
  refPage.onchange = () => { const n = Math.round(refPage.valueAsNumber); if (n >= 1 && n <= refSlots.length) goToPage(n); else refPage.value = String(reference?.page || 1); };
  function trackPage() {
    if (!reference) return;
    const mark = refScroll.scrollTop + refScroll.clientHeight / 3;
    let n = 1; for (let i = 0; i < refSlots.length; i++) if (refSlots[i].slot.offsetTop <= mark) n = i + 1;
    reference.page = n;
    if (document.activeElement !== refPage) refPage.value = String(n);
  }
  let renderQueued = false;
  function queueRender() { if (renderQueued) return; renderQueued = true; requestAnimationFrame(() => { renderQueued = false; renderVisible(); }); }
  refScroll.addEventListener('scroll', () => { trackPage(); queueRender(); }, {passive: true});
  // Only pages near the viewport keep pixels, which keeps memory low on iPad.
  function renderVisible() {
    if (!refDoc) return;
    const top = refScroll.scrollTop - refScroll.clientHeight, bottom = refScroll.scrollTop + 2 * refScroll.clientHeight;
    const ratio = Math.min(2, devicePixelRatio || 1);
    refSlots.forEach((s, i) => {
      const near = s.slot.offsetTop + s.slot.offsetHeight >= top && s.slot.offsetTop <= bottom;
      if (!near) { if (s.canvas) { s.task?.cancel(); s.canvas.remove(); s.canvas = null; s.scale = 0; } return; }
      let scale = refBase * refZoom * ratio;
      const maxPixels = 12e6; if (s.w * s.h * scale * scale > maxPixels) scale = Math.sqrt(maxPixels / (s.w * s.h));
      if (s.canvas && Math.abs(s.scale - scale) / scale < .05) return;
      const token = refToken;
      refDoc.getPage(i + 1).then(page => {
        if (token !== refToken || !refSlots.includes(s)) return;
        const viewport = page.getViewport({scale});
        const c = document.createElement('canvas'); c.width = Math.floor(viewport.width); c.height = Math.floor(viewport.height);
        s.task?.cancel();
        s.task = page.render({canvas: c, canvasContext: c.getContext('2d'), viewport});
        return s.task.promise.then(() => { if (token !== refToken || !refSlots.includes(s)) return; s.canvas?.remove(); s.canvas = c; s.scale = scale; s.slot.append(c); });
      }).catch(err => { if (err?.name !== 'RenderingCancelledException') console.warn('PDF page', i + 1, err); });
    });
  }
  // Pinch with two fingers zooms the reader (native page zoom is off here).
  let pinch = null;
  refScroll.addEventListener('touchstart', e => {
    if (e.touches.length === 2 && !capturing) { const [a, b] = e.touches; pinch = {d: Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY), z: refZoom}; }
  }, {passive: true});
  refScroll.addEventListener('touchmove', e => {
    if (!pinch || e.touches.length !== 2) return;
    e.preventDefault();
    const [a, b] = e.touches, rect = refScroll.getBoundingClientRect();
    const d = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
    setRefZoom(pinch.z * d / pinch.d, {x: (a.clientX + b.clientX) / 2 - rect.left, y: (a.clientY + b.clientY) / 2 - rect.top});
  }, {passive: false});
  refScroll.addEventListener('touchend', e => { if (e.touches.length < 2) pinch = null; });
  refScroll.addEventListener('wheel', e => {
    if (!e.ctrlKey && !e.metaKey) return; e.preventDefault();
    const rect = refScroll.getBoundingClientRect();
    setRefZoom(refZoom * Math.exp(-e.deltaY * .01), {x: e.clientX - rect.left, y: e.clientY - rect.top});
  }, {passive: false});

  // Capture: drag a rectangle over a PDF page; it lands on the page as a new layer.
  function setCapturing(on) {
    capturing = on && !!reference;
    refPane.classList.toggle('kd-capturing', capturing);
    captureButton.setAttribute('aria-pressed', String(capturing));
    marquee.hidden = true;
    if (capturing) say('Drag over the PDF to capture a region', true); else if (!saving) say('');
  }
  let grab = null;
  refScroll.addEventListener('pointerdown', e => {
    if (!capturing) return;
    const slot = e.target.closest?.('.kd-ref-page'); if (!slot) return;
    e.preventDefault(); refScroll.setPointerCapture(e.pointerId);
    grab = {id: e.pointerId, slot, x: e.clientX, y: e.clientY};
    drawMarquee(e);
  });
  refScroll.addEventListener('pointermove', e => { if (grab?.id === e.pointerId) drawMarquee(e); });
  refScroll.addEventListener('pointerup', e => { if (grab?.id !== e.pointerId) return; const g = grab; grab = null; marquee.hidden = true; captureRegion(g, e); });
  refScroll.addEventListener('pointercancel', e => { if (grab?.id === e.pointerId) { grab = null; marquee.hidden = true; } });
  function regionOf(g, e) {
    const r = g.slot.getBoundingClientRect();
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const x0 = clamp(Math.min(g.x, e.clientX), r.left, r.right), x1 = clamp(Math.max(g.x, e.clientX), r.left, r.right);
    const y0 = clamp(Math.min(g.y, e.clientY), r.top, r.bottom), y1 = clamp(Math.max(g.y, e.clientY), r.top, r.bottom);
    return {r, x0, x1, y0, y1};
  }
  function drawMarquee(e) {
    const {x0, x1, y0, y1} = regionOf(grab, e), pane = refPane.getBoundingClientRect();
    Object.assign(marquee.style, {left: x0 - pane.left + 'px', top: y0 - pane.top + 'px', width: x1 - x0 + 'px', height: y1 - y0 + 'px'});
    marquee.hidden = false;
  }
  async function captureRegion(g, e) {
    const {r, x0, x1, y0, y1} = regionOf(g, e);
    if (x1 - x0 < 8 || y1 - y0 < 8) return;
    const n = Number(g.slot.dataset.page), s = refSlots[n - 1], token = refToken;
    // Region in PDF points, placed on the page at its printed size (at most 90% of the paper width).
    const k = s.w / r.width, px0 = (x0 - r.left) * k, py0 = (y0 - r.top) * k, pw = (x1 - x0) * k, ph = (y1 - y0) * k;
    const mmPerPt = 25.4 / 72, widthMm = Math.min(pw * mmPerPt, mm[0] * .9);
    const outW = Math.max(1, Math.round(widthMm * pxPerMm)), scale = outW / pw, outH = Math.max(1, Math.round(ph * scale));
    try {
      say('Capturing from page ' + n + '…', true);
      const page = await refDoc.getPage(n);
      const piece = document.createElement('canvas'); piece.width = outW; piece.height = outH;
      const viewport = page.getViewport({scale, offsetX: -px0 * scale, offsetY: -py0 * scale});
      await page.render({canvas: piece, canvasContext: piece.getContext('2d'), viewport}).promise;
      if (token !== refToken) return;
      // Centre it on what is visible of the page, kept inside the paper.
      const view = sheet.getBoundingClientRect(), p = localPoint({clientX: view.left + view.width / 2, clientY: view.top + view.height / 2});
      const k2 = canvas.width / plane.clientWidth;
      const cx = Math.max(outW / 2, Math.min(canvas.width - outW / 2, p.x * k2)), cy = Math.max(outH / 2, Math.min(canvas.height - outH / 2, p.y * k2));
      const pixels = document.createElement('canvas'); pixels.width = canvas.width; pixels.height = canvas.height;
      pixels.getContext('2d').drawImage(piece, Math.round(cx - outW / 2), Math.round(cy - outH / 2));
      const before = snapshot();
      const layer = newLayer({name: reference.name + ' · p. ' + n, rasterImg: pixels, source: {itemId: reference.itemId, name: reference.name, page: n}});
      insertAbove(current, layer); current = layer; paperSelected = false; commitState(before);
      setCapturing(false); say('Captured page ' + n + ' onto the page as a new layer');
    } catch (err) { say(err.message || 'Could not capture that region.', true); }
  }
  // A captured layer links back to its PDF page.
  function showSource(source) {
    if (!source) return;
    if (reference && (source.itemId ? reference.itemId === source.itemId : reference.name === source.name)) { goToPage(source.page); return; }
    if (source.itemId) openReference({itemId: source.itemId, name: source.name, page: source.page});
    else say('Open ' + source.name + ' from this device to see page ' + source.page + '.', true);
  }

  const viewGroup = pill(pdfButton, layersButton, guidesButton, paperButton, toggle, fullscreenButton, moreButton);
  const historyGroup = pill(undo, redo);
  const leftGroup = pill(closeButton, title);
  const spacer = document.createElement('div'); spacer.className = 'kd-spacer';
  const bar = document.createElement('div'); bar.className = 'kd-bar';
  bar.append(leftGroup, historyGroup, spacer, viewGroup, insert);
  const dockTools = pill(toolGroup, Object.assign(document.createElement('span'), {className: 'kd-sep'}), inkButton);
  const dock = document.createElement('div'); dock.className = 'kd-dock';
  dock.append(dockTools);
  // Narrow screens (phones) move the view controls into the bottom dock so the
  // top bar keeps only close, undo/redo and Insert.
  function adapt() {
    const narrow = stage.clientWidth < 640;
    dialog.classList.toggle('kd-narrow', narrow);
    if (narrow && viewGroup.parentElement !== dock) { dock.append(viewGroup); historyGroup.after(spacer); }
    if (!narrow && viewGroup.parentElement !== bar) { spacer.after(viewGroup); }
    title.style.display = stage.clientWidth < 760 ? 'none' : '';
    for (const pop of pops) if (!pop.hidden) placePop(pop);
    layoutPlane();
  }
  const resize = new ResizeObserver(() => layoutSplit());

  // Two-finger pan / pinch / rotate (fingers never ink; the Pencil and mouse do).
  sheet.onselectstart = sheet.oncontextmenu = e => { e.preventDefault(); };
  const fingers = new Map(); let previous = null;
  function pair() {
    const [a, b] = fingers.values(); return {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(b.x - a.x, b.y - a.y), a: Math.atan2(b.y - a.y, b.x - a.x)};
  }
  sheet.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch' || e.target.closest('[data-ruler]')) return;
    e.preventDefault(); sheet.setPointerCapture(e.pointerId); fingers.set(e.pointerId, {x: e.clientX, y: e.clientY});
    previous = fingers.size === 2 ? pair() : null;
  });
  sheet.onpointermove = e => {
    if (!fingers.has(e.pointerId)) return;
    fingers.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (fingers.size !== 2) return;
    const now = pair();
    if (previous && !active && previous.d > 2) {
      const rect = plane.getBoundingClientRect(), cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      const next = Math.max(.25, Math.min(6, zoom * now.d / previous.d)), delta = now.a - previous.a;
      const x = cx - previous.x, y = cy - previous.y;
      panX += now.x + (x * Math.cos(delta) - y * Math.sin(delta)) * next / zoom - cx;
      panY += now.y + (x * Math.sin(delta) + y * Math.cos(delta)) * next / zoom - cy;
      zoom = next; angle += delta; transform();
    }
    previous = now;
  };
  sheet.onpointerup = sheet.onpointercancel = e => { fingers.delete(e.pointerId); previous = null; };
  // Mac trackpad pinch arrives as ctrl+wheel.
  sheet.addEventListener('wheel', e => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    zoom = Math.max(.25, Math.min(6, zoom * Math.exp(-e.deltaY * .01))); transform();
  }, {passive: false});

  if (saved) { size.value = saved.size in sizes ? saved.size : 'Custom'; guide.value = saved.guide; if (saved.guideSpacing in GUIDE_MM.Grid) guideSpacing.value = saved.guideSpacing; if (saved.guidePrint === false) guidePrint.checked = false; paperWidth.value = saved.mm[0]; paperHeight.value = saved.mm[1]; }
  if (raster && !saved) { size.value = 'Custom'; paperWidth.value = String(background.width / 6); paperHeight.value = String(background.height / 6); }
  // Existing drawings keep the resolution their strokes were recorded at.
  if (saved) dpi = Number.isFinite(saved.dpi) && saved.dpi > 0 ? saved.dpi : Math.min(6, 3072 / Math.max(...saved.mm)) * 25.4;
  else if (raster) dpi = 6 * 25.4;
  setResolutionControls(dpi);
  function describe() {
    description = (size.value === 'Custom' ? Math.round(mm[0]) + '×' + Math.round(mm[1]) + ' mm' : size.value) + (guide.value === 'Plain' ? '' : ' · ' + guide.value + (guideSpacing.value === 'Medium' ? '' : ' ' + guideSpacing.value.toLowerCase())) + ' · ' + Math.round(pxPerMm * 25.4) + ' dpi';
    showBadge();
  }
  resolution.addEventListener('change', () => { dpiField.hidden = resolution.value !== 'Custom'; if (resolution.value !== 'Custom') dpi = RESOLUTIONS[resolution.value]; else dpiInput.focus(); });
  dpiInput.addEventListener('change', () => { const v = dpiInput.valueAsNumber; if (Number.isFinite(v)) dpi = Math.max(72, Math.min(600, v)); dpiInput.value = String(Math.round(dpi)); });
  // Guides only change how the paper is drawn: no need to re-express the strokes.
  for (const el of [guide, guideSpacing]) el.addEventListener('change', () => { showGuides(); describe(); repaint(); });
  showGuides();
  for (const el of [size, paperWidth, paperHeight, resolution, dpiInput]) el.addEventListener('change', () => {
    if (saving || (el === resolution && resolution.value === 'Custom')) return;
    const oldWidth = canvas.width, oldHeight = canvas.height, oldPx = pxPerMm;
    if (!paper()) { insert.disabled = true; return; }
    // Re-express every stroke at the new pixel grid; widths keep their size on paper.
    for (const stroke of knownStrokes()) for (const p of stroke.points) { p.x *= canvas.width / oldWidth; p.y *= canvas.height / oldHeight; p.width *= pxPerMm / oldPx; }
    layers.forEach(l => l.dirty = true); changed = true; insert.disabled = false; say(''); repaint(); describe(); refreshLayers();
  });
  plane.append(canvas, edge); sheet.append(plane);
  stage.append(sheet, bar, dock, status);
  dialog.append(style, refPane, divider, stage, pdfFile, ...pops, confirmBox);
  document.body.append(dialog);
  selectTool('Pen');
  setColor(color.value);
  refreshHistory();
  paper(); repaint(); describe();
  dialog.showModal();
  resize.observe(dialog);
  adapt();
  // Reopening a drawing made beside a PDF brings the PDF back at the same page.
  const savedRef = saved?.reference, pending = globalThis.keepitPdfLibrary?.next;
  if (pending && !savedRef) { delete globalThis.keepitPdfLibrary.next; openReference(pending); }
  else if (savedRef && typeof savedRef.name === 'string') {
    if (savedRef.itemId) openReference(savedRef, {quiet: true});
    else say('This drawing was made beside ' + savedRef.name + '. Open it again with PDF beside.');
  }
}

export async function editDrawing({editor,assets,selection,insertPosition,makeAsset,canEdit}) {
  const previous = selection && assets.get(selection.node.attrs.assetId);
  const replace = previous?.name === 'KeepIt drawing.png';
  const pos = replace ? selection.pos : insertPosition();
  await drawNote(replace ? previous.blob : null, async (file, meta = {}) => {
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
      // A new drawing made beside a PDF is captioned with the PDF and page.
      const ref=meta.reference, caption=ref?.name?editor.schema.text('Beside '+ref.name+' · p. '+ref.page):null;
      if(dispatch)tr.insert(at,editor.schema.nodes.figure.create(attrs,caption));
      return true;
    });
    if (!ok) throw Error('Could not insert the drawing.');
  });
}
