/**
 * Is this offer worth it? — the model.
 *
 * Pure functions, no DOM — the same shape as the affordability and time
 * tools' model.js files.
 *
 * Implements Alex Hormozi's Value Equation from $100M Offers (2021):
 *
 *   Value = (Dream Outcome × Perceived Likelihood of Achievement)
 *           ----------------------------------------------------
 *                  (Time Delay × Effort & Sacrifice)
 *
 * The book uses this as a mental model for designing offers — maximise the
 * top, minimise the bottom — not as a calibrated formula with real units.
 * There is no ground truth for "how much you want something." This tool
 * turns it into a repeatable score anyway, on the book's own terms.
 */

const LEVEL_MIN = 1;
const LEVEL_MAX = 10;

const clampLevel = (n) => {
  const num = typeof n === 'number' ? n : parseFloat(n);
  if (!Number.isFinite(num)) return LEVEL_MIN;
  return Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, num));
};

/**
 * Anchor text for the two feel-based sliders, so a bare "6/10" never has to
 * stand on its own — every value on the slider maps to a plain-language
 * example of what that level of wanting or believing looks like.
 */
export const DREAM_OUTCOME_LEVELS = [
  { max: 2, text: 'Mildly curious. Nothing changes in your life if you skip this.' },
  { max: 4, text: "Would be nice to have, but you're not chasing it." },
  { max: 6, text: 'You genuinely want this outcome.' },
  { max: 8, text: 'This is high on your list right now.' },
  { max: 10, text: "Exactly what you've been wanting most." },
];

export const LIKELIHOOD_LEVELS = [
  { max: 2, text: "You doubt it will actually work, for you specifically." },
  { max: 4, text: 'Skeptical — the claims outrun the proof on offer.' },
  { max: 6, text: 'Plausible. No strong reason to believe or disbelieve it.' },
  { max: 8, text: 'You believe this will work — there is evidence behind it.' },
  { max: 10, text: "You're nearly certain. A guarantee, a track record, or both." },
];

/** @returns {string} the example text for whichever bucket `value` falls into */
export function describeLevel(value, levels) {
  const v = clampLevel(value);
  return (levels.find((l) => v <= l.max) || levels[levels.length - 1]).text;
}

/** Shared anchor text for the two computed "cost" scores — delay and effort. */
export const COST_LEVELS = [
  { max: 2, text: 'Barely any friction — close to the best case.' },
  { max: 4, text: 'A small, manageable cost.' },
  { max: 6, text: 'A real cost — worth being honest about.' },
  { max: 8, text: 'A significant cost.' },
  { max: 10, text: 'About as costly as this gets.' },
];

/** Units for the Time Delay question — converted to days for the score below. */
export const DELAY_UNITS = [
  { id: 'hours', label: 'hours', toDays: (n) => n / 24 },
  { id: 'days', label: 'days', toDays: (n) => n },
  { id: 'weeks', label: 'weeks', toDays: (n) => n * 7 },
  { id: 'months', label: 'months', toDays: (n) => n * 30 },
  { id: 'years', label: 'years', toDays: (n) => n * 365 },
];

const delayUnitById = (id) => DELAY_UNITS.find((u) => u.id === id) || DELAY_UNITS[1];

/**
 * Time Delay score, 1 (instant) to 10 (2+ years). Log-scaled because the
 * felt difference between "1 day vs 1 week" is much larger than between
 * "13 months vs 14 months" — a linear scale would flatten the exact part
 * of the range most real offers live in.
 */
export function delayScore(value, unitId) {
  const raw = typeof value === 'number' ? value : parseFloat(value);
  const days = Number.isFinite(raw) && raw > 0 ? delayUnitById(unitId).toDays(raw) : 0;
  const ratio = Math.log10(days + 1) / Math.log10(731); // 731 days ≈ 2 years, the score-10 anchor
  return clampLevel(1 + 9 * Math.min(1, Math.max(0, ratio)));
}

/**
 * Effort & Sacrifice checklist. Each item is a concrete cost someone can
 * recognise in their own situation, rather than an abstract "how much
 * effort, 1–10" slider — the same lesson the affordability tool learned
 * about "take-home pay" being too abstract to answer confidently.
 */
export const EFFORT_ITEMS = [
  { id: 'daily', label: 'Needs ongoing effort or discipline — a daily or weekly habit', weight: 2 },
  { id: 'giveup', label: 'Means giving up something you currently enjoy', weight: 2 },
  { id: 'uncomfortable', label: 'Feels socially uncomfortable, or asks for vulnerability', weight: 2 },
  { id: 'others', label: "Depends on other people's cooperation or schedules", weight: 1.5 },
  { id: 'skill', label: 'Requires learning a skill from scratch', weight: 1.5 },
  { id: 'money', label: 'Costs more money beyond the price — gear, travel, subscriptions', weight: 1 },
];

/** @param {string[]} checkedIds */
export function effortScore(checkedIds) {
  const ids = checkedIds || [];
  const sum = EFFORT_ITEMS.filter((item) => ids.includes(item.id)).reduce((total, item) => total + item.weight, 0);
  return clampLevel(1 + sum);
}

/** Ready-made scenarios for the "try an example" row — span weak, fair, and strong on purpose. */
export const EXAMPLES = [
  {
    id: 'gym',
    name: 'A $40/month gym membership',
    dreamOutcome: 6,
    likelihood: 4,
    delayValue: 3,
    delayUnit: 'months',
    effortChecked: ['daily', 'giveup'],
  },
  {
    id: 'coaching',
    name: 'A 12-week coaching program with a guarantee',
    dreamOutcome: 8,
    likelihood: 8,
    delayValue: 2,
    delayUnit: 'weeks',
    effortChecked: ['money'],
  },
  {
    id: 'webinar',
    name: 'A free webinar pitching a $2,000 course',
    dreamOutcome: 7,
    likelihood: 3,
    delayValue: 6,
    delayUnit: 'months',
    effortChecked: ['daily', 'skill', 'money'],
  },
];

function leverStrengths({ dreamOutcome, likelihood, delay, effort }) {
  // Each normalised to 0–1 where higher is always better, so the four are
  // comparable on one scale regardless of which side of the equation they're on.
  return {
    dreamOutcome: dreamOutcome / LEVEL_MAX,
    likelihood: likelihood / LEVEL_MAX,
    delay: (LEVEL_MAX + LEVEL_MIN - delay) / LEVEL_MAX,
    effort: (LEVEL_MAX + LEVEL_MIN - effort) / LEVEL_MAX,
  };
}

const LEVER_ADVICE = {
  dreamOutcome: {
    label: 'The outcome itself',
    text: "This isn't pulling much weight yet. Would you want the result more if it were bigger, more specific, or more personal to you?",
  },
  likelihood: {
    label: 'Your belief it will work',
    text: 'Doubt is the biggest drag here. A guarantee, a specific testimonial from someone like you, or a trial run moves this more than persuasion does.',
  },
  delay: {
    label: 'The wait',
    text: 'Time is the biggest cost here. Ask whether a faster first win is available — even a small one — before committing to wait for the whole outcome.',
  },
  effort: {
    label: 'The effort required',
    text: 'The work this asks of you outweighs the rest. Would paying more to have part of it done for you change the answer?',
  },
};

function findWeakestLever(strengths) {
  return Object.entries(strengths).sort((a, b) => a[1] - b[1])[0][0];
}

/**
 * raw ranges from 0.01 (worst: D=L=1, T=E=10) to 100 (best: D=L=10, T=E=1).
 * Log-mapped onto 0–100 so that score 50 sits exactly at raw = 1 — the
 * point where the numerator and denominator are equal — rather than at
 * some arbitrary spot the raw scale happens to produce.
 */
function scoreFromRaw(raw) {
  const ratio = (Math.log10(raw) + 2) / 4; // log10(0.01) = -2, log10(100) = 2
  return Math.round(Math.min(1, Math.max(0, ratio)) * 100);
}

function verdictFromScore(score) {
  if (score >= 75) {
    return {
      tone: 'good',
      badge: 'Exceptional',
      headline: 'worth saying yes to',
      sub: 'The outcome and your belief in it clearly outweigh the wait and the work.',
    };
  }
  if (score >= 55) {
    return {
      tone: 'good',
      badge: 'Strong',
      headline: 'a good offer',
      sub: 'More is pulling you toward this than away from it.',
    };
  }
  if (score >= 35) {
    return {
      tone: 'ok',
      badge: 'Fair',
      headline: 'could go either way',
      sub: 'Nothing here is clearly wrong — but nothing makes it obvious either.',
    };
  }
  return {
    tone: 'bad',
    badge: 'Weak',
    headline: 'hard to justify as it stands',
    sub: 'The wait, the effort, or your own doubt outweighs the outcome.',
  };
}

/**
 * @param {object} input
 * @param {number} input.dreamOutcome   1–10 slider
 * @param {number} input.likelihood     1–10 slider
 * @param {number|string} input.delayValue  raw number, in delayUnit
 * @param {string} input.delayUnit      one of DELAY_UNITS' ids
 * @param {string[]} input.effortChecked  ids from EFFORT_ITEMS
 */
export function evaluate({ dreamOutcome, likelihood, delayValue, delayUnit, effortChecked }) {
  const D = clampLevel(dreamOutcome);
  const L = clampLevel(likelihood);
  const T = delayScore(delayValue, delayUnit);
  const E = effortScore(effortChecked);

  const raw = (D * L) / (T * E);
  const score = scoreFromRaw(raw);
  const verdict = verdictFromScore(score);

  const strengths = leverStrengths({ dreamOutcome: D, likelihood: L, delay: T, effort: E });
  const weakestId = findWeakestLever(strengths);

  return {
    D,
    L,
    T,
    E,
    raw,
    score,
    verdict,
    weakest: { id: weakestId, ...LEVER_ADVICE[weakestId] },
  };
}
