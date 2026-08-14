/**
 * How long could I last? — view layer.
 *
 * All judgement lives in model.js and all drawing in runwaybar.js; this file
 * reads the form, hands the numbers over, and paints the answer — the same
 * split the other tools use.
 */

import { initTheme, mountThemePicker } from '../../../assets/js/theme.js';
import { bindModals, openModal } from '../../../assets/js/modal.js';
import { load, save } from '../../../assets/js/store.js';
import { showToast } from '../../../assets/js/toast.js';
import { CURRENCIES, buildFormatter } from '../../../assets/js/currency.js';
import { INDEFINITE, evaluate, purchaseImpact } from './model.js';
import { renderRunwayBar, renderIndefiniteBar, SCALE_CAP_MONTHS } from './runwaybar.js';

const STORAGE_KEY = 'runway.data';
const AFFORDABILITY_KEY = 'afford.inputs'; // read-only, best-effort convenience

const DEFAULT_STATE = {
  currency: 'NOK',
  savings: '',
  essentials: '',
  debt: '',
  income: '',
  saving: '',
  incomeWhileOff: '',
  impactRecurring: false,
  impactAmount: '',
};

const $ = (selector) => document.querySelector(selector);

const el = {
  form: $('#runway-form'),
  currency: $('#currency'),
  savings: $('#savings'),
  essentials: $('#essentials'),
  debt: $('#debt'),
  income: $('#income'),
  saving: $('#saving'),
  incomeWhileOff: $('#income-while-off'),
  resetBtn: $('#reset-btn'),
  verdict: $('#verdict'),
  verdictBadge: $('#verdict-badge'),
  verdictHeadline: $('#verdict-headline'),
  verdictSub: $('#verdict-sub'),
  resultsBody: $('#results-body'),
  heroCard: $('#hero-card'),
  heroNumber: $('#hero-number'),
  heroLabel: $('#hero-label'),
  runwayTrack: $('#runway-track'),
  runwayTicks: $('#runway-ticks'),
  runwaySr: $('#runway-sr'),
  figures: $('#figures'),
  unaccountedCard: $('#unaccounted-card'),
  unaccountedText: $('#unaccounted-text'),
  impactModeInputs: Array.from(document.querySelectorAll('input[name="impact-mode"]')),
  impactAmountLabel: $('#impact-amount-label'),
  impactAmount: $('#impact-amount'),
  impactResult: $('#impact-result'),
  guidance: $('#guidance'),
};

let money = (n) => String(Math.round(n));
let state = structuredClone(DEFAULT_STATE);

// ---------- Persistence ----------

function persist() {
  save(STORAGE_KEY, state);
}

/** Best-effort only: a missing or unreadable value must never throw. */
function prefillFromAffordabilityTool() {
  try {
    const afford = JSON.parse(localStorage.getItem(AFFORDABILITY_KEY) || 'null');
    if (!afford || typeof afford !== 'object') return;
    const hasValue = (v) => String(v ?? '').trim() !== '';
    if (hasValue(afford.savings)) state.savings = afford.savings;
    if (hasValue(afford.essentials)) state.essentials = afford.essentials;
    if (hasValue(afford.debt)) state.debt = afford.debt;
    if (hasValue(afford.income)) state.income = afford.income;
    if (hasValue(afford.saving)) state.saving = afford.saving;
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

  // First run: offer a prefill from the affordability calculator's own
  // storage, if it has one. Never overwrites anything of this tool's own,
  // since this branch only runs when this tool has no saved state yet.
  state = structuredClone(DEFAULT_STATE);
  prefillFromAffordabilityTool();

  // Persist immediately, not on the next edit — otherwise "no saved state"
  // stays true and a later visit re-derives the prefill from whatever the
  // affordability tool holds *then*, which looks like silent drift rather
  // than a one-time convenience.
  persist();
}

// ---------- Form <-> state ----------

const isBlank = (value) => String(value ?? '').trim() === '';
const num = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function readForm() {
  state.currency = el.currency.value;
  state.savings = el.savings.value;
  state.essentials = el.essentials.value;
  state.debt = el.debt.value;
  state.income = el.income.value;
  state.saving = el.saving.value;
  state.incomeWhileOff = el.incomeWhileOff.value;
  state.impactRecurring = $('input[name="impact-mode"]:checked').value === 'recurring';
  state.impactAmount = el.impactAmount.value;
}

function writeForm() {
  el.currency.value = state.currency;
  el.savings.value = state.savings;
  el.essentials.value = state.essentials;
  el.debt.value = state.debt;
  el.income.value = state.income;
  el.saving.value = state.saving;
  el.incomeWhileOff.value = state.incomeWhileOff;
  el.impactModeInputs.forEach((input) => {
    input.checked = (input.value === 'recurring') === state.impactRecurring;
  });
  el.impactAmount.value = state.impactAmount;
  el.impactAmountLabel.textContent = state.impactRecurring
    ? 'How much a month would you cut?'
    : 'How much would you skip?';
}

function toModelInput() {
  return {
    savings: num(state.savings),
    essentials: num(state.essentials),
    debtPayments: num(state.debt),
    income: num(state.income),
    monthlySaving: num(state.saving),
    incomeWhileOff: num(state.incomeWhileOff),
  };
}

function toAnswered() {
  return {
    savings: !isBlank(state.savings),
    essentials: !isBlank(state.essentials),
    income: !isBlank(state.income),
    monthlySaving: !isBlank(state.saving),
  };
}

// ---------- Formatting ----------

function monthsText(months) {
  if (months === INDEFINITE) return 'no limit';
  if (months < 10) return `${months.toFixed(1)} months`;
  return `${Math.round(months)} months`;
}

function heroText(months) {
  if (months === INDEFINITE) return '∞';
  return months < 10 ? months.toFixed(1) : String(Math.round(months));
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
  const items = [
    figure('Real monthly burn', money(d.realBurn), d.incomeKnown ? 'income minus what you save' : 'essentials plus debt'),
  ];

  if (d.leanMonths != null && d.leanMonths !== d.months) {
    items.push(
      figure('If you cut to essentials', monthsText(d.leanMonths), `${money(d.leanNetBurn)} a month`),
    );
  }

  if (d.incomeKnown && d.unaccounted > 1) {
    items.push(figure('Unaccounted spending', money(d.unaccounted), 'a month, not named above'));
  }

  if (d.incomeWhileOff > 0) {
    items.push(figure('Still coming in', money(d.incomeWhileOff), 'a month, even without a job'));
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

function renderGuidance(d) {
  const items = [];

  if (d.incomeKnown && d.unaccounted > 1 && d.months !== INDEFINITE) {
    const closedNetBurn = Math.max(d.netBurn - d.unaccounted, 0.01);
    const closedMonths = d.savings / closedNetBurn;
    items.push(
      guidanceItem(
        'Naming it is worth something concrete',
        `About ${money(d.unaccounted)} a month leaves your account that isn't in the essentials or debt figures above. Closing that gap alone is worth ${monthsText(closedMonths - d.months)} of runway.`,
      ),
    );
  }

  items.push(
    guidanceItem(
      'This is a floor, not a forecast',
      'Nothing here grows or shrinks with time — no investment returns, no inflation, no emergency costing more than planned. A real gap in income is usually worse than this number, not better.',
    ),
  );

  items.push(
    guidanceItem(
      'Three months is the usual minimum',
      'Most emergency-fund advice treats three months of essentials as a baseline and six as comfortable — the same bands the affordability calculator checks your buffer against.',
      { href: '../affordability/', text: 'Can I Afford This? →' },
    ),
  );

  el.guidance.replaceChildren(...items);
}

function renderImpact(d) {
  const amount = num(state.impactAmount);
  if (!d.burnKnown || amount <= 0) {
    el.impactResult.textContent = "Enter an amount to see what it's worth.";
    return;
  }
  if (d.months === INDEFINITE) {
    el.impactResult.textContent = 'Your income already covers your costs, so there is no runway left to add to.';
    return;
  }

  const impact = purchaseImpact(d, { recurring: state.impactRecurring, amount });
  if (impact.months == null) {
    el.impactResult.textContent = "Fill in your monthly costs first — there's nothing to measure this against yet.";
    return;
  }

  if (state.impactRecurring) {
    if (impact.newTotal === INDEFINITE) {
      el.impactResult.textContent = `Cutting ${money(amount)} a month would cover your entire burn — your runway would stop being a countdown.`;
    } else {
      el.impactResult.textContent = `Cutting ${money(amount)} a month for good takes your runway from ${monthsText(d.months)} to ${monthsText(impact.newTotal)} — worth ${monthsText(impact.months)} on its own.`;
    }
  } else {
    el.impactResult.textContent = `Skipping this once adds ${monthsText(impact.months)} of runway — from ${monthsText(d.months)} to ${monthsText(impact.newTotal)}.`;
  }
}

function render() {
  const result = evaluate(toModelInput(), toAnswered());

  if (!result.ready) {
    el.verdict.dataset.tone = 'empty';
    el.verdictBadge.textContent = 'Waiting';
    el.verdictHeadline.textContent = 'Enter your savings and monthly costs to begin';
    el.verdictSub.textContent = 'Even just savings and essentials is enough for a first answer.';
    el.resultsBody.hidden = true;
    return;
  }

  el.verdict.dataset.tone = result.verdict.tone;
  el.verdictBadge.textContent = result.verdict.badge;
  el.verdictHeadline.textContent = result.verdict.headline;
  el.verdictSub.textContent = result.verdict.sub;

  el.heroCard.dataset.tone = result.verdict.tone;
  el.heroNumber.textContent = heroText(result.months);
  el.heroLabel.textContent = result.months === INDEFINITE ? 'no runway problem' : 'months of runway';

  if (result.months === INDEFINITE) {
    renderIndefiniteBar(
      { track: el.runwayTrack, ticks: el.runwayTicks, srText: el.runwaySr },
      `Your income covers your costs, so there is no runway to measure — savings of ${money(result.savings)} against a monthly surplus.`,
    );
  } else {
    const capped = result.months > SCALE_CAP_MONTHS;
    renderRunwayBar(
      { track: el.runwayTrack, ticks: el.runwayTicks, srText: el.runwaySr },
      result.months,
      result.verdict.tone,
      `${monthsText(result.months)} of runway${capped ? ` — the bar is capped at ${SCALE_CAP_MONTHS} months for legibility` : ''}, at a real monthly burn of ${money(result.realBurn)}.`,
    );
  }

  renderFigures(result);

  el.unaccountedCard.hidden = !(result.incomeKnown && result.unaccounted > 1);
  if (!el.unaccountedCard.hidden) {
    el.unaccountedText.textContent = `About ${money(result.unaccounted)} a month leaves your account beyond the essentials and debt you named — that gap is already priced into the runway above it, even though nothing above named it.`;
  }

  renderImpact(result);
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
  // Re-painting every input on every keystroke resets cursor position in
  // some browsers; only do it when something other than plain typing needs
  // reflecting back into the form (the impact-mode label, load, reset).
  if (repaintForm) writeForm();
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
  el.impactModeInputs.forEach((input) => input.addEventListener('change', () => update({ repaintForm: true })));
  el.impactAmount.addEventListener('input', () => update());

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
