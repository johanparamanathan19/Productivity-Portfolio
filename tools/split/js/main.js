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
const makeItem = () => ({ id: uid(), description: '', amount: '', mode: 'shared' });

const DEFAULT_STATE = {
  currency: 'NOK',
  nameA: '',
  nameB: '',
  ratio: DEFAULT_RATIO_A,
  items: [],
  paidBy: '',
};

const $ = (selector) => document.querySelector(selector);

const el = {
  form: $('#split-form'),
  currency: $('#currency'),
  nameA: $('#name-a'),
  nameB: $('#name-b'),
  ratio: $('#ratio'),
  ratioReadout: $('#ratio-readout'),
  itemList: $('#item-list'),
  addItemBtn: $('#add-item-btn'),
  paidInputs: Array.from(document.querySelectorAll('input[name="paid-by"]')),
  paidLabelNone: $('#paid-label-none'),
  paidLabelA: $('#paid-label-a'),
  paidLabelB: $('#paid-label-b'),
  resetBtn: $('#reset-btn'),
  verdict: $('#verdict'),
  verdictBadge: $('#verdict-badge'),
  verdictHeadline: $('#verdict-headline'),
  verdictSub: $('#verdict-sub'),
  resultsBody: $('#results-body'),
  splitTrack: $('#split-track'),
  splitLegend: $('#split-legend'),
  splitSr: $('#split-sr'),
  figures: $('#figures'),
  breakdownTable: $('#breakdown-table'),
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
  if (!Array.isArray(state.items) || state.items.length === 0) {
    state.items = [makeItem()];
  }
}

// ---------- Small helpers ----------

const effectiveName = (raw, fallback) => (raw || '').trim() || fallback;
/** "You" takes the first-person verb; every other name is third person. */
const verb = (name) => (name.trim().toLowerCase() === 'you' ? 'owe' : 'owes');

function findItem(id) {
  return state.items.find((it) => it.id === id);
}

// ---------- Item rows ----------

function itemModeOptions(aName, bName) {
  return [
    { value: 'shared', label: 'Split by ratio' },
    { value: 'a', label: `100% — ${aName}` },
    { value: 'b', label: `100% — ${bName}` },
  ];
}

function itemRowNode(item, aName, bName) {
  const li = document.createElement('li');
  li.className = 'item-row';
  li.dataset.id = item.id;

  const desc = document.createElement('input');
  desc.type = 'text';
  desc.className = 'item-desc';
  desc.placeholder = 'e.g. Groceries';
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
  amount.placeholder = 'e.g. 500';
  amount.setAttribute('aria-label', 'Amount');
  amount.value = item.amount;
  amount.addEventListener('input', () => {
    const it = findItem(item.id);
    if (!it) return;
    it.amount = amount.value;
    update();
  });

  const mode = document.createElement('select');
  mode.className = 'item-mode';
  mode.setAttribute('aria-label', 'How this splits');
  itemModeOptions(aName, bName).forEach((opt) => mode.append(new Option(opt.label, opt.value, false, opt.value === item.mode)));
  mode.addEventListener('change', () => {
    const it = findItem(item.id);
    if (!it) return;
    it.mode = mode.value;
    update();
  });

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'item-remove';
  remove.setAttribute('aria-label', `Remove ${item.description || 'this item'}`);
  remove.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  remove.addEventListener('click', () => {
    state.items = state.items.filter((it) => it.id !== item.id);
    if (state.items.length === 0) state.items.push(makeItem());
    renderItemRows();
    update();
  });

  li.append(desc, amount, mode, remove);
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

function renderFigures(result, aName, bName) {
  const items = [
    figure('Total', money(result.total), `across ${result.items.length} item${result.items.length === 1 ? '' : 's'}`),
  ];

  if (result.sharedTotal > 0) {
    items.push(figure('On the shared ratio', money(result.sharedTotal), `${result.ratio}/${100 - result.ratio} split`));
  }

  const soloTotal = result.aOnlyTotal + result.bOnlyTotal;
  if (soloTotal > 0) {
    items.push(figure('100% items', money(soloTotal), 'kept out of the ratio entirely'));
  }

  if (result.settlement) {
    const fromName = result.settlement.from === 'a' ? aName : bName;
    const toName = result.settlement.to === 'a' ? aName : bName;
    items.push(figure('Settle up', money(result.settlement.amount), `${fromName} → ${toName}`));
  }

  el.figures.replaceChildren(...items);
}

function modeLabel(item, ratio, aName, bName) {
  if (item.mode === 'a') return `100% ${aName}`;
  if (item.mode === 'b') return `100% ${bName}`;
  return `${ratio}/${100 - ratio}`;
}

function renderBreakdown(result, aName, bName) {
  const head = document.createElement('tr');
  ['Item', 'Amount', 'Split', aName, bName].forEach((text, i) => {
    const th = document.createElement('th');
    th.textContent = text;
    if (i > 0) th.setAttribute('scope', 'col');
    head.append(th);
  });

  const body = result.items.map((item) => {
    const tr = document.createElement('tr');
    const nameCell = document.createElement('th');
    nameCell.setAttribute('scope', 'row');
    nameCell.textContent = item.description || 'Untitled item';
    const cells = [
      money(item.amount),
      modeLabel(item, result.ratio, aName, bName),
      money(item.owedA),
      money(item.owedB),
    ];
    tr.append(nameCell, ...cells.map((text) => {
      const td = document.createElement('td');
      td.textContent = text;
      return td;
    }));
    return tr;
  });

  const thead = document.createElement('thead');
  thead.append(head);
  const tbody = document.createElement('tbody');
  tbody.append(...body);
  el.breakdownTable.replaceChildren(thead, tbody);
}

function guidanceItem(label, text) {
  const li = document.createElement('li');
  const strong = document.createElement('strong');
  strong.textContent = label;
  li.append(strong, document.createTextNode(text));
  return li;
}

function renderGuidance(result, aName, bName) {
  const items = [];

  items.push(guidanceItem(
    'The ratio only touches shared items',
    `100% items go entirely to whoever they're marked for, no matter what the ${result.ratio}/${100 - result.ratio} split above says — that's what keeps a personal subscription from quietly getting divided.`,
  ));

  if (result.settlement) {
    const fromName = result.settlement.from === 'a' ? aName : bName;
    const toName = result.settlement.to === 'a' ? aName : bName;
    items.push(guidanceItem(
      'This is the only transfer needed',
      `${toName} already covered everything on the card, so one payment from ${fromName} settles every item above — nothing else needs to move.`,
    ));
  } else {
    items.push(guidanceItem(
      'Nobody is marked as having paid',
      'Set "Who paid?" on the left if all of this went on one shared card — it turns these two fair shares into a single settlement instead of two separate payments.',
    ));
  }

  items.push(guidanceItem(
    'This is a snapshot, not a ledger',
    "Nothing here tracks whether a transfer actually happened. Once you settle up, clear the items to start the next round clean.",
  ));

  el.guidance.replaceChildren(...items);
}

function render() {
  const aName = effectiveName(state.nameA, 'You');
  const bName = effectiveName(state.nameB, 'Them');
  const result = evaluate({ items: state.items, ratioA: state.ratio, paidBy: state.paidBy || null });

  if (!result.ready) {
    el.verdict.dataset.tone = 'empty';
    el.verdictBadge.textContent = 'Waiting';
    el.verdictHeadline.textContent = 'Add an item to begin';
    el.verdictSub.textContent = 'Anything from a dinner to a whole shared card works.';
    el.resultsBody.hidden = true;
    return;
  }

  el.verdict.dataset.tone = result.verdict.tone;
  el.verdictBadge.textContent = result.verdict.badge;

  if (result.settlement) {
    const fromName = result.settlement.from === 'a' ? aName : bName;
    const toName = result.settlement.to === 'a' ? aName : bName;
    el.verdictHeadline.textContent = `${fromName} ${verb(fromName)} ${toName} ${money(result.settlement.amount)}`;
  } else {
    el.verdictHeadline.textContent = "Here's what each of you owes";
  }
  el.verdictSub.textContent = result.verdict.sub;

  renderSplitBar(
    { track: el.splitTrack, legend: el.splitLegend, srText: el.splitSr },
    { owedA: result.owedA, owedB: result.owedB, aName, bName },
    money,
  );
  renderFigures(result, aName, bName);
  renderBreakdown(result, aName, bName);
  renderGuidance(result, aName, bName);
  el.resultsBody.hidden = false;
}

// ---------- Form painting ----------

function paintForm() {
  el.currency.value = state.currency;
  el.nameA.value = state.nameA;
  el.nameB.value = state.nameB;
  el.ratio.value = String(state.ratio);
  el.ratioReadout.textContent = `${state.ratio} / ${100 - state.ratio}`;

  const aName = effectiveName(state.nameA, 'You');
  const bName = effectiveName(state.nameB, 'Them');
  el.paidLabelNone.textContent = 'Paid separately';
  el.paidLabelA.textContent = `${aName} paid`;
  el.paidLabelB.textContent = `${bName} paid`;
  el.paidInputs.forEach((input) => { input.checked = input.value === (state.paidBy || ''); });

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

  el.paidInputs.forEach((input) => {
    input.addEventListener('change', () => {
      if (!input.checked) return;
      state.paidBy = input.value;
      update();
    });
  });

  el.resetBtn.addEventListener('click', () => {
    state = structuredClone(DEFAULT_STATE);
    state.items = [makeItem()];
    update({ repaintForm: true });
    showToast('Cleared');
  });

  const themeModal = $('#theme-modal');
  mountThemePicker($('#theme-grid'));
  bindModals([themeModal]);
  $('#theme-btn').addEventListener('click', () => openModal(themeModal));
}

init();
