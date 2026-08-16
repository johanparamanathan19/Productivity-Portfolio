/**
 * Debt Escape Plan — view layer.
 *
 * All judgement lives in model.js and all drawing in payoffchart.js; this
 * file reads the form, hands the numbers over, and paints the answer — the
 * same split every other tool uses.
 */

import { initTheme, mountThemePicker } from '../../../assets/js/theme.js';
import { bindModals, openModal } from '../../../assets/js/modal.js';
import { load, save } from '../../../assets/js/store.js';
import { showToast } from '../../../assets/js/toast.js';
import { CURRENCIES, buildFormatter } from '../../../assets/js/currency.js';
import {
  DEBT_KINDS, STRATEGIES, DEFAULT_STRATEGY,
  toNumber, suggestedMinimum, sumMinimums, compare, rateCutImpact, worstRateDebtId,
} from './model.js';
import { renderChart, renderTimeline } from './payoffchart.js';

const STORAGE_KEY = 'debt.data';

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const CARD_KIND = DEBT_KINDS.find((k) => k.id === 'card') || DEBT_KINDS[0];

function makeDebt(overrides = {}) {
  return {
    id: uid(),
    kindId: 'card',
    label: '',
    balance: '',
    apr: CARD_KIND.apr,
    minPayment: '',
    ...overrides,
  };
}

const DEFAULT_STATE = {
  currency: 'NOK',
  debts: [makeDebt()],
  budget: '',
  strategyId: DEFAULT_STRATEGY,
  wage: '',
  hasMatch: false,
  leverApr: 5,
};

const $ = (selector) => document.querySelector(selector);

const el = {
  currency: $('#currency'),
  hasMatch: $('#has-match'),
  debtList: $('#debt-list'),
  addDebtBtn: $('#add-debt-btn'),
  budget: $('#budget'),
  budgetHint: $('#budget-hint'),
  strategyInputs: Array.from(document.querySelectorAll('input[name="strategy"]')),
  wage: $('#wage'),
  resetBtn: $('#reset-btn'),
  verdict: $('#verdict'),
  verdictBadge: $('#verdict-badge'),
  verdictHeadline: $('#verdict-headline'),
  verdictSub: $('#verdict-sub'),
  infeasibleBody: $('#infeasible-body'),
  infeasibleFigures: $('#infeasible-figures'),
  infeasibleGuidance: $('#infeasible-guidance'),
  resultsBody: $('#results-body'),
  figures: $('#figures'),
  chart: $('#chart'),
  chartTooltip: $('#chart-tooltip'),
  chartLegend: $('#chart-legend'),
  chartTable: $('#chart-table'),
  tableToggle: $('#table-toggle'),
  tableWrap: $('#chart-table-wrap'),
  timeline: $('#timeline'),
  leverTarget: $('#lever-target'),
  leverApr: $('#lever-apr'),
  leverAprReadout: $('#lever-apr-readout'),
  leverResult: $('#lever-result'),
  guidance: $('#guidance'),
};

let money = (n) => String(Math.round(n));
let state = structuredClone(DEFAULT_STATE);

// ---------- Persistence ----------

function persist() {
  save(STORAGE_KEY, state);
}

function loadState() {
  const saved = load(STORAGE_KEY, null);
  state = saved && typeof saved === 'object'
    ? { ...structuredClone(DEFAULT_STATE), ...saved }
    : structuredClone(DEFAULT_STATE);
  if (!Array.isArray(state.debts) || state.debts.length === 0) {
    state.debts = [makeDebt()];
  }
}

// ---------- Static option lists ----------

function populateSelects() {
  el.currency.replaceChildren(...CURRENCIES.map((c) => new Option(c.code, c.code)));
}

// ---------- Debt rows ----------
// Rebuilt wholesale on add / remove / kind change (all of which move focus
// anyway); per-keystroke edits inside a row mutate state directly and only
// re-render the results panel, so typing never rebuilds the list and never
// steals the caret — the trap a naive repeating-row implementation falls into.

function findDebt(id) {
  return state.debts.find((d) => d.id === id);
}

function debtRowNode(debt) {
  const kind = DEBT_KINDS.find((k) => k.id === debt.kindId) || DEBT_KINDS[0];

  const li = document.createElement('li');
  li.className = 'debt-row';
  li.dataset.id = debt.id;

  const head = document.createElement('div');
  head.className = 'debt-row-head';

  const kindSelect = document.createElement('select');
  kindSelect.className = 'debt-kind';
  kindSelect.setAttribute('aria-label', 'Kind of debt');
  DEBT_KINDS.forEach((k) => kindSelect.append(new Option(`${k.icon} ${k.label}`, k.id, false, k.id === debt.kindId)));
  kindSelect.addEventListener('change', () => {
    const d = findDebt(debt.id);
    if (!d) return;
    const newKind = DEBT_KINDS.find((k) => k.id === kindSelect.value) || DEBT_KINDS[0];
    d.kindId = newKind.id;
    d.apr = newKind.apr;
    d.minPayment = newKind.minPct > 0 ? suggestedMinimum(newKind.id, d.balance) : '';
    update({ repaintForm: true });
  });

  const labelInput = document.createElement('input');
  labelInput.type = 'text';
  labelInput.className = 'debt-label';
  labelInput.placeholder = kind.label;
  labelInput.setAttribute('aria-label', 'Name (optional)');
  labelInput.value = debt.label;
  labelInput.addEventListener('input', () => {
    const d = findDebt(debt.id);
    if (!d) return;
    d.label = labelInput.value;
    render();
    persist();
  });

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'debt-remove';
  removeBtn.setAttribute('aria-label', `Remove ${debt.label || kind.label}`);
  removeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  removeBtn.addEventListener('click', () => {
    state.debts = state.debts.filter((d) => d.id !== debt.id);
    if (state.debts.length === 0) state.debts.push(makeDebt());
    update({ repaintForm: true });
    showToast('Removed');
    el.addDebtBtn.focus();
  });

  head.append(kindSelect, labelInput, removeBtn);

  const fields = document.createElement('div');
  fields.className = 'debt-row-fields';

  const field = (labelText, input) => {
    const wrap = document.createElement('label');
    const span = document.createElement('span');
    span.textContent = labelText;
    wrap.append(span, input);
    return wrap;
  };

  const balanceInput = document.createElement('input');
  balanceInput.type = 'number';
  balanceInput.min = '0';
  balanceInput.step = 'any';
  balanceInput.inputMode = 'decimal';
  balanceInput.placeholder = 'e.g. 30000';
  balanceInput.value = debt.balance;

  const aprInput = document.createElement('input');
  aprInput.type = 'number';
  aprInput.min = '0';
  aprInput.max = '100';
  aprInput.step = '0.1';
  aprInput.inputMode = 'decimal';
  aprInput.value = debt.apr;
  aprInput.addEventListener('input', () => {
    const d = findDebt(debt.id);
    if (!d) return;
    d.apr = aprInput.value;
    render();
    persist();
  });

  const minInput = document.createElement('input');
  minInput.type = 'number';
  minInput.min = '0';
  minInput.step = 'any';
  minInput.inputMode = 'decimal';
  minInput.placeholder = kind.minPct > 0 ? 'auto' : 'e.g. 1200';
  minInput.value = debt.minPayment;
  minInput.addEventListener('input', () => {
    const d = findDebt(debt.id);
    if (!d) return;
    d.minPayment = minInput.value;
    render();
    persist();
  });

  balanceInput.addEventListener('input', () => {
    const d = findDebt(debt.id);
    if (!d) return;
    d.balance = balanceInput.value;
    // Live-suggest a minimum for revolving credit while the field is still
    // untouched — the moment someone edits it directly, this stops.
    if ((d.minPayment === '' || d.minPayment == null) && kind.minPct > 0) {
      const suggestion = suggestedMinimum(d.kindId, d.balance);
      d.minPayment = suggestion;
      minInput.value = String(suggestion);
    }
    render();
    persist();
  });

  fields.append(
    field('Balance', balanceInput),
    field('APR %', aprInput),
    field('Minimum / mo', minInput),
  );

  const note = document.createElement('p');
  note.className = 'debt-row-note';
  note.textContent = kind.note;

  li.append(head, fields, note);
  return li;
}

function renderDebtRows() {
  el.debtList.replaceChildren(...state.debts.map(debtRowNode));
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

/** Built by hand rather than through guidanceItem() because it needs two real, separate links. */
function counsellingItem() {
  const li = document.createElement('li');
  const strong = document.createElement('strong');
  strong.textContent = 'Free, non-profit help exists';
  li.append(strong, document.createTextNode('A debt counsellor can negotiate directly with lenders in ways a calculator cannot — '));
  const nfcc = document.createElement('a');
  nfcc.href = 'https://www.nfcc.org';
  nfcc.textContent = 'NFCC';
  const step = document.createElement('a');
  step.href = 'https://www.stepchange.org';
  step.textContent = 'StepChange';
  li.append(nfcc, document.createTextNode(' in the US, '), step, document.createTextNode(' in the UK, or NAV’s gjeldsrådgivning in Norway.'));
  return li;
}

function calendarLabel(months) {
  if (months == null) return null;
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function renderFigures(cmp) {
  const items = [];
  const primary = cmp.primary;
  const strategyLabel = (STRATEGIES.find((s) => s.id === cmp.strategyId) || {}).label || '';

  const cal = calendarLabel(primary.months);
  items.push(figure(
    'Debt-free',
    cal || `${primary.points[primary.points.length - 1].month}mo, not finished`,
    cal ? `${primary.months} month${primary.months === 1 ? '' : 's'} from now, on ${strategyLabel.toLowerCase()}` : 'more than 50 years at this rate — see the lever below',
  ));

  items.push(figure('Total interest', money(primary.interestTotal), strategyLabel));

  if (cmp.interestSavedVsMinimums != null) {
    items.push(figure('Saved vs. minimums only', money(cmp.interestSavedVsMinimums), 'compared with paying just the minimums'));
  } else if (cmp.minimumsOnly) {
    const last = cmp.minimumsOnly.points[cmp.minimumsOnly.points.length - 1];
    items.push(figure('If you only paid minimums', `${money(last.total)} still owed`, `after ${last.month} months — this plan finishes`));
  }

  if (cmp.debts.length > 1) {
    items.push(figure(
      'Snowball costs extra',
      money(cmp.strategyGapInterest),
      `and ${cmp.strategyGapMonths} more month${cmp.strategyGapMonths === 1 ? '' : 's'}`,
    ));
  }

  if (cmp.lifeHours != null) {
    items.push(figure('In life-hours', `${Math.round(cmp.lifeHours)}h`, 'interest paid, divided by your hourly pay'));
  }

  el.figures.replaceChildren(...items);
}

function renderInfeasible(cmp) {
  const shortfall = Math.max(0, cmp.minTotal - cmp.budget);
  el.infeasibleFigures.replaceChildren(
    figure('Your minimums total', money(cmp.minTotal), 'every debt, every month'),
    figure('Short by', money(shortfall), 'a month, just to keep up'),
  );

  el.infeasibleGuidance.replaceChildren(
    guidanceItem(
      'This is a real wall, not a strategy problem',
      'No payoff order fixes a budget that cannot cover the minimums — reordering only decides which debt grows fastest while the others wait.',
    ),
    counsellingItem(),
    guidanceItem(
      'Cutting a rate helps more than any order',
      'A lower rate — a balance transfer, a consolidation loan, or simply calling and asking — shrinks the minimums themselves, not just the payoff order.',
    ),
  );
}

function leverEmptyNode() {
  const p = document.createElement('p');
  p.className = 'lever-empty';
  p.textContent = 'Add debts and a budget to see what a rate cut is worth.';
  return p;
}

function renderLever(cmp) {
  const targetId = worstRateDebtId(cmp.debts);
  const target = cmp.debts.find((d) => d.id === targetId);
  if (!target) {
    el.leverTarget.textContent = '';
    el.leverResult.replaceChildren(leverEmptyNode());
    return;
  }

  const maxApr = Math.max(1, Math.round(target.apr));
  el.leverApr.max = String(maxApr);
  if (toNumber(state.leverApr) > maxApr) state.leverApr = Math.round(maxApr / 2);
  el.leverApr.value = String(state.leverApr);
  el.leverAprReadout.textContent = `${state.leverApr}%`;

  el.leverTarget.textContent = `Applied to your highest rate: ${target.label || 'this debt'}, currently ${target.apr}% APR.`;

  const impact = rateCutImpact({
    debts: cmp.debts,
    monthlyBudget: cmp.budget,
    strategyId: cmp.strategyId,
    debtId: target.id,
    newApr: state.leverApr,
  });

  if (!impact) {
    el.leverResult.replaceChildren(leverEmptyNode());
    return;
  }

  const p1 = document.createElement('p');
  const strong1 = document.createElement('strong');
  strong1.textContent = money(impact.interestSaved);
  p1.append(strong1, document.createTextNode(' less interest, over the life of the plan.'));

  const p2 = document.createElement('p');
  p2.className = 'lever-compare';
  p2.textContent = impact.monthsSaved > 0
    ? `Finishes ${impact.monthsSaved} month${impact.monthsSaved === 1 ? '' : 's'} sooner too.`
    : 'Finishes in the same number of months — the saving here is all in interest.';

  el.leverResult.replaceChildren(p1, p2);
}

function renderGuidance(cmp) {
  const items = [];

  items.push(guidanceItem(
    'Cutting the rate usually beats reordering',
    'A lower rate compounds across every month left on the plan, where switching from snowball to avalanche only reshuffles which debt eats which dollar of interest. Try the lever above before assuming the order is what matters most.',
  ));

  if (cmp.boost && cmp.boost.interestSaved > 0) {
    items.push(guidanceItem(
      'Paying more usually beats both',
      `Putting ${money(cmp.boost.extraPerMonth)} more toward this each month (${cmp.boost.pct}% more) would save ${money(cmp.boost.interestSaved)} and finish ${cmp.boost.monthsSaved} month${cmp.boost.monthsSaved === 1 ? '' : 's'} sooner — often more than the strategy toggle moves either number.`,
    ));
  }

  if (cmp.primary.neverPaidIds.length > 0) {
    const names = cmp.primary.neverPaidIds
      .map((id) => (cmp.debts.find((d) => d.id === id) || {}).label)
      .filter(Boolean)
      .join(', ');
    items.push(guidanceItem(
      'Watch this one grow before its turn',
      `${names || 'One debt'}'s minimum does not cover its own interest — it will grow while only the minimum is being paid, until the plan reaches it with the full surplus.`,
    ));
  }

  if (cmp.debts.length > 1) {
    items.push(guidanceItem(
      'Snowball is not just a feeling',
      `Attacking the smallest balance first is a studied effect on whether people actually finish, not just a preference — paying ${money(cmp.strategyGapInterest)} more here for that edge is a real, considered trade, not a mistake.`,
    ));
  }

  if (state.hasMatch) {
    items.push(guidanceItem(
      'Take the match first',
      'You said an employer match applies to you — that return usually beats even this plan’s worst rate, so it comes before extra debt payments, not after.',
    ));
  }

  items.push(guidanceItem(
    'What comes after this',
    'Once these are cleared, whatever you were paying is free to start compounding for you instead of against you — the exact same arithmetic, aimed the other way.',
    { href: '../invest/', text: 'Buy It, or Invest It? →' },
  ));

  el.guidance.replaceChildren(...items);
}

function setVerdict(cmp) {
  el.verdict.dataset.tone = cmp.verdict.tone;
  el.verdictBadge.textContent = cmp.verdict.badge;
  el.verdictHeadline.textContent = cmp.verdict.headline;

  if (!cmp.feasible) {
    const shortfall = Math.max(0, cmp.minTotal - cmp.budget);
    el.verdictSub.textContent = `${cmp.verdict.sub} Minimums come to ${money(cmp.minTotal)} a month — ${money(shortfall)} more than you have budgeted.`;
    return;
  }

  const extra = cmp.debts.length > 1
    ? ` Snowball costs an extra ${money(cmp.strategyGapInterest)} and ${cmp.strategyGapMonths} month${cmp.strategyGapMonths === 1 ? '' : 's'}.`
    : '';
  el.verdictSub.textContent = `${cmp.verdict.sub}${extra}`;
}

function render() {
  el.budgetHint.textContent = `Your minimums come to ${money(sumMinimums(state.debts))}.`;

  const cmp = compare({
    debts: state.debts,
    monthlyBudget: state.budget,
    strategyId: state.strategyId,
    hourlyWage: state.wage,
  });

  if (!cmp.ready) {
    el.verdict.dataset.tone = 'empty';
    el.verdictBadge.textContent = 'Waiting';
    el.verdictHeadline.textContent = 'Add a debt and a monthly budget to begin';
    el.verdictSub.textContent = 'Every credit card, loan, or IOU works.';
    el.infeasibleBody.hidden = true;
    el.resultsBody.hidden = true;
    return;
  }

  setVerdict(cmp);

  if (!cmp.feasible) {
    el.infeasibleBody.hidden = false;
    el.resultsBody.hidden = true;
    renderInfeasible(cmp);
    return;
  }

  el.infeasibleBody.hidden = true;
  el.resultsBody.hidden = false;

  renderFigures(cmp);
  renderChart(
    { svg: el.chart, tooltip: el.chartTooltip, legend: el.chartLegend, table: el.chartTable },
    cmp,
    money,
  );
  renderTimeline(el.timeline, cmp);
  renderLever(cmp);
  renderGuidance(cmp);
}

// ---------- Form painting ----------

function paintForm() {
  el.currency.value = state.currency;
  el.hasMatch.checked = state.hasMatch;
  el.budget.value = state.budget;
  el.strategyInputs.forEach((input) => { input.checked = input.value === state.strategyId; });
  el.wage.value = state.wage;
  renderDebtRows();
}

function update({ repaintForm = false } = {}) {
  money = buildFormatter(state.currency);
  if (repaintForm) paintForm();
  render();
  persist();
}

// ---------- Wiring ----------

function init() {
  initTheme();
  populateSelects();
  loadState();
  paintForm();
  money = buildFormatter(state.currency);
  render();

  el.currency.addEventListener('change', () => {
    state.currency = el.currency.value;
    update();
  });

  el.hasMatch.addEventListener('change', () => {
    state.hasMatch = el.hasMatch.checked;
    render();
    persist();
  });

  el.addDebtBtn.addEventListener('click', () => {
    const debt = makeDebt();
    state.debts.push(debt);
    update({ repaintForm: true });
    const label = el.debtList.querySelector(`[data-id="${debt.id}"] .debt-label`);
    if (label) label.focus();
  });

  el.budget.addEventListener('input', () => {
    state.budget = el.budget.value;
    render();
    persist();
  });

  el.strategyInputs.forEach((input) => {
    input.addEventListener('change', () => {
      if (!input.checked) return;
      state.strategyId = input.value;
      render();
      persist();
    });
  });

  el.wage.addEventListener('input', () => {
    state.wage = el.wage.value;
    render();
    persist();
  });

  el.leverApr.addEventListener('input', () => {
    state.leverApr = Number(el.leverApr.value);
    el.leverAprReadout.textContent = `${state.leverApr}%`;
    render();
    persist();
  });

  el.tableToggle.addEventListener('click', () => {
    const showing = !el.tableWrap.hidden;
    el.tableWrap.hidden = showing;
    el.tableToggle.setAttribute('aria-expanded', String(!showing));
    el.tableToggle.textContent = showing ? 'Show the numbers' : 'Hide the numbers';
  });

  el.resetBtn.addEventListener('click', () => {
    state = structuredClone(DEFAULT_STATE);
    state.debts = [makeDebt()];
    update({ repaintForm: true });
    showToast('Cleared');
  });

  const themeModal = $('#theme-modal');
  mountThemePicker($('#theme-grid'));
  bindModals([themeModal]);
  $('#theme-btn').addEventListener('click', () => openModal(themeModal));
}

init();
