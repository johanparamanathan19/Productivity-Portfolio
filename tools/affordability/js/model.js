/**
 * Affordability engine.
 *
 * Pure functions — no DOM, no storage — so the rules stay auditable in one
 * place and the whole thing is trivially testable.
 *
 * The tool does not invent a scoring system. It runs a purchase past the
 * published rules of thumb that lenders, regulators, and planners actually
 * use, and reports which ones it clears:
 *
 *  - Emergency fund of 3–6 months of essential expenses (the long-standing
 *    consensus baseline in consumer-finance guidance).
 *  - 50/30/20 budgeting — needs / wants / savings-and-debt (Warren &
 *    Warren-Tyagi, "All Your Worth").
 *  - Debt-to-income limits — the 28/36 rule used in mortgage underwriting,
 *    and the ~43% ceiling of the Qualified Mortgage rule.
 *  - The 30% housing-cost threshold that defines "cost burdened" in US
 *    housing policy; above ~50% is "severely cost burdened".
 *  - The 20/4/10 guideline for vehicles — 20% down, no more than 4 years of
 *    financing, and total transport costs under 10% of income.
 *  - Opportunity cost expressed as hours worked, after Robin & Dominguez,
 *    "Your Money or Your Life".
 *
 * Every threshold below is applied to *take-home* pay. Lenders normally use
 * gross income, so these checks are deliberately stricter than a bank's.
 */

// ---------- Reference data ----------

export const CURRENCIES = [
  { code: 'NOK', locale: 'nb-NO' },
  { code: 'USD', locale: 'en-US' },
  { code: 'EUR', locale: 'de-DE' },
  { code: 'GBP', locale: 'en-GB' },
  { code: 'SEK', locale: 'sv-SE' },
  { code: 'DKK', locale: 'da-DK' },
];

/**
 * Per-category ceilings on the new monthly commitment, as a share of
 * take-home pay. `warn` is the comfortable limit, `fail` the stretch limit.
 */
export const CATEGORIES = [
  { id: 'general', label: 'General purchase', warn: 0.1, fail: 0.2 },
  { id: 'vehicle', label: 'Car or vehicle', warn: 0.1, fail: 0.15 },
  { id: 'housing', label: 'Home or rent', warn: 0.3, fail: 0.4 },
  { id: 'recurring', label: 'Subscription or membership', warn: 0.05, fail: 0.1 },
];

/** Months of essential spending the buffer should cover. */
const BUFFER_TARGET_MONTHS = 3;
const BUFFER_COMFORTABLE_MONTHS = 6;

/** Back-end debt-to-income limits (28/36 rule, and the QM ceiling). */
const DTI_COMFORTABLE = 0.2;
const DTI_LIMIT = 0.36;

/** Total interest as a share of the sticker price. */
const INTEREST_COMFORTABLE = 0.05;
const INTEREST_LIMIT = 0.15;

/** 20/4/10 rule for vehicles. */
const VEHICLE_MIN_DOWN = 0.2;
const VEHICLE_MAX_TERM_MONTHS = 48;

/** Hours in a nominal full-time month, for the opportunity-cost figure. */
const HOURS_PER_MONTH = 160;

// ---------- Maths ----------

/** Standard amortised payment. Handles the 0% case without dividing by zero. */
export function amortisedPayment(principal, annualRatePct, months) {
  if (principal <= 0 || months <= 0) return 0;
  const monthlyRate = annualRatePct / 100 / 12;
  if (monthlyRate === 0) return principal / months;
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
}

const clampPositive = (n) => (Number.isFinite(n) && n > 0 ? n : 0);

// ---------- Evaluation ----------

/**
 * @typedef {object} Input
 * @property {string} category
 * @property {number} price
 * @property {boolean} financed
 * @property {number} downPayment
 * @property {number} apr
 * @property {number} termMonths
 * @property {number} ongoingMonthly  running costs: insurance, upkeep, fees
 * @property {number} income          monthly take-home
 * @property {number} essentials      monthly needs: housing, food, utilities
 * @property {number} debtPayments    existing monthly debt obligations
 * @property {number} savings         liquid savings available today
 * @property {number} monthlySaving   what gets saved in a normal month
 */

/** Everything downstream of the raw inputs. */
export function derive(input) {
  const price = clampPositive(input.price);
  const financed = Boolean(input.financed);

  // A down payment can never exceed the price.
  const downPayment = financed ? Math.min(clampPositive(input.downPayment), price) : price;
  const borrowed = financed ? price - downPayment : 0;
  const termMonths = financed ? Math.max(1, Math.round(input.termMonths || 0)) : 0;

  const monthlyPayment = financed ? amortisedPayment(borrowed, clampPositive(input.apr), termMonths) : 0;
  const totalInterest = financed ? Math.max(0, monthlyPayment * termMonths - borrowed) : 0;

  const ongoing = clampPositive(input.ongoingMonthly);
  const commitment = monthlyPayment + ongoing;

  const income = clampPositive(input.income);
  const essentials = clampPositive(input.essentials);
  const debtPayments = clampPositive(input.debtPayments);
  const savings = clampPositive(input.savings);
  const monthlySaving = clampPositive(input.monthlySaving);

  // What is genuinely uncommitted each month, with saving treated as a bill
  // you pay yourself rather than as leftover slack.
  const freeCash = income - essentials - debtPayments - monthlySaving;

  const upfront = financed ? downPayment : price;
  const savingsAfter = savings - upfront;
  const bufferMonths = essentials > 0 ? savingsAfter / essentials : Infinity;

  return {
    price,
    financed,
    downPayment,
    borrowed,
    termMonths,
    monthlyPayment,
    totalInterest,
    ongoing,
    commitment,
    income,
    essentials,
    debtPayments,
    savings,
    monthlySaving,
    freeCash,
    upfront,
    savingsAfter,
    bufferMonths,
    totalCost: price + totalInterest,
    downPaymentRatio: price > 0 ? downPayment / price : 0,
    shareOfIncome: income > 0 ? commitment / income : 0,
    debtToIncome: income > 0 ? (debtPayments + monthlyPayment) / income : 0,
    interestRatio: price > 0 ? totalInterest / price : 0,
    hoursOfWork: income > 0 ? ((price + totalInterest) / income) * HOURS_PER_MONTH : 0,
  };
}

/** Fallback when no currency formatter is supplied. */
const plainMoney = (n) => Math.round(n).toLocaleString();

/**
 * @param {(n:number)=>string} money formats an amount in the user's currency
 * @returns {{id:string,label:string,status:'pass'|'warn'|'fail',detail:string}[]}
 */
function runChecks(d, categoryId, money = plainMoney) {
  const category = CATEGORIES.find((c) => c.id === categoryId) || CATEGORIES[0];
  const checks = [];
  const months = (n) => `${n.toFixed(1)} month${n.toFixed(1) === '1.0' ? '' : 's'}`;
  const pct = (n) => `${Math.round(n * 100)}%`;

  // 1. Does the cash outlay leave a working emergency fund?
  if (d.savingsAfter < 0) {
    checks.push({
      id: 'buffer',
      label: 'Emergency fund',
      status: 'fail',
      detail: `You are ${money(Math.abs(d.savingsAfter))} short of the upfront cost, before any buffer.`,
    });
  } else if (d.essentials <= 0) {
    checks.push({
      id: 'buffer',
      label: 'Emergency fund',
      status: 'warn',
      // Missing data rather than a real problem: it should temper the verdict,
      // but it must not make the price search unsolvable.
      informational: true,
      detail: 'Add your monthly essentials to check this properly.',
    });
  } else {
    const status =
      d.bufferMonths >= BUFFER_TARGET_MONTHS ? 'pass' : d.bufferMonths >= 1 ? 'warn' : 'fail';
    const target =
      d.bufferMonths >= BUFFER_COMFORTABLE_MONTHS
        ? 'comfortably clear of the 3–6 month guideline'
        : status === 'pass'
          ? 'within the 3–6 month guideline'
          : 'below the 3-month guideline';
    checks.push({
      id: 'buffer',
      label: 'Emergency fund',
      status,
      detail: `${months(d.bufferMonths)} of essentials left afterwards — ${target}.`,
    });
  }

  // 2. Does the recurring commitment fit the month without raiding savings?
  if (d.commitment > 0) {
    const status =
      d.commitment <= d.freeCash
        ? 'pass'
        : d.commitment <= d.freeCash + d.monthlySaving
          ? 'warn'
          : 'fail';
    const detail =
      status === 'pass'
        ? `${money(d.commitment)} a month against ${money(d.freeCash)} of uncommitted income.`
        : status === 'warn'
          ? 'It fits only by cutting into what you normally save each month.'
          : `It exceeds your spare income by ${money(d.commitment - d.freeCash - d.monthlySaving)} a month.`;
    checks.push({ id: 'cashflow', label: 'Monthly budget', status, detail });
  }

  // 3. Share of take-home, against the ceiling for this kind of purchase.
  if (d.commitment > 0 && d.income > 0) {
    const status =
      d.shareOfIncome <= category.warn ? 'pass' : d.shareOfIncome <= category.fail ? 'warn' : 'fail';
    checks.push({
      id: 'share',
      label: 'Share of take-home',
      status,
      detail: `${pct(d.shareOfIncome)} of what you bring home; the guideline for ${category.label.toLowerCase()} is ${pct(category.warn)}.`,
    });
  }

  // 4. Total debt load, the back-end half of the 28/36 rule.
  if (d.income > 0 && (d.debtPayments > 0 || d.monthlyPayment > 0)) {
    const status =
      d.debtToIncome <= DTI_COMFORTABLE ? 'pass' : d.debtToIncome <= DTI_LIMIT ? 'warn' : 'fail';
    checks.push({
      id: 'dti',
      label: 'Total debt load',
      status,
      detail: `${pct(d.debtToIncome)} of take-home goes to debt; underwriting treats ${pct(DTI_LIMIT)} as the ceiling.`,
    });
  }

  // 5. What the borrowing itself costs.
  if (d.financed && d.borrowed > 0) {
    const status =
      d.interestRatio <= INTEREST_COMFORTABLE
        ? 'pass'
        : d.interestRatio <= INTEREST_LIMIT
          ? 'warn'
          : 'fail';
    checks.push({
      id: 'interest',
      label: 'Cost of borrowing',
      status,
      detail: `${money(d.totalInterest)} in interest — ${pct(d.interestRatio)} on top of the price.`,
    });
  }

  // 6. Vehicles get the structural half of the 20/4/10 rule.
  if (categoryId === 'vehicle' && d.financed) {
    const tooLittleDown = d.downPaymentRatio < VEHICLE_MIN_DOWN;
    const tooLong = d.termMonths > VEHICLE_MAX_TERM_MONTHS;
    const problems = [];
    if (tooLittleDown) problems.push(`${pct(d.downPaymentRatio)} down, against the 20% guideline`);
    if (tooLong) problems.push(`${d.termMonths} months of financing, against the 48-month guideline`);
    checks.push({
      id: 'structure',
      label: 'Loan structure',
      status: tooLittleDown && tooLong ? 'fail' : problems.length ? 'warn' : 'pass',
      detail: problems.length
        ? `${problems.join('; ')}. A thin deposit over a long term is how people end up owing more than the car is worth.`
        : 'Deposit and term both sit inside the 20/4/10 guideline.',
    });
  }

  return checks;
}

export const VERDICTS = {
  yes: { id: 'yes', headline: 'Yes — this fits', tone: 'good' },
  caution: { id: 'caution', headline: 'Yes, but go in deliberately', tone: 'ok' },
  wait: { id: 'wait', headline: 'Not yet', tone: 'warn' },
  no: { id: 'no', headline: 'No — not right now', tone: 'bad' },
};

function verdictFor(checks) {
  const fails = checks.filter((c) => c.status === 'fail').length;
  const warns = checks.filter((c) => c.status === 'warn').length;
  if (fails >= 2) return VERDICTS.no;
  if (fails === 1) return VERDICTS.wait;
  if (warns >= 2) return VERDICTS.caution;
  return VERDICTS.yes;
}

/**
 * The largest price that clears every check outright, found by bisection on
 * the full model rather than by inverting any single rule. Answers the
 * question people actually have: not "can I", but "how much can I".
 *
 * Note this is a stricter bar than a `yes` verdict, which tolerates one
 * warning — a number described as comfortable should have no caveats
 * attached to it.
 */
function comfortablePrice(input) {
  const passesAt = (price) => {
    const trial = { ...input, price };
    // Keep the deposit proportional so the structure of the deal is preserved.
    if (input.financed && input.price > 0) {
      trial.downPayment = input.downPayment * (price / input.price);
    }
    const checks = runChecks(derive(trial), input.category);
    return checks.every((c) => c.informational || c.status === 'pass');
  };

  // Nothing clears, not even a free one — the terms, not the price, are wrong.
  if (!passesAt(0)) return 0;

  // Push the upper bound out until it actually fails, so the answer is a
  // property of the rules rather than of where the search happened to start.
  let high = Math.max(input.price * 3, 1000);
  for (let expansions = 0; passesAt(high); expansions++) {
    if (expansions >= 16) return null; // unbounded: no check constrains price
    high *= 2;
  }

  let low = 0;
  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2;
    if (passesAt(mid)) low = mid;
    else high = mid;
  }
  return low;
}

/** "a, b and c" — plain English for any length. */
const listOf = (items) =>
  items.length <= 1 ? items[0] || '' : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/** Concrete, arithmetic-backed next steps — never vague encouragement. */
function buildGuidance(input, d, checks, verdict, ceiling, money = plainMoney) {
  const guidance = [];
  const failed = (id) => checks.some((c) => c.id === id && c.status === 'fail');

  if (failed('buffer') && d.monthlySaving > 0 && d.essentials > 0) {
    const target = d.upfront + BUFFER_TARGET_MONTHS * d.essentials;
    const shortfall = target - d.savings;
    if (shortfall > 0) {
      guidance.push({
        label: 'Wait and save',
        text: `You are ${money(shortfall)} short of buying this and keeping three months of essentials in reserve — about ${Math.ceil(shortfall / d.monthlySaving)} months at your current saving rate.`,
      });
    }
  }

  if (failed('cashflow')) {
    const gap = d.commitment - d.freeCash;
    guidance.push({
      label: 'Close the monthly gap',
      text: `The commitment runs ${money(gap)} a month past your spare income. A lower price, a larger deposit, or trimming the running costs are the only three levers.`,
    });
  }

  if (failed('structure')) {
    guidance.push({
      label: 'Restructure the loan',
      text: `A 20% deposit at this price is ${money(d.price * VEHICLE_MIN_DOWN)}, and ${VEHICLE_MAX_TERM_MONTHS} months is the outer edge of sensible. Borrowing less over a shorter term cuts the interest and the years spent owing more than the car is worth.`,
    });
  }

  // Worth showing even when the verdict is already yes: a yes tolerates one
  // warning, and the price at which nothing is strained is the useful number.
  if (ceiling !== null && ceiling > 0 && ceiling < d.price) {
    const below = Math.round((1 - ceiling / d.price) * 100);
    guidance.push(
      verdict.id === 'yes'
        ? {
            label: 'Where it stops being tight',
            text: `Every check clears outright at about ${money(ceiling)}, ${below}% below the asking price. Above that it still works, just with less slack than is comfortable.`,
          }
        : {
            label: 'A price that would work',
            text: `At roughly ${money(ceiling)} — ${below}% below the asking price — this clears every check.`,
          },
    );
  }

  // A zero ceiling means no price at all clears the checks, so pointing at
  // the sticker would be misleading — the terms are what is failing.
  if (verdict.id !== 'yes' && ceiling === 0) {
    const blockers = checks
      .filter((c) => c.status === 'fail' && c.id !== 'buffer')
      .map((c) => c.label.toLowerCase());
    guidance.push({
      label: 'Price is not the lever here',
      text: blockers.length
        ? `Even at a far lower price this would not clear every check — ${listOf(blockers)} would still fail. Change the terms or the running costs, not just the number on the tag.`
        : 'Even at a far lower price this would not clear every check. The running costs and terms are doing the damage, not the sticker price.',
    });
  }

  if (verdict.id === 'yes' && ceiling !== null && ceiling > d.price * 1.05) {
    guidance.push({
      label: 'Headroom',
      text: `You have room up to about ${money(ceiling)} on the same terms, so there is no need to stretch to the top of your range.`,
    });
  }

  // Behavioural brake, scaled to how big this is against a year of income.
  const annualShare = d.income > 0 ? d.price / (d.income * 12) : 0;
  if (annualShare > 0.05) {
    guidance.push({
      label: 'Sit on it',
      text: 'This is over 5% of a year of take-home pay. Purchases this size are worth a 30-day pause — the ones that still matter after a month are the ones worth buying.',
    });
  } else if (annualShare > 0.01) {
    guidance.push({
      label: 'Sleep on it',
      text: 'Big enough to be worth a night of distance before deciding.',
    });
  }

  return guidance;
}

/** The single entry point. */
export function evaluate(input, money = plainMoney) {
  const d = derive(input);
  const checks = runChecks(d, input.category, money);
  const verdict = verdictFor(checks);
  const ceiling = d.income > 0 && d.price > 0 ? comfortablePrice(input) : 0;

  return {
    derived: d,
    checks,
    verdict,
    ceiling,
    guidance: buildGuidance(input, d, checks, verdict, ceiling, money),
    ready: d.income > 0 && d.price > 0,
  };
}
