/**
 * When could I stop? — view layer.
 *
 * All judgement lives in model.js and all drawing in fichart.js; this file
 * reads the form, hands the numbers over, and paints the answer — the same
 * split the other tools use.
 */

import { initTheme, mountThemePicker } from '../../../assets/js/theme.js';
import { bindModals, openModal } from '../../../assets/js/modal.js';
import { load, save } from '../../../assets/js/store.js';
import { showToast } from '../../../assets/js/toast.js';
import { CURRENCIES, buildFormatter } from '../../../assets/js/currency.js';
import {
  DEFAULT_REAL_RETURN,
  DEFAULT_SWR,
  COAST_TARGET_AGE,
  MAX_HORIZON_YEARS,
  evaluate,
  spendingLever,
  windfallLever,
} from './model.js';
import { renderChart } from './fichart.js';

const STORAGE_KEY = 'fi.data';
const RUNWAY_KEY = 'runway.data'; // read-only, best-effort convenience
const AFFORDABILITY_KEY = 'afford.inputs'; // read-only, best-effort convenience

const DEFAULT_STATE = {
  currency: 'NOK',
  expenses: '',
  retirementExpenses: '',
  portfolio: '',
  saving: '',
  income: '',
  age: '',
  swr: DEFAULT_SWR,
  realReturn: DEFAULT_REAL_RETURN,
  leverAmount: '',
};

const $ = (selector) => document.querySelector(selector);

const el = {
  form: $('#fi-form'),
  currency: $('#currency'),
  expenses: $('#expenses'),
  retirementExpenses: $('#retirement-expenses'),
  portfolio: $('#portfolio'),
  saving: $('#saving'),
  income: $('#income'),
  age: $('#age'),
  swr: $('#swr'),
  swrReadout: $('#swr-readout'),
  returnRate: $('#return-rate'),
  resetBtn: $('#reset-btn'),
  verdict: $('#verdict'),
  verdictBadge: $('#verdict-badge'),
  verdictHeadline: $('#verdict-headline'),
  verdictSub: $('#verdict-sub'),
  resultsBody: $('#results-body'),
  heroCard: $('#hero-card'),
  heroEyebrow: $('#hero-eyebrow'),
  heroNumber: $('#hero-number'),
  heroLabel: $('#hero-label'),
  heroRange: $('#hero-range'),
  progressTrack: $('#progress-track'),
  progressNow: $('#progress-now'),
  progressPct: $('#progress-pct'),
  progressSr: $('#progress-sr'),
  figures: $('#figures'),
  chart: $('#chart'),
  chartTooltip: $('#chart-tooltip'),
  chartLegend: $('#chart-legend'),
  chartTable: $('#chart-table'),
  tableToggle: $('#table-toggle'),
  tableWrap: $('#chart-table-wrap'),
  leverAmount: $('#lever-amount'),
  leverResult: $('#lever-result'),
  guidance: $('#guidance'),
};

let money = (n) => String(Math.round(n));
let state = structuredClone(DEFAULT_STATE);

// ---------- Persistence ----------

function persist() {
  save(STORAGE_KEY, state);
}

/**
 * Best-effort prefill from the sibling money tools. A missing or unreadable
 * value must never throw.
 *
 * Deliberately does **not** prefill `portfolio` from either tool's savings
 * field. Both `runway.data.savings` and `afford.inputs.savings` mean liquid
 * cash you could spend this week — the runway tool's own hint says "not index
 * funds or a pension". That is the opposite quantity to invested assets, and
 * silently filling someone's retirement target with their emergency fund
 * would produce a confidently wrong date.
 */
function prefillFromSiblingTools() {
  const hasValue = (v) => String(v ?? '').trim() !== '';
  const monthlyToYearly = (v) => String(Math.round(parseFloat(v) * 12));

  try {
    const runway = JSON.parse(localStorage.getItem(RUNWAY_KEY) || 'null');
    if (runway && typeof runway === 'object') {
      // The runway tool's honest burn rate is the same quantity this tool
      // wants, one time-step apart: income minus what is saved, if both are
      // known, and essentials plus debt otherwise.
      const income = parseFloat(runway.income);
      const saved = parseFloat(runway.saving);
      if (Number.isFinite(income) && Number.isFinite(saved) && income > 0) {
        state.expenses = String(Math.round((income - saved) * 12));
      } else if (hasValue(runway.essentials)) {
        const essentials = parseFloat(runway.essentials) + (parseFloat(runway.debt) || 0);
        if (Number.isFinite(essentials) && essentials > 0) {
          state.expenses = String(Math.round(essentials * 12));
        }
      }
      if (hasValue(runway.income)) state.income = monthlyToYearly(runway.income);
      if (hasValue(runway.saving)) state.saving = monthlyToYearly(runway.saving);
    }
  } catch {
    /* nothing usable — fall through to the affordability tool */
  }

  try {
    const afford = JSON.parse(localStorage.getItem(AFFORDABILITY_KEY) || 'null');
    if (!afford || typeof afford !== 'object') return;
    if (!hasValue(state.income) && hasValue(afford.income)) state.income = monthlyToYearly(afford.income);
    if (!hasValue(state.saving) && hasValue(afford.saving)) state.saving = monthlyToYearly(afford.saving);
    if (!hasValue(state.expenses) && hasValue(afford.essentials)) {
      state.expenses = monthlyToYearly(afford.essentials);
    }
  } catch {
    /* nothing to prefill from — the defaults stand */
  }
}

function loadState() {
  const saved = load(STORAGE_KEY, null);
  if (saved && typeof saved === 'object') {
    state = { ...structuredClone(DEFAULT_STATE), ...saved };
    return;
  }

  // First run: offer a prefill from the sibling tools' own storage. Never
  // overwrites anything of this tool's own, since this branch only runs when
  // this tool has no saved state yet.
  state = structuredClone(DEFAULT_STATE);
  prefillFromSiblingTools();

  // Persist immediately, not on the next edit — otherwise "no saved state"
  // stays true and a later visit re-derives the prefill from whatever the
  // other tools hold *then*, which looks like silent drift rather than a
  // one-time convenience.
  persist();
}

// ---------- Form <-> state ----------

const num = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function readForm() {
  state.currency = el.currency.value;
  state.expenses = el.expenses.value;
  state.retirementExpenses = el.retirementExpenses.value;
  state.portfolio = el.portfolio.value;
  state.saving = el.saving.value;
  state.income = el.income.value;
  state.age = el.age.value;
  state.swr = Number(el.swr.value);
  state.realReturn = el.returnRate.value;
  state.leverAmount = el.leverAmount.value;
}

function writeForm() {
  el.currency.value = state.currency;
  el.expenses.value = state.expenses;
  el.retirementExpenses.value = state.retirementExpenses;
  el.portfolio.value = state.portfolio;
  el.saving.value = state.saving;
  el.income.value = state.income;
  el.age.value = state.age;
  el.swr.value = String(state.swr);
  el.returnRate.value = String(state.realReturn);
  el.leverAmount.value = state.leverAmount;
  paintSwrReadout();
}

function paintSwrReadout() {
  const swr = num(state.swr) || DEFAULT_SWR;
  const multiplier = 100 / swr;
  el.swrReadout.textContent = `${swr.toFixed(1).replace(/\.0$/, '')}% — ${multiplier.toFixed(multiplier % 1 < 0.05 ? 0 : 1)}x`;
}

function toModelInput() {
  return {
    annualExpenses: num(state.expenses),
    retirementExpenses: num(state.retirementExpenses),
    portfolio: num(state.portfolio),
    annualSaving: num(state.saving),
    annualIncome: num(state.income),
    age: num(state.age),
    swr: num(state.swr),
    realReturn: num(state.realReturn),
  };
}

// ---------- Formatting ----------

function yearsText(years) {
  if (years == null) return 'never, on this path';
  if (years <= 0) return 'now';
  if (years > MAX_HORIZON_YEARS) return `over ${MAX_HORIZON_YEARS} years`;
  return years < 10 ? `${years.toFixed(1)} years` : `${Math.round(years)} years`;
}

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
    figure(
      'When you would get there',
      yearsText(result.years),
      result.alreadyThere ? 'you are past the target' : `at ${result.realReturn}% real growth`,
    ),
  );

  if (result.shortfall > 0) {
    items.push(figure('Still to go', money(result.shortfall), `${Math.round(result.progress * 100)}% of the way there`));
  }

  if (result.annualIncome > 0) {
    items.push(
      figure(
        'Savings rate',
        `${Math.round(result.savingsRate * 100)}%`,
        'the share you keep sets the date more than the size of the income',
      ),
    );
  }

  if (result.coast != null) {
    items.push(
      figure(
        'Coast number',
        money(result.coast),
        result.coastReached
          ? `already past it — you could stop adding and still arrive by ${COAST_TARGET_AGE}`
          : `hold this much and you could stop adding, and still arrive by ${COAST_TARGET_AGE}`,
      ),
    );
  }

  el.figures.replaceChildren(...items);
}

function renderProgress(result) {
  const pct = Math.round(result.progress * 100);
  el.progressTrack.style.setProperty('--fill-pct', `${Math.min(100, result.progress * 100)}%`);
  el.progressTrack.style.setProperty(
    '--fill-color',
    result.verdict.tone === 'bad' ? 'var(--bad)' : result.verdict.tone === 'ok' ? 'var(--ok)' : 'var(--good)',
  );
  el.progressNow.textContent = `${money(result.portfolio)} invested`;
  el.progressPct.textContent = `${pct}% of target`;

  const label = `${money(result.portfolio)} invested against a target of ${money(result.target)} — ${pct}% of the way there.`;
  el.progressTrack.setAttribute('role', 'img');
  el.progressTrack.setAttribute('aria-label', label);
  el.progressSr.textContent = label;
}

function leverLine(text, strongText) {
  const p = document.createElement('p');
  if (strongText) {
    const strong = document.createElement('strong');
    strong.textContent = strongText;
    p.append(strong, document.createTextNode(` ${text}`));
  } else {
    p.textContent = text;
  }
  return p;
}

function renderLever(result) {
  const cut = num(state.leverAmount);
  if (cut <= 0) {
    const empty = document.createElement('p');
    empty.className = 'lever-empty';
    empty.textContent = 'Enter an amount to see what a permanent cut is worth.';
    el.leverResult.replaceChildren(empty);
    return;
  }

  const lever = spendingLever(result, cut);
  if (!lever) {
    const empty = document.createElement('p');
    empty.className = 'lever-empty';
    empty.textContent = 'Fill in your spending first — there is nothing to measure this against yet.';
    el.leverResult.replaceChildren(empty);
    return;
  }

  const nodes = [];

  nodes.push(
    leverLine(
      `off the target, because the multiplier works on the cut too — ${money(lever.cut)} a year less to fund is ${money(lever.targetDrop)} less to accumulate.`,
      money(lever.targetDrop),
    ),
  );

  if (lever.yearsSaved != null && lever.yearsSaved > 0) {
    nodes.push(
      leverLine(
        `sooner — ${yearsText(result.years)} becomes ${yearsText(lever.newYears)}. The cut lands twice: it lowers what you need and raises what you add.`,
        yearsText(lever.yearsSaved),
      ),
    );
  } else if (lever.newYears != null) {
    nodes.push(leverLine(`The date moves to ${yearsText(lever.newYears)}.`));
  }

  // The same money as a one-off, for contrast. This comparison is the whole
  // argument: a permanent cut beats a windfall of the same size, badly.
  const windfall = windfallLever(result, cut);
  if (windfall && windfall.yearsSaved != null && lever.yearsSaved != null) {
    const oneOff = windfall.yearsSaved > 0 ? yearsText(windfall.yearsSaved) : 'almost nothing';
    const compare = document.createElement('p');
    compare.className = 'lever-compare';
    compare.textContent = `The same ${money(cut)} as a one-off windfall would buy you ${oneOff} — a permanent change and a single payment are not the same kind of money.`;
    nodes.push(compare);
  }

  el.leverResult.replaceChildren(...nodes);
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

function renderGuidance(result) {
  const items = [];

  items.push(
    guidanceItem(
      'The 4% rule is a historical result, not a law',
      "The Trinity Study tested 30-year windows of US market history and found 4% survived nearly all of them. That is a success frequency from one country's unusually good century — and a retirement longer than thirty years is asking it a question it never answered. Drag the rate to 3% and watch the target move; that gap is the honest uncertainty in this whole exercise.",
    ),
  );

  if (result.annualIncome > 0) {
    items.push(
      guidanceItem(
        'Your savings rate is the whole game',
        `At ${Math.round(result.savingsRate * 100)}%, the date above depends far more on that share than on what you earn. Two people saving the same percentage arrive at almost the same time, whatever their salaries — because a bigger income that is fully spent raises the target as fast as it fills it.`,
      ),
    );
  }

  items.push(
    guidanceItem(
      'Sequence matters more than average',
      'A bad first decade hurts a portfolio being drawn down far more than a bad last decade, even at identical average returns. That asymmetry, not the average, is what the low-withdrawal-rate argument is really about — and no single line on a chart can show it.',
    ),
  );

  items.push(
    guidanceItem(
      'This is the far end of the same question',
      'It measures the years until you could stop for good. For how long you could last starting today, without a paycheque,',
      { href: '../runway/', text: 'How Long Could I Last? →' },
    ),
  );

  el.guidance.replaceChildren(...items);
}

function render() {
  const result = evaluate(toModelInput());

  if (!result.ready) {
    el.verdict.dataset.tone = 'empty';
    el.verdictBadge.textContent = 'Waiting';
    el.verdictHeadline.textContent = 'Enter a year of spending to begin';
    el.verdictSub.textContent = 'That alone gives you the target. Add what you hold and save to get the date.';
    el.resultsBody.hidden = true;
    return;
  }

  el.verdict.dataset.tone = result.verdict.tone;
  el.verdictBadge.textContent = result.verdict.badge;
  el.verdictHeadline.textContent = result.verdict.headline;
  el.verdictSub.textContent = result.savingOverflow
    ? `${result.verdict.sub} (Saving cannot exceed take-home pay, so it has been capped at your income.)`
    : result.verdict.sub;

  el.heroCard.dataset.tone = result.verdict.tone;
  el.heroNumber.textContent = money(result.target);
  el.heroLabel.textContent = `at a ${result.swr.toFixed(1).replace(/\.0$/, '')}% withdrawal rate — ${result.multiplier.toFixed(result.multiplier % 1 < 0.05 ? 0 : 1)}x a year of spending`;
  el.heroRange.textContent = `Between ${money(result.targetTrinity)} and ${money(result.targetConservative)}, depending on whether you trust 4% or the more cautious 3%.`;
  el.heroEyebrow.textContent = result.expensesAdjusted
    ? 'Your number, on the spending you expect to keep'
    : 'Your number';

  renderProgress(result);
  renderFigures(result);
  renderChart(
    { svg: el.chart, tooltip: el.chartTooltip, legend: el.chartLegend, table: el.chartTable },
    result,
    money,
  );
  renderLever(result);
  renderGuidance(result);
  el.resultsBody.hidden = false;
}

// ---------- Wiring ----------

function populateSelects() {
  el.currency.replaceChildren(...CURRENCIES.map((c) => new Option(c.code, c.code)));
}

function update({ repaintForm = false } = {}) {
  readForm();
  money = buildFormatter(state.currency);
  // Re-painting every input on every keystroke resets cursor position in some
  // browsers; only do it when something other than plain typing needs
  // reflecting back into the form.
  if (repaintForm) writeForm();
  paintSwrReadout();
  render();
  persist();
}

function init() {
  initTheme();
  populateSelects();
  loadState();
  writeForm();
  money = buildFormatter(state.currency);
  render();

  el.form.addEventListener('input', () => update());
  el.form.addEventListener('change', () => update());
  el.currency.addEventListener('change', () => update());
  el.leverAmount.addEventListener('input', () => update());

  el.tableToggle.addEventListener('click', () => {
    const showing = !el.tableWrap.hidden;
    el.tableWrap.hidden = showing;
    el.tableToggle.setAttribute('aria-expanded', String(!showing));
    el.tableToggle.textContent = showing ? 'Show the numbers' : 'Hide the numbers';
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
