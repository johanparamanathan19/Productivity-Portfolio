/**
 * The accumulation chart: portfolio value climbing toward the target.
 *
 * Form choice (per this project's dataviz guidance): trend over time for one
 * series against a threshold, so it is a single line on one money axis. The
 * crossing point *is* the answer, so it gets the annotation weight.
 *
 * The target is drawn as a **band between the 3% and 4% withdrawal targets,
 * not a single line**. A single line would imply the finish is a known
 * quantity, and it is the most contested number in the whole model — the same
 * reasoning docs/invest-vs-buy.md gives for banding its return. Banding the
 * return *as well* would put two uncertainties in the same ink; the target is
 * the more disputed of the two, so it wins the band and the return stays a
 * single assumption stated in the caption.
 *
 * Colours are slots 1 and 2 of the project's validated categorical palette,
 * defined in fi.css exactly as tools/invest/invest.css defines them. The
 * lavender theme's orange lands below 3:1 against the surface, which is why
 * the direct end-label and the table view below are load-bearing rather than
 * decoration.
 */

const NS = 'http://www.w3.org/2000/svg';

const VB = { w: 760, h: 340 };
const PAD = { top: 18, right: 96, bottom: 34, left: 64 };

const PLOT = {
  x0: PAD.left,
  x1: VB.w - PAD.right,
  y0: PAD.top,
  y1: VB.h - PAD.bottom,
};

const el = (name, attrs = {}) => {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
};

/** Round a maximum up to a clean axis top, and hand back evenly spaced ticks. */
function niceTicks(max, target = 5) {
  if (!(max > 0)) return { top: 1, ticks: [0, 1] };
  const rough = max / target;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rough) || 10 * mag;
  const top = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);
  return { top, ticks };
}

/** Compact money for axis ticks — the tooltip and table carry exact figures. */
function compact(n) {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(abs >= 1e10 ? 0 : 1)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(abs >= 1e7 ? 0 : 1)}M`;
  if (abs >= 1e3) return `${Math.round(n / 1e3)}k`;
  return String(Math.round(n));
}

/** Year ticks that stay readable at any horizon. */
function yearTicks(horizon) {
  const step = horizon <= 10 ? 2 : horizon <= 25 ? 5 : 10;
  const ticks = [];
  for (let y = 0; y <= horizon + 0.001; y += step) ticks.push(y);
  if (ticks[ticks.length - 1] < horizon - 0.001) ticks.push(horizon);
  return ticks;
}

/**
 * @param {object} refs  { svg, tooltip, legend, table }
 * @param {object} result  from model.evaluate()
 * @param {(n:number)=>string} money
 */
export function renderChart(refs, result, money) {
  const { svg } = refs;
  const pts = result.points;
  if (!pts.length) return;

  const bandTop = Math.max(result.targetConservative, result.targetTrinity);
  const bandBottom = Math.min(result.targetConservative, result.targetTrinity);

  // Keep the whole band on screen even when the portfolio never climbs to it,
  // otherwise the target floats above the frame and the chart answers nothing.
  const maxY = Math.max(...pts.map((p) => p.value), bandTop, 1);
  const { top, ticks } = niceTicks(maxY);

  const sx = (t) => PLOT.x0 + (t / result.horizon) * (PLOT.x1 - PLOT.x0);
  const sy = (v) => PLOT.y1 - (v / top) * (PLOT.y1 - PLOT.y0);

  svg.replaceChildren();
  svg.setAttribute('viewBox', `0 0 ${VB.w} ${VB.h}`);

  // The tooltip lives outside the SVG, so replaceChildren() above doesn't touch
  // it — without this it keeps showing figures from the previous scenario.
  refs.tooltip.hidden = true;
  refs.tooltip.replaceChildren();

  // ---- Gridlines ----
  const grid = el('g', { class: 'fc-grid' });
  ticks.forEach((v) => {
    grid.append(el('line', { x1: PLOT.x0, x2: PLOT.x1, y1: sy(v), y2: sy(v) }));
  });
  svg.append(grid);

  // ---- Axis labels: text tokens, never a series colour ----
  const axis = el('g', { class: 'fc-axis' });
  ticks.forEach((v) => {
    const label = el('text', { x: PLOT.x0 - 10, y: sy(v) + 4, 'text-anchor': 'end' });
    label.textContent = compact(v);
    axis.append(label);
  });
  yearTicks(result.horizon).forEach((y) => {
    const label = el('text', { x: sx(y), y: PLOT.y1 + 22, 'text-anchor': 'middle' });
    label.textContent = y === 0 ? 'now' : `${Math.round(y)}y`;
    axis.append(label);
  });
  svg.append(axis);

  svg.append(el('line', { class: 'fc-baseline', x1: PLOT.x0, x2: PLOT.x1, y1: PLOT.y1, y2: PLOT.y1 }));

  // ---- The target band: 3% to 4%, the span of the live dispute ----
  svg.append(el('rect', {
    class: 'fc-target-band',
    x: PLOT.x0,
    y: sy(bandTop),
    width: PLOT.x1 - PLOT.x0,
    height: Math.max(1, sy(bandBottom) - sy(bandTop)),
  }));
  svg.append(el('line', { class: 'fc-target-edge', x1: PLOT.x0, x2: PLOT.x1, y1: sy(bandBottom), y2: sy(bandBottom) }));
  svg.append(el('line', { class: 'fc-target-edge', x1: PLOT.x0, x2: PLOT.x1, y1: sy(bandTop), y2: sy(bandTop) }));

  const bandLabel = el('text', { class: 'fc-target-label', x: PLOT.x1 + 12, y: sy(bandTop) + 4 });
  bandLabel.textContent = 'target';
  svg.append(bandLabel);

  // ---- The accumulation line ----
  svg.append(el('path', {
    class: 'fc-line',
    d: `M${pts.map((p) => `${sx(p.t)},${sy(p.value)}`).join(' L')}`,
  }));

  // ---- Crossing annotation: a genuine threshold, so dashed is correct ----
  if (result.years != null && result.years > 0 && result.years <= result.horizon) {
    const x = sx(result.years);
    svg.append(el('line', { class: 'fc-crossing', x1: x, x2: x, y1: PLOT.y0, y2: PLOT.y1 }));
    const tag = el('text', { class: 'fc-crossing-label', x: x + 6, y: PLOT.y0 + 12 });
    tag.textContent = `${result.years.toFixed(1)}y`;
    svg.append(tag);
  }

  // ---- End dot and direct end-label ----
  const last = pts[pts.length - 1];
  svg.append(el('circle', { class: 'fc-dot', cx: sx(last.t), cy: sy(last.value), r: 5 }));
  const endLabel = el('text', { class: 'fc-endlabel', x: PLOT.x1 + 12, y: sy(last.value) + 4 });
  endLabel.textContent = money(last.value);
  // Don't stack a colliding pair — the legend and table carry the value instead
  // of detaching a label from the thing it names.
  if (Math.abs(sy(last.value) - sy(bandTop)) >= 16) svg.append(endLabel);

  // ---- Hover / focus layer ----
  const hover = el('g', { class: 'fc-hover', hidden: 'hidden' });
  const hairline = el('line', { class: 'fc-hairline', y1: PLOT.y0, y2: PLOT.y1 });
  const dot = el('circle', { class: 'fc-dot', r: 5 });
  hover.append(hairline, dot);
  svg.append(hover);

  const overlay = el('rect', {
    class: 'fc-overlay',
    x: PLOT.x0,
    y: PLOT.y0,
    width: PLOT.x1 - PLOT.x0,
    height: PLOT.y1 - PLOT.y0,
    tabindex: '0',
    role: 'application',
    'aria-label': 'Portfolio value by year. Use left and right arrow keys to step through time.',
  });
  svg.append(overlay);

  let index = pts.length - 1;

  const showAt = (i) => {
    index = Math.max(0, Math.min(pts.length - 1, i));
    const p = pts[index];
    hover.removeAttribute('hidden');
    hairline.setAttribute('x1', sx(p.t));
    hairline.setAttribute('x2', sx(p.t));
    dot.setAttribute('cx', sx(p.t));
    dot.setAttribute('cy', sy(p.value));

    // Values lead, labels follow — and every label goes in as text, never HTML.
    refs.tooltip.replaceChildren(
      row(p.t === 0 ? 'Now' : `Year ${Math.round(p.t)}`, '', 'fc-tip-head'),
      row(money(p.value), 'Portfolio', 'fc-tip-row fc-portfolio'),
      row(
        p.value >= result.target ? 'reached' : money(result.target - p.value),
        p.value >= result.target ? 'Target' : 'Still to go',
        'fc-tip-row fc-diff',
      ),
    );
    refs.tooltip.hidden = false;
    const pct = (sx(p.t) / VB.w) * 100;
    refs.tooltip.style.left = `${Math.min(78, Math.max(2, pct))}%`;
  };

  const hide = () => {
    hover.setAttribute('hidden', 'hidden');
    refs.tooltip.hidden = true;
  };

  const indexFromEvent = (event) => {
    const box = svg.getBoundingClientRect();
    const xVb = ((event.clientX - box.left) / box.width) * VB.w;
    const frac = (xVb - PLOT.x0) / (PLOT.x1 - PLOT.x0);
    return Math.round(frac * (pts.length - 1));
  };

  overlay.addEventListener('pointermove', (event) => showAt(indexFromEvent(event)));
  overlay.addEventListener('pointerleave', hide);
  overlay.addEventListener('focus', () => showAt(index));
  overlay.addEventListener('blur', hide);
  overlay.addEventListener('keydown', (event) => {
    const stride = Math.max(1, Math.round(pts.length / 40));
    if (event.key === 'ArrowRight') { event.preventDefault(); showAt(index + stride); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); showAt(index - stride); }
    if (event.key === 'Home') { event.preventDefault(); showAt(0); }
    if (event.key === 'End') { event.preventDefault(); showAt(pts.length - 1); }
  });

  renderLegend(refs.legend, result, money);
  renderTable(refs.table, result, money);
}

function row(value, label, className) {
  const div = document.createElement('div');
  div.className = className;
  const strong = document.createElement('strong');
  strong.textContent = value;
  div.append(strong);
  if (label) {
    const span = document.createElement('span');
    span.textContent = label;
    div.append(span);
  }
  return div;
}

function renderLegend(node, result, money) {
  const entry = (cls, name, detail) => {
    const li = document.createElement('li');
    li.className = 'fc-legend-row';
    const key = document.createElement('span');
    key.className = `fc-key ${cls}`;
    const label = document.createElement('span');
    label.className = 'fc-legend-name';
    label.textContent = name;
    const figure = document.createElement('span');
    figure.className = 'fc-legend-fig';
    figure.textContent = detail;
    li.append(key, label, figure);
    return li;
  };

  node.replaceChildren(
    entry('fc-portfolio', `Your portfolio, growing at ${result.realReturn}% real`, money(result.points[result.points.length - 1].value)),
    entry(
      'fc-band-key',
      'Target, at withdrawal rates from 4% down to 3%',
      `${money(result.targetTrinity)} – ${money(result.targetConservative)}`,
    ),
  );
}

/** The table-view twin: every plotted value reachable without hovering. */
function renderTable(node, result, money) {
  const step = result.horizon <= 10 ? 1 : result.horizon <= 25 ? 2 : 5;
  const rows = [];
  for (let y = 0; y <= result.horizon + 0.001; y += step) {
    const p = result.points[Math.min(result.points.length - 1, Math.round(y))];
    rows.push([
      y === 0 ? 'Now' : `Year ${Math.round(y)}`,
      money(p.value),
      p.value >= result.target ? 'reached' : money(result.target - p.value),
    ]);
  }

  const head = document.createElement('tr');
  ['', 'Portfolio', 'Still to go'].forEach((text) => {
    const th = document.createElement('th');
    th.textContent = text;
    if (text !== '') th.setAttribute('scope', 'col');
    head.append(th);
  });

  const body = rows.map((cells) => {
    const tr = document.createElement('tr');
    cells.forEach((text, i) => {
      const cell = document.createElement(i === 0 ? 'th' : 'td');
      if (i === 0) cell.setAttribute('scope', 'row');
      cell.textContent = text;
      tr.append(cell);
    });
    return tr;
  });

  const thead = document.createElement('thead');
  thead.append(head);
  const tbody = document.createElement('tbody');
  tbody.append(...body);
  node.replaceChildren(thead, tbody);
}
