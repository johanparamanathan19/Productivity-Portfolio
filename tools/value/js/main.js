/**
 * Is this offer worth it? — view layer.
 *
 * All judgement lives in model.js; this file reads the form, hands the
 * numbers over, and paints the answer — the same split used by the
 * affordability and time tools.
 */

import { initTheme, mountThemePicker } from '../../../assets/js/theme.js';
import { bindModals, openModal } from '../../../assets/js/modal.js';
import { load, save } from '../../../assets/js/store.js';
import { showToast } from '../../../assets/js/toast.js';
import {
  DREAM_OUTCOME_LEVELS,
  LIKELIHOOD_LEVELS,
  COST_LEVELS,
  DELAY_UNITS,
  EFFORT_ITEMS,
  EXAMPLES,
  describeLevel,
  evaluate,
} from './model.js';

const STORAGE_KEY = 'value.data';

const DEFAULT_STATE = {
  offerName: '',
  dreamOutcome: 5,
  likelihood: 5,
  delayValue: 1,
  delayUnit: 'weeks',
  effortChecked: [],
};

const $ = (selector) => document.querySelector(selector);

const el = {
  form: $('#value-form'),
  offerName: $('#offer-name'),
  exampleBtns: $('#example-btns'),
  dreamOutcome: $('#dream-outcome'),
  dreamOutcomeValue: $('#dream-outcome-value'),
  dreamOutcomeDesc: $('#dream-outcome-desc'),
  likelihood: $('#likelihood'),
  likelihoodValue: $('#likelihood-value'),
  likelihoodDesc: $('#likelihood-desc'),
  delayValue: $('#delay-value'),
  delayUnit: $('#delay-unit'),
  delayDesc: $('#delay-desc'),
  effortList: $('#effort-list'),
  effortDesc: $('#effort-desc'),
  resetBtn: $('#reset-btn'),
  verdict: $('#verdict'),
  verdictBadge: $('#verdict-badge'),
  verdictOffer: $('#verdict-offer'),
  verdictHeadline: $('#verdict-headline'),
  verdictSub: $('#verdict-sub'),
  figures: $('#figures'),
  leverList: $('#lever-list'),
  equationRow: $('#equation-row'),
  adviceList: $('#advice-list'),
};

let state = structuredClone(DEFAULT_STATE);

// ---------- Persistence ----------

function persist() {
  save(STORAGE_KEY, state);
}

function loadState() {
  const saved = load(STORAGE_KEY, null);
  state = saved && typeof saved === 'object' ? { ...structuredClone(DEFAULT_STATE), ...saved } : structuredClone(DEFAULT_STATE);
}

// ---------- Static option lists ----------

function populateDelayUnits() {
  el.delayUnit.replaceChildren(...DELAY_UNITS.map((u) => new Option(u.label, u.id)));
}

function renderEffortList() {
  el.effortList.replaceChildren(
    ...EFFORT_ITEMS.map((item) => {
      const label = document.createElement('label');
      label.className = 'effort-item';

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = state.effortChecked.includes(item.id);
      input.addEventListener('change', () => {
        state.effortChecked = input.checked
          ? [...state.effortChecked, item.id]
          : state.effortChecked.filter((id) => id !== item.id);
        persist();
        render();
      });

      const span = document.createElement('span');
      span.textContent = item.label;

      label.append(input, span);
      return label;
    }),
  );
}

function renderExamples() {
  el.exampleBtns.replaceChildren(
    ...EXAMPLES.map((ex) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'example-btn';
      btn.textContent = ex.name;
      btn.addEventListener('click', () => loadExample(ex));
      return btn;
    }),
  );
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
  el.figures.replaceChildren(
    figure('Value score', `${result.score}/100`, result.verdict.badge),
    figure('Numerator', `${(result.D * result.L).toFixed(0)}`, 'Dream Outcome × Likelihood'),
    figure('Denominator', `${(result.T * result.E).toFixed(1)}`, 'Time Delay × Effort'),
  );
}

function leverRow(name, value, note, effect) {
  const li = document.createElement('li');
  li.className = 'lever-row';

  const head = document.createElement('div');
  head.className = 'lever-head';
  const nameEl = document.createElement('span');
  nameEl.className = 'lever-name';
  nameEl.textContent = name;
  const figEl = document.createElement('span');
  figEl.className = 'lever-figure';
  figEl.textContent = `${value.toFixed(1)}/10`;
  head.append(nameEl, figEl);

  const track = document.createElement('div');
  track.className = 'lever-track';
  const fill = document.createElement('div');
  fill.className = 'lever-fill';
  fill.dataset.effect = effect;
  fill.style.width = `${(value / 10) * 100}%`;
  track.append(fill);

  const noteEl = document.createElement('p');
  noteEl.className = 'lever-note';
  noteEl.textContent = note;

  li.append(head, track, noteEl);
  return li;
}

function renderLevers(result) {
  el.leverList.replaceChildren(
    leverRow('Dream Outcome', result.D, describeLevel(result.D, DREAM_OUTCOME_LEVELS), 'helps'),
    leverRow('Likelihood', result.L, describeLevel(result.L, LIKELIHOOD_LEVELS), 'helps'),
    leverRow('Time Delay', result.T, describeLevel(result.T, COST_LEVELS), 'hurts'),
    leverRow('Effort & Sacrifice', result.E, describeLevel(result.E, COST_LEVELS), 'hurts'),
  );

  el.equationRow.innerHTML = '';
  el.equationRow.append(
    document.createTextNode('Value = ('),
    Object.assign(document.createElement('strong'), { textContent: result.D }),
    document.createTextNode(' × '),
    Object.assign(document.createElement('strong'), { textContent: result.L }),
    document.createTextNode(') ÷ ('),
    Object.assign(document.createElement('strong'), { textContent: result.T.toFixed(1) }),
    document.createTextNode(' × '),
    Object.assign(document.createElement('strong'), { textContent: result.E.toFixed(1) }),
    document.createTextNode(') → '),
    Object.assign(document.createElement('strong'), { textContent: `${result.score}/100` }),
  );
}

function renderAdvice(result) {
  const li = document.createElement('li');
  const strong = document.createElement('strong');
  strong.textContent = result.weakest.label;
  const span = document.createElement('span');
  span.textContent = result.weakest.text;
  li.append(strong, span);
  el.adviceList.replaceChildren(li);
}

function render() {
  const result = evaluate({
    dreamOutcome: state.dreamOutcome,
    likelihood: state.likelihood,
    delayValue: state.delayValue,
    delayUnit: state.delayUnit,
    effortChecked: state.effortChecked,
  });

  el.verdict.dataset.tone = result.verdict.tone;
  el.verdictBadge.textContent = result.verdict.badge;
  el.verdictOffer.textContent = state.offerName.trim();
  el.verdictHeadline.textContent = result.verdict.headline;
  el.verdictSub.textContent = result.verdict.sub;

  renderFigures(result);
  renderLevers(result);
  renderAdvice(result);

  el.dreamOutcomeDesc.textContent = describeLevel(result.D, DREAM_OUTCOME_LEVELS);
  el.likelihoodDesc.textContent = describeLevel(result.L, LIKELIHOOD_LEVELS);
  el.delayDesc.textContent = `≈ ${result.T.toFixed(1)}/10 — ${describeLevel(result.T, COST_LEVELS)}`;
  const checkedCount = state.effortChecked.length;
  el.effortDesc.textContent = checkedCount === 0
    ? `≈ 1.0/10 — nothing checked yet, the best case.`
    : `≈ ${result.E.toFixed(1)}/10 — ${checkedCount} thing${checkedCount === 1 ? '' : 's'} checked. ${describeLevel(result.E, COST_LEVELS)}`;
}

// ---------- Wiring ----------

function loadExample(ex) {
  state = {
    ...structuredClone(DEFAULT_STATE),
    offerName: ex.name,
    dreamOutcome: ex.dreamOutcome,
    likelihood: ex.likelihood,
    delayValue: ex.delayValue,
    delayUnit: ex.delayUnit,
    effortChecked: [...ex.effortChecked],
  };
  paintForm();
  renderEffortList();
  render();
  persist();
  showToast(`Loaded "${ex.name}" — edit anything below`);
}

function paintForm() {
  el.offerName.value = state.offerName;
  el.dreamOutcome.value = String(state.dreamOutcome);
  el.dreamOutcomeValue.textContent = String(state.dreamOutcome);
  el.likelihood.value = String(state.likelihood);
  el.likelihoodValue.textContent = String(state.likelihood);
  el.delayValue.value = state.delayValue === '' ? '' : String(state.delayValue);
  el.delayUnit.value = state.delayUnit;
}

function init() {
  initTheme();
  populateDelayUnits();
  loadState();
  paintForm();
  renderEffortList();
  renderExamples();
  render();

  el.offerName.addEventListener('input', () => {
    state.offerName = el.offerName.value;
    el.verdictOffer.textContent = state.offerName.trim();
    persist();
  });

  el.dreamOutcome.addEventListener('input', () => {
    state.dreamOutcome = Number(el.dreamOutcome.value);
    el.dreamOutcomeValue.textContent = el.dreamOutcome.value;
    render();
    persist();
  });

  el.likelihood.addEventListener('input', () => {
    state.likelihood = Number(el.likelihood.value);
    el.likelihoodValue.textContent = el.likelihood.value;
    render();
    persist();
  });

  el.delayValue.addEventListener('input', () => {
    state.delayValue = el.delayValue.value;
    render();
    persist();
  });
  el.delayUnit.addEventListener('change', () => {
    state.delayUnit = el.delayUnit.value;
    render();
    persist();
  });

  el.resetBtn.addEventListener('click', () => {
    state = structuredClone(DEFAULT_STATE);
    paintForm();
    renderEffortList();
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
