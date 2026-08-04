/** Constants shared across the timer's modules. */

/** Matches r=132 on the progress circle in index.html. */
export const RING_RADIUS = 132;
export const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** Phase order, which is also the order of the tabs in the mode switch. */
export const MODES = ['focus', 'short', 'long'];

export const MODE_META = {
  focus: { label: 'Time to focus', short: 'Focus', sprout: '🌱' },
  short: { label: 'Take a breather', short: 'Short Break', sprout: '🍃' },
  long: { label: 'Rest and reset', short: 'Long Break', sprout: '🌳' },
};

/** Durations are in minutes; `rounds` is focus sessions per long break. */
export const DEFAULTS = {
  focus: 25,
  short: 5,
  long: 15,
  rounds: 4,
  autoBreak: false,
  autoFocus: false,
  sound: true,
  tick: false,
  notify: false,
  volume: 60,
};

/** Allowed ranges for the numeric settings inputs. */
export const LIMITS = {
  focus: [1, 180],
  short: [1, 60],
  long: [1, 90],
  rounds: [2, 12],
};

/**
 * Deliberately still namespaced `grove.*`, the tool's former name. Renaming
 * these would orphan the settings, tasks, and focus history of anyone who
 * has already used it.
 */
export const STORAGE_KEYS = {
  settings: 'grove.settings',
  tasks: 'grove.tasks',
  stats: 'grove.stats',
};

export const EMPTY_STATS = { total: 0, days: {}, streak: 0, lastDay: null };
