/**
 * Buy it, or invest it? — the model.
 *
 * Pure functions, no DOM — the same shape as the other tools' model.js files.
 *
 * Everything here is in **real (inflation-adjusted) terms**, i.e. today's
 * money. That choice runs through the whole model:
 *
 *   - the return is a real return, so a future figure buys what it says today
 *   - the item's price is held constant, because in real terms it roughly is
 *   - depreciation is real depreciation
 *
 * The alternative — nominal returns — produces bigger, more exciting numbers
 * that quietly overstate what they'd actually buy. This tool would rather be
 * boring and right.
 */

const MONTHS_PER_YEAR = 12;

/**
 * Long-run real (after-inflation) return for a broad stock index, as a
 * percentage. ~7% is the figure most commonly cited for long-run US large-cap
 * equity after inflation; it is a historical average over many decades, not a
 * forecast, and any given decade can miss it badly in either direction. The
 * band either side is what makes that uncertainty visible instead of implied.
 */
export const DEFAULT_REAL_RETURN = 7;

/** How far the pessimistic/optimistic band sits either side of the mid rate. */
const BAND_SPREAD = 3;

export const MIN_RETURN = 0;
export const MAX_RETURN = 15;

/**
 * Annual real depreciation by category — rules of thumb, not measurements.
 * They exist so nobody has to answer "what will this be worth in six years?"
 * off the top of their head, which is the same problem "take-home pay" had in
 * the affordability tool. Every one is editable via the custom option.
 */
export const CATEGORIES = [
  { id: 'consumed', label: 'Experience or consumable', icon: '🍽️', rate: 1, note: 'Holidays, meals out, concerts, subscriptions — worth nothing afterwards, by design.' },
  { id: 'clothing', label: 'Clothing', icon: '👕', rate: 0.4, note: 'Loses most of its resale value quickly.' },
  { id: 'electronics', label: 'Electronics', icon: '💻', rate: 0.25, note: 'Phones, laptops, TVs — steady decline, and they date fast.' },
  { id: 'carNew', label: 'Car (new)', icon: '🚗', rate: 0.2, note: 'The steepest drop is in the first year or two.' },
  { id: 'carUsed', label: 'Car (used)', icon: '🚙', rate: 0.12, note: 'Already took the worst of the hit before you bought it.' },
  { id: 'furniture', label: 'Furniture', icon: '🛋️', rate: 0.15, note: 'Holds up physically, but the second-hand market is thin.' },
  { id: 'equipment', label: 'Tools, bikes & instruments', icon: '🔧', rate: 0.1, note: 'Well-made kit holds value better than most things.' },
  { id: 'jewellery', label: 'Jewellery & watches', icon: '💍', rate: 0.03, note: 'Roughly holds its value in real terms — rarely gains, despite the stories.' },
  { id: 'custom', label: 'Something else', icon: '📦', rate: 0.15, note: 'Set your own rate below.' },
];

export const FREQUENCIES = [
  { id: 'daily', label: 'a day', perYear: 365 },
  { id: 'weekly', label: 'a week', perYear: 52 },
  { id: 'monthly', label: 'a month', perYear: 12 },
  { id: 'yearly', label: 'a year', perYear: 1 },
];

const categoryById = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[0];
const frequencyById = (id) => FREQUENCIES.find((f) => f.id === id) || FREQUENCIES[2];

/**
 * Coerces before checking — form inputs hand back strings, and
 * `Number.isFinite` returns false for any string without parsing it first.
 * (The time tool shipped this bug once; every raw value here goes through
 * one guard so it cannot happen again.)
 */
export function toNumber(value, fallback = 0) {
  const num = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(num) ? num : fallback;
}

const clampPositive = (value) => Math.max(0, toNumber(value, 0));

/** The three return rates the chart draws, as decimals. */
export function returnBand(midPercent) {
  const mid = Math.min(MAX_RETURN, Math.max(MIN_RETURN, toNumber(midPercent, DEFAULT_REAL_RETURN)));
  return {
    low: Math.max(0, mid - BAND_SPREAD) / 100,
    mid: mid / 100,
    high: (mid + BAND_SPREAD) / 100,
  };
}

/** Resolve the depreciation rate actually in force, as a decimal 0–1. */
export function depreciationRate(categoryId, customPercent) {
  if (categoryId === 'custom') {
    return Math.min(1, Math.max(0, toNumber(customPercent, 15) / 100));
  }
  return categoryById(categoryId).rate;
}

/**
 * Normalise any recurring amount to a monthly one, so the whole model has a
 * single time step regardless of what the user typed. Stepping monthly keeps
 * a 40-year horizon under 500 iterations while staying accurate enough that
 * the compounding is not visibly wrong.
 */
export function monthlyAmount(amount, frequencyId) {
  const perYear = frequencyById(frequencyId).perYear;
  return (clampPositive(amount) * perYear) / MONTHS_PER_YEAR;
}

/**
 * Build the month-by-month series both curves are drawn from.
 *
 * `invested` is an annuity-due for the recurring case — the money is diverted
 * at the *start* of each period, since it is money you would otherwise have
 * spent that day, not at the end of some accounting month.
 *
 * `owned` accumulates each purchase and depreciates it from its own purchase
 * date, which is why it is computed iteratively rather than in closed form:
 * the recurring case is a stack of items of different ages, and a consumed
 * category (rate 1) has to collapse to zero without a divide-by-zero.
 *
 * @returns {{t:number, invested:number, low:number, high:number, owned:number, contributed:number}[]}
 */
export function buildSeries({ recurring, amount, frequencyId, years, rates, depreciation }) {
  const months = Math.round(Math.min(50, Math.max(1, toNumber(years, 20))) * MONTHS_PER_YEAR);
  const monthly = recurring ? monthlyAmount(amount, frequencyId) : 0;
  const lump = recurring ? 0 : clampPositive(amount);

  // Monthly equivalents of the annual rates.
  const step = (annual) => (1 + annual) ** (1 / MONTHS_PER_YEAR) - 1;
  const rLow = step(rates.low);
  const rMid = step(rates.mid);
  const rHigh = step(rates.high);
  const keep = (1 - depreciation) ** (1 / MONTHS_PER_YEAR); // monthly retention

  let invested = lump;
  let low = lump;
  let high = lump;
  let owned = lump;
  let contributed = lump;

  const points = [{ t: 0, invested, low, high, owned, contributed }];

  for (let m = 1; m <= months; m += 1) {
    // Contribution first (start of period), then a month of growth.
    invested = (invested + monthly) * (1 + rMid);
    low = (low + monthly) * (1 + rLow);
    high = (high + monthly) * (1 + rHigh);

    // Existing holdings age by a month; this month's purchase joins at full value.
    owned = owned * keep + monthly;
    contributed += monthly;

    points.push({ t: m / MONTHS_PER_YEAR, invested, low, high, owned, contributed });
  }

  return points;
}

/**
 * The year at which the position pays for the thing by itself.
 *
 * One-off: when the *gains alone* cover the price, you could buy it outright
 * and still hold your original capital — the money has bought the thing for
 * free. That is the doubling point.
 *
 * Recurring: when one month of real return covers one month of the cost, the
 * fund sustains the habit indefinitely without touching the principal — the
 * classic perpetuity condition, which is a far more useful answer than
 * "it never breaks even".
 *
 * @returns {number|null} years, or null if it does not happen inside the horizon
 */
export function selfFundingYear(points, { recurring, monthly, price, monthlyRate }) {
  for (const p of points) {
    if (recurring) {
      if (monthly > 0 && p.invested * monthlyRate >= monthly) return p.t;
    } else if (price > 0 && p.invested - price >= price) {
      return p.t;
    }
  }
  return null;
}

function verdictFor(gapMultiple, consumed) {
  if (gapMultiple >= 3) {
    return {
      tone: 'bad',
      badge: 'Expensive choice',
      headline: 'This one costs a lot to say yes to',
      sub: consumed
        ? 'The money is gone the moment you spend it, and the gap keeps widening for decades.'
        : 'Even counting what you would still own, the gap is large.',
    };
  }
  if (gapMultiple >= 1) {
    return {
      tone: 'ok',
      badge: 'Real tradeoff',
      headline: 'There is a genuine cost here',
      sub: 'Not ruinous, but the difference is bigger than the price tag suggests.',
    };
  }
  return {
    tone: 'good',
    badge: 'Close call',
    headline: 'The gap is smaller than you might expect',
    sub: 'What you keep offsets most of what the money would have earned.',
  };
}

/**
 * @param {object} input
 * @param {boolean} input.recurring
 * @param {number|string} input.amount
 * @param {string} input.frequencyId
 * @param {string} input.categoryId
 * @param {number|string} input.customDepreciation  percent, used when categoryId is 'custom'
 * @param {number|string} input.years
 * @param {number|string} input.realReturn          percent
 */
export function evaluate({ recurring, amount, frequencyId, categoryId, customDepreciation, years, realReturn }) {
  const rates = returnBand(realReturn);
  const depreciation = depreciationRate(categoryId, customDepreciation);
  const horizon = Math.min(50, Math.max(1, toNumber(years, 20)));
  const value = clampPositive(amount);

  const points = buildSeries({ recurring, amount, frequencyId, years: horizon, rates, depreciation });
  const final = points[points.length - 1];

  const monthly = recurring ? monthlyAmount(amount, frequencyId) : 0;
  const monthlyRate = (1 + rates.mid) ** (1 / MONTHS_PER_YEAR) - 1;
  const breakEven = selfFundingYear(points, { recurring, monthly, price: value, monthlyRate });

  const gap = final.invested - final.owned;
  // Measured against what you actually put in, so a €5 coffee and a €50,000
  // car are judged on the same scale rather than by raw size.
  const gapMultiple = final.contributed > 0 ? gap / final.contributed : 0;

  return {
    ready: value > 0,
    recurring,
    depreciation,
    consumed: depreciation >= 1,
    horizon,
    rates,
    points,
    monthly,
    contributed: final.contributed,
    investedFinal: final.invested,
    lowFinal: final.low,
    highFinal: final.high,
    ownedFinal: final.owned,
    gap,
    gapMultiple,
    breakEvenYears: breakEven,
    verdict: verdictFor(gapMultiple, depreciation >= 1),
  };
}
