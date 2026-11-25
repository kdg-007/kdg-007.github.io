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
const SWATCHES = ['#173449','#000000','#5b6770','#ffffff','#c0392b','#e8731a','#f2c230','#2e9a57','#14968a','#2e7bd6','#7d4cb8','#d43f8d'];
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
 background:color-mix(in srgb,var(--kd-chrome) 90%,transparent);-webkit-backdrop-filter:blur(18px) saturate(1.4);backdrop-filter:blur(18px) saturate(1.4);
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
 border-top:2px solid #1d5d78;border-radius:0 0 10px 10px;box-shadow:0 6px 18px #1a2f3a33;-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}
.kd-edge[hidden]{display:none}
.kd-edge button{position:absolute;right:0;top:0;width:44px;height:38px;border:0;background:none;color:#1d5d78;display:grid;place-items:center;touch-action:none;cursor:grab}
.kd.kd-inking .kd-pill,.kd.kd-inking .kd-done{opacity:.6}
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
    opacity: name === 'Highlighter' ? .22 : name === 'Pencil' ? .7 : 1,
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
  const guide = select('Paper guides', ['Plain', 'Ruled', 'Grid']);
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
      if (stroke.tool === 'Straight line') mark(ink, stroke, stroke.points[0], stroke.points.at(-1));
      else stroke.points.forEach((p, i) => mark(ink, stroke, stroke.points[i - 1], p));
    }
    layer.dirty = false;
    return surface;
  }
  function repaint() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = paperOpacity;
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const spacing = (guide.value === 'Grid' ? 5 : 8) * canvas.height / mm[1];
    if (guide.value !== 'Plain' && spacing >= 2) {
      ctx.beginPath(); ctx.strokeStyle = '#c5d9e5'; ctx.lineWidth = 1;
      for (let y = spacing; y < canvas.height; y += spacing) { ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); }
      if (guide.value === 'Grid') for (let x = spacing; x < canvas.width; x += spacing) { ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); }
      ctx.stroke();
    }
    if (raster) ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
    for (const layer of layers) {
      if (!layer.visible) continue;
      const surface = renderLayer(layer);
      ctx.globalAlpha = layer.opacity; ctx.globalCompositeOperation = layer.blend;
      ctx.drawImage(surface, 0, 0);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
  }
  const strokes = saved?.strokes || [];
  const blendOk = value => BLENDS.some(b => b[0] === value);
  const layers = (saved?.layers?.length ? saved.layers : [{id: 0, name: 'Layer 1', visible: true}]).map(l => ({
    id: l.id, name: String(l.name ?? 'Layer'), visible: l.visible !== false,
    opacity: Number.isFinite(l.opacity) ? Math.max(0, Math.min(1, l.opacity)) : 1,
    blend: blendOk(l.blend) ? l.blend : 'source-over',
    raster: typeof l.raster === 'string' && l.raster.startsWith('data:image/png;base64,') ? l.raster : null,
    rasterImg: null, surface: document.createElement('canvas'), dirty: true,
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
  function point(event) {
    const local = localPoint(event);
    const pressure = event.pointerType === 'pen' ? event.pressure : 0.5;
    const weight = active.tool === 'Eraser' ? 32 : active.tool === 'Marker' ? 12 + Math.hypot(event.tiltX || 0, event.tiltY || 0) / 4 : active.tool === 'Highlighter' ? 24 : 2 + 8 * pressure;
    const next = {x: local.x * canvas.width / plane.clientWidth, y: local.y * canvas.height / plane.clientHeight, width: weight * Number(width.value) * pxPerMm / 6};
    if (rulerOn) {
      const rad = edgeAngle * Math.PI / 180, ux = Math.cos(rad), uy = Math.sin(rad);
      const ox = edgeX * canvas.width, oy = edgeY * canvas.height;
      const dot = (next.x - ox) * ux + (next.y - oy) * uy;
      next.x = ox + dot * ux; next.y = oy + dot * uy;
    }
    if (active.tool !== 'Straight line') mark(current.surface.getContext('2d'), active, active.points.at(-1), next);
    active.points.push(next);
    if (active.tool === 'Straight line') current.dirty = true;
    schedulePaint();
  }
  let frame = 0;
  function schedulePaint() { if (!frame) frame = requestAnimationFrame(() => { frame = 0; repaint(); }); }
  canvas.onpointerdown = event => {
    if (saving || active || event.pointerType === 'touch' || event.button !== 0) return;
    if (!current.visible) { say('“' + current.name + '” is hidden. Show it in Layers to draw on it.'); return; }
    closePops();
    canvas.setPointerCapture(event.pointerId);
    active = {id: event.pointerId, layer: current.id, opacity: Number(opacity.value), tool: tool.value, color: tool.value === 'Eraser' ? '#ffffff' : color.value, points: []};
    redoStack.length = 0; strokes.push(active); history.push({stroke: active}); changed = true;
    dialog.classList.add('kd-inking');
    point(event);
    refreshHistory();
  };
  canvas.onpointermove = event => {
    if (active?.id !== event.pointerId) return;
    const samples = event.getCoalescedEvents?.();
    for (const sample of samples?.length ? samples : [event]) point(sample);
  };
  canvas.onlostpointercapture = canvas.onpointercancel = canvas.onpointerup = event => {
    if (active?.id === event.pointerId) { active = null; dialog.classList.remove('kd-inking'); }
  };

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
  inkPop.append(swatchList, wheelRow, preview, widthField.field, opacityField.field);

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
    return {id: l.id, name: l.name, visible: l.visible, opacity: l.opacity, blend: l.blend, ...(l.raster ? {raster: l.raster} : {})};
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
    const meta = [layer.blend !== 'source-over' ? blendName(layer.blend) : '', layer.opacity < 1 ? Math.round(layer.opacity * 100) + '%' : '', layer.rasterImg ? 'merged' : ''].filter(Boolean).join(' · ');
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
    row.append(thumbnail(renderLayer(layer), layer.opacity), name, eye);
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
    const grip = e.currentTarget; grip.setPointerCapture(e.pointerId);
    const rows = [...layerList.querySelectorAll('.kd-layer:not(.kd-layer-paper)')];
    const startY = e.clientY, from = rows.indexOf(row);
    let target = from;
    row.classList.add('kd-dragging');
    const move = ev => {
      row.style.transform = 'translateY(' + (ev.clientY - startY) + 'px)';
      target = rows.length - 1;
      for (let i = 0; i < rows.length; i++) { const r = rows[i].getBoundingClientRect(); if (ev.clientY < r.top + r.height / 2) { target = i; break; } }
      rows.forEach((r, i) => { r.classList.toggle('kd-drop-before', i === target && target < from); r.classList.toggle('kd-drop-after', i === target && target > from); });
    };
    const end = () => {
      grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', end); grip.removeEventListener('pointercancel', end);
      row.style.transform = ''; row.classList.remove('kd-dragging');
      rows.forEach(r => r.classList.remove('kd-drop-before', 'kd-drop-after'));
      // Display order is top-first; the layers array is bottom-first.
      if (target !== from) moveLayer(layer, layers.length - 1 - target); else refreshLayers();
    };
    grip.addEventListener('pointermove', move); grip.addEventListener('pointerup', end); grip.addEventListener('pointercancel', end);
  }
  layersButton.addEventListener('click', () => refreshLayers());
  refreshLayers();

  const paperButton = iconButton('Paper', 'paper');
  const paperPop = popover('Paper', paperButton);
  const sizeField = document.createElement('label'); sizeField.className = 'kd-field'; sizeField.append('Size', size);
  const guideField = document.createElement('label'); guideField.className = 'kd-field'; guideField.append('Guides', guide);
  const resolutionField = document.createElement('label'); resolutionField.className = 'kd-field'; resolutionField.append('Resolution', resolution);
  paperPop.append(sizeField, guideField, customRow, resolutionField, dpiField, pixelInfo);

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
  function localPoint(e) {
    const rect = plane.getBoundingClientRect(), dx = e.clientX - rect.left - rect.width / 2, dy = e.clientY - rect.top - rect.height / 2;
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
      repaint();
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw Error('Could not encode the drawing.');
      const result = packPage(blob, {version: 1, basePNG, mm, size: size.value, guide: guide.value, dpi: pxPerMm * 25.4, paperOpacity, strokes, layers: layers.map(layerRecord), activeLayer: current.id});
      await commit(new File([result], 'KeepIt drawing.png', {type: 'image/png'}));
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
  const viewGroup = pill(layersButton, paperButton, toggle, fullscreenButton, moreButton);
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
    const narrow = dialog.clientWidth < 640;
    dialog.classList.toggle('kd-narrow', narrow);
    if (narrow && viewGroup.parentElement !== dock) { dock.append(viewGroup); historyGroup.after(spacer); }
    if (!narrow && viewGroup.parentElement !== bar) { spacer.after(viewGroup); }
    title.style.display = dialog.clientWidth < 760 ? 'none' : '';
    for (const pop of pops) if (!pop.hidden) placePop(pop);
    layoutPlane();
  }
  const resize = new ResizeObserver(() => adapt());

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

  if (saved) { size.value = saved.size in sizes ? saved.size : 'Custom'; guide.value = saved.guide; paperWidth.value = saved.mm[0]; paperHeight.value = saved.mm[1]; }
  if (raster && !saved) { size.value = 'Custom'; paperWidth.value = String(background.width / 6); paperHeight.value = String(background.height / 6); }
  // Existing drawings keep the resolution their strokes were recorded at.
  if (saved) dpi = Number.isFinite(saved.dpi) && saved.dpi > 0 ? saved.dpi : Math.min(6, 3072 / Math.max(...saved.mm)) * 25.4;
  else if (raster) dpi = 6 * 25.4;
  setResolutionControls(dpi);
  function describe() {
    titleSmall.textContent = (size.value === 'Custom' ? Math.round(mm[0]) + '×' + Math.round(mm[1]) + ' mm' : size.value) + (guide.value === 'Plain' ? '' : ' · ' + guide.value) + ' · ' + Math.round(pxPerMm * 25.4) + ' dpi';
  }
  resolution.addEventListener('change', () => { dpiField.hidden = resolution.value !== 'Custom'; if (resolution.value !== 'Custom') dpi = RESOLUTIONS[resolution.value]; else dpiInput.focus(); });
  dpiInput.addEventListener('change', () => { const v = dpiInput.valueAsNumber; if (Number.isFinite(v)) dpi = Math.max(72, Math.min(600, v)); dpiInput.value = String(Math.round(dpi)); });
  for (const el of [size, paperWidth, paperHeight, guide, resolution, dpiInput]) el.addEventListener('change', () => {
    if (saving || (el === resolution && resolution.value === 'Custom')) return;
    const oldWidth = canvas.width, oldHeight = canvas.height, oldPx = pxPerMm;
    if (!paper()) { insert.disabled = true; return; }
    // Re-express every stroke at the new pixel grid; widths keep their size on paper.
    for (const stroke of knownStrokes()) for (const p of stroke.points) { p.x *= canvas.width / oldWidth; p.y *= canvas.height / oldHeight; p.width *= pxPerMm / oldPx; }
    layers.forEach(l => l.dirty = true); changed = true; insert.disabled = false; say(''); repaint(); describe(); refreshLayers();
  });
  plane.append(canvas, edge); sheet.append(plane);
  dialog.append(style, sheet, bar, dock, status, ...pops, confirmBox);
  document.body.append(dialog);
  selectTool('Pen');
  setColor(color.value);
  refreshHistory();
  paper(); repaint(); describe();
  dialog.showModal();
  resize.observe(dialog);
  adapt();
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
