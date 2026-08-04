/**
 * Persisted state for the timer.
 *
 * The exported bindings are live: importers always read the current value,
 * but they mutate through the functions here so every change is written to
 * storage in one place.
 */

import { load, save } from '../../../assets/js/store.js';
import { DEFAULTS, EMPTY_STATS, STORAGE_KEYS } from './config.js';

/** Builds before the portfolio refactor stored `done_pomos`. */
function normalizeTask({ done_pomos: legacyPomos, ...task }) {
  return { ...task, donePomos: task.donePomos ?? legacyPomos ?? 0 };
}

export let settings = { ...DEFAULTS, ...load(STORAGE_KEYS.settings, {}) };
export let tasks = load(STORAGE_KEYS.tasks, []).map(normalizeTask);
export let stats = { ...EMPTY_STATS, ...load(STORAGE_KEYS.stats, {}) };

// ---------- Settings ----------

export function saveSettings() {
  save(STORAGE_KEYS.settings, settings);
}

/**
 * @param {keyof typeof DEFAULTS} key
 * @param {number|boolean} value
 */
export function updateSetting(key, value) {
  settings[key] = value;
  saveSettings();
}

export function resetSettings() {
  settings = { ...DEFAULTS };
  saveSettings();
}

// ---------- Tasks ----------

export function saveTasks() {
  save(STORAGE_KEYS.tasks, tasks);
}

/** @param {Array} next replaces the whole list (used by add/delete) */
export function setTasks(next) {
  tasks = next;
  saveTasks();
}

// ---------- Stats ----------

export function saveStats() {
  save(STORAGE_KEYS.stats, stats);
}

export function resetStats() {
  stats = { ...EMPTY_STATS, days: {} };
  saveStats();
}
