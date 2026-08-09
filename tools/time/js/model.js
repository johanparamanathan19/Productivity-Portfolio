/**
 * How much time do I spend? — the model.
 *
 * Pure functions, no DOM — the same shape as the affordability tool's
 * model.js, for the same reason: the arithmetic should be readable and
 * testable on its own, not scattered through event handlers.
 *
 * The core idea: a year is a fixed budget of hours, exactly like a paycheque
 * is a fixed budget of money in the affordability tool. Every category is a
 * claim against that budget; whatever nobody claims is either free time or
 * time nobody has counted yet, and that number is usually the point.
 */

/** 365 days × 24 hours. Deliberately not fussed over for leap years. */
export const HOURS_PER_YEAR = 8760;

const DAYS_PER_YEAR = 365;
const WEEKS_PER_YEAR = 52;

/** Assumed only when the user has not filled in their own Work hours. */
const STANDARD_WORK_HOURS_PER_YEAR = 2080; // 40 hours × 52 weeks

export const UNITS = [
  { id: 'day', label: 'a day', toYearly: (h) => h * DAYS_PER_YEAR },
  { id: 'week', label: 'a week', toYearly: (h) => h * WEEKS_PER_YEAR },
  { id: 'year', label: 'a year', toYearly: (h) => h },
];

const unitById = (id) => UNITS.find((u) => u.id === id) || UNITS[1];

/**
 * The fixed master order color and adjacency depend on. Colors are assigned
 * to a *contiguous prefix* of whichever of these actually have hours entered
 * — see assignColorSlots() — so on-screen neighbours are always a subset of
 * the palette's validated adjacent pairs, never an arbitrary pair.
 *
 * `special` categories are computed, not entered — see deriveSpecial().
 */
export const PRESET_CATEGORIES = [
  { id: 'sleep', label: 'Sleep', icon: '😴', unit: 'day' },
  { id: 'work', label: 'Work', icon: '💼', unit: 'week' },
  { id: 'commute', label: 'Commuting', icon: '🚗', unit: 'week' },
  { id: 'chores', label: 'Chores & errands', icon: '🧺', unit: 'week' },
  { id: 'screens', label: 'Screens & entertainment', icon: '📱', unit: 'day' },
  { id: 'exercise', label: 'Exercise & health', icon: '🏃', unit: 'week' },
  { id: 'social', label: 'Friends, family & hobbies', icon: '👥', unit: 'week' },
];

/**
 * Rough starting numbers for the "load a typical week" shortcut. These are
 * illustrative placeholders to edit, not a cited statistic — the tool has no
 * verified source for anyone's actual time use, including yours.
 */
export const TYPICAL_WEEK = {
  sleep: 8, // per day
  work: 40,
  commute: 5,
  chores: 6,
  screens: 2.5, // per day
  exercise: 3,
  social: 5,
};

/**
 * Coerces before checking — form inputs hand back strings (`el.value` is
 * always a string, even for `type="number"`), and `Number.isFinite` returns
 * false for any string without parsing it first. Every raw value in this
 * model passes through here specifically so callers never have to remember
 * to pre-convert their own form state.
 */
const clampPositive = (n) => {
  const num = typeof n === 'number' ? n : parseFloat(n);
  return Number.isFinite(num) && num > 0 ? num : 0;
};

/** @returns {number} yearly hours for one entry */
export function toYearlyHours(value, unitId) {
  return unitById(unitId).toYearly(clampPositive(value));
}

/**
 * @typedef {object} CategoryInput
 * @property {string} id
 * @property {string} label
 * @property {string} icon
 * @property {boolean} custom
 * @property {number} value   raw entered number, in its own unit
 * @property {string} unit    'day' | 'week' | 'year'
 */

/**
 * @param {number} salaryYearly  after-tax yearly income; 0 if not entered
 * @param {CategoryInput[]} categories
 * @returns {{hourlyRate: number, usingFallback: boolean, yearlyWorkHours: number}}
 */
export function deriveHourlyRate(salaryYearly, categories) {
  const work = categories.find((c) => c.id === 'work');
  const enteredWorkHours = work ? toYearlyHours(work.value, work.unit) : 0;
  const usingFallback = enteredWorkHours <= 0;
  const yearlyWorkHours = usingFallback ? STANDARD_WORK_HOURS_PER_YEAR : enteredWorkHours;

  return {
    hourlyRate: salaryYearly > 0 ? salaryYearly / yearlyWorkHours : 0,
    usingFallback,
    yearlyWorkHours,
  };
}

/**
 * Assign palette slot indices (0-based) to categories, in a *contiguous
 * prefix* of a fixed master order — never skipping a slot to reach one
 * further along. That is what keeps every on-screen neighbour a pair the
 * palette was actually validated on: dropping entries from the front of a
 * validated adjacent run leaves the remaining run still validated, but
 * *skipping* one into the middle would create a pair nobody checked.
 *
 * Custom categories share one slot (the 8th) in creation order; a second
 * custom category, and any preset beyond the master order, folds into an
 * unslotted "Other" bucket rendered in a neutral, non-palette tone.
 */
export function assignColorSlots(masterOrderIds, presentIds) {
  const slots = new Map();
  let next = 0;

  for (const id of masterOrderIds) {
    if (next >= 8) break;
    if (presentIds.includes(id)) slots.set(id, next++);
  }
  return slots;
}

/**
 * @param {number} salaryYearly
 * @param {CategoryInput[]} categories
 */
export function evaluate(salaryYearly, categories) {
  const salary = clampPositive(salaryYearly);
  const rate = deriveHourlyRate(salary, categories);

  const rows = categories
    .map((c) => {
      const yearlyHours = toYearlyHours(c.value, c.unit);
      return {
        id: c.id,
        label: c.label,
        icon: c.icon,
        custom: Boolean(c.custom),
        unit: c.unit,
        rawValue: clampPositive(c.value),
        yearlyHours,
        dailyHours: yearlyHours / DAYS_PER_YEAR,
        weeklyHours: yearlyHours / WEEKS_PER_YEAR,
        moneyValue: rate.hourlyRate * yearlyHours,
      };
    })
    .filter((r) => r.yearlyHours > 0);

  const allocatedHours = rows.reduce((sum, r) => sum + r.yearlyHours, 0);
  const unaccountedHours = Math.max(0, HOURS_PER_YEAR - allocatedHours);
  const overBudgetHours = Math.max(0, allocatedHours - HOURS_PER_YEAR);

  // Contiguous-prefix colour assignment, per the note on assignColorSlots().
  const masterOrder = [...PRESET_CATEGORIES.map((c) => c.id), ...rows.filter((r) => r.custom).map((r) => r.id)];
  const presentIds = rows.map((r) => r.id);
  const slots = assignColorSlots(masterOrder, presentIds);

  const withSlots = rows.map((r) => ({ ...r, slot: slots.has(r.id) ? slots.get(r.id) : null }));

  return {
    ready: allocatedHours > 0,
    hourlyRate: rate.hourlyRate,
    usingFallbackWorkHours: rate.usingFallback,
    yearlyWorkHours: rate.yearlyWorkHours,
    salaryYearly: salary,
    rows: withSlots,
    allocatedHours,
    unaccountedHours,
    overBudgetHours,
    unaccountedMoneyValue: rate.hourlyRate * unaccountedHours,
    insights: buildInsights({ rows: withSlots, allocatedHours, unaccountedHours, overBudgetHours, hourlyRate: rate.hourlyRate }),
  };
}

function findRow(rows, id) {
  return rows.find((r) => r.id === id);
}

/** Short, honest observations — nothing here is a claim about "the average person". */
function buildInsights({ rows, unaccountedHours, overBudgetHours, hourlyRate }) {
  const insights = [];

  if (overBudgetHours > 0) {
    return insights; // the banner already carries this; don't repeat it as an insight
  }

  const sleep = findRow(rows, 'sleep');
  const work = findRow(rows, 'work');
  if (sleep && work) {
    const free = Math.max(0, HOURS_PER_YEAR - sleep.yearlyHours - work.yearlyHours);
    insights.push({
      label: 'Outside sleep and work',
      text: `About ${Math.round(free).toLocaleString()} hours a year are left once sleep and work are accounted for — roughly ${(free / DAYS_PER_YEAR).toFixed(1)} hours on an average day.`,
    });
  }

  const discretionary = rows
    .filter((r) => r.id !== 'sleep' && r.id !== 'work')
    .sort((a, b) => b.yearlyHours - a.yearlyHours)[0];
  if (discretionary) {
    const moneyBit = hourlyRate > 0 ? `, worth roughly ${Math.round(discretionary.moneyValue).toLocaleString()} a year at your rate` : '';
    insights.push({
      label: 'Where the rest goes',
      text: `Outside sleep and work, ${discretionary.label.toLowerCase()} takes the most — about ${Math.round(discretionary.yearlyHours).toLocaleString()} hours a year${moneyBit}.`,
    });
  }

  if (unaccountedHours > 100 && hourlyRate > 0) {
    insights.push({
      label: 'The unaccounted time',
      text: `${Math.round(unaccountedHours).toLocaleString()} hours a year are not claimed by anything above — at your rate, that stretch alone is worth about ${Math.round(unaccountedHours * hourlyRate).toLocaleString()}.`,
    });
  } else if (unaccountedHours > 100) {
    insights.push({
      label: 'The unaccounted time',
      text: `${Math.round(unaccountedHours).toLocaleString()} hours a year are not claimed by anything above yet — either genuinely free time, or things you have not logged.`,
    });
  }

  return insights;
}
