/**
 * How to Split — the model.
 *
 * Pure functions, no DOM — the same shape as every other tool's model.js.
 *
 * The flow mirrors how a shared card actually gets settled at the end of a
 * month: you know the **total** on the statement before you know anything
 * else, you already have a **ratio** the two of you split by, and only a
 * handful of lines on that statement were ever really one person's — a PS5,
 * someone's makeup order. Everything else is the shared remainder.
 *
 *   shared amount = total bill − individual items
 *   each person's total = their ratio share of the shared amount
 *                        + whatever was individually theirs
 *
 * There is no line-by-line itemisation of the whole bill. That was the
 * previous shape of this tool, and it was the wrong one: nobody wants to
 * re-type every grocery run from a statement. This only ever asks for the
 * exceptions.
 */

/**
 * Coerces before checking — form inputs hand back strings, and
 * `Number.isFinite` returns false for any string without parsing it first.
 */
export function toNumber(value, fallback = 0) {
  const num = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(num) ? num : fallback;
}

const clampPositive = (value) => Math.max(0, toNumber(value, 0));
const clampPercent = (value, fallback) => Math.min(100, Math.max(0, toNumber(value, fallback)));

export const DEFAULT_RATIO_A = 50;

/** Clamp and coerce a row of raw form state. Drops anything with no amount. */
export function normaliseItems(rows) {
  return (rows || [])
    .map((r) => ({
      id: r.id,
      description: (r.description || '').trim(),
      amount: clampPositive(r.amount),
      owner: r.owner === 'b' ? 'b' : 'a',
    }))
    .filter((it) => it.amount > 0);
}

function verdictFor({ overAllocated }) {
  if (overAllocated) {
    return {
      tone: 'bad',
      badge: 'Doesn’t add up',
      sub: 'The individual items add up to more than the total bill — nothing left to split, and something above is probably off.',
    };
  }
  return {
    tone: 'good',
    badge: 'Split',
    sub: "Here's what each of you actually pays, once the individual items are set aside first.",
  };
}

/**
 * @param {object} input
 * @param {number|string} input.totalBill    the full amount on the bill/statement
 * @param {number|string} input.ratioA       A's percentage of the *shared* remainder, 0–100
 * @param {object[]} input.items             individual items: { id, description, amount, owner: 'a'|'b' }
 */
export function evaluate({ totalBill, ratioA, items }) {
  const total = clampPositive(totalBill);
  const ratio = clampPercent(ratioA, DEFAULT_RATIO_A);
  const normalised = normaliseItems(items);

  const aOnlyTotal = normalised.filter((it) => it.owner === 'a').reduce((sum, it) => sum + it.amount, 0);
  const bOnlyTotal = normalised.filter((it) => it.owner === 'b').reduce((sum, it) => sum + it.amount, 0);
  const individualTotal = aOnlyTotal + bOnlyTotal;

  if (total <= 0) {
    return {
      ready: false, total: 0, ratio, items: normalised,
      aOnlyTotal, bOnlyTotal, individualTotal, sharedAmount: 0,
      overAllocated: false, owedA: 0, owedB: 0, verdict: null,
    };
  }

  const overAllocated = individualTotal > total;
  const sharedAmount = Math.max(0, total - individualTotal);

  const shareA = ratio / 100;
  const shareB = 1 - shareA;

  const owedA = sharedAmount * shareA + aOnlyTotal;
  const owedB = sharedAmount * shareB + bOnlyTotal;

  return {
    ready: true,
    total,
    ratio,
    items: normalised,
    aOnlyTotal,
    bOnlyTotal,
    individualTotal,
    sharedAmount,
    overAllocated,
    owedA,
    owedB,
    verdict: verdictFor({ overAllocated }),
  };
}
