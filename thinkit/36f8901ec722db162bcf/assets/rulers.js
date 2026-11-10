(() => {
  const ns = 'http://www.w3.org/2000/svg';
  const pxPerMm = 96 / 25.4;

  function draw(ruler, { span, origin, pixelsPerMm, vertical = false, gutter = 0 }) {
    const thickness = vertical ? 38 : 27;
    const step = [1, 2, 5, 10, 20, 50, 100, 200].find(mm => mm * pixelsPerMm >= 4) || 200;
    const major = step * (step === 1 || step === 5 ? 10 : 5);
    const size = vertical ? [thickness, span] : [span, thickness];
    ruler.setAttribute('width', size[0]);
    ruler.setAttribute('height', size[1]);
    ruler.replaceChildren();
    const ticks = document.createElementNS(ns, 'path');
    const segments = [];
    const first = Math.ceil((gutter - origin) / (pixelsPerMm * step)) * step;
    for (let mm = first; origin + mm * pixelsPerMm <= span; mm += step) {
      const position = origin + mm * pixelsPerMm;
      const labeled = mm % major === 0;
      const length = labeled ? 10 : 5;
      if (vertical) segments.push(`M${thickness - length} ${position}H${thickness}`);
      else segments.push(`M${position} ${thickness - length}V${thickness}`);
      if (!labeled) continue;
      const label = document.createElementNS(ns, 'text');
      label.setAttribute('x', vertical ? 2 : position + 2);
      label.setAttribute('y', vertical ? position + 4 : 13);
      label.textContent = mm;
      ruler.append(label);
    }
    ticks.setAttribute('d', segments.join(' '));
    ruler.prepend(ticks);
  }

  window.ThinkItRulers = Object.freeze({ draw, pxPerMm });
})();
