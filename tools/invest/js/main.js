/**
 * Buy it, or invest it? — view layer.
 *
 * All judgement lives in model.js and all drawing in growthchart.js; this file
 * reads the form, hands the numbers over, and paints the answer — the same
 * split the other tools use.
 */

import { initTheme, mountThemePicker } from '../../../assets/js/theme.js';
import { bindModals, openModal } from '../../../assets/js/modal.js';
import { load, save } from '../../../assets/js/store.js';
import { showToast } from '../../../assets/js/toast.js';
import { CURRENCIES, buildFormatter } from '../../../assets/js/currency.js';
import { CATEGORIES, FREQUENCIES, DEFAULT_REAL_RETURN, evaluate } from './model.js';
import { renderChart } from './growthchart.js';

const STORAGE_KEY = 'invest.data';

const DEFAULT_STATE = {
  currency: 'NOK',
  recurring: false,
  amount: '',
  frequencyId: 'monthly',
  categoryId: 'consumed',
  customDepreciation: '15',
  years: 20,
  realReturn: DEFAULT_REAL_RETURN,
};

const $ = (selector) => document.querySelector(selector);

const el = {
  form: $('#invest-form'),
  currency: $('#currency'),
  modeInputs: Array.from(document.querySelectorAll('input[name="mode"]')),
  amount: $('#amount'),
  amountLabel: $('#amount-label'),
  frequency: $('#frequency'),
  category: $('#category'),
  categoryNote: $('#category-note'),
  customField: $('#custom-field'),
  customDepreciation: $('#custom-depreciation'),
  years: $('#years'),
  yearsReadout: $('#years-readout'),
  returnRate: $('#return-rate'),
  resetBtn: $('#reset-btn'),
  verdict: $('#verdict'),
  verdictBadge: $('#verdict-badge'),
  verdictHeadline: $('#verdict-headline'),
  verdictSub: $('#verdict-sub'),
  resultsBody: $('#results-body'),
  figures: $('#figures'),
  chart: $('#chart'),
  chartTooltip: $('#chart-tooltip'),
  chartLegend: $('#chart-legend'),
  chartTable: $('#chart-table'),
  tableToggle: $('#table-toggle'),
  tableWrap: $('#chart-table-wrap'),
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
}

// ---------- Static option lists ----------

function populateSelects() {
  el.currency.replaceChildren(...CURRENCIES.map((c) => new Option(c.code, c.code)));
  el.frequency.replaceChildren(...FREQUENCIES.map((f) => new Option(f.label, f.id)));
  el.category.replaceChildren(...CATEGORIES.map((c) => new Option(`${c.icon}  ${c.label}`, c.id)));
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
  const years = Math.round(result.horizon);
  const items = [
    figure('If invested instead', money(result.investedFinal), `after ${years} years, in today's money`),
    figure(
      'What you would still own',
      result.consumed ? '—' : money(result.ownedFinal),
      result.consumed ? 'consumed — nothing left to sell' : `after losing ${Math.round(result.depreciation * 100)}% a year`,
    ),
    figure('The difference', money(result.gap), 'what saying yes actually costs'),
  ];

  if (result.recurring) {
    items.push(figure('You would have spent', money(result.contributed), `${money(result.monthly)} a month, every month`));
  }

  el.figures.replaceChildren(...items);
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
  const years = Math.round(result.horizon);

  if (result.recurring) {
    items.push(
      result.breakEvenYears != null
        ? guidanceItem(
            'It could pay for itself',
            `After about ${result.breakEvenYears.toFixed(1)} years, the fund's own returns would cover this cost indefinitely — it would keep paying for itself without ever touching the principal.`,
          )
        : guidanceItem(
            'Not self-funding yet',
            `Within ${years} years the fund does not yet throw off enough return to cover this cost on its own. Drag the horizon further out to find the year it would.`,
          ),
    );
  } else {
    items.push(
      result.breakEvenYears != null
        ? guidanceItem(
            'Or wait, and get it for free',
            `Invest the money instead and after about ${result.breakEvenYears.toFixed(1)} years the growth alone covers the price — you could buy the thing outright and still have your original stake intact.`,
          )
        : guidanceItem(
            'The returns have not caught up yet',
            `Within ${years} years the growth alone does not yet cover the price. Push the horizon out to see when it would.`,
          ),
    );
  }

  items.push(
    guidanceItem(
      'The band is the honest part',
      'The shaded range is the same money at three points either side of your assumed return. Real markets deliver the average over decades, never on schedule — treat the middle line as one plausible path, not a plan.',
    ),
  );

  items.push(
    guidanceItem(
      'This does not tell you whether to buy it',
      'It only prices one side of the decision — it cannot know what the thing is worth to you. If that is the real question,',
      { href: '../value/', text: 'the Value Equation calculator →' },
    ),
  );

  el.guidance.replaceChildren(...items);
}

function render() {
  const result = evaluate({
    recurring: state.recurring,
    amount: state.amount,
    frequencyId: state.frequencyId,
    categoryId: state.categoryId,
    customDepreciation: state.customDepreciation,
    years: state.years,
    realReturn: state.realReturn,
  });

  if (!result.ready) {
    el.verdict.dataset.tone = 'empty';
    el.verdictBadge.textContent = 'Waiting';
    el.verdictHeadline.textContent = 'Enter a price to begin';
    el.verdictSub.textContent = 'Anything from a daily coffee to a car works.';
    el.resultsBody.hidden = true;
    return;
  }

  el.verdict.dataset.tone = result.verdict.tone;
  el.verdictBadge.textContent = result.verdict.badge;
  el.verdictHeadline.textContent = result.verdict.headline;
  el.verdictSub.textContent = `${result.verdict.sub} Over ${Math.round(result.horizon)} years the gap comes to ${money(result.gap)}.`;

  renderFigures(result);
  renderChart(
    { svg: el.chart, tooltip: el.chartTooltip, legend: el.chartLegend, table: el.chartTable },
    result,
    money,
  );
  renderGuidance(result);
  el.resultsBody.hidden = false;
}

// ---------- Form painting ----------

function paintForm() {
  el.currency.value = state.currency;
  el.modeInputs.forEach((input) => {
    input.checked = (input.value === 'recurring') === state.recurring;
  });
  el.amount.value = state.amount;
  el.frequency.value = state.frequencyId;
  el.frequency.hidden = !state.recurring;
  el.amountLabel.textContent = state.recurring ? 'How much does it cost each time?' : 'How much does it cost?';
  el.category.value = state.categoryId;
  el.customField.hidden = state.categoryId !== 'custom';
  el.customDepreciation.value = state.customDepreciation;
  el.years.value = String(state.years);
  el.yearsReadout.textContent = `${state.years} year${state.years === 1 ? '' : 's'}`;
  el.returnRate.value = String(state.realReturn);

  const category = CATEGORIES.find((c) => c.id === state.categoryId);
  el.categoryNote.textContent = category ? category.note : '';
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

  el.modeInputs.forEach((input) => {
    input.addEventListener('change', () => {
      if (!input.checked) return;
      state.recurring = input.value === 'recurring';
      update({ repaintForm: true });
    });
  });

  el.amount.addEventListener('input', () => {
    state.amount = el.amount.value;
    update();
  });

  el.frequency.addEventListener('change', () => {
    state.frequencyId = el.frequency.value;
    update();
  });

  el.category.addEventListener('change', () => {
    state.categoryId = el.category.value;
    update({ repaintForm: true });
  });

  el.customDepreciation.addEventListener('input', () => {
    state.customDepreciation = el.customDepreciation.value;
    update();
  });

  el.years.addEventListener('input', () => {
    state.years = Number(el.years.value);
    el.yearsReadout.textContent = `${state.years} year${state.years === 1 ? '' : 's'}`;
    update();
  });

  el.returnRate.addEventListener('input', () => {
    state.realReturn = el.returnRate.value;
    update();
  });

  el.tableToggle.addEventListener('click', () => {
    const showing = !el.tableWrap.hidden;
    el.tableWrap.hidden = showing;
    el.tableToggle.setAttribute('aria-expanded', String(!showing));
    el.tableToggle.textContent = showing ? 'Show the numbers' : 'Hide the numbers';
  });

  el.resetBtn.addEventListener('click', () => {
    state = structuredClone(DEFAULT_STATE);
    update({ repaintForm: true });
    showToast('Cleared');
  });

  const themeModal = $('#theme-modal');
  mountThemePicker($('#theme-grid'));
  bindModals([themeModal]);
  $('#theme-btn').addEventListener('click', () => openModal(themeModal));
}

init();
