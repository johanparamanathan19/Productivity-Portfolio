/**
 * Pomodoro — a focus timer.
 *
 * This module owns the phase machine (focus → break → focus) and wires the
 * pieces together; the mechanics live in their own modules alongside it.
 */

import { initTheme, mountThemePicker } from '../../../assets/js/theme.js';
import { bindModals, isAnyModalOpen, openModal } from '../../../assets/js/modal.js';
import { showToast } from '../../../assets/js/toast.js';

import { DEFAULTS, LIMITS, MODE_META, MODES, RING_CIRCUMFERENCE } from './config.js';
import { resetSettings, resetStats, settings, updateSetting } from './state.js';
import { createCountdown } from './countdown.js';
import { createAudio } from './audio.js';
import { createConfetti } from './confetti.js';
import { createTaskList } from './tasks.js';
import { recordFocusSession, renderStats } from './stats.js';
import { notify, requestPermission } from './notify.js';

const IDLE_TITLE = 'Pomodoro — a focus timer';
const AUTO_START_DELAY_MS = 900;

const $ = (selector) => document.querySelector(selector);

const refs = {
  time: $('#time'),
  phaseLabel: $('#phase-label'),
  sprout: $('#sprout'),
  ring: $('.ring-progress'),
  roundDots: $('#round-dots'),
  startBtn: $('#start-btn'),
  startLabel: $('#start-btn .ctrl-label'),
  resetBtn: $('#reset-btn'),
  skipBtn: $('#skip-btn'),
  glider: $('.mode-glider'),
  modeTabs: [...document.querySelectorAll('.mode-tab')],

  taskForm: $('#task-form'),
  taskInput: $('#task-input'),
  estValue: $('#est-value'),

  settingsModal: $('#settings-modal'),
  statsModal: $('#stats-modal'),
  themeGrid: $('#theme-grid'),
  confetti: $('#confetti'),

  stats: {
    today: $('#stat-today'),
    focused: $('#stat-focused'),
    streak: $('#stat-streak'),
    total: $('#stat-total'),
    weekChart: $('#week-chart'),
    garden: $('#garden'),
  },
};

// ---------- Phase state ----------

/** @type {'focus'|'short'|'long'} */
let mode = 'focus';
/** Focus sessions completed since the last long break. */
let completedInCycle = 0;
/** Pomodoro estimate attached to the next task added. */
let pendingEstimate = 1;

const durationFor = (phase) => settings[phase] * 60;

// ---------- Collaborators ----------

const audio = createAudio(() => settings);
const confetti = createConfetti(refs.confetti);
const countdown = createCountdown({ onTick: handleTick, onFinish: handleFinish });
const taskList = createTaskList({
  list: $('#task-list'),
  meta: $('#tasks-meta'),
  emptyHint: $('#empty-hint'),
});

// ---------- Rendering ----------

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function paintRing() {
  const progress = countdown.duration > 0 ? 1 - countdown.remaining / countdown.duration : 0;
  refs.ring.style.strokeDashoffset = (RING_CIRCUMFERENCE * (1 - progress)).toFixed(2);

  // The sprout grows through a focus session and rests during breaks.
  const scale = mode === 'focus' ? 1 + progress * 0.9 : 1.15;
  refs.sprout.style.transform = `scale(${scale.toFixed(3)})`;
}

function renderRoundDots() {
  refs.roundDots.replaceChildren(
    ...Array.from({ length: settings.rounds }, (_, i) => {
      const dot = document.createElement('span');
      if (i < completedInCycle) dot.className = 'done';
      else if (i === completedInCycle && mode === 'focus') dot.className = 'current';
      return dot;
    }),
  );
}

function renderModeSwitch() {
  refs.glider.style.transform = `translateX(${MODES.indexOf(mode) * 100}%)`;
  refs.modeTabs.forEach((tab) => {
    const selected = tab.dataset.setMode === mode;
    tab.classList.toggle('is-active', selected);
    tab.setAttribute('aria-selected', String(selected));
  });
}

/** Start button label and the body class that drives the "running" animations. */
function renderControls() {
  document.body.classList.toggle('running', countdown.running);
  refs.startLabel.textContent = countdown.running
    ? 'Pause'
    : countdown.remaining < countdown.duration
      ? 'Resume'
      : 'Start';
}

function render() {
  refs.time.textContent = formatTime(countdown.remaining);
  refs.phaseLabel.textContent = MODE_META[mode].label;
  refs.sprout.textContent = MODE_META[mode].sprout;
  document.title = countdown.running
    ? `${formatTime(countdown.remaining)} · ${MODE_META[mode].short} — Pomodoro`
    : IDLE_TITLE;

  paintRing();
  renderRoundDots();
  renderControls();
}

// ---------- Timer control ----------

function setMode(next) {
  mode = next;
  countdown.reset();
  countdown.set(durationFor(mode));
  renderModeSwitch();
  render();
}

function start() {
  if (settings.notify) requestPermission();
  audio.resume(); // must happen inside the click gesture
  countdown.start();
  render();
}

function toggle() {
  if (countdown.running) countdown.pause();
  else start();
  render();
}

function handleTick() {
  render();
  if (settings.tick && mode === 'focus' && countdown.remaining > 0) audio.tick();
}

/** The next phase after `finished`, given how far through the cycle we are. */
function nextPhase(finished) {
  if (finished !== 'focus') return 'focus';
  return completedInCycle >= settings.rounds ? 'long' : 'short';
}

function handleFinish() {
  const finished = mode;

  if (finished === 'focus') {
    recordFocusSession();
    completedInCycle += 1;
    taskList.creditActive();
    confetti.launch();
  }
  audio.chime(finished === 'focus');

  const message =
    finished === 'focus'
      ? 'Focus complete — nice work. Time for a break 🌿'
      : 'Break over — ready to focus again? 🌱';
  showToast(message);
  notify(message);

  const next = nextPhase(finished);
  if (next === 'long') completedInCycle = 0;
  setMode(next);

  const autoStart = next === 'focus' ? settings.autoFocus : settings.autoBreak;
  if (autoStart) setTimeout(start, AUTO_START_DELAY_MS);
}

/** Advance manually — deliberately does not credit the unfinished session. */
function skip() {
  const next = mode === 'focus'
    ? (completedInCycle + 1 >= settings.rounds ? 'long' : 'short')
    : 'focus';
  setMode(next);
}

// ---------- Settings ----------

function syncSettingsInputs() {
  $('#dur-focus').value = settings.focus;
  $('#dur-short').value = settings.short;
  $('#dur-long').value = settings.long;
  $('#rounds').value = settings.rounds;
  $('#auto-break').checked = settings.autoBreak;
  $('#auto-focus').checked = settings.autoFocus;
  $('#sound-on').checked = settings.sound;
  $('#tick-on').checked = settings.tick;
  $('#notify-on').checked = settings.notify;
  $('#volume').value = settings.volume;
}

/** Reflect a duration change immediately when the timer is not mid-session. */
function refreshIdleDuration() {
  if (!countdown.running && durationFor(mode) !== countdown.duration) {
    countdown.set(durationFor(mode));
  }
  render();
}

function bindSettings() {
  const bindNumber = (selector, key) => {
    const [min, max] = LIMITS[key];
    $(selector).addEventListener('change', (event) => {
      const parsed = parseInt(event.target.value, 10);
      const value = Number.isNaN(parsed) ? DEFAULTS[key] : Math.min(max, Math.max(min, parsed));
      event.target.value = value;
      updateSetting(key, value);
      refreshIdleDuration();
    });
  };
  bindNumber('#dur-focus', 'focus');
  bindNumber('#dur-short', 'short');
  bindNumber('#dur-long', 'long');
  bindNumber('#rounds', 'rounds');

  const bindToggle = (selector, key) => {
    $(selector).addEventListener('change', (event) => {
      updateSetting(key, event.target.checked);
      if (key === 'notify' && event.target.checked) requestPermission();
    });
  };
  bindToggle('#auto-break', 'autoBreak');
  bindToggle('#auto-focus', 'autoFocus');
  bindToggle('#sound-on', 'sound');
  bindToggle('#tick-on', 'tick');
  bindToggle('#notify-on', 'notify');

  $('#volume').addEventListener('input', (event) => {
    updateSetting('volume', parseInt(event.target.value, 10));
  });
  // Preview the new level once the user lets go of the slider.
  $('#volume').addEventListener('change', () => audio.chime(true));

  $('#reset-defaults').addEventListener('click', () => {
    resetSettings();
    syncSettingsInputs();
    countdown.reset();
    countdown.set(durationFor(mode));
    render();
    showToast('Settings reset to defaults');
  });
}

// ---------- Stats ----------

function openStats() {
  renderStats(refs.stats, settings.focus);
  openModal(refs.statsModal);
}

// ---------- Events ----------

function bindEvents() {
  refs.startBtn.addEventListener('click', toggle);
  refs.resetBtn.addEventListener('click', () => {
    countdown.reset();
    render();
  });
  refs.skipBtn.addEventListener('click', skip);
  refs.modeTabs.forEach((tab) => tab.addEventListener('click', () => setMode(tab.dataset.setMode)));

  $('#settings-btn').addEventListener('click', () => openModal(refs.settingsModal));
  $('#stats-btn').addEventListener('click', openStats);
  $('#reset-stats').addEventListener('click', () => {
    resetStats();
    renderStats(refs.stats, settings.focus);
    showToast('Statistics cleared');
  });

  // Estimate stepper on the add-task form
  document.querySelectorAll('.est-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      pendingEstimate = Math.min(20, Math.max(1, pendingEstimate + Number(btn.dataset.est)));
      refs.estValue.textContent = String(pendingEstimate);
    });
  });

  refs.taskForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = refs.taskInput.value.trim();
    if (!text) return;

    taskList.add(text, pendingEstimate);
    refs.taskInput.value = '';
    pendingEstimate = 1;
    refs.estValue.textContent = '1';
    refs.taskInput.focus();
  });

  document.addEventListener('keydown', (event) => {
    const isTyping = /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
    if (isTyping || isAnyModalOpen([refs.settingsModal, refs.statsModal])) return;

    if (event.code === 'Space') {
      event.preventDefault();
      toggle();
    } else if (event.key === 'r' || event.key === 'R') {
      countdown.reset();
      render();
    } else if (event.key === 's' || event.key === 'S') {
      skip();
    }
  });

  // Background tabs throttle timers; catch up as soon as we are visible again.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) countdown.sync();
  });
}

// ---------- Init ----------

function init() {
  initTheme();
  refs.ring.style.strokeDasharray = RING_CIRCUMFERENCE.toFixed(2);

  mountThemePicker(refs.themeGrid);
  bindModals([refs.settingsModal, refs.statsModal]);
  syncSettingsInputs();
  bindSettings();
  bindEvents();

  refs.estValue.textContent = String(pendingEstimate);
  taskList.render();
  setMode('focus');
}

init();
