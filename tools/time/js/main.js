/**
 * How much time do I spend? — view layer.
 *
 * All judgement lives in model.js; this file reads the form, hands the
 * numbers over, and paints the answer — the same split used by the
 * affordability tool.
 */

import { initTheme, mountThemePicker } from '../../../assets/js/theme.js';
import { bindModals, openModal } from '../../../assets/js/modal.js';
import { load, save } from '../../../assets/js/store.js';
import { showToast } from '../../../assets/js/toast.js';
import { CURRENCIES, buildFormatter } from '../../../assets/js/currency.js';
import { HOURS_PER_YEAR, PRESET_CATEGORIES, TYPICAL_WEEK, evaluate } from './model.js';
import { renderYearbar } from './yearbar.js';

const STORAGE_KEY = 'time.data';
const AFFORDABILITY_KEY = 'afford.inputs'; // read-only, best-effort convenience

const DEFAULT_STATE = {
  currency: 'NOK',
  salary: '',
  categories: PRESET_CATEGORIES.map((c) => ({ ...c, custom: false, value: '' })),
};

const $ = (selector) => document.querySelector(selector);
const uid = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const el = {
  form: $('#time-form'),
  currency: $('#currency'),
  salary: $('#salary'),
  quickfill: $('#quickfill'),
  catList: $('#cat-list'),
  addBtn: $('#add-category'),
  resetBtn: $('#reset-btn'),
  verdict: $('#verdict'),
  verdictBadge: $('#verdict-badge'),
  verdictHeadline: $('#verdict-headline'),
  verdictSub: $('#verdict-sub'),
  resultsBody: $('#results-body'),
  figures: $('#figures'),
  yearbarTrack: $('#yearbar-track'),
  yearbarLegend: $('#yearbar-legend'),
  insightsWrap: $('#insights-wrap'),
  insights: $('#insights'),
};

let money = (n) => String(Math.round(n));
let state = structuredClone(DEFAULT_STATE);

// ---------- Persistence ----------

function persist() {
  save(STORAGE_KEY, state);
}

/** Best-effort only: a missing or unreadable value must never throw. */
function salaryFromAffordabilityTool() {
  try {
    const afford = JSON.parse(localStorage.getItem(AFFORDABILITY_KEY) || 'null');
    const monthly = parseFloat(afford?.income);
    return Number.isFinite(monthly) && monthly > 0 ? Math.round(monthly * 12) : null;
  } catch {
    return null;
  }
}

function loadState() {
  const saved = load(STORAGE_KEY, null);
  if (saved && Array.isArray(saved.categories)) {
    state = saved;
    return;
  }

  // First run: offer a salary prefill from the affordability calculator's
  // own storage, if it has one. Never overwrites anything of this tool's
  // own, since this branch only runs when this tool has no saved state yet.
  state = structuredClone(DEFAULT_STATE);
  const inferred = salaryFromAffordabilityTool();
  if (inferred) state.salary = String(inferred);

  // Persist immediately, not on the next edit — otherwise nothing has
  // actually been written yet, "no saved state" stays true, and a later
  // visit re-derives the prefill from whatever the other tool holds *then*,
  // which looks like silent drift rather than a one-time convenience.
  persist();
}

// ---------- Category list ----------

function isBlank(value) {
  return String(value ?? '').trim() === '';
}

function allPresetsBlank() {
  return state.categories.filter((c) => !c.custom).every((c) => isBlank(c.value));
}

function catRow(cat) {
  const li = document.createElement('li');
  li.className = 'cat-row' + (cat.custom ? ' custom' : '');
  li.dataset.id = cat.id;

  const icon = document.createElement('span');
  icon.className = 'cat-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = cat.icon;

  let nameEl;
  if (cat.custom) {
    nameEl = document.createElement('input');
    nameEl.className = 'cat-name-input';
    nameEl.type = 'text';
    nameEl.maxLength = 40;
    nameEl.placeholder = 'What is it?';
    nameEl.value = cat.label;
    nameEl.setAttribute('aria-label', 'Category name');
    nameEl.addEventListener('input', () => {
      cat.label = nameEl.value;
      persist();
      update({ rerenderList: false });
    });
  } else {
    nameEl = document.createElement('span');
    nameEl.className = 'cat-name';
    nameEl.textContent = cat.label;
  }

  const amount = document.createElement('div');
  amount.className = 'cat-amount';

  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.step = 'any';
  input.inputMode = 'decimal';
  input.placeholder = '0';
  input.value = cat.value;
  input.setAttribute('aria-label', `Hours ${cat.label}`);
  input.addEventListener('input', () => {
    cat.value = input.value;
    persist();
    update({ rerenderList: false });
  });

  const unit = document.createElement('select');
  unit.setAttribute('aria-label', `Unit for ${cat.label}`);
  ['day', 'week', 'year'].forEach((id) => unit.append(new Option(id, id, false, id === cat.unit)));
  unit.addEventListener('change', () => {
    cat.unit = unit.value;
    persist();
    update({ rerenderList: false });
  });

  amount.append(input, unit);

  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'cat-del';
  del.setAttribute('aria-label', `Remove ${cat.label}`);
  del.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
  if (cat.custom) {
    del.addEventListener('click', () => {
      state.categories = state.categories.filter((c) => c.id !== cat.id);
      persist();
      renderCategoryList();
      update();
    });
  } else {
    del.disabled = true;
  }

  const yearly = document.createElement('div');
  yearly.className = 'cat-yearly';
  yearly.dataset.yearlyFor = cat.id;

  li.append(icon, nameEl, amount, del, yearly);
  return li;
}

function renderCategoryList() {
  el.catList.replaceChildren(...state.categories.map(catRow));
}

/** Live "= N hrs/yr" hint under each row, without rebuilding the inputs (which would drop focus). */
function updateYearlyHints(result) {
  const byId = new Map(result.rows.map((r) => [r.id, r]));
  state.categories.forEach((cat) => {
    const target = el.catList.querySelector(`[data-yearly-for="${CSS.escape(cat.id)}"]`);
    if (!target) return;
    const row = byId.get(cat.id);
    target.textContent = row && row.yearlyHours > 0
      ? `= ${Math.round(row.yearlyHours).toLocaleString()} hrs/yr${row.moneyValue > 0 ? ` · ${money(row.moneyValue)}` : ''}`
      : '';
  });
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

  if (result.hourlyRate > 0) {
    items.push(
      figure(
        'Your hourly rate',
        money(result.hourlyRate),
        result.usingFallbackWorkHours ? 'assuming a standard 40-hour week' : 'from your own Work hours',
      ),
    );
  }

  items.push(figure('Mapped out', `${Math.round((result.allocatedHours / HOURS_PER_YEAR) * 100)}%`, `${Math.round(result.allocatedHours).toLocaleString()} of ${HOURS_PER_YEAR.toLocaleString()} hours`));

  if (result.overBudgetHours > 0) {
    items.push(figure('Over budget by', `${Math.round(result.overBudgetHours).toLocaleString()}h`, 'more than exist in a year'));
  } else {
    items.push(
      figure(
        'Unaccounted',
        `${Math.round(result.unaccountedHours).toLocaleString()}h`,
        result.unaccountedMoneyValue > 0 ? `worth ${money(result.unaccountedMoneyValue)} at your rate` : 'free, or just untracked',
      ),
    );
  }

  el.figures.replaceChildren(...items);
}

function renderInsights(insights) {
  el.insightsWrap.hidden = insights.length === 0;
  el.insights.replaceChildren(
    ...insights.map((item) => {
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

function verdictFromAllocation(result) {
  if (result.overBudgetHours > 0) {
    return {
      tone: 'bad',
      badge: 'Over budget',
      headline: "That's more hours than exist",
      sub: `You've allocated ${Math.round(result.overBudgetHours).toLocaleString()} hours more than the ${HOURS_PER_YEAR.toLocaleString()} in a year. Trim something below.`,
    };
  }
  const pct = Math.round((result.allocatedHours / HOURS_PER_YEAR) * 100);
  if (pct === 0) {
    return { tone: 'ok', badge: 'Empty', headline: 'Add a category to begin', sub: 'Fill in a couple of the big ones — sleep and work usually go furthest.' };
  }
  return {
    tone: pct >= 70 ? 'good' : 'ok',
    badge: `${pct}% mapped`,
    headline: pct >= 90 ? "You've mapped nearly the whole year" : "Here's your year so far",
    sub: `${Math.round(result.allocatedHours).toLocaleString()} of ${HOURS_PER_YEAR.toLocaleString()} hours accounted for below.`,
  };
}

function render() {
  const result = evaluate(parseFloat(state.salary) || 0, state.categories);
  updateYearlyHints(result);

  if (!result.ready) {
    el.verdict.dataset.tone = 'ok';
    el.verdictBadge.textContent = 'Waiting';
    el.verdictHeadline.textContent = 'Add how you spend your time';
    el.verdictSub.textContent = 'Even one or two categories are enough to see something.';
    el.resultsBody.hidden = true;
    return;
  }

  const v = verdictFromAllocation(result);
  el.verdict.dataset.tone = v.tone;
  el.verdictBadge.textContent = v.badge;
  el.verdictHeadline.textContent = v.headline;
  el.verdictSub.textContent = v.sub;

  renderFigures(result);
  renderYearbar({ track: el.yearbarTrack, legend: el.yearbarLegend }, result, money);
  renderInsights(result.insights);
  el.resultsBody.hidden = false;
}

// ---------- Wiring ----------

function populateCurrencies() {
  el.currency.replaceChildren(...CURRENCIES.map((c) => new Option(c.code, c.code)));
}

function update({ rerenderList = false, persistToo = false } = {}) {
  money = buildFormatter(state.currency);
  el.quickfill.hidden = !allPresetsBlank();
  if (rerenderList) renderCategoryList();
  render();
  if (persistToo) persist();
}

function addCustomCategory() {
  const cat = { id: uid(), label: '', icon: '⭐', unit: 'week', custom: true, value: '' };
  state.categories.push(cat);
  persist();
  renderCategoryList();
  update();
  el.catList.querySelector(`[data-id="${cat.id}"] .cat-name-input`)?.focus();
}

function loadTypicalWeek() {
  state.categories.forEach((cat) => {
    if (!cat.custom && TYPICAL_WEEK[cat.id] != null) {
      cat.value = TYPICAL_WEEK[cat.id];
      cat.unit = PRESET_CATEGORIES.find((p) => p.id === cat.id)?.unit || cat.unit;
    }
  });
  persist();
  renderCategoryList();
  update();
  showToast('Loaded a typical week — edit anything above');
}

function init() {
  initTheme();
  populateCurrencies();
  loadState();

  el.currency.value = state.currency;
  el.salary.value = state.salary;
  renderCategoryList();
  update();

  el.currency.addEventListener('change', () => {
    state.currency = el.currency.value;
    update({ persistToo: true });
  });
  el.salary.addEventListener('input', () => {
    state.salary = el.salary.value;
    update({ persistToo: true });
  });

  el.quickfill.addEventListener('click', loadTypicalWeek);
  el.addBtn.addEventListener('click', addCustomCategory);

  el.resetBtn.addEventListener('click', () => {
    state = structuredClone(DEFAULT_STATE);
    el.currency.value = state.currency;
    el.salary.value = state.salary;
    renderCategoryList();
    update({ persistToo: true });
    showToast('Cleared');
  });

  const themeModal = $('#theme-modal');
  mountThemePicker($('#theme-grid'));
  bindModals([themeModal]);
  $('#theme-btn').addEventListener('click', () => openModal(themeModal));
}

init();
