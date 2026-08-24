/**
 * The distribution chart: where one net worth falls on the global curve.
 *
 * Form choice (per this project's dataviz guidance): the job is to locate a
 * single point in a distribution spanning six orders of magnitude, so the
 * x-axis is **logarithmic** and non-negotiable. On a linear axis every adult
 * on earth except the billionaires collapses onto the left edge, which is a
 * true picture of the inequality and a useless picture of where you are.
 *
 * The curve plotted is *cumulative* — share of adults below a given net worth
 * — rather than a histogram. That choice is doing real teaching work: the
 * curve goes nearly flat above USD 1m, so a reader can see for themselves
 * that moving from USD 1m to USD 10m is a tenfold change in money and about
 * one and a half percentage points of rank. A histogram would show the shape
 * but not that.
 *
 * The four published bands render as background shading, not as a second
 * series. They are the source data's own divisions — a reference the reader
 * needs in order to know which parts of the curve are measured and which are
 * interpolated — so they get neutral, non-categorical ink, the same treatment
 * tools/invest/'s uncertainty band and tools/fi/'s target zone get.
 *
 * Colour is slot 1 of the project's validated categorical palette, used
 * verbatim from tools/invest/invest.css so every chart on the site agrees
 * with itself. See docs/invest-vs-buy.md for the contrast finding that makes
 * the direct labels and table view required rather than decorative.
 */

const NS = 'http://www.w3.org/2000/svg';

const VB = { w: 760, h: 340 };
const PAD = { top: 18, right: 96, bottom: 34, left: 52 };

const PLOT = {
  x0: PAD.left,
  x1: VB.w - PAD.right,
  y0: PAD.top,
  y1: VB.h - PAD.bottom,
};

const MIN_USD = 100;
const MAX_USD = 1e9;

const el = (name, attrs = {}) => {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
};

/** Compact USD for axis ticks — the tooltip and table carry exact figures. */
function compactUsd(n) {
  if (n >= 1e9) return `$${n / 1e9}B`;
  if (n >= 1e6) return `$${n / 1e6}M`;
  if (n >= 1e3) return `$${n / 1e3}k`;
  return `$${Math.round(n)}`;
}

/** One tick per decade — anything denser is unreadable on a log axis. */
function decadeTicks() {
  const ticks = [];
  for (let e = Math.log10(MIN_USD); e <= Math.log10(MAX_USD) + 0.001; e += 1) {
    ticks.push(10 ** e);
  }
  return ticks;
}

/**
 * @param {object} refs  { svg, tooltip, legend, table }
 * @param {object} result  from model.evaluate()
 * @param {(n:number)=>string} money  formats the user's own currency
 * @param {(usd:number)=>number} toLocal  converts USD back for display
 */
export function renderChart(refs, result, money, toLocal) {
  const { svg } = refs;
  const pts = result.curve;
  if (!pts.length) return;

  const logMin = Math.log10(MIN_USD);
  const logMax = Math.log10(MAX_USD);

  const sx = (usd) => {
    const clamped = Math.min(MAX_USD, Math.max(MIN_USD, usd));
    return PLOT.x0 + ((Math.log10(clamped) - logMin) / (logMax - logMin)) * (PLOT.x1 - PLOT.x0);
  };
  const sy = (share) => PLOT.y1 - share * (PLOT.y1 - PLOT.y0);

  svg.replaceChildren();
  svg.setAttribute('viewBox', `0 0 ${VB.w} ${VB.h}`);

  // The tooltip lives outside the SVG, so replaceChildren() above doesn't
  // touch it — without this it keeps showing the previous scenario's figures.
  refs.tooltip.hidden = true;
  refs.tooltip.replaceChildren();

  // ---- The published bands, as background shading ----
  const bands = el('g', { class: 'dc-bands' });
  result.tiers.forEach((tier, i) => {
    const from = Math.max(MIN_USD, tier.floor || MIN_USD);
    const to = Math.min(MAX_USD, tier.ceiling);
    if (to <= from) return;
    const rect = el('rect', {
      class: i % 2 === 0 ? 'dc-band' : 'dc-band is-alt',
      x: sx(from),
      y: PLOT.y0,
      width: Math.max(1, sx(to) - sx(from)),
      height: PLOT.y1 - PLOT.y0,
    });
    bands.append(rect);
  });
  svg.append(bands);

  // ---- Gridlines at each 25% of population ----
  const grid = el('g', { class: 'dc-grid' });
  [0, 0.25, 0.5, 0.75, 1].forEach((share) => {
    grid.append(el('line', { x1: PLOT.x0, x2: PLOT.x1, y1: sy(share), y2: sy(share) }));
  });
  svg.append(grid);

  // ---- Axis labels: text tokens, never a series colour ----
  const axis = el('g', { class: 'dc-axis' });
  [0, 0.25, 0.5, 0.75, 1].forEach((share) => {
    const label = el('text', { x: PLOT.x0 - 10, y: sy(share) + 4, 'text-anchor': 'end' });
    label.textContent = `${Math.round(share * 100)}%`;
    axis.append(label);
  });
  decadeTicks().forEach((usd) => {
    const label = el('text', { x: sx(usd), y: PLOT.y1 + 22, 'text-anchor': 'middle' });
    label.textContent = compactUsd(usd);
    axis.append(label);
  });
  svg.append(axis);

  svg.append(el('line', { class: 'dc-baseline', x1: PLOT.x0, x2: PLOT.x1, y1: PLOT.y1, y2: PLOT.y1 }));

  // ---- The cumulative curve ----
  svg.append(el('path', {
    class: 'dc-line',
    d: `M${pts.map((p) => `${sx(p.usd)},${sy(p.share)}`).join(' L')}`,
  }));

  // ---- Your position ----
  if (result.share != null) {
    const x = sx(result.usd);
    const y = sy(result.share);

    svg.append(el('line', { class: 'dc-you-v', x1: x, x2: x, y1: y, y2: PLOT.y1 }));
    svg.append(el('line', { class: 'dc-you-h', x1: PLOT.x0, x2: x, y1: y, y2: y }));
    svg.append(el('circle', { class: 'dc-you-dot', cx: x, cy: y, r: 6 }));

    const tag = el('text', {
      class: 'dc-you-label',
      x: Math.min(x + 10, PLOT.x1 - 4),
      y: Math.max(PLOT.y0 + 12, y - 12),
      'text-anchor': x > PLOT.x1 - 90 ? 'end' : 'start',
    });
    tag.textContent = `you — ${result.rankLabel.toLowerCase()}`;
    svg.append(tag);
  }

  // ---- Hover / focus layer ----
  const hover = el('g', { class: 'dc-hover', hidden: 'hidden' });
  const hairline = el('line', { class: 'dc-hairline', y1: PLOT.y0, y2: PLOT.y1 });
  const dot = el('circle', { class: 'dc-dot', r: 5 });
  hover.append(hairline, dot);
  svg.append(hover);

  const overlay = el('rect', {
    class: 'dc-overlay',
    x: PLOT.x0,
    y: PLOT.y0,
    width: PLOT.x1 - PLOT.x0,
    height: PLOT.y1 - PLOT.y0,
    tabindex: '0',
    role: 'application',
    'aria-label': 'Global wealth distribution by net worth. Use left and right arrow keys to step along the curve.',
  });
  svg.append(overlay);

  let index = Math.round(pts.length / 2);

  const showAt = (i) => {
    index = Math.max(0, Math.min(pts.length - 1, i));
    const p = pts[index];
    hover.removeAttribute('hidden');
    hairline.setAttribute('x1', sx(p.usd));
    hairline.setAttribute('x2', sx(p.usd));
    dot.setAttribute('cx', sx(p.usd));
    dot.setAttribute('cy', sy(p.share));

    // Values lead, labels follow — and every label goes in as text, never HTML.
    refs.tooltip.replaceChildren(
      row(money(toLocal(p.usd)), '', 'dc-tip-head'),
      row(`${(p.share * 100).toFixed(1)}%`, 'hold less', 'dc-tip-row dc-portfolio'),
      row(`${((1 - p.share) * 100).toFixed(1)}%`, 'hold more', 'dc-tip-row dc-diff'),
    );
    refs.tooltip.hidden = false;
    const pct = (sx(p.usd) / VB.w) * 100;
    refs.tooltip.style.left = `${Math.min(76, Math.max(2, pct))}%`;
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

  renderLegend(refs.legend, result);
  renderTable(refs.table, result, money, toLocal);
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

function renderLegend(node, result) {
  const entry = (cls, name, detail) => {
    const li = document.createElement('li');
    li.className = 'dc-legend-row';
    const key = document.createElement('span');
    key.className = `dc-key ${cls}`;
    const label = document.createElement('span');
    label.className = 'dc-legend-name';
    label.textContent = name;
    const figure = document.createElement('span');
    figure.className = 'dc-legend-fig';
    figure.textContent = detail;
    li.append(key, label, figure);
    return li;
  };

  const rows = [
    entry(
      'dc-portfolio',
      'Share of adults holding less than a given amount',
      // With no rank there is no "below you" to quote, and inventing one here
      // would undo the whole point of withholding the rank.
      result.share != null ? `${(result.adultsBelow / 1e9).toFixed(2)}bn below you` : 'the full distribution',
    ),
    entry('dc-band-key', "The report's four published bands", 'shaded behind the curve'),
  ];
  if (result.share != null) {
    rows.push(entry('dc-you-key', 'Where you are', result.rankLabel.toLowerCase()));
  }
  node.replaceChildren(...rows);
}

/** The table-view twin: the published bands, reachable without hovering. */
function renderTable(node, result, money, toLocal) {
  const rows = result.tiers.map((tier) => [
    tier.label,
    `${(tier.adults / 1e6).toFixed(0)}m`,
    `${((tier.adults / result.adultsCovered) * 100).toFixed(1)}%`,
    `${(tier.wealthShare * 100).toFixed(1)}%`,
  ]);

  const head = document.createElement('tr');
  ['Net worth band', 'Adults', 'Share of adults', 'Share of wealth'].forEach((text, i) => {
    const th = document.createElement('th');
    th.textContent = text;
    th.setAttribute('scope', 'col');
    if (i === 0) th.classList.add('is-label');
    head.append(th);
  });

  const body = rows.map((cells, rowIndex) => {
    const tr = document.createElement('tr');
    if (result.tier && result.tiers[rowIndex].id === result.tier.id && result.share != null) {
      tr.className = 'is-you';
    }
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
