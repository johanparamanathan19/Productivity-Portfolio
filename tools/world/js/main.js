/**
 * Where am I in the world? — view layer.
 *
 * All judgement lives in model.js and all drawing in distributionchart.js;
 * this file reads the form, hands the numbers over, and paints the answer —
 * the same split every other tool uses.
 */

import { initTheme, mountThemePicker } from '../../../assets/js/theme.js';
import { bindModals, openModal } from '../../../assets/js/modal.js';
import { load, save } from '../../../assets/js/store.js';
import { showToast } from '../../../assets/js/toast.js';
import { CURRENCIES, buildFormatter } from '../../../assets/js/currency.js';
import {
  ADULTS_COVERED,
  RATES_AS_OF,
  TOTAL_WEALTH_USD,
  USD_RATES,
  evaluate,
  fromUsd,
} from './model.js';
import { renderChart } from './distributionchart.js';

const STORAGE_KEY = 'world.data';
const AFFORDABILITY_KEY = 'afford.inputs'; // read-only, best-effort convenience

const DEFAULT_STATE = {
  currency: 'NOK',
  netWorth: '',
  household: false,
};

const $ = (selector) => document.querySelector(selector);

const el = {
  form: $('#world-form'),
  currency: $('#currency'),
  netWorth: $('#net-worth'),
  household: $('#household'),
  srcAdults: $('#src-adults'),
  srcWealth: $('#src-wealth'),
  srcRates: $('#src-rates'),
  resetBtn: $('#reset-btn'),
  verdict: $('#verdict'),
  verdictBadge: $('#verdict-badge'),
  verdictHeadline: $('#verdict-headline'),
  verdictSub: $('#verdict-sub'),
  resultsBody: $('#results-body'),
  heroCard: $('#hero-card'),
  heroNumber: $('#hero-number'),
  heroLabel: $('#hero-label'),
  heroDetail: $('#hero-detail'),
  indicativeNote: $('#indicative-note'),
  figures: $('#figures'),
  chart: $('#chart'),
  chartTooltip: $('#chart-tooltip'),
  chartLegend: $('#chart-legend'),
  chartTable: $('#chart-table'),
  tableToggle: $('#table-toggle'),
  tableWrap: $('#chart-table-wrap'),
  milestonesTitle: $('#milestones-title'),
  milestones: $('#milestones'),
  guidance: $('#guidance'),
};

let money = (n) => String(Math.round(n));
let state = structuredClone(DEFAULT_STATE);

// ---------- Persistence ----------

function persist() {
  save(STORAGE_KEY, state);
}

/**
 * Best-effort only: a missing or unreadable value must never throw.
 *
 * Only the currency is carried across. The affordability tool's `savings`
 * means liquid cash and the runway tool's means the same — neither is a net
 * worth, and quietly ranking someone's emergency fund against global wealth
 * would be a confidently wrong answer of exactly the kind this tool exists
 * to avoid. Net worth is a question this tool asks for itself.
 */
function prefillCurrency() {
  try {
    const afford = JSON.parse(localStorage.getItem(AFFORDABILITY_KEY) || 'null');
    if (afford && typeof afford === 'object' && USD_RATES[afford.currency]) {
      state.currency = afford.currency;
    }
  } catch {
    /* nothing to prefill from — the default stands */
  }
}

function loadState() {
  const saved = load(STORAGE_KEY, null);
  if (saved && typeof saved === 'object') {
    state = { ...structuredClone(DEFAULT_STATE), ...saved };
    return;
  }

  state = structuredClone(DEFAULT_STATE);
  prefillCurrency();

  // Persist immediately, not on the next edit — otherwise "no saved state"
  // stays true and a later visit re-derives the prefill from whatever the
  // other tools hold then, which looks like drift rather than a convenience.
  persist();
}

// ---------- Form <-> state ----------

function readForm() {
  state.currency = el.currency.value;
  state.netWorth = el.netWorth.value;
  state.household = el.household.checked;
}

function writeForm() {
  el.currency.value = state.currency;
  el.netWorth.value = state.netWorth;
  el.household.checked = state.household;
}

/** A household figure is split per adult, because that is how the source counts. */
function perAdult(value) {
  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed)) return value;
  return state.household ? parsed / 2 : parsed;
}

function toModelInput() {
  return {
    netWorth: perAdult(state.netWorth),
    currency: state.currency,
  };
}

// ---------- Formatting ----------

/** Percentages spanning six orders of magnitude need variable precision. */
function topPercentText(topPercent) {
  if (topPercent < 0.001) return topPercent.toFixed(5);
  if (topPercent < 0.01) return topPercent.toFixed(4);
  if (topPercent < 0.1) return topPercent.toFixed(3);
  if (topPercent < 1) return topPercent.toFixed(2);
  if (topPercent < 10) return topPercent.toFixed(1);
  return String(Math.round(topPercent));
}

/** "3.7 billion" reads better than "3,732,000,000" at this scale. */
function peopleText(n) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} billion`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(n / 1e6 >= 100 ? 0 : 1)} million`;
  if (n >= 1e3) return `${Math.round(n / 1e3)},000`;
  return String(Math.round(n));
}

const toLocal = (usd) => fromUsd(usd, state.currency);

// ---------- Rendering ----------

function figure(label, value, note) {
  const item = document.createElement('div');
  item.className = 'figure';
  const val = document.createElement('div');
  val.className = 'figure-value';
  val.textContent = value;
  const lbl = document.createElement('div');
  lbl.className = 'figure-label';
  lbl.textContent = label;
  item.append(val, lbl);
  if (note) {
    const hint = document.createElement('div');
    hint.className = 'figure-note';
    hint.textContent = note;
    item.append(hint);
  }
  return item;
}

function renderFigures(result) {
  const items = [];

  items.push(
    figure('Adults holding less', peopleText(result.adultsBelow), `of the ${peopleText(result.adultsCovered)} the report covers`),
  );
  items.push(
    figure('Adults holding more', peopleText(result.adultsAbove), 'the queue ahead of you'),
  );

  if (result.multipleOfMedian != null && result.multipleOfMedian > 0) {
    const multiple = result.multipleOfMedian;
    items.push(
      figure(
        'Times the median adult',
        multiple >= 100 ? `${Math.round(multiple)}x` : `${multiple.toFixed(1)}x`,
        'median implied by the published bands',
      ),
    );
  }

  items.push(
    figure(
      'Your band holds',
      `${Math.round(result.wealthShareOfTier * 100)}%`,
      `of world wealth, shared by ${peopleText(result.tier.adults)} adults`,
    ),
  );

  el.figures.replaceChildren(...items);
}

function renderMilestones(result) {
  if (!result.milestones.length) {
    el.milestonesTitle.hidden = true;
    el.milestones.replaceChildren();
    return;
  }
  el.milestonesTitle.hidden = false;

  el.milestones.replaceChildren(
    ...result.milestones.map((m) => {
      const li = document.createElement('li');
      li.className = 'milestone';

      const rank = document.createElement('span');
      rank.className = 'milestone-rank';
      rank.textContent = `Top ${topPercentText(m.topPercent)}%`;

      const amount = document.createElement('span');
      amount.className = 'milestone-amount';
      amount.textContent = money(toLocal(m.usd));

      const gap = document.createElement('span');
      gap.className = 'milestone-gap';
      const needed = m.usd - result.usd;
      gap.textContent = needed > 0 ? `${money(toLocal(needed))} away` : 'reached';

      li.append(rank, amount, gap);
      return li;
    }),
  );
}

function guidanceItem(label, text, link) {
  const li = document.createElement('li');
  const strong = document.createElement('strong');
  strong.textContent = label;
  li.append(strong, document.createTextNode(text));
  if (link) {
    const a = document.createElement('a');
    a.href = link.href;
    a.textContent = link.text;
    li.append(document.createTextNode(' '), a);
  }
  return li;
}

function renderGuidance() {
  el.guidance.replaceChildren(
    guidanceItem(
      'It is not income, and the two rank very differently',
      'Net worth is a stock — what you have accumulated. A surgeon three years out of training with student debt can sit below a subsistence farmer who owns a goat, because the farmer has a goat and the surgeon has a balance sheet in the red. Neither number describes their life, and the ranking ignores future earnings entirely.',
    ),
    guidanceItem(
      'It is not purchasing power',
      'The conversion is at market exchange rates, which is the convention for wealth statistics and which flatters richer countries. The same sum buys a very different life depending on where it is spent, so the real gap in living standards is narrower than the raw figures suggest.',
    ),
    guidanceItem(
      'It is not age-adjusted, and that hides most of the story',
      'The distribution puts every adult in one pile. Wealth accumulates over a working life, so a large share of what looks like inequality between people is the same person at different ages. Being top-decile at sixty is ordinary; the identical figure at twenty-five is not.',
    ),
    guidanceItem(
      'The two ends of the curve are the least certain',
      'The source publishes four bands. Between them this interpolates, which reads slightly high in the lower bands because real density bunches toward the bottom of each. The top is a fitted power law — better attested, but still a fit.',
    ),
    guidanceItem(
      'A rank is not a plan',
      'Knowing where you sit globally changes nothing about whether your own position is stable. For the length of time your savings would actually cover you,',
      { href: '../runway/', text: 'How Long Could I Last? →' },
    ),
  );
}

function render() {
  const result = evaluate(toModelInput());

  if (!result.ready) {
    el.verdict.dataset.tone = 'empty';
    el.verdictBadge.textContent = 'Waiting';
    el.verdictHeadline.textContent = 'Enter a net worth to begin';
    el.verdictSub.textContent = 'Assets minus debts, in whichever currency you picked above.';
    el.resultsBody.hidden = true;
    return;
  }

  el.verdict.dataset.tone = 'neutral';
  el.verdictBadge.textContent = result.verdict.badge;
  el.verdictHeadline.textContent = result.verdict.headline;
  el.verdictSub.textContent = result.verdict.sub;

  // Zero and negative net worth get the verdict and the caveats, but no rank
  // and no chart position — inventing a percentile there would be the one
  // thing this tool most needs not to do.
  if (result.unranked) {
    el.heroCard.hidden = true;
    el.indicativeNote.hidden = true;
    el.figures.replaceChildren();
    el.milestonesTitle.hidden = true;
    el.milestones.replaceChildren();
    // Still draw the distribution — it is worth seeing — but repaint it so the
    // marker from the previous entry cannot linger and point at a rank this
    // reading does not have.
    renderChart(
      { svg: el.chart, tooltip: el.chartTooltip, legend: el.chartLegend, table: el.chartTable },
      result,
      money,
      toLocal,
    );
    renderGuidance();
    el.resultsBody.hidden = false;
    return;
  }

  el.heroCard.hidden = false;
  el.heroNumber.textContent = result.rankLabel;
  el.heroLabel.textContent = 'by net worth per adult';
  el.heroDetail.textContent = `${peopleText(result.adultsBelow)} adults hold less than you, and ${peopleText(result.adultsAbove)} hold more.`;

  el.indicativeNote.hidden = !result.indicative;
  if (result.indicative) {
    el.indicativeNote.textContent = 'Below USD 10,000 the source does not break the distribution down further, so this figure is interpolated across a single published band. Read it as a range, not a rank.';
  }

  renderFigures(result);
  renderChart(
    { svg: el.chart, tooltip: el.chartTooltip, legend: el.chartLegend, table: el.chartTable },
    result,
    money,
    toLocal,
  );
  renderMilestones(result);
  renderGuidance();
  el.resultsBody.hidden = false;
}

// ---------- Wiring ----------

function populateSelects() {
  // Only currencies the model holds a rate for — a currency it cannot convert
  // would silently rank the wrong number.
  el.currency.replaceChildren(
    ...CURRENCIES.filter((c) => USD_RATES[c.code]).map((c) => new Option(c.code, c.code)),
  );
}

function paintSource() {
  el.srcAdults.textContent = peopleText(ADULTS_COVERED);
  el.srcWealth.textContent = `USD ${Math.round(TOTAL_WEALTH_USD / 1e12)} trillion`;
  el.srcRates.textContent = RATES_AS_OF;
}

function update() {
  readForm();
  money = buildFormatter(state.currency);
  render();
  persist();
}

function init() {
  initTheme();
  populateSelects();
  paintSource();
  loadState();
  writeForm();
  money = buildFormatter(state.currency);
  render();

  el.form.addEventListener('input', update);
  el.form.addEventListener('change', update);
  el.currency.addEventListener('change', update);

  el.tableToggle.addEventListener('click', () => {
    const showing = !el.tableWrap.hidden;
    el.tableWrap.hidden = showing;
    el.tableToggle.setAttribute('aria-expanded', String(!showing));
    el.tableToggle.textContent = showing ? 'Show the published bands' : 'Hide the published bands';
  });

  el.resetBtn.addEventListener('click', () => {
    state = structuredClone(DEFAULT_STATE);
    writeForm();
    render();
    persist();
    showToast('Cleared');
  });

  const themeModal = $('#theme-modal');
  mountThemePicker($('#theme-grid'));
  bindModals([themeModal]);
  $('#theme-btn').addEventListener('click', () => openModal(themeModal));
}

init();
