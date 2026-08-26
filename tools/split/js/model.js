/**
 * How to Split — the model.
 *
 * Pure functions, no DOM — the same shape as every other tool's model.js.
 *
 * The arithmetic is deliberately small: every item is either **shared**, and
 * split by one ratio the two people agree on up front, or owned **100% by
 * one person** — a personal item that happened to ride the same card. There
 * is no per-item ratio override and no third person. A tool that tried to
 * handle every splitting scheme would end up worse at the one job this
 * exists for: two people, one card, a fair answer in under a minute.
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

/** Below this, a computed settlement is float noise, not a real amount owed. */
const SETTLE_EPSILON = 0.005;

export const DEFAULT_RATIO_A = 50;

export const ITEM_MODES = {
  SHARED: 'shared',
  A: 'a',
  B: 'b',
};

/** Clamp and coerce a row of raw form state. Drops anything with no amount. */
export function normaliseItems(rows) {
  return (rows || [])
    .map((r) => ({
      id: r.id,
      description: (r.description || '').trim(),
      amount: clampPositive(r.amount),
      mode: Object.values(ITEM_MODES).includes(r.mode) ? r.mode : ITEM_MODES.SHARED,
    }))
    .filter((it) => it.amount > 0);
}

/**
 * One item's cost, divided between A and B.
 * @param {{amount:number, mode:string}} item
 * @param {number} ratioAPercent A's share of every *shared* item, 0–100 — a
 *   100%-owned item ignores this entirely, by design: the ratio prices what's
 *   genuinely shared, not what one person happened to swipe the card for.
 */
export function splitItem(item, ratioAPercent) {
  if (item.mode === ITEM_MODES.A) return { a: item.amount, b: 0 };
  if (item.mode === ITEM_MODES.B) return { a: 0, b: item.amount };
  const shareA = clampPercent(ratioAPercent, DEFAULT_RATIO_A) / 100;
  return { a: item.amount * shareA, b: item.amount * (1 - shareA) };
}

function verdictFor({ settlement }) {
  if (settlement) {
    return {
      tone: 'good',
      badge: 'One transfer',
      sub: 'Everything below nets down to a single payment — nothing else needs to move.',
    };
  }
  return {
    tone: 'good',
    badge: 'Fair shares',
    sub: "Here's what each of you should put toward this — nobody paid the whole card here, so there's nothing to transfer.",
  };
}

/**
 * @param {object} input
 * @param {object[]} input.items      raw rows: { id, description, amount, mode }
 * @param {number|string} input.ratioA  A's percentage of every shared item, 0–100
 * @param {'a'|'b'|null} [input.paidBy] whose card actually covered all of this,
 *   if any — turns each person's fair share into a single settlement transfer
 */
export function evaluate({ items, ratioA, paidBy }) {
  const normalised = normaliseItems(items);
  const ratio = clampPercent(ratioA, DEFAULT_RATIO_A);

  if (normalised.length === 0) {
    return { ready: false, items: [], ratio, paidBy: paidBy || null, total: 0, owedA: 0, owedB: 0, verdict: null };
  }

  let owedA = 0;
  let owedB = 0;
  let sharedTotal = 0;
  let aOnlyTotal = 0;
  let bOnlyTotal = 0;

  const lines = normalised.map((item) => {
    const { a, b } = splitItem(item, ratio);
    owedA += a;
    owedB += b;
    if (item.mode === ITEM_MODES.SHARED) sharedTotal += item.amount;
    else if (item.mode === ITEM_MODES.A) aOnlyTotal += item.amount;
    else bOnlyTotal += item.amount;
    return { ...item, owedA: a, owedB: b };
  });

  const total = owedA + owedB;

  let settlement = null;
  if (paidBy === 'a' && owedB > SETTLE_EPSILON) {
    settlement = { from: 'b', to: 'a', amount: owedB };
  } else if (paidBy === 'b' && owedA > SETTLE_EPSILON) {
    settlement = { from: 'a', to: 'b', amount: owedA };
  }

  return {
    ready: true,
    items: lines,
    ratio,
    paidBy: paidBy || null,
    total,
    owedA,
    owedB,
    sharedTotal,
    aOnlyTotal,
    bOnlyTotal,
    settlement,
    verdict: verdictFor({ settlement }),
  };
}
