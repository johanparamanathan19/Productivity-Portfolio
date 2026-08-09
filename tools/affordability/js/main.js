/**
 * Can I Afford This? — view layer.
 *
 * All judgement lives in model.js; this file only reads the form, hands the
 * numbers over, and paints the answer.
 */

import { initTheme, mountThemePicker } from '../../../assets/js/theme.js';
import { bindModals, openModal } from '../../../assets/js/modal.js';
import { load, save } from '../../../assets/js/store.js';
import { showToast } from '../../../assets/js/toast.js';
import { CURRENCIES, buildFormatter } from '../../../assets/js/currency.js';
import { CATEGORIES, evaluate } from './model.js';

const STORAGE_KEY = 'afford.inputs';

const DEFAULTS = {
  currency: 'NOK',
  category: 'general',
  price: '',
  financed: false,
  deposit: '',
  apr: '',
  term: '36',
  ongoing: '',
  income: '',
  essentials: '',
  debt: '',
  saving: '',
  savings: '',
};

const $ = (selector) => document.querySelector(selector);

const el = {
  form: $('#calc-form'),
  currency: $('#currency'),
  category: $('#category'),
  financeFields: $('#finance-fields'),
  ongoingHint: $('#ongoing-hint'),
  essentialsFill: $('#essentials-fill'),
  verdict: $('#verdict'),
  verdictBadge: $('#verdict-badge'),
  verdictHeadline: $('#verdict-headline'),
  verdictSub: $('#verdict-sub'),
  resultsBody: $('#results-body'),
  figures: $('#figures'),
  checks: $('#checks'),
  guidance: $('#guidance'),
  guidanceWrap: $('#guidance-wrap'),
};

/** Text inputs, by element id. */
const NUMBER_FIELDS = [
  'price', 'deposit', 'apr', 'term', 'ongoing',
  'income', 'essentials', 'debt', 'saving', 'savings',
];

// ---------- Formatting ----------

let money = (n) => String(Math.round(n));

const hours = (n) =>
  n >= 160 ? `${(n / 160).toFixed(1)} months of work` : `${Math.round(n)} hours of work`;

// ---------- Form <-> state ----------

function readForm() {
  const state = {
    currency: el.currency.value,
    category: el.category.value,
    financed: $('input[name="pay"]:checked').value === 'financed',
  };
  NUMBER_FIELDS.forEach((id) => {
    state[id] = $(`#${id}`).value;
  });
  return state;
}

function writeForm(state) {
  el.currency.value = state.currency;
  el.category.value = state.category;
  $(`input[name="pay"][value="${state.financed ? 'financed' : 'cash'}"]`).checked = true;
  NUMBER_FIELDS.forEach((id) => {
    $(`#${id}`).value = state[id] ?? '';
  });
}

const num = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** An untouched field, as opposed to one a user deliberately set to 0. */
const isBlank = (value) => String(value ?? '').trim() === '';

/** Map the raw form state onto the shape the model expects. */
function toModelInput(state) {
  return {
    category: state.category,
    price: num(state.price),
    financed: state.financed,
    downPayment: num(state.deposit),
    apr: num(state.apr),
    termMonths: num(state.term),
    ongoingMonthly: num(state.ongoing),
    income: num(state.income),
    essentials: num(state.essentials),
    debtPayments: num(state.debt),
    savings: num(state.savings),
    monthlySaving: num(state.saving),
  };
}

/** Which of the optional money questions the user has actually touched. */
function toAnswered(state) {
  return {
    savings: !isBlank(state.savings),
    essentials: !isBlank(state.essentials),
    debtPayments: !isBlank(state.debt),
  };
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

function renderFigures(d) {
  const items = [];

  if (d.commitment > 0) {
    items.push(figure('Per month', money(d.commitment), d.financed ? 'payment + running costs' : 'running costs'));
  }
  items.push(figure('Total you pay', money(d.totalCost), d.totalInterest > 0 ? `${money(d.totalInterest)} of it interest` : 'no interest'));
  items.push(figure('Costs you', hours(d.hoursOfWork), 'worth of what you earn'));

  // The same number the hours tile is built from, said the other way round —
  // a year of pay is easier to picture than 400 hours of it.
  if (d.income > 0) {
    const yearly = d.income * 12;
    const share = Math.round((d.totalCost / yearly) * 100);
    items.push(
      figure(
        'You earn a year',
        money(yearly),
        `this is ${share < 1 ? 'under 1' : share}% of it`,
      ),
    );
  }

  if (Number.isFinite(d.bufferMonths)) {
    items.push(
      figure(
        'Buffer left',
        `${Math.max(0, d.bufferMonths).toFixed(1)} mo`,
        d.savingsAfter >= 0 ? money(d.savingsAfter) : 'not enough saved',
      ),
    );
  }

  el.figures.replaceChildren(...items);
}

function renderChecks(checks) {
  el.checks.replaceChildren(
    ...checks.map((check) => {
      const item = document.createElement('li');
      item.className = `check check-${check.status}` + (check.informational ? ' check-ask' : '');

      const dot = document.createElement('span');
      dot.className = 'check-dot';
      dot.setAttribute('aria-hidden', 'true');

      const body = document.createElement('div');

      const label = document.createElement('div');
      label.className = 'check-label';
      label.textContent = check.label;

      const status = document.createElement('span');
      status.className = 'check-status';
      status.textContent = check.informational
        ? 'add this'
        : { pass: 'clears', warn: 'tight', fail: 'fails' }[check.status];
      label.append(status);

      const detail = document.createElement('p');
      detail.className = 'check-detail';
      detail.textContent = check.detail;

      body.append(label, detail);
      item.append(dot, body);
      return item;
    }),
  );
}

function renderGuidance(guidance) {
  el.guidanceWrap.hidden = guidance.length === 0;
  el.guidance.replaceChildren(
    ...guidance.map((item) => {
      const li = document.createElement('li');

      const label = document.createElement('strong');
      label.textContent = item.label;

      const text = document.createElement('span');
      text.textContent = item.text;

      li.append(label, text);
      return li;
    }),
  );
}

/** "a, b and c" — plain English for any length. */
function listOf(items) {
  if (items.length <= 1) return items[0] || '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** One or two lines: why the verdict came out this way, then what's missing. */
function verdictSummary(result) {
  const missing = result.checks.filter((c) => c.informational);
  const real = result.checks.filter((c) => !c.informational);
  const fails = real.filter((c) => c.status === 'fail');
  const warns = real.filter((c) => c.status === 'warn');

  let text;
  if (fails.length) {
    text = `It does not clear ${listOf(fails.map((c) => c.label.toLowerCase()))}.`;
  } else if (warns.length >= 2) {
    text = `It clears every check, but ${warns.length} of them only just — this leaves you less slack than is comfortable.`;
  } else if (warns.length === 1) {
    text = `It clears every check, with ${warns[0].label.toLowerCase()} the one to keep an eye on.`;
  } else {
    text = 'It clears every check with room to spare.';
  }

  if (missing.length === 1) {
    text += ' Answer one more question above for a sharper answer.';
  } else if (missing.length > 1) {
    text += ` Answer ${missing.length} more questions above for a sharper answer.`;
  }
  return text;
}

function render(state) {
  const result = evaluate(toModelInput(state), money, toAnswered(state));

  if (!result.ready) {
    el.verdict.dataset.tone = 'empty';
    el.verdictBadge.textContent = 'Waiting';
    el.verdictHeadline.textContent = 'Fill in the price and your income';
    el.verdictSub.textContent = "That's enough for a first answer — the rest sharpens it.";
    el.resultsBody.hidden = true;
    return;
  }

  el.verdict.dataset.tone = result.verdict.tone;
  el.verdictBadge.textContent = { good: 'Yes', ok: 'Careful', warn: 'Wait', bad: 'No' }[result.verdict.tone];
  el.verdictHeadline.textContent = result.verdict.headline;
  el.verdictSub.textContent = verdictSummary(result);

  renderFigures(result.derived);
  renderChecks(result.checks);
  renderGuidance(result.guidance);
  el.resultsBody.hidden = false;
}

// ---------- Wiring ----------

function populateSelects() {
  el.currency.replaceChildren(
    ...CURRENCIES.map((currency) => new Option(currency.code, currency.code)),
  );
  el.category.replaceChildren(
    ...CATEGORIES.map((category) => new Option(category.label, category.id)),
  );
}

/** Round to a step that scales with the size of the number — no one wants "17 483". */
function roundish(n) {
  const step = n >= 10000 ? 500 : n >= 1000 ? 100 : 10;
  return Math.round(n / step) * step;
}

function update({ persist = true } = {}) {
  const state = readForm();
  money = buildFormatter(state.currency);
  el.financeFields.hidden = !state.financed;

  const category = CATEGORIES.find((c) => c.id === state.category) || CATEGORIES[0];
  el.ongoingHint.textContent = category.running;

  // Offer the shortcut only while it would still do something useful.
  el.essentialsFill.hidden = isBlank(state.income) || !isBlank(state.essentials);

  render(state);
  if (persist) save(STORAGE_KEY, state);
}

function init() {
  initTheme();
  populateSelects();

  writeForm({ ...DEFAULTS, ...load(STORAGE_KEY, {}) });
  update({ persist: false });

  // Recalculate as they type; `change` catches the selects and radios.
  el.form.addEventListener('input', () => update());
  el.form.addEventListener('change', () => update());
  el.currency.addEventListener('change', () => update());

  $('#reset-btn').addEventListener('click', () => {
    writeForm(DEFAULTS);
    update();
    showToast('Cleared');
  });

  el.essentialsFill.addEventListener('click', () => {
    const income = num($('#income').value);
    $('#essentials').value = roundish(income / 2);
    update();
  });

  const themeModal = $('#theme-modal');
  mountThemePicker($('#theme-grid'));
  bindModals([themeModal]);
  $('#theme-btn').addEventListener('click', () => openModal(themeModal));
}

init();
