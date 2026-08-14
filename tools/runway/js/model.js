/**
 * How long could I last? — the model.
 *
 * Pure functions, no DOM — the same shape as the other tools' model.js files.
 *
 * The naive version of this tool is `savings / essentials`, and it flatters
 * you: people can name their rent but chronically underestimate everything
 * else that leaves their account. The affordability tool already asks for
 * income and what gets saved in a normal month, so when both are known this
 * derives a second, more honest burn rate from what's left after saving —
 * `impliedBurn` — rather than trusting the stated essentials figure alone.
 * The gap between the two is itself the most useful number the tool
 * produces: money leaving the account that was never named.
 *
 * Everything runs in today's money, like tools/invest/. No growth on the
 * savings balance, no inflation, no tax on withdrawals — modelling any of
 * that half-heartedly would be worse than not modelling it at all.
 */

/** Months of essential spending a buffer should cover — the same bands the
 * affordability tool applies (BUFFER_TARGET_MONTHS / BUFFER_COMFORTABLE_MONTHS
 * in tools/affordability/js/model.js), duplicated rather than imported so
 * this tool's model stays self-contained, the way every other tool.js does. */
const LEAN_MONTHS = 1;
const TARGET_MONTHS = 3;
const COMFORTABLE_MONTHS = 6;
const OPTIONALITY_MONTHS = 12;

/** Sentinel for "income covers costs — there is no runway to measure." */
export const INDEFINITE = Infinity;

/**
 * Coerces before checking — form inputs hand back strings, and
 * `Number.isFinite` returns false for any string without parsing it first.
 */
export function toNumber(value, fallback = 0) {
  const num = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(num) ? num : fallback;
}

const clampPositive = (value) => Math.max(0, toNumber(value, 0));

/**
 * @typedef {object} Input
 * @property {number|string} savings         liquid savings available today
 * @property {number|string} essentials      monthly needs: housing, food, utilities
 * @property {number|string} debtPayments    existing monthly debt obligations
 * @property {number|string} income          monthly take-home while working
 * @property {number|string} monthlySaving   what gets saved in a normal month
 * @property {number|string} incomeWhileOff  income that would keep arriving anyway
 *   (a partner's income, benefits, freelance work) — optional
 */

/**
 * @param {Input} input
 * @param {{savings:boolean, essentials:boolean, income:boolean, monthlySaving:boolean}} [answered]
 *   which fields were actually filled in, keyed by Input property. A blank
 *   field is not the same as a zero — see tools/affordability/js/model.js's
 *   own `answered` map for why that distinction matters here too.
 */
export function derive(input, answered = {}) {
  const blank = (key) => answered[key] === false;

  const savings = clampPositive(input.savings);
  const essentials = clampPositive(input.essentials);
  const debtPayments = clampPositive(input.debtPayments);
  const income = clampPositive(input.income);
  const monthlySaving = clampPositive(input.monthlySaving);
  const incomeWhileOff = clampPositive(input.incomeWhileOff);

  const statedBurn = essentials + debtPayments;

  const incomeKnown = !blank('income') && !blank('monthlySaving') && income > 0;
  const impliedBurnRaw = income - monthlySaving;
  // Never let a stray form combination make the implied figure smaller than
  // the essentials the user actually named — that would be a worse number
  // than the honest one, not just a different one.
  const impliedBurn = incomeKnown ? Math.max(impliedBurnRaw, statedBurn) : null;
  const unaccounted = incomeKnown ? impliedBurn - statedBurn : 0;

  const burnKnown = incomeKnown || statedBurn > 0;
  const realBurn = incomeKnown ? impliedBurn : statedBurn;

  const netBurn = realBurn - incomeWhileOff;
  const leanNetBurn = statedBurn - incomeWhileOff;

  const months = burnKnown ? (netBurn > 0 ? savings / netBurn : INDEFINITE) : null;
  const leanMonths = statedBurn > 0 ? (leanNetBurn > 0 ? savings / leanNetBurn : INDEFINITE) : null;

  return {
    savings,
    essentials,
    debtPayments,
    income,
    monthlySaving,
    incomeWhileOff,
    statedBurn,
    incomeKnown,
    impliedBurn,
    unaccounted,
    burnKnown,
    realBurn,
    netBurn,
    leanNetBurn,
    months,
    leanMonths,
    ready: savings > 0 && burnKnown,
  };
}

function verdictFor(months) {
  if (months === INDEFINITE) {
    return {
      tone: 'good',
      badge: 'No runway problem',
      headline: 'Your income covers your costs',
      sub: 'There is nothing to run out of — the money coming in already clears what goes out.',
    };
  }
  if (months < LEAN_MONTHS) {
    return {
      tone: 'bad',
      badge: 'No cushion',
      headline: "You'd run out inside a month",
      sub: 'Any gap in income would hit immediately — this is worth fixing before anything else.',
    };
  }
  if (months < TARGET_MONTHS) {
    return {
      tone: 'bad',
      badge: 'Thin runway',
      headline: `${months < 1 ? 'Under a month' : `About ${months.toFixed(1)} months`} of runway`,
      sub: 'Under the three months most emergency-fund advice treats as a minimum.',
    };
  }
  if (months < COMFORTABLE_MONTHS) {
    return {
      tone: 'ok',
      badge: 'Meets the minimum',
      headline: `About ${months.toFixed(1)} months of runway`,
      sub: 'At or past the usual three-month floor, short of the six most planners call comfortable.',
    };
  }
  if (months < OPTIONALITY_MONTHS) {
    return {
      tone: 'good',
      badge: 'Comfortable',
      headline: `About ${months.toFixed(1)} months of runway`,
      sub: 'Past the six-month mark most advice treats as a solid emergency fund.',
    };
  }
  return {
    tone: 'good',
    badge: 'Real optionality',
    headline: `About ${Math.round(months)} months of runway`,
    sub: "Past a year — this is no longer just a safety net, it's room to make a choice.",
  };
}

/**
 * Extra months of runway a purchase decision is worth.
 * @param {ReturnType<typeof derive>} d
 * @param {{recurring:boolean, amount:number|string}} purchase
 * @returns {{months:number|null, newTotal:number}} months is null when netBurn
 *   is not knowable; newTotal mirrors INDEFINITE when the cut removes the burn entirely
 */
export function purchaseImpact(d, { recurring, amount }) {
  const value = clampPositive(amount);
  if (!d.burnKnown || value <= 0) return { months: null, newTotal: d.months };

  if (!recurring) {
    if (d.netBurn <= 0) return { months: 0, newTotal: INDEFINITE };
    const added = value / d.netBurn;
    return { months: added, newTotal: (d.months === INDEFINITE ? INDEFINITE : d.months + added) };
  }

  const newNetBurn = d.netBurn - value;
  const newTotal = newNetBurn > 0 ? d.savings / newNetBurn : INDEFINITE;
  const added = d.months === INDEFINITE || newTotal === INDEFINITE ? INDEFINITE : newTotal - d.months;
  return { months: added, newTotal };
}

/**
 * @param {Input} input
 * @param {{savings:boolean, essentials:boolean, income:boolean, monthlySaving:boolean}} [answered]
 */
export function evaluate(input, answered = {}) {
  const d = derive(input, answered);
  if (!d.ready) {
    return { ...d, verdict: null };
  }
  return { ...d, verdict: verdictFor(d.months) };
}

export const THRESHOLDS = { LEAN_MONTHS, TARGET_MONTHS, COMFORTABLE_MONTHS, OPTIONALITY_MONTHS };
