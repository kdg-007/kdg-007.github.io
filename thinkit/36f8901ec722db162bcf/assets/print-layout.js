(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const { draw, pxPerMm } = ThinkItRulers;
  const papers = { A4:[210,297], A3:[297,420], A2:[420,594], Letter:[215.9,279.4], Legal:[215.9,355.6] };
  const box = $('diagramSlot');
  const board = box.querySelector('.business-print');
  const diagram = board || box.querySelector('svg');
  const fields = ['paper','orientation','margins','framing','scale','scaleMode','halign','valign','offsetX','offsetY','printRulers'];
  const value = id => $(id).value;
  if (board) $('controls').dataset.business = '';
  $('framing').disabled = Boolean(board);

  function calculate() {
    const paper = papers[value('paper')] || papers.A4;
    const landscape = value('orientation') === 'landscape';
    const [width, height] = landscape ? [...paper].reverse() : paper;
    const margin = Number(value('margins')) || 10;
    const sheet = $('sheet');
    sheet.style.width = width + 'mm';
    sheet.style.height = height + 'mm';
    sheet.style.padding = margin + 'mm';
    $('pageRules').textContent = `@page{size:${width}mm ${height}mm;margin:0}`;
    $('pageInfo').textContent = `${value('paper')} ${value('orientation')} · ${width} × ${height} mm · 1 page`;

    const { width: areaWidth, height: areaHeight } = getComputedStyle(box);
    const cw = parseFloat(areaWidth), ch = parseFloat(areaHeight);
    const viewBox = value('framing') === 'canvas' ? '0 0 1100 790' : box.dataset.contentViewBox;
    const [, , bw, bh] = board ? [0, 0, board.offsetWidth, board.offsetHeight] : viewBox.split(/[,\s]+/).map(Number);
    if (!board) {
      diagram.setAttribute('viewBox', viewBox);
      diagram.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    }
    const actual = value('scaleMode') === 'actual';
    const factor = actual ? 1 : Math.min(cw / bw, ch / bh) * (Number(value('scale')) || 100) / 100;
    const aw = bw * factor, ah = bh * factor;
    const dx = (Number(value('offsetX')) || 0) * pxPerMm, dy = (Number(value('offsetY')) || 0) * pxPerMm;
    const ha = value('halign'), va = value('valign');
    const left = (ha === 'left' ? 0 : ha === 'right' ? cw - aw : (cw - aw) / 2) + dx;
    const top = (va === 'top' ? 0 : va === 'bottom' ? ch - ah : (ch - ah) / 2) + dy;
    Object.assign(diagram.style, { left: left + 'px', top: top + 'px' });
    if (board) diagram.style.transform = `scale(${factor})`;
    else Object.assign(diagram.style, { width: aw + 'px', height: ah + 'px' });
    $('scale').disabled = actual;
    $('scaleValue').textContent = actual ? '100% actual size' : value('scale') + '% of fit';
    $('artworkSize').textContent = `Artwork on paper · ${(aw / pxPerMm).toFixed(1)} × ${(ah / pxPerMm).toFixed(1)} mm`;
    const clipped = left < -.25 || top < -.25 || left + aw > cw + .25 || top + ah > ch + .25;
    $('warning').hidden = !clipped;
    if (clipped) $('warning').textContent = 'Artwork extends beyond the drawing area. Choose a larger sheet, fit the diagram, or adjust its position to prevent clipping.';

    const stage = $('stageArea');
    const ruler = $('printRulers').checked;
    const gutterX = ruler ? 38 : 0, gutterY = ruler ? 27 : 0;
    const sw = width * pxPerMm, sh = height * pxPerMm;
    const zoom = Math.min(1, Math.max(100,stage.clientWidth - 40 - gutterX) / sw,
                            Math.max(100,stage.clientHeight - 40 - gutterY) / sh);
    sheet.style.transform = `scale(${zoom})`;
    const host = $('sheetHost');
    host.style.width = sw * zoom + gutterX + 'px';
    host.style.height = sh * zoom + gutterY + 'px';
    host.style.paddingLeft = gutterX + 'px';
    host.style.paddingTop = gutterY + 'px';
    $('sheetRulers').hidden = !ruler;
    if (ruler) {
      draw($('sheetRulerX'), { span: sw * zoom + gutterX, origin: gutterX, gutter: gutterX, pixelsPerMm: pxPerMm * zoom });
      draw($('sheetRulerY'), { span: sh * zoom + gutterY, origin: gutterY, gutter: gutterY, pixelsPerMm: pxPerMm * zoom, vertical: true });
    }
  }

  $('fit').onclick = () => {
    $('framing').value = 'content';
    $('scaleMode').value = 'fit';
    $('scale').value = '100';
    $('offsetX').value = '0';
    $('offsetY').value = '0';
    $('halign').value = 'center';
    $('valign').value = 'center';
    calculate();
  };
  fields.forEach(id => $(id).addEventListener(id === 'scale' ? 'input' : 'change', calculate));
  $('print').onclick = async () => {
    await Promise.all([...box.querySelectorAll('img')].map(img => img.decode().catch(() => {})));
    calculate();
    window.focus();
    window.print();
  };
  window.addEventListener('resize', calculate);
  if (board) new ResizeObserver(calculate).observe(board);
  requestAnimationFrame(calculate);
})();
