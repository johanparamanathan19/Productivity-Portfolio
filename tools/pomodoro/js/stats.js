/**
 * Focus history: a per-day session count, an all-time total, and a streak.
 */

import { stats, saveStats } from './state.js';

/** Local-time YYYY-MM-DD. Deliberately not ISO/UTC — "today" is the user's. */
export function dayKey(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function daysAgo(n) {
  const date = new Date();
  date.setDate(date.getDate() - n);
  return date;
}

/** Record one completed focus session and roll the streak forward. */
export function recordFocusSession() {
  const today = dayKey();

  stats.total = (stats.total || 0) + 1;
  stats.days[today] = (stats.days[today] || 0) + 1;

  // Only the first session of a day moves the streak.
  if (stats.lastDay !== today) {
    const yesterday = dayKey(daysAgo(1));
    stats.streak = stats.lastDay === yesterday ? (stats.streak || 0) + 1 : 1;
    stats.lastDay = today;
  }

  saveStats();
}

function renderWeekChart(container) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const date = daysAgo(i);
    days.push({
      count: stats.days[dayKey(date)] || 0,
      label: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][date.getDay()],
    });
  }

  const max = Math.max(1, ...days.map((d) => d.count));
  container.replaceChildren(
    ...days.map((day) => {
      const col = document.createElement('div');
      col.className = 'week-col';
      col.title = `${day.count} session${day.count === 1 ? '' : 's'}`;

      const bar = document.createElement('div');
      bar.className = 'week-bar' + (day.count ? '' : ' empty');
      bar.style.height = '0';

      const label = document.createElement('div');
      label.className = 'week-day';
      label.textContent = day.label;

      col.append(bar, label);

      // Animate from zero once the element is in the document.
      requestAnimationFrame(() => {
        bar.style.height = day.count ? `${Math.max(6, (day.count / max) * 100)}%` : '4px';
      });
      return col;
    }),
  );
}

const GROWTH_STAGES = ['🌱', '🌿', '🌳'];

function renderGrove(container, count) {
  if (!count) {
    const hint = document.createElement('span');
    hint.className = 'grove-empty';
    hint.textContent = 'No sessions yet today — plant your first 🌱';
    container.replaceChildren(hint);
    return;
  }

  // Cap the render; beyond ~60 sprouts the row stops being readable.
  const shown = Math.min(count, 60);
  container.replaceChildren(
    ...Array.from({ length: shown }, (_, i) => {
      const sprout = document.createElement('span');
      sprout.textContent = GROWTH_STAGES[Math.min(2, Math.floor(i / 4))];
      sprout.style.animationDelay = `${i * 40}ms`;
      return sprout;
    }),
  );
}

/**
 * @param {object} refs elements inside the stats modal
 * @param {number} focusMinutes the current focus duration, for the "focused today" sum
 */
export function renderStats(refs, focusMinutes) {
  const today = stats.days[dayKey()] || 0;

  refs.today.textContent = String(today);
  refs.focused.textContent = `${today * focusMinutes}m`;
  refs.streak.textContent = String(stats.streak || 0);
  refs.total.textContent = String(stats.total || 0);

  renderWeekChart(refs.weekChart);
  renderGrove(refs.grove, today);
}
