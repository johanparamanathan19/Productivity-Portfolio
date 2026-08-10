/**
 * The growth chart: value over time, invested vs. still owned.
 *
 * Form choice (per this project's dataviz guidance): the job is *trend over
 * time* for two distinct series, so it is a multi-line chart on **one** money
 * axis — never two y-scales, which would invent a relationship that isn't in
 * the data. The pessimistic/optimistic band is not a third series; it is the
 * same series' uncertainty, so it renders as that series' hue at ~10% opacity
 * rather than taking a second colour slot.
 *
 * Colours are slots 1 and 2 of the project's validated categorical palette,
 * assigned in fixed order and defined in invest.css. They were run through the
 * skill's validator against all six theme surfaces before any of this was
 * written; the lavender theme's orange lands below 3:1, which is why the
 * direct end-labels and the table view below are load-bearing, not decoration.
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

  const maxY = Math.max(...pts.map((p) => Math.max(p.high, p.owned)), 1);
  const { top, ticks } = niceTicks(maxY);

  const sx = (t) => PLOT.x0 + (t / result.horizon) * (PLOT.x1 - PLOT.x0);
  const sy = (v) => PLOT.y1 - (v / top) * (PLOT.y1 - PLOT.y0);

  svg.replaceChildren();
  svg.setAttribute('viewBox', `0 0 ${VB.w} ${VB.h}`);

  // The tooltip lives outside the SVG, so replaceChildren() above doesn't touch
  // it — without this it keeps showing figures from the previous scenario after
  // an input changes, which reads as the chart disagreeing with itself.
  refs.tooltip.hidden = true;
  refs.tooltip.replaceChildren();

  // ---- Gridlines: hairline, solid, one step off the surface ----
  const grid = el('g', { class: 'gc-grid' });
  ticks.forEach((v) => {
    grid.append(el('line', { x1: PLOT.x0, x2: PLOT.x1, y1: sy(v), y2: sy(v) }));
  });
  svg.append(grid);

  // ---- Axis labels: text tokens, never a series colour ----
  const axis = el('g', { class: 'gc-axis' });
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

  // ---- Baseline ----
  svg.append(el('line', { class: 'gc-baseline', x1: PLOT.x0, x2: PLOT.x1, y1: PLOT.y1, y2: PLOT.y1 }));

  // ---- Uncertainty band: the invested series' own hue, ~10% opacity ----
  const bandUp = pts.map((p) => `${sx(p.t)},${sy(p.high)}`).join(' L');
  const bandDown = [...pts].reverse().map((p) => `${sx(p.t)},${sy(p.low)}`).join(' L');
  svg.append(el('path', { class: 'gc-band', d: `M${bandUp} L${bandDown} Z` }));

  // ---- The two series ----
  const line = (key, cls) => el('path', {
    class: cls,
    d: `M${pts.map((p) => `${sx(p.t)},${sy(p[key])}`).join(' L')}`,
  });
  svg.append(line('owned', 'gc-line gc-owned'));
  svg.append(line('invested', 'gc-line gc-invested'));

  // ---- Break-even annotation (a real threshold, so dashed is correct here) ----
  if (result.breakEvenYears != null) {
    const x = sx(result.breakEvenYears);
    svg.append(el('line', { class: 'gc-breakeven', x1: x, x2: x, y1: PLOT.y0, y2: PLOT.y1 }));
    const tag = el('text', { class: 'gc-breakeven-label', x: x + 6, y: PLOT.y0 + 12 });
    tag.textContent = `${result.breakEvenYears.toFixed(1)}y`;
    svg.append(tag);
  }

  // ---- End dots (r=5, 2px surface ring) and direct end-labels ----
  const last = pts[pts.length - 1];
  const endInvested = sy(last.invested);
  const endOwned = sy(last.owned);

  svg.append(el('circle', { class: 'gc-dot gc-invested', cx: sx(last.t), cy: endInvested, r: 5 }));
  svg.append(el('circle', { class: 'gc-dot gc-owned', cx: sx(last.t), cy: endOwned, r: 5 }));

  const endLabel = (y, text) => {
    const node = el('text', { class: 'gc-endlabel', x: PLOT.x1 + 12, y: y + 4 });
    node.textContent = text;
    return node;
  };
  svg.append(endLabel(endInvested, money(last.invested)));
  // Don't stack colliding end-labels — drop the lower one and let the legend,
  // tooltip, and table carry it rather than detaching a label from its line.
  if (Math.abs(endInvested - endOwned) >= 16) {
    svg.append(endLabel(endOwned, money(last.owned)));
  }

  // ---- Hover / focus layer ----
  const hover = el('g', { class: 'gc-hover', hidden: 'hidden' });
  const hairline = el('line', { class: 'gc-hairline', y1: PLOT.y0, y2: PLOT.y1 });
  const dotA = el('circle', { class: 'gc-dot gc-invested', r: 5 });
  const dotB = el('circle', { class: 'gc-dot gc-owned', r: 5 });
  hover.append(hairline, dotA, dotB);
  svg.append(hover);

  const overlay = el('rect', {
    class: 'gc-overlay',
    x: PLOT.x0,
    y: PLOT.y0,
    width: PLOT.x1 - PLOT.x0,
    height: PLOT.y1 - PLOT.y0,
    tabindex: '0',
    role: 'application',
    'aria-label': 'Chart values by year. Use left and right arrow keys to step through time.',
  });
  svg.append(overlay);

  let index = pts.length - 1;

  const showAt = (i) => {
    index = Math.max(0, Math.min(pts.length - 1, i));
    const p = pts[index];
    hover.removeAttribute('hidden');
    hairline.setAttribute('x1', sx(p.t));
    hairline.setAttribute('x2', sx(p.t));
    dotA.setAttribute('cx', sx(p.t));
    dotA.setAttribute('cy', sy(p.invested));
    dotB.setAttribute('cx', sx(p.t));
    dotB.setAttribute('cy', sy(p.owned));

    // Values lead, labels follow — and every label goes in as text, never HTML.
    refs.tooltip.replaceChildren(
      row(`Year ${p.t.toFixed(1)}`, '', 'gc-tip-head'),
      row(money(p.invested), 'Invested', 'gc-tip-row gc-invested'),
      row(money(p.owned), 'Still owned', 'gc-tip-row gc-owned'),
      row(money(p.invested - p.owned), 'Difference', 'gc-tip-row gc-diff'),
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

/** A legend is always present for two or more series. */
function renderLegend(node, result, money) {
  const entry = (cls, name, detail) => {
    const li = document.createElement('li');
    li.className = 'gc-legend-row';
    const key = document.createElement('span');
    key.className = `gc-key ${cls}`;
    const label = document.createElement('span');
    label.className = 'gc-legend-name';
    label.textContent = name;
    const figure = document.createElement('span');
    figure.className = 'gc-legend-fig';
    figure.textContent = detail;
    li.append(key, label, figure);
    return li;
  };

  node.replaceChildren(
    entry('gc-invested', 'Invested in an index fund', money(result.investedFinal)),
    entry('gc-owned', result.consumed ? 'What you would still own (nothing)' : 'What you would still own', money(result.ownedFinal)),
    entry('gc-band-key', `Range if returns run ${(result.rates.low * 100).toFixed(0)}–${(result.rates.high * 100).toFixed(0)}%`, `${money(result.lowFinal)} – ${money(result.highFinal)}`),
  );
}

/** The table-view twin: every plotted value reachable without hovering. */
function renderTable(node, result, money) {
  const step = result.horizon <= 10 ? 1 : result.horizon <= 25 ? 2 : 5;
  const rows = [];
  for (let y = 0; y <= result.horizon + 0.001; y += step) {
    const p = result.points[Math.min(result.points.length - 1, Math.round(y * 12))];
    rows.push([y === 0 ? 'Now' : `Year ${Math.round(y)}`, money(p.invested), money(p.owned), money(p.invested - p.owned)]);
  }

  const head = document.createElement('tr');
  ['', 'Invested', 'Still owned', 'Difference'].forEach((text) => {
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
