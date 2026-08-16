/**
 * Debt Escape Plan — the model.
 *
 * Pure functions, no DOM — the same shape as every other tool's model.js.
 *
 * Unlike tools/invest/ and tools/fi/, this runs in **nominal** terms, on
 * purpose: a debt contract is nominal. The APR on a statement is nominal, the
 * balance owed is nominal, and the payment leaving an account next month is a
 * nominal figure. Deflating a payoff schedule would be technically defensible
 * and practically confusing — the debt-free month has to match the month on
 * the actual statement. See docs/debt-payoff.md.
 */

const MONTHS_PER_YEAR = 12;

/** Past this, "when do I finish" stops being a useful answer. */
export const MAX_MONTHS = 600;

export const STRATEGIES = [
  {
    id: 'avalanche',
    label: 'Highest rate first',
    note: 'Always the least total interest and the shortest payoff, for a fixed budget. No exceptions.',
  },
  {
    id: 'snowball',
    label: 'Smallest balance first',
    note: 'Costs more in interest, but the early wins are why people actually finish it.',
  },
];

export const DEFAULT_STRATEGY = 'avalanche';

/**
 * Presets so nobody has to invent a plausible APR or minimum-payment rule.
 * `minPct` / `minFloor` describe a revolving-credit minimum: max(floor,
 * balance × pct). Installment debts (a car loan, a student loan) don't work
 * that way — their real minimum is whatever is on the statement — so those
 * kinds carry a zero rule and the field simply asks for the actual figure,
 * the same "don't guess" stance tools/invest/ takes with its custom category.
 */
export const DEBT_KINDS = [
  { id: 'card', label: 'Credit card', icon: '💳', apr: 24, minPct: 2.5, minFloor: 250, note: 'Minimums shrink as the balance does, which is what makes "just pay the minimum" so slow.' },
  { id: 'store', label: 'Store card / Buy now, pay later', icon: '🛍️', apr: 27, minPct: 3, minFloor: 200, note: 'Often the worst rate of anything in a wallet.' },
  { id: 'consumer', label: 'Consumer / personal loan', icon: '🏦', apr: 12, minPct: 2, minFloor: 300, note: 'Usually a fixed installment — check your statement for the real minimum.' },
  { id: 'car', label: 'Car loan', icon: '🚗', apr: 7, minPct: 0, minFloor: 0, note: 'A fixed installment. Enter the payment from your loan agreement.' },
  { id: 'student', label: 'Student loan', icon: '🎓', apr: 5, minPct: 0, minFloor: 0, note: 'Income-driven plans and forgiveness change this math — see the guidance below before overpaying one of these.' },
  { id: 'personal', label: 'Money owed to someone', icon: '🤝', apr: 0, minPct: 0, minFloor: 0, note: 'Often 0% — but still worth a place in the plan.' },
  { id: 'other', label: 'Something else', icon: '📄', apr: 10, minPct: 0, minFloor: 0, note: 'Set the rate and minimum from your own statement.' },
];

const kindById = (id) => DEBT_KINDS.find((k) => k.id === id) || DEBT_KINDS[0];

/**
 * Coerces before checking — form inputs hand back strings, and
 * `Number.isFinite` returns false for any string without parsing it first.
 */
export function toNumber(value, fallback = 0) {
  const num = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(num) ? num : fallback;
}

const clampPositive = (value) => Math.max(0, toNumber(value, 0));

/** A rounded starting suggestion for a row's minimum, from its preset. Never used silently — the field stays editable. */
export function suggestedMinimum(kindId, balance) {
  const kind = kindById(kindId);
  const bal = clampPositive(balance);
  if (kind.minPct <= 0) return kind.minFloor;
  return Math.round(Math.max(kind.minFloor, bal * (kind.minPct / 100)));
}

/** Clamp and coerce a row of raw form state into a debt the model can use. Drops anything with no balance. */
export function normaliseDebts(rows) {
  return (rows || [])
    .map((r) => ({
      id: r.id,
      label: (r.label || '').trim() || kindById(r.kindId).label,
      kindId: r.kindId || 'card',
      balance: clampPositive(r.balance),
      apr: Math.min(100, Math.max(0, toNumber(r.apr, 0))),
      minPayment: clampPositive(r.minPayment),
    }))
    .filter((d) => d.balance > 0);
}

/** Sum of every debt's minimum, each capped at its own balance — the floor a budget must clear to be feasible at all. */
export function sumMinimums(debts) {
  return normaliseDebts(debts).reduce((sum, d) => sum + Math.min(d.balance, d.minPayment), 0);
}

/**
 * The payoff order, fixed once at the start of the plan rather than
 * re-sorted every month — "list your debts smallest to largest and pay them
 * off in that order" is how both methods are actually described, and
 * re-sorting mid-stream as balances shift would thrash the target debt for
 * no benefit. Ties are broken deterministically so the two strategies never
 * jitter against each other on equal inputs.
 */
export function orderDebts(debts, strategyId) {
  const list = [...debts];
  if (strategyId === 'snowball') {
    list.sort((a, b) => (a.balance - b.balance) || (b.apr - a.apr) || a.id.localeCompare(b.id));
  } else {
    list.sort((a, b) => (b.apr - a.apr) || (a.balance - b.balance) || a.id.localeCompare(b.id));
  }
  return list.map((d) => d.id);
}

function pointAt(month, orderIds, byId, balances, interestPaid) {
  const byDebt = {};
  let total = 0;
  orderIds.forEach((id) => {
    const bal = Math.max(0, balances.get(id) ?? 0);
    byDebt[id] = bal;
    total += bal;
  });
  return { t: month / MONTHS_PER_YEAR, month, total, byDebt, interestPaid };
}

/**
 * Debts whose minimum payment does not even cover a month of their own
 * interest — while only the minimum is being paid, that balance grows, not
 * shrinks. It does not mean the debt is never paid off: once it becomes the
 * strategy's target it gets the full surplus, which almost always exceeds
 * its interest. It does mean it will visibly grow before its turn arrives,
 * which is worth naming rather than leaving as an unexplained wobble on the
 * chart.
 */
function negativeAmortizationIds(debts) {
  return debts
    .filter((d) => d.minPayment > 0 && d.balance * (d.apr / 100 / MONTHS_PER_YEAR) >= d.minPayment)
    .map((d) => d.id);
}

/**
 * Run one strategy to completion (or to `maxMonths`).
 *
 * Per month: accrue interest on every live debt, pay every minimum, then
 * throw whatever is left of the budget at debts in strategy order. A debt
 * that clears mid-cascade lets its leftover roll straight to the next one in
 * the same month — the single detail a naive simulator most often drops,
 * which silently overstates the payoff date. A cleared debt's minimum stops
 * being deducted from the budget the very next month, which is what "rolls
 * the snowball forward" actually is; avalanche gets the identical mechanic,
 * ordered by rate instead of balance.
 */
export function simulate({ debts, monthlyBudget, strategyId = DEFAULT_STRATEGY, maxMonths = MAX_MONTHS }) {
  const initial = normaliseDebts(debts);
  const budget = clampPositive(monthlyBudget);
  const orderIds = orderDebts(initial, strategyId);
  const byId = new Map(initial.map((d) => [d.id, d]));
  const balances = new Map(initial.map((d) => [d.id, d.balance]));

  const minTotal = sumMinimums(initial);
  const feasible = initial.length === 0 || budget >= minTotal - 1e-9;

  if (initial.length === 0) {
    return {
      feasible: true, months: 0, truncated: false, interestTotal: 0, minTotal: 0,
      neverPaidIds: [], payoffOrder: [], points: [pointAt(0, [], byId, balances, 0)],
    };
  }

  if (!feasible) {
    return {
      feasible: false, months: null, truncated: false, interestTotal: 0, minTotal,
      neverPaidIds: negativeAmortizationIds(initial), payoffOrder: [],
      points: [pointAt(0, orderIds, byId, balances, 0)],
    };
  }

  let interestTotal = 0;
  const paid = new Set();
  const payoffOrder = [];
  const points = [pointAt(0, orderIds, byId, balances, 0)];
  let finishMonth = null;

  for (let month = 1; month <= maxMonths; month += 1) {
    let surplus = budget;

    // Interest, then every minimum.
    orderIds.forEach((id) => {
      let bal = balances.get(id);
      if (bal <= 0) return;
      const debt = byId.get(id);
      const interest = bal * (debt.apr / 100 / MONTHS_PER_YEAR);
      bal += interest;
      interestTotal += interest;
      const minPay = Math.min(bal, debt.minPayment);
      bal -= minPay;
      surplus -= minPay;
      balances.set(id, Math.max(0, bal));
    });

    // The surplus cascades down strategy order; a debt clearing mid-pass
    // hands its leftover straight to the next one, same month.
    surplus = Math.max(0, surplus);
    for (const id of orderIds) {
      if (surplus <= 1e-9) break;
      const bal = balances.get(id);
      if (bal <= 0) continue;
      const pay = Math.min(bal, surplus);
      balances.set(id, bal - pay);
      surplus -= pay;
    }

    // Record anything that crossed zero this month, from whichever step did it.
    orderIds.forEach((id) => {
      if (balances.get(id) <= 1e-6 && !paid.has(id)) {
        paid.add(id);
        balances.set(id, 0);
        payoffOrder.push({ id, label: byId.get(id).label, month });
      }
    });

    points.push(pointAt(month, orderIds, byId, balances, interestTotal));

    if (paid.size === orderIds.length) {
      finishMonth = month;
      break;
    }
  }

  return {
    feasible: true,
    months: finishMonth,
    truncated: finishMonth === null,
    interestTotal,
    minTotal,
    neverPaidIds: negativeAmortizationIds(initial),
    payoffOrder,
    points,
  };
}

function verdictFor({ feasible, debtCount, avalancheInterest, strategyGapInterest }) {
  if (!feasible) {
    return {
      tone: 'bad',
      badge: 'Budget too tight',
      headline: 'This budget cannot cover the minimums',
      sub: 'No payoff order fixes that by itself — the help below is the next step, not the strategy toggle.',
    };
  }
  if (debtCount <= 1) {
    return {
      tone: 'good',
      badge: 'One debt',
      headline: 'The order does not apply here',
      sub: 'With a single balance, avalanche and snowball are the same plan — here is the path out.',
    };
  }
  const relGap = avalancheInterest > 0 ? strategyGapInterest / avalancheInterest : 0;
  if (relGap < 0.05) {
    return {
      tone: 'good',
      badge: 'Close call',
      headline: 'Both orders finish close together',
      sub: 'Pick whichever one you will actually stick to — switching barely moves the total.',
    };
  }
  return {
    tone: 'ok',
    badge: 'Real tradeoff',
    headline: 'The order you choose has a real price',
    sub: 'Highest-rate-first saves money. Smallest-balance-first is easier to stay on. Below is exactly what each costs.',
  };
}

/**
 * Runs both strategies, plus a minimums-only baseline, and prices the
 * difference between them — in money, in months, and (given an hourly wage)
 * in hours of life spent servicing the debt rather than anything else.
 *
 * @param {object} input
 * @param {object[]} input.debts
 * @param {number|string} input.monthlyBudget total put toward debt each month, minimums included
 * @param {string} [input.strategyId] which strategy is foregrounded as "the plan" — both are always computed
 * @param {number|string} [input.hourlyWage] optional take-home hourly figure
 */
export function compare({ debts, monthlyBudget, strategyId = DEFAULT_STRATEGY, hourlyWage }) {
  const normalised = normaliseDebts(debts);
  const budget = clampPositive(monthlyBudget);
  const minTotal = sumMinimums(normalised);

  if (normalised.length === 0 || budget <= 0) {
    return { ready: false, debts: normalised, minTotal, budget };
  }

  const avalanche = simulate({ debts: normalised, monthlyBudget: budget, strategyId: 'avalanche' });
  const snowball = simulate({ debts: normalised, monthlyBudget: budget, strategyId: 'snowball' });
  const minimumsOnly = minTotal > 0
    ? simulate({ debts: normalised, monthlyBudget: minTotal, strategyId: 'avalanche' })
    : null;

  const primary = strategyId === 'snowball' ? snowball : avalanche;
  const other = strategyId === 'snowball' ? avalanche : snowball;

  const strategyGapInterest = Math.max(0, snowball.interestTotal - avalanche.interestTotal);
  const strategyGapMonths = avalanche.feasible && snowball.feasible
    ? Math.max(0, (snowball.months ?? MAX_MONTHS) - (avalanche.months ?? MAX_MONTHS))
    : null;

  // Only a clean "interest saved" figure when the minimums-only baseline
  // actually finishes inside the horizon — otherwise the honest number is
  // "still owed after 50 years," which the UI reads straight off minimumsOnly.
  const interestSavedVsMinimums = minimumsOnly && minimumsOnly.months != null
    ? minimumsOnly.interestTotal - primary.interestTotal
    : null;

  // A currency-agnostic sensitivity check: does paying 20% more move the
  // needle further than the strategy choice does? Often yes, and it is the
  // single most useful line of guidance the tool can offer for free.
  const boostBudget = budget * 1.2;
  const boosted = avalanche.feasible ? simulate({ debts: normalised, monthlyBudget: boostBudget, strategyId }) : null;
  const boost = boosted ? {
    pct: 20,
    extraPerMonth: boostBudget - budget,
    interestSaved: Math.max(0, primary.interestTotal - boosted.interestTotal),
    monthsSaved: Math.max(0, (primary.months ?? MAX_MONTHS) - (boosted.months ?? MAX_MONTHS)),
  } : null;

  const wage = clampPositive(hourlyWage);
  const lifeHours = wage > 0 ? primary.interestTotal / wage : null;

  return {
    ready: true,
    feasible: avalanche.feasible,
    debts: normalised,
    budget,
    minTotal,
    strategyId: primary === avalanche ? 'avalanche' : 'snowball',
    avalanche,
    snowball,
    minimumsOnly,
    primary,
    other,
    strategyGapInterest,
    strategyGapMonths,
    interestSavedVsMinimums,
    boost,
    lifeHours,
    verdict: verdictFor({
      feasible: avalanche.feasible,
      debtCount: normalised.length,
      avalancheInterest: avalanche.interestTotal,
      strategyGapInterest,
    }),
  };
}

/**
 * "What if this debt's rate were cut to X%?" — the lever priced against the
 * plan already on screen. Deliberately does not recommend how to get the
 * lower rate (balance transfer, consolidation loan, a phone call); that is a
 * decision for a specific offer, not a generic calculator.
 */
export function rateCutImpact({ debts, monthlyBudget, strategyId, debtId, newApr }) {
  const normalised = normaliseDebts(debts);
  const base = simulate({ debts: normalised, monthlyBudget, strategyId });
  if (!base.feasible) return null;

  const cutDebts = normalised.map((d) => (d.id === debtId ? { ...d, apr: Math.min(100, Math.max(0, toNumber(newApr, d.apr))) } : d));
  const cut = simulate({ debts: cutDebts, monthlyBudget, strategyId });
  if (!cut.feasible) return null;

  return {
    interestSaved: Math.max(0, base.interestTotal - cut.interestTotal),
    monthsSaved: Math.max(0, (base.months ?? MAX_MONTHS) - (cut.months ?? MAX_MONTHS)),
    months: cut.months,
    interestTotal: cut.interestTotal,
  };
}

/** The debt currently carrying the worst rate — the lever's default target. */
export function worstRateDebtId(debts) {
  const normalised = normaliseDebts(debts);
  if (normalised.length === 0) return null;
  return orderDebts(normalised, 'avalanche')[0];
}
