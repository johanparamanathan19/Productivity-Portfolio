/**
 * The payoff chart: total balance remaining over time, avalanche vs.
 * snowball, against a minimums-only baseline.
 *
 * Form choice (per this project's dataviz guidance): trend over time for
 * distinct series, so a multi-line chart on **one** money axis — never two
 * y-scales. The minimums-only line is not a third series in the same sense
 * as the other two; it is a reference an honest reader needs ("what if I
 * changed nothing"), so it renders as muted, dashed text-dim ink rather than
 * taking a third slot of the categorical palette — the same treatment
 * tools/invest/'s uncertainty band and tools/fi/'s target zone get.
 *
 * Colours are slots 1 and 2 of the project's validated categorical palette,
 * used verbatim from tools/invest/invest.css so every money chart on the
 * site agrees with itself. See debt.css for the palette declaration and the
 * Lavender override, and docs/invest-vs-buy.md for the contrast finding that
 * makes the end-labels and table view required rather than decorative.
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

/**
 * A payoff horizon can be a few months or several decades, unlike the other
 * tools' fixed year-sliders — so ticks switch from months to years by scale
 * instead of assuming years always make sense.
 */
function timeTicks(horizonMonths) {
  if (horizonMonths <= 24) {
    const step = horizonMonths <= 6 ? 1 : horizonMonths <= 12 ? 2 : 3;
    const ticks = [];
    for (let m = 0; m <= horizonMonths + 0.001; m += step) ticks.push(m);
    if (ticks[ticks.length - 1] < horizonMonths - 0.001) ticks.push(horizonMonths);
    return { ticks, label: (m) => (m === 0 ? 'now' : `${Math.round(m)}mo`) };
  }
  const years = horizonMonths / 12;
  const step = years <= 10 ? 2 : years <= 25 ? 5 : 10;
  const ticks = [];
  for (let y = 0; y <= years + 0.001; y += step) ticks.push(Math.round(y * 12));
  if (ticks[ticks.length - 1] < horizonMonths - 0.001) ticks.push(horizonMonths);
  return { ticks, label: (m) => (m === 0 ? 'now' : `${Math.round(m / 12)}y`) };
}

/**
 * Reshape a simulate() result into one point per month across the shared
 * chart horizon. A series that finished before the horizon is zero-filled
 * from its payoff month onward, so the line visibly reaches and holds zero
 * rather than appearing to stop. A series that never finished (truncated) is
 * left exactly as long as its real data — extending it would fabricate a
 * balance that was never computed.
 */
function seriesFor(sim, horizonMonths) {
  const points = sim.points;
  const finished = sim.months != null;
  const byMonth = new Map(points.map((p) => [p.month, p]));
  const lastAvailable = points[points.length - 1].month;
  const lastInterest = points[points.length - 1].interestPaid;
  const cap = finished ? horizonMonths : Math.min(horizonMonths, lastAvailable);

  const out = [];
  for (let m = 0; m <= cap; m += 1) {
    out.push(byMonth.get(m) || { month: m, t: m / 12, total: 0, byDebt: {}, interestPaid: lastInterest });
  }
  return out;
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

/**
 * @param {object} refs  { svg, tooltip, legend, table }
 * @param {object} cmp    from model.compare()
 * @param {(n:number)=>string} money
 */
export function renderChart(refs, cmp, money) {
  const { svg } = refs;
  const { avalanche, snowball, minimumsOnly } = cmp;

  const horizonMonths = Math.max(
    avalanche.points[avalanche.points.length - 1].month,
    snowball.points[snowball.points.length - 1].month,
    1,
  );

  const av = seriesFor(avalanche, horizonMonths);
  const sn = seriesFor(snowball, horizonMonths);
  const mn = minimumsOnly ? seriesFor(minimumsOnly, horizonMonths) : [];

  const maxY = Math.max(...av.map((p) => p.total), ...sn.map((p) => p.total), ...mn.map((p) => p.total), 1);
  const { top, ticks } = niceTicks(maxY);
  const { ticks: xTicks, label: xLabel } = timeTicks(horizonMonths);

  const sx = (m) => PLOT.x0 + (m / horizonMonths) * (PLOT.x1 - PLOT.x0);
  const sy = (v) => PLOT.y1 - (v / top) * (PLOT.y1 - PLOT.y0);

  svg.replaceChildren();
  svg.setAttribute('viewBox', `0 0 ${VB.w} ${VB.h}`);

  refs.tooltip.hidden = true;
  refs.tooltip.replaceChildren();

  // ---- Gridlines ----
  const grid = el('g', { class: 'pc-grid' });
  ticks.forEach((v) => grid.append(el('line', { x1: PLOT.x0, x2: PLOT.x1, y1: sy(v), y2: sy(v) })));
  svg.append(grid);

  // ---- Axis labels ----
  const axis = el('g', { class: 'pc-axis' });
  ticks.forEach((v) => {
    const label = el('text', { x: PLOT.x0 - 10, y: sy(v) + 4, 'text-anchor': 'end' });
    label.textContent = compact(v);
    axis.append(label);
  });
  xTicks.forEach((m) => {
    const label = el('text', { x: sx(m), y: PLOT.y1 + 22, 'text-anchor': 'middle' });
    label.textContent = xLabel(m);
    axis.append(label);
  });
  svg.append(axis);

  svg.append(el('line', { class: 'pc-baseline', x1: PLOT.x0, x2: PLOT.x1, y1: PLOT.y1, y2: PLOT.y1 }));

  // ---- The minimums-only reference: muted, dashed, drawn first so the two live series sit on top ----
  if (mn.length > 1) {
    svg.append(el('path', {
      class: 'pc-line pc-minimums',
      d: `M${mn.map((p) => `${sx(p.month)},${sy(p.total)}`).join(' L')}`,
    }));
  }

  // ---- The two strategies ----
  const line = (pts, cls) => el('path', { class: cls, d: `M${pts.map((p) => `${sx(p.month)},${sy(p.total)}`).join(' L')}` });
  svg.append(line(sn, 'pc-line pc-snowball'));
  svg.append(line(av, 'pc-line pc-avalanche'));

  // ---- Payoff-month annotations: real thresholds, so dashed is correct here ----
  const payoffMark = (months, cls, dx) => {
    if (months == null) return;
    const x = sx(months);
    svg.append(el('line', { class: 'pc-payoff-line', x1: x, x2: x, y1: PLOT.y0, y2: PLOT.y1 }));
    const tag = el('text', { class: `pc-payoff-label ${cls}`, x: x + dx, y: PLOT.y0 + 12 });
    tag.textContent = `${months}mo`;
    svg.append(tag);
  };
  const closeCall = avalanche.months != null && snowball.months != null && Math.abs(sx(avalanche.months) - sx(snowball.months)) < 34;
  payoffMark(avalanche.months, 'pc-avalanche', 6);
  payoffMark(snowball.months, 'pc-snowball', closeCall ? 6 : -6);

  // ---- End dots and direct end-labels ----
  const endPoint = (sim, series) => (sim.months != null
    ? { month: sim.months, total: 0 }
    : { month: series[series.length - 1].month, total: series[series.length - 1].total });
  const avEnd = endPoint(avalanche, av);
  const snEnd = endPoint(snowball, sn);

  svg.append(el('circle', { class: 'pc-dot pc-avalanche', cx: sx(avEnd.month), cy: sy(avEnd.total), r: 5 }));
  svg.append(el('circle', { class: 'pc-dot pc-snowball', cx: sx(snEnd.month), cy: sy(snEnd.total), r: 5 }));

  const endLabel = (y, text) => {
    const node = el('text', { class: 'pc-endlabel', x: PLOT.x1 + 12, y: y + 4 });
    node.textContent = text;
    return node;
  };
  const avY = sy(avEnd.total);
  const snY = sy(snEnd.total);
  svg.append(endLabel(avY, avalanche.months != null ? 'Paid off' : `${money(avEnd.total)} left`));
  // Don't stack colliding end-labels — the legend and table carry the second figure.
  if (Math.abs(avY - snY) >= 16) {
    svg.append(endLabel(snY, snowball.months != null ? 'Paid off' : `${money(snEnd.total)} left`));
  }

  // ---- Hover / focus layer ----
  const hover = el('g', { class: 'pc-hover', hidden: 'hidden' });
  const hairline = el('line', { class: 'pc-hairline', y1: PLOT.y0, y2: PLOT.y1 });
  const dotA = el('circle', { class: 'pc-dot pc-avalanche', r: 5 });
  const dotB = el('circle', { class: 'pc-dot pc-snowball', r: 5 });
  hover.append(hairline, dotA, dotB);
  svg.append(hover);

  const overlay = el('rect', {
    class: 'pc-overlay',
    x: PLOT.x0,
    y: PLOT.y0,
    width: PLOT.x1 - PLOT.x0,
    height: PLOT.y1 - PLOT.y0,
    tabindex: '0',
    role: 'application',
    'aria-label': 'Chart values by month. Use left and right arrow keys to step through time.',
  });
  svg.append(overlay);

  let index = av.length - 1;

  const showAt = (i) => {
    index = Math.max(0, Math.min(av.length - 1, i));
    const pA = av[index];
    const pB = sn[index];
    const pM = mn[index];
    hover.removeAttribute('hidden');
    hairline.setAttribute('x1', sx(pA.month));
    hairline.setAttribute('x2', sx(pA.month));
    dotA.setAttribute('cx', sx(pA.month));
    dotA.setAttribute('cy', sy(pA.total));
    dotB.setAttribute('cx', sx(pB.month));
    dotB.setAttribute('cy', sy(pB.total));

    const rows = [
      row(`Month ${pA.month}`, '', 'pc-tip-head'),
      row(money(pA.total), 'Highest rate first', 'pc-tip-row pc-avalanche'),
      row(money(pB.total), 'Smallest balance first', 'pc-tip-row pc-snowball'),
    ];
    if (pM) rows.push(row(money(pM.total), 'Minimums only', 'pc-tip-row pc-minimums'));
    refs.tooltip.replaceChildren(...rows);
    refs.tooltip.hidden = false;
    const pct = (sx(pA.month) / VB.w) * 100;
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
    return Math.round(frac * (av.length - 1));
  };

  overlay.addEventListener('pointermove', (event) => showAt(indexFromEvent(event)));
  overlay.addEventListener('pointerleave', hide);
  overlay.addEventListener('focus', () => showAt(index));
  overlay.addEventListener('blur', hide);
  overlay.addEventListener('keydown', (event) => {
    const stride = Math.max(1, Math.round(av.length / 40));
    if (event.key === 'ArrowRight') { event.preventDefault(); showAt(index + stride); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); showAt(index - stride); }
    if (event.key === 'Home') { event.preventDefault(); showAt(0); }
    if (event.key === 'End') { event.preventDefault(); showAt(av.length - 1); }
  });

  renderLegend(refs.legend, cmp, money);
  renderTable(refs.table, cmp, av, sn, mn, money);
}

/** A legend is always present for two or more series. Figures here are the true completion totals, not the plotted (possibly clipped) window. */
function renderLegend(node, cmp, money) {
  const { avalanche, snowball, minimumsOnly } = cmp;

  const entry = (cls, name, detail) => {
    const li = document.createElement('li');
    li.className = 'pc-legend-row';
    const key = document.createElement('span');
    key.className = `pc-key ${cls}`;
    const label = document.createElement('span');
    label.className = 'pc-legend-name';
    label.textContent = name;
    const figure = document.createElement('span');
    figure.className = 'pc-legend-fig';
    figure.textContent = detail;
    li.append(key, label, figure);
    return li;
  };

  const strategyDetail = (sim) => (sim.months != null
    ? `${sim.months}mo · ${money(sim.interestTotal)} interest`
    : `still going after ${sim.points[sim.points.length - 1].month}mo`);

  const rows = [
    entry('pc-avalanche', 'Highest rate first', strategyDetail(avalanche)),
    entry('pc-snowball', 'Smallest balance first', strategyDetail(snowball)),
  ];

  if (minimumsOnly) {
    const detail = minimumsOnly.months != null
      ? `${minimumsOnly.months}mo · ${money(minimumsOnly.interestTotal)} interest`
      : `still ${money(minimumsOnly.points[minimumsOnly.points.length - 1].total)} owed after ${minimumsOnly.points[minimumsOnly.points.length - 1].month}mo`;
    rows.push(entry('pc-minimums', 'Minimums only, no strategy', detail));
  }

  node.replaceChildren(...rows);
}

/** The table-view twin: every plotted value reachable without hovering. */
function renderTable(node, cmp, av, sn, mn, money) {
  const horizonMonths = av[av.length - 1].month;
  const step = horizonMonths <= 24 ? 1 : horizonMonths <= 60 ? 3 : horizonMonths <= 300 ? 12 : 24;

  const rows = [];
  for (let m = 0; m <= horizonMonths; m += step) {
    const cells = [
      m === 0 ? 'Now' : `Month ${m}`,
      money(av[Math.min(m, av.length - 1)].total),
      money(sn[Math.min(m, sn.length - 1)].total),
      mn[m] ? money(mn[Math.min(m, mn.length - 1)].total) : '—',
    ];
    rows.push(cells);
  }

  const head = document.createElement('tr');
  ['', 'Highest rate first', 'Smallest balance first', 'Minimums only'].forEach((text) => {
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

/** The ordered "when each debt clears" list beside the chart. */
export function renderTimeline(node, cmp) {
  const order = cmp.primary.payoffOrder;
  if (order.length === 0) {
    const li = document.createElement('li');
    li.className = 'timeline-empty';
    li.textContent = 'Add a debt to see the order it would clear in.';
    node.replaceChildren(li);
    return;
  }

  const rows = order.map((entry, i) => {
    const li = document.createElement('li');
    const index = document.createElement('span');
    index.className = 'timeline-index';
    index.textContent = String(i + 1);
    const name = document.createElement('span');
    name.className = 'timeline-name';
    name.textContent = entry.label;
    const month = document.createElement('span');
    month.className = 'timeline-month';
    month.textContent = entry.month === 1 ? 'month 1' : `month ${entry.month}`;
    li.append(index, name, month);
    return li;
  });

  node.replaceChildren(...rows);
}
