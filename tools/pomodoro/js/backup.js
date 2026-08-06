/**
 * Backup and restore.
 *
 * Sessions already persist to localStorage on their own — this exists for the
 * cases localStorage cannot survive: clearing site data, a new machine, a
 * different browser.
 *
 * Restoring **merges** rather than replaces. Overwriting someone's focus
 * history from a file they picked in a hurry is not a recoverable mistake, so
 * the operation is built to be incapable of losing anything: per-day counts
 * take the larger of the two values, and tasks are matched on id.
 */

import { stats, tasks, saveStats, setTasks } from './state.js';
import { recountFromDays } from './stats.js';

const FORMAT = 'pomodoro-backup';
const VERSION = 1;

/** @returns {string} the JSON a backup file contains */
export function buildBackup() {
  return JSON.stringify(
    {
      format: FORMAT,
      version: VERSION,
      exportedAt: new Date().toISOString(),
      stats,
      tasks,
    },
    null,
    2,
  );
}

/** Hand the user a file. Same-origin blob, so no network involved. */
export function downloadBackup() {
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([buildBackup()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `pomodoro-backup-${stamp}.json`;
  document.body.append(link);
  link.click();
  link.remove();

  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * A file the user picked is untrusted input — it may be any JSON at all, or
 * not JSON. Every field is checked before it is allowed near stored state.
 *
 * @param {string} text
 * @returns {{ok: true, days: object, tasks: Array} | {ok: false, error: string}}
 */
export function parseBackup(text) {
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' };
  }

  if (!payload || typeof payload !== 'object' || payload.format !== FORMAT) {
    return { ok: false, error: 'That does not look like a Pomodoro backup.' };
  }

  const rawDays = payload.stats && typeof payload.stats === 'object' ? payload.stats.days : null;
  const days = {};
  if (rawDays && typeof rawDays === 'object') {
    Object.entries(rawDays).forEach(([key, count]) => {
      // Keys are local YYYY-MM-DD; counts are whole non-negative sessions.
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return;
      const n = Math.floor(Number(count));
      if (Number.isFinite(n) && n > 0) days[key] = n;
    });
  }

  const incomingTasks = Array.isArray(payload.tasks)
    ? payload.tasks
        .filter((t) => t && typeof t === 'object' && typeof t.id === 'string' && typeof t.text === 'string')
        .map((t) => ({
          id: t.id,
          text: String(t.text).slice(0, 200),
          est: Math.max(1, Math.floor(Number(t.est)) || 1),
          donePomos: Math.max(0, Math.floor(Number(t.donePomos)) || 0),
          done: Boolean(t.done),
        }))
    : [];

  if (!Object.keys(days).length && !incomingTasks.length) {
    return { ok: false, error: 'That backup has nothing in it.' };
  }

  return { ok: true, days, tasks: incomingTasks };
}

/**
 * Fold a parsed backup into what is already stored.
 * @returns {{days: number, tasks: number}} how much was new
 */
export function applyBackup({ days, tasks: incomingTasks }) {
  let changedDays = 0;
  Object.entries(days).forEach(([key, count]) => {
    const existing = stats.days[key] || 0;
    // Larger-of-the-two, so importing the same file twice is a no-op rather
    // than doubling a day's count.
    if (count > existing) {
      stats.days[key] = count;
      changedDays += 1;
    }
  });

  recountFromDays();
  saveStats();

  const known = new Set(tasks.map((t) => t.id));
  const newTasks = incomingTasks.filter((t) => !known.has(t.id));
  if (newTasks.length) setTasks([...tasks, ...newTasks]);

  return { days: changedDays, tasks: newTasks.length };
}
