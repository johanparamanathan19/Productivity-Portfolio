/**
 * When could I stop? — the model.
 *
 * Pure functions, no DOM — the same shape as the other tools' model.js files.
 *
 * The headline arithmetic is the one everybody quotes:
 *
 *   FI number = annual expenses x 25
 *
 * That 25 is 1 / 0.04, and the 4% comes from the Trinity Study (Cooley,
 * Hubbard & Walz, 1998), which tested historical 30-year US stock/bond
 * portfolios and found a 4% initial withdrawal, adjusted for inflation each
 * year, survived nearly all of them. Three things about that are load-bearing,
 * and this model refuses to hide any of them:
 *
 *   - It is a *historical success frequency*, not a guarantee, and it comes
 *     from one country's unusually good century.
 *   - It was tested over **30 years**. Retiring at 40 asks it a question it
 *     never answered, and the failure modes worsen with the horizon.
 *   - Later work disputes it downward. Wade Pfau and others argue for 3–3.5%
 *     when starting yields are low, because sequence-of-returns risk in the
 *     first decade dominates the outcome far more than the average return does.
 *
 * So the withdrawal rate is an input with a range, not a constant, and the
 * target is reported as a band rather than a point. Hardcoding x25 would make
 * this tool a worse citizen than the study it is quoting.
 *
 * Everything is in real (after-inflation) terms, exactly as tools/invest/ is.
 */

/**
 * Long-run real return for a broad stock index, as a percentage. Pinned to the
 * same default tools/invest/js/model.js uses (DEFAULT_REAL_RETURN) on purpose:
 * the two tools model the same asset over the same kind of horizon, and it
 * would be indefensible for them to disagree. Duplicated rather than imported
 * because every tool's model.js stays self-contained — the same call
 * tools/runway/ made with the emergency-fund bands.
 */
export const DEFAULT_REAL_RETURN = 7;

export const MIN_RETURN = 0;
export const MAX_RETURN = 12;

/** Withdrawal rates, as percentages. The Trinity figure sits in the middle. */
export const DEFAULT_SWR = 4;
export const MIN_SWR = 3;
export const MAX_SWR = 5;

/** The two ends of the live dispute, drawn as the target band. */
export const CONSERVATIVE_SWR = 3;
export const TRINITY_SWR = 4;

/** Beyond this, "when" stops being a useful answer. */
export const MAX_HORIZON_YEARS = 60;

/** The age Coast FI is measured to — conventional retirement, not this tool's opinion. */
export const COAST_TARGET_AGE = 65;

/**
 * Coerces before checking — form inputs hand back strings, and
 * `Number.isFinite` returns false for any string without parsing it first.
 */
export function toNumber(value, fallback = 0) {
  const num = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(num) ? num : fallback;
}

const clampPositive = (value) => Math.max(0, toNumber(value, 0));

/** FI number for a given yearly spend and withdrawal rate. */
export function targetFor(annualExpenses, swrPercent) {
  const rate = Math.max(0.001, toNumber(swrPercent, DEFAULT_SWR) / 100);
  return clampPositive(annualExpenses) / rate;
}

/**
 * Years until a portfolio compounding at `r` with `s` added each year reaches
 * `target`, starting from `principal`.
 *
 * Closed form rather than a loop. Future value of a principal plus an ordinary
 * annuity is:
 *
 *   FV = P(1+r)^n + s * ((1+r)^n - 1) / r
 *
 * Setting FV = target and letting x = (1+r)^n gives x(P + s/r) = target + s/r,
 * so n = ln((target + s/r) / (P + s/r)) / ln(1+r).
 *
 * Note the contributions land at period *end* here, unlike tools/invest/'s
 * annuity-due. That is deliberate in both places and not a bug in either: the
 * invest tool models money you would otherwise have spent that morning, so it
 * is diverted at the start of the period; this models a year's saving landing
 * over the course of that year.
 *
 * @returns {number|null} years, or null when the target is never reached
 */
export function yearsToTarget(target, principal, annualSaving, realReturnPercent) {
  const P = clampPositive(principal);
  const s = clampPositive(annualSaving);
  const goal = clampPositive(target);

  if (P >= goal) return 0;

  const r = Math.max(0, toNumber(realReturnPercent, DEFAULT_REAL_RETURN)) / 100;

  // No growth: the closed form divides by r, so the linear case is its own path.
  if (r === 0) {
    if (s <= 0) return null;
    return (goal - P) / s;
  }

  // Nothing going in, and compounding alone has to cover the gap.
  if (s <= 0) {
    if (P <= 0) return null;
    return Math.log(goal / P) / Math.log(1 + r);
  }

  const years = Math.log((goal + s / r) / (P + s / r)) / Math.log(1 + r);
  return Number.isFinite(years) && years >= 0 ? years : null;
}

/**
 * The portfolio you would need *today* to reach the target by
 * COAST_TARGET_AGE on compounding alone, adding nothing further.
 *
 * @returns {number|null} null when no age was given
 */
export function coastNumber(target, age, realReturnPercent) {
  const years = COAST_TARGET_AGE - clampPositive(age);
  if (!(clampPositive(age) > 0) || years <= 0) return null;
  const r = Math.max(0, toNumber(realReturnPercent, DEFAULT_REAL_RETURN)) / 100;
  return clampPositive(target) / (1 + r) ** years;
}

/**
 * The accumulation series the chart is drawn from, stepped yearly.
 * @returns {{t:number, value:number}[]}
 */
export function buildSeries(principal, annualSaving, realReturnPercent, horizonYears) {
  const r = Math.max(0, toNumber(realReturnPercent, DEFAULT_REAL_RETURN)) / 100;
  const s = clampPositive(annualSaving);
  const years = Math.max(1, Math.ceil(horizonYears));

  let value = clampPositive(principal);
  const points = [{ t: 0, value }];
  for (let y = 1; y <= years; y += 1) {
    value = value * (1 + r) + s;
    points.push({ t: y, value });
  }
  return points;
}

function verdictFor({ alreadyThere, years, savingsRate }) {
  if (alreadyThere) {
    return {
      tone: 'good',
      badge: 'You are there',
      headline: 'Your portfolio already covers your spending',
      sub: 'At the withdrawal rate you picked, what you hold would fund this level of expenses. Whether that is enough to actually stop is a different, and much more personal, question.',
    };
  }
  if (years == null) {
    return {
      tone: 'bad',
      badge: 'Not on this path',
      headline: 'Nothing is being added, so the target never arrives',
      sub: 'With no annual saving and no growth to work with, the gap does not close. The number below is still the target — the timeline is what is missing.',
    };
  }
  if (years > MAX_HORIZON_YEARS) {
    return {
      tone: 'bad',
      badge: 'Beyond a lifetime',
      headline: `More than ${MAX_HORIZON_YEARS} years at this rate`,
      sub: 'Far enough out that the projection stops meaning much. Saving rate is the lever that moves this most — see what a permanent cut does below.',
    };
  }
  if (years <= 10) {
    return {
      tone: 'good',
      badge: 'Within a decade',
      headline: `About ${years.toFixed(1)} years away`,
      sub: `A savings rate of ${Math.round(savingsRate * 100)}% is doing most of that work — it is the share you keep, far more than the size of the income, that sets this date.`,
    };
  }
  if (years <= 25) {
    return {
      tone: 'ok',
      badge: 'In sight',
      headline: `About ${years.toFixed(1)} years away`,
      sub: `At a savings rate of ${Math.round(savingsRate * 100)}%. Every permanent cut in spending moves this twice — it lowers the target and raises what you add each year.`,
    };
  }
  return {
    tone: 'ok',
    badge: 'A long road',
    headline: `About ${Math.round(years)} years away`,
    sub: `At a savings rate of ${Math.round(savingsRate * 100)}%. This is the range where changing the rate matters far more than changing the return assumption.`,
  };
}

/**
 * What a permanent change in annual spending does to the date.
 *
 * The point of this function, and arguably of the whole tool: a recurring cut
 * hits *both* sides of the equation. It lowers the target by the cut times the
 * multiplier, and it raises annual saving by the same cut. That is why a
 * modest permanent cut beats a large one-off windfall over any real horizon,
 * and the asymmetry should fall out of the arithmetic rather than be asserted.
 *
 * @param {ReturnType<typeof evaluate>} d
 * @param {number|string} annualCut  reduction in yearly spending
 */
export function spendingLever(d, annualCut) {
  const cut = clampPositive(annualCut);
  if (cut <= 0 || !d.ready) return null;

  const newExpenses = Math.max(0, d.retirementExpenses - cut);
  const newTarget = targetFor(newExpenses, d.swr);
  const newSaving = d.annualSaving + cut;
  const newYears = yearsToTarget(newTarget, d.portfolio, newSaving, d.realReturn);

  const yearsSaved =
    d.years != null && newYears != null ? d.years - newYears : null;

  return {
    cut,
    newTarget,
    targetDrop: d.target - newTarget,
    newSaving,
    newYears,
    yearsSaved,
  };
}

/** What the same money does as a single one-off addition, for contrast. */
export function windfallLever(d, amount) {
  const value = clampPositive(amount);
  if (value <= 0 || !d.ready) return null;

  const newYears = yearsToTarget(d.target, d.portfolio + value, d.annualSaving, d.realReturn);
  return {
    amount: value,
    newYears,
    yearsSaved: d.years != null && newYears != null ? d.years - newYears : null,
  };
}

/**
 * @param {object} input
 * @param {number|string} input.annualExpenses     spending now, per year
 * @param {number|string} input.retirementExpenses spending you expect to keep, per year
 * @param {number|string} input.portfolio          invested assets today
 * @param {number|string} input.annualSaving       added to investments per year
 * @param {number|string} input.annualIncome       take-home per year, for the savings rate
 * @param {number|string} input.age                optional, enables the Coast figure
 * @param {number|string} input.swr                withdrawal rate, percent
 * @param {number|string} input.realReturn         percent, after inflation
 */
export function evaluate(input) {
  const annualExpenses = clampPositive(input.annualExpenses);
  // The override exists because a mortgage that ends, or a commute that stops,
  // makes today's spending the wrong basis for a lifetime target. Defaults to
  // today's spending rather than guessing at a reduction.
  const retirementExpenses = clampPositive(input.retirementExpenses) || annualExpenses;
  const portfolio = clampPositive(input.portfolio);
  const annualIncome = clampPositive(input.annualIncome);
  // Saving cannot exceed income; a rate over 100% is a typo, not a lifestyle.
  const annualSaving = annualIncome > 0
    ? Math.min(clampPositive(input.annualSaving), annualIncome)
    : clampPositive(input.annualSaving);
  const savingOverflow = clampPositive(input.annualSaving) > annualSaving;

  const swr = Math.min(MAX_SWR, Math.max(MIN_SWR, toNumber(input.swr, DEFAULT_SWR)));
  const realReturn = Math.min(MAX_RETURN, Math.max(MIN_RETURN, toNumber(input.realReturn, DEFAULT_REAL_RETURN)));

  const target = targetFor(retirementExpenses, swr);
  // The band is the two ends of the live dispute, not an error bar.
  const targetConservative = targetFor(retirementExpenses, CONSERVATIVE_SWR);
  const targetTrinity = targetFor(retirementExpenses, TRINITY_SWR);

  const ready = retirementExpenses > 0;
  const alreadyThere = ready && portfolio >= target;
  const years = ready ? yearsToTarget(target, portfolio, annualSaving, realReturn) : null;

  const savingsRate = annualIncome > 0 ? annualSaving / annualIncome : 0;
  const coast = coastNumber(target, input.age, realReturn);

  const horizon = years != null && years > 0
    ? Math.min(MAX_HORIZON_YEARS, Math.max(5, Math.ceil(years * 1.15)))
    : Math.min(MAX_HORIZON_YEARS, 30);

  return {
    ready,
    annualExpenses,
    retirementExpenses,
    expensesAdjusted: retirementExpenses !== annualExpenses,
    portfolio,
    annualIncome,
    annualSaving,
    savingOverflow,
    savingsRate,
    swr,
    multiplier: 100 / swr,
    realReturn,
    target,
    targetConservative,
    targetTrinity,
    shortfall: Math.max(0, target - portfolio),
    progress: target > 0 ? Math.min(1, portfolio / target) : 0,
    alreadyThere,
    years,
    beyondHorizon: years != null && years > MAX_HORIZON_YEARS,
    horizon,
    coast,
    coastReached: coast != null && portfolio >= coast,
    points: ready ? buildSeries(portfolio, annualSaving, realReturn, horizon) : [],
    verdict: ready ? verdictFor({ alreadyThere, years, savingsRate }) : null,
  };
}
