/**
 * How to Split — view layer.
 *
 * All judgement lives in model.js and all drawing in splitbar.js; this file
 * reads the form, hands the numbers over, and paints the answer — the same
 * split every other tool uses.
 */

import { initTheme, mountThemePicker } from '../../../assets/js/theme.js';
import { bindModals, openModal } from '../../../assets/js/modal.js';
import { load, save } from '../../../assets/js/store.js';
import { showToast } from '../../../assets/js/toast.js';
import { CURRENCIES, buildFormatter } from '../../../assets/js/currency.js';
import { DEFAULT_RATIO_A, evaluate } from './model.js';
import { renderSplitBar } from './splitbar.js';

const STORAGE_KEY = 'split.data';

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const makeItem = () => ({ id: uid(), description: '', amount: '', owner: 'a' });

const DEFAULT_STATE = {
  currency: 'NOK',
  nameA: '',
  nameB: '',
  totalBill: '',
  ratio: DEFAULT_RATIO_A,
  items: [],
};

const $ = (selector) => document.querySelector(selector);

const el = {
  form: $('#split-form'),
  currency: $('#currency'),
  nameA: $('#name-a'),
  nameB: $('#name-b'),
  totalBill: $('#total-bill'),
  ratio: $('#ratio'),
  ratioReadout: $('#ratio-readout'),
  itemList: $('#item-list'),
  addItemBtn: $('#add-item-btn'),
  resetBtn: $('#reset-btn'),
  verdict: $('#verdict'),
  verdictBadge: $('#verdict-badge'),
  verdictHeadline: $('#verdict-headline'),
  verdictSub: $('#verdict-sub'),
  resultsBody: $('#results-body'),
  figures: $('#figures'),
  splitTrack: $('#split-track'),
  splitLegend: $('#split-legend'),
  splitSr: $('#split-sr'),
  individualWrap: $('#individual-summary-wrap'),
  individualSummary: $('#individual-summary'),
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
  if (!Array.isArray(state.items)) state.items = [];
}

// ---------- Small helpers ----------

const effectiveName = (raw, fallback) => (raw || '').trim() || fallback;
/** "You" takes the first-person verb; every other name is third person. */
const verb = (name) => (name.trim().toLowerCase() === 'you' ? 'pay' : 'pays');

function findItem(id) {
  return state.items.find((it) => it.id === id);
}

// ---------- Individual-item rows ----------

function itemRowNode(item, aName, bName) {
  const li = document.createElement('li');
  li.className = 'item-row';
  li.dataset.id = item.id;

  const desc = document.createElement('input');
  desc.type = 'text';
  desc.className = 'item-desc';
  desc.placeholder = 'e.g. PS5';
  desc.setAttribute('aria-label', 'What was it?');
  desc.value = item.description;
  desc.addEventListener('input', () => {
    const it = findItem(item.id);
    if (!it) return;
    it.description = desc.value;
    render();
    persist();
  });

  const amount = document.createElement('input');
  amount.type = 'number';
  amount.className = 'item-amount';
  amount.min = '0';
  amount.step = 'any';
  amount.inputMode = 'decimal';
  amount.placeholder = 'e.g. 5000';
  amount.setAttribute('aria-label', 'Amount');
  amount.value = item.amount;
  amount.addEventListener('input', () => {
    const it = findItem(item.id);
    if (!it) return;
    it.amount = amount.value;
    update();
  });

  const owner = document.createElement('select');
  owner.className = 'item-owner';
  owner.setAttribute('aria-label', 'Whose is it?');
  owner.append(new Option(aName, 'a', false, item.owner === 'a'));
  owner.append(new Option(bName, 'b', false, item.owner === 'b'));
  owner.addEventListener('change', () => {
    const it = findItem(item.id);
    if (!it) return;
    it.owner = owner.value;
    update();
  });

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'item-remove';
  remove.setAttribute('aria-label', `Remove ${item.description || 'this item'}`);
  remove.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  remove.addEventListener('click', () => {
    state.items = state.items.filter((it) => it.id !== item.id);
    renderItemRows();
    update();
  });

  li.append(desc, amount, owner, remove);
  return li;
}

function renderItemRows() {
  const aName = effectiveName(state.nameA, 'You');
  const bName = effectiveName(state.nameB, 'Them');
  el.itemList.replaceChildren(...state.items.map((item) => itemRowNode(item, aName, bName)));
}

// ---------- Static option lists ----------

function populateSelects() {
  el.currency.replaceChildren(...CURRENCIES.map((c) => new Option(c.code, c.code)));
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
  const items = [figure('Total bill', money(result.total))];

  if (result.overAllocated) {
    items.push(figure('Over by', money(result.individualTotal - result.total), 'the individual items alone exceed the bill'));
  } else if (result.individualTotal > 0) {
    const count = result.items.length;
    items.push(figure('Set aside individually', money(result.individualTotal), `${count} item${count === 1 ? '' : 's'}, off the top`));
    items.push(figure('Split by ratio', money(result.sharedAmount), `${result.ratio}/${100 - result.ratio} of the remainder`));
  }

  el.figures.replaceChildren(...items);
}

function renderIndividualSummary(result, aName, bName) {
  if (result.items.length === 0) {
    el.individualWrap.hidden = true;
    return;
  }
  el.individualWrap.hidden = false;
  const rows = result.items.map((item) => {
    const li = document.createElement('li');
    li.className = 'individual-row';
    const desc = document.createElement('span');
    desc.className = 'individual-desc';
    desc.textContent = item.description || 'Untitled item';
    const ownerTag = document.createElement('span');
    ownerTag.className = 'individual-owner';
    ownerTag.textContent = item.owner === 'a' ? aName : bName;
    const amount = document.createElement('span');
    amount.className = 'individual-amount';
    amount.textContent = money(item.amount);
    li.append(desc, ownerTag, amount);
    return li;
  });
  el.individualSummary.replaceChildren(...rows);
}

function guidanceItem(label, text) {
  const li = document.createElement('li');
  const strong = document.createElement('strong');
  strong.textContent = label;
  li.append(strong, document.createTextNode(text));
  return li;
}

function renderGuidance(result) {
  const items = [];

  if (result.individualTotal > 0) {
    items.push(guidanceItem(
      'Individual items skip the ratio entirely',
      `They come off the total before the ${result.ratio}/${100 - result.ratio} split runs, then land back on whoever they're marked for, in full — that's what keeps a PS5 from quietly getting divided.`,
    ));
  } else {
    items.push(guidanceItem(
      'Nothing has been set aside yet',
      'With no individual items, the whole bill is treated as shared and split straight by the ratio. Add an item below if any of it was really just one person\'s.',
    ));
  }

  items.push(guidanceItem(
    'This is a snapshot, not a ledger',
    "Nothing here tracks whether a payment was actually made. Once you've settled up, clear it to start the next bill clean.",
  ));

  el.guidance.replaceChildren(...items);
}

function render() {
  const aName = effectiveName(state.nameA, 'You');
  const bName = effectiveName(state.nameB, 'Them');
  const result = evaluate({ totalBill: state.totalBill, ratioA: state.ratio, items: state.items });

  if (!result.ready) {
    el.verdict.dataset.tone = 'empty';
    el.verdictBadge.textContent = 'Waiting';
    el.verdictHeadline.textContent = 'Enter the total bill to begin';
    el.verdictSub.textContent = 'Everything else can stay at its default.';
    el.resultsBody.hidden = true;
    return;
  }

  el.verdict.dataset.tone = result.verdict.tone;
  el.verdictBadge.textContent = result.verdict.badge;
  el.verdictSub.textContent = result.verdict.sub;
  el.verdictHeadline.textContent = result.overAllocated
    ? "That's more than the whole bill"
    : `${aName} ${verb(aName)} ${money(result.owedA)} · ${bName} ${verb(bName)} ${money(result.owedB)}`;

  renderFigures(result);
  renderSplitBar(
    { track: el.splitTrack, legend: el.splitLegend, srText: el.splitSr },
    { owedA: result.owedA, owedB: result.owedB, aName, bName },
    money,
  );
  renderIndividualSummary(result, aName, bName);
  renderGuidance(result);
  el.resultsBody.hidden = false;
}

// ---------- Form painting ----------

function paintForm() {
  el.currency.value = state.currency;
  el.nameA.value = state.nameA;
  el.nameB.value = state.nameB;
  el.totalBill.value = state.totalBill;
  el.ratio.value = String(state.ratio);
  el.ratioReadout.textContent = `${state.ratio} / ${100 - state.ratio}`;
  renderItemRows();
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

  el.nameA.addEventListener('input', () => {
    state.nameA = el.nameA.value;
    update({ repaintForm: true });
  });

  el.nameB.addEventListener('input', () => {
    state.nameB = el.nameB.value;
    update({ repaintForm: true });
  });

  el.totalBill.addEventListener('input', () => {
    state.totalBill = el.totalBill.value;
    update();
  });

  el.ratio.addEventListener('input', () => {
    state.ratio = Number(el.ratio.value);
    el.ratioReadout.textContent = `${state.ratio} / ${100 - state.ratio}`;
    update();
  });

  el.addItemBtn.addEventListener('click', () => {
    state.items.push(makeItem());
    renderItemRows();
    update();
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
