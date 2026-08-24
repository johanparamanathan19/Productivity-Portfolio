/**
 * Where am I in the world? — the model.
 *
 * Pure functions, no DOM — the same shape as every other tool's model.js.
 *
 * This one is different from the rest of the suite in an important way: it is
 * not projecting your future, it is locating you in someone else's published
 * dataset. So almost all of the work here is in being honest about what that
 * dataset does and does not say, and every constant below traces to a figure
 * that can be checked — the same stance tools/affordability/ takes with its
 * lending rules. See docs/global-wealth.md.
 *
 * Source: UBS Global Wealth Report (which absorbed the Credit Suisse series).
 * The band structure below is the 2025/2026 edition's wealth pyramid.
 *
 * The single most important caveat, repeated in the UI: **net worth is not
 * income, and it is not wellbeing.** A newly-qualified doctor with student
 * debt has negative net worth and ranks below a subsistence farmer who owns a
 * goat. That is not a flaw in the arithmetic — it is what net worth measures,
 * and what it ignores, which is every bit of future earning power.
 */

/**
 * The wealth pyramid: adults in each band, and the share of all household
 * wealth they hold. Bands are net worth (assets minus debts) per adult, in
 * USD at market exchange rates.
 *
 * These four numbers are the entire empirical basis of the tool. They sum to
 * 3.808bn adults and 99.9% of wealth, which is the arithmetic check that they
 * were transcribed correctly.
 */
export const TIERS = [
  { id: 'under10k', floor: 0, ceiling: 1e4, adults: 1.55e9, wealthShare: 0.006, label: 'Under $10,000' },
  { id: 'under100k', floor: 1e4, ceiling: 1e5, adults: 1.57e9, wealthShare: 0.12, label: '$10,000 – $100,000' },
  { id: 'under1m', floor: 1e5, ceiling: 1e6, adults: 628e6, wealthShare: 0.392, label: '$100,000 – $1 million' },
  { id: 'millionaire', floor: 1e6, ceiling: Infinity, adults: 60e6, wealthShare: 0.481, label: 'Over $1 million' },
];

/**
 * Adults covered by the report's wealth pyramid — the population this tool's
 * percentile is *of*. Deliberately not "every adult alive": world adult
 * population is nearer 5.5bn, and the report covers 56 markets. Saying
 * "richer than 98% of the world" when the base is 3.8bn would be an
 * overclaim, so the UI always names the base.
 */
export const ADULTS_COVERED = TIERS.reduce((sum, t) => sum + t.adults, 0);

/** Total household wealth implied by the bands, ~USD 470 trillion. */
export const TOTAL_WEALTH_USD = 470e12;

/**
 * Cumulative share of adults *below* each band ceiling. Derived from TIERS
 * rather than written out, so the two can never drift apart.
 * → 40.7% below $10k, 81.7% below $100k, 98.4% below $1m.
 */
export const ANCHORS = (() => {
  const points = [];
  let cumulative = 0;
  for (const tier of TIERS) {
    cumulative += tier.adults / ADULTS_COVERED;
    if (Number.isFinite(tier.ceiling)) points.push({ usd: tier.ceiling, below: cumulative });
  }
  return points;
})();

/**
 * Pareto exponent for the tail above USD 1 million, fitted to two published
 * counts: ~60 million millionaires and ~3,000 billionaires. A power law is
 * the standard description of the top tail of a wealth distribution, and two
 * anchors three decades apart determine it exactly.
 *
 * It is worth stating why this is trusted rather than merely assumed: the fit
 * was checked against two *independent* figures it was not built from. It
 * predicts ~2.2 million adults above USD 10 million (reported: ~2.2–2.5m) and
 * ~81,000 above USD 100 million (reported: ~80,000). A two-point fit landing
 * that close on two held-out decades is the reason the tail is drawn as a
 * curve rather than left as a single "top 1.6%" step.
 */
export const MILLIONAIRES = 60e6;
export const BILLIONAIRES = 3000;
export const PARETO_ALPHA = Math.log(MILLIONAIRES / BILLIONAIRES) / Math.log(1000);

/**
 * USD per unit of each supported currency's *inverse* — i.e. how many units
 * of the currency one USD buys. Mid-market, mid-August 2026.
 *
 * These are static because nothing in this project talks to the network. That
 * sounds like a compromise and mostly is not one: the distribution spans six
 * orders of magnitude, so a 10% currency move shifts a percentile by a
 * fraction of a percentage point. The date is shown in the UI anyway, because
 * a stale number with a visible date is honest and a stale number without one
 * is not.
 */
export const RATES_AS_OF = 'August 2026';

export const USD_RATES = {
  USD: 1,
  NOK: 9.55,
  EUR: 0.867,
  GBP: 0.744,
  SEK: 9.48,
  DKK: 6.47,
};

/**
 * Coerces before checking — form inputs hand back strings, and
 * `Number.isFinite` returns false for any string without parsing it first.
 */
export function toNumber(value, fallback = 0) {
  const num = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(num) ? num : fallback;
}

/** Convert a local amount to USD at the static rate for that currency. */
export function toUsd(amount, currencyCode) {
  const rate = USD_RATES[currencyCode] || 1;
  return toNumber(amount, 0) / rate;
}

/** Convert USD back to a local amount — used for the "what would it take" figures. */
export function fromUsd(usd, currencyCode) {
  const rate = USD_RATES[currencyCode] || 1;
  return toNumber(usd, 0) * rate;
}

/** How many adults hold more than this, using the fitted tail. */
function adultsAboveMillion(usd) {
  return MILLIONAIRES * (usd / 1e6) ** -PARETO_ALPHA;
}

/**
 * Share of adults holding *less* than a given net worth, 0–1.
 *
 * Three regimes, and the middle one is the weakest link:
 *
 *  - **Above USD 1m** — the fitted power law above, which is the best-attested
 *    part of the whole model.
 *  - **USD 1 to 1m** — log-linear interpolation between the published band
 *    ceilings. This assumes adults are spread evenly across each band *in log
 *    space*, which they are not: real density is bunched toward the bottom of
 *    each band. So percentiles in the lower bands read slightly high, and the
 *    UI flags anything under USD 10,000 as indicative rather than measured.
 *  - **Zero or negative** — not a percentile at all. Returns null, because the
 *    report does not break the bottom band down and a person with debts is the
 *    case where a net worth percentile is least meaningful anyway.
 */
export function shareBelow(usd) {
  if (!(usd > 0)) return null;

  if (usd >= 1e6) {
    return 1 - adultsAboveMillion(usd) / ADULTS_COVERED;
  }

  // Walk the anchors, interpolating in log space between them. The bottom
  // segment runs from USD 1 (taken as 0%) up to the first published ceiling.
  let prevUsd = 1;
  let prevBelow = 0;
  for (const anchor of ANCHORS) {
    if (usd <= anchor.usd) {
      const span = Math.log10(anchor.usd) - Math.log10(prevUsd);
      const into = Math.log10(usd) - Math.log10(prevUsd);
      const frac = span > 0 ? into / span : 0;
      return prevBelow + frac * (anchor.below - prevBelow);
    }
    prevUsd = anchor.usd;
    prevBelow = anchor.below;
  }
  return prevBelow;
}

/**
 * The inverse: the net worth that sits at a given share-below. Used for
 * "what would it take to reach the top 1%", so it has to agree exactly with
 * shareBelow or the tool contradicts itself.
 */
export function netWorthAtShare(share) {
  const s = Math.min(0.999999, Math.max(0.0001, share));

  const topAnchor = ANCHORS[ANCHORS.length - 1];
  if (s >= topAnchor.below) {
    const above = (1 - s) * ADULTS_COVERED;
    if (above <= 0) return Infinity;
    return 1e6 * (above / MILLIONAIRES) ** (-1 / PARETO_ALPHA);
  }

  let prevUsd = 1;
  let prevBelow = 0;
  for (const anchor of ANCHORS) {
    if (s <= anchor.below) {
      const frac = anchor.below > prevBelow ? (s - prevBelow) / (anchor.below - prevBelow) : 0;
      const logValue = Math.log10(prevUsd) + frac * (Math.log10(anchor.usd) - Math.log10(prevUsd));
      return 10 ** logValue;
    }
    prevUsd = anchor.usd;
    prevBelow = anchor.below;
  }
  return topAnchor.usd;
}

/**
 * How to say a rank out loud.
 *
 * "Top 72%" is technically true of someone below the median and reads as
 * nonsense — worse, it contradicts the same screen's "72% hold more than you".
 * Below the median the honest phrasing is a bottom share, so the flip happens
 * here, once, and both the headline and the chart label read from it.
 */
export function rankLabel(share) {
  if (share == null) return null;
  if (share < 0.5) return `Bottom ${Math.round(share * 100)}%`;
  const topPercent = (1 - share) * 100;
  const digits = topPercent < 0.001 ? 5 : topPercent < 0.01 ? 4 : topPercent < 0.1 ? 3 : topPercent < 1 ? 2 : topPercent < 10 ? 1 : 0;
  return `Top ${topPercent.toFixed(digits)}%`;
}

/** Which published band a net worth falls in. */
export function tierFor(usd) {
  return TIERS.find((t) => usd < t.ceiling) || TIERS[TIERS.length - 1];
}

/**
 * The cumulative curve the chart is drawn from: share-below against net worth,
 * sampled evenly in log space because that is the only way six orders of
 * magnitude fit on one axis.
 */
export function buildCurve(minUsd = 100, maxUsd = 1e9, steps = 160) {
  const logMin = Math.log10(minUsd);
  const logMax = Math.log10(maxUsd);
  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    const usd = 10 ** (logMin + ((logMax - logMin) * i) / steps);
    points.push({ usd, share: shareBelow(usd) ?? 0 });
  }
  return points;
}

/**
 * Milestones above the user, so the answer is not just a rank but a distance.
 * Only ever returns rungs strictly above where they already are.
 */
export function nextMilestones(share, limit = 3) {
  const rungs = [0.5, 0.75, 0.9, 0.95, 0.99, 0.999, 0.9999];
  return rungs
    .filter((r) => r > share + 0.0005)
    .slice(0, limit)
    .map((r) => ({
      share: r,
      topPercent: (1 - r) * 100,
      usd: netWorthAtShare(r),
    }));
}

function verdictFor({ share, tier, negative, zero }) {
  if (zero) {
    return {
      badge: 'Exactly zero',
      headline: 'What you own and what you owe cancel out',
      sub: 'A net worth of nothing is not the same as having nothing, and the distribution cannot rank it: the bottom band holds everyone from deeply indebted to almost-solvent, and the report does not separate them.',
    };
  }
  if (negative) {
    return {
      badge: 'Below zero',
      headline: 'Your debts are larger than what you own',
      sub: 'Net worth cannot rank this usefully, and the ranking would be misleading if it tried: this is the position of most people partway through a degree or a mortgage, and it says nothing about what they will earn.',
    };
  }

  const topPercent = (1 - share) * 100;

  if (topPercent <= 1) {
    return {
      badge: 'Global top 1%',
      headline: `You are in the wealthiest ${topPercent.toFixed(topPercent < 0.1 ? 3 : 2)}% of adults`,
      sub: 'This is the part of the distribution most people badly misjudge — the threshold is far lower than the word "one percent" suggests, and reaching it does not feel like anything from the inside.',
    };
  }
  if (topPercent <= 10) {
    return {
      badge: `Global top ${topPercent.toFixed(1)}%`,
      headline: `You are in the wealthiest ${topPercent.toFixed(1)}% of adults`,
      sub: 'Comfortably inside the top tenth of the world by net worth, and almost certainly unremarkable among the people you actually compare yourself to. Both things are true at once.',
    };
  }
  if (topPercent <= 50) {
    return {
      badge: `Global top ${Math.round(topPercent)}%`,
      headline: `You hold more than ${Math.round(share * 100)}% of the world's adults`,
      sub: `In the ${tier.label.toLowerCase()} band of the wealth pyramid — where most of humanity's assets that are not housing equity or savings simply are not.`,
    };
  }
  return {
    badge: `Bottom ${Math.round(share * 100)}%`,
    headline: `About ${Math.round(share * 100)}% of adults hold less than you`,
    sub: 'The lower bands are where this model is weakest — the report does not break them down finely, so read this as a band rather than a rank.',
  };
}

/**
 * @param {object} input
 * @param {number|string} input.netWorth  in the user's own currency
 * @param {string} input.currency         one of USD_RATES' keys
 */
export function evaluate({ netWorth, currency }) {
  const raw = toNumber(netWorth, NaN);
  const entered = Number.isFinite(raw);
  const usd = entered ? toUsd(raw, currency) : 0;

  // Zero is its own case, not a mild kind of negative: "your debts are larger
  // than what you own" is simply false when they cancel out exactly.
  const zero = entered && raw === 0;
  const negative = entered && raw < 0;
  const share = entered && !zero && !negative ? shareBelow(usd) : null;
  const ready = entered && (zero || negative || share != null);

  const tier = tierFor(usd);
  const adultsBelow = share != null ? share * ADULTS_COVERED : 0;
  const adultsAbove = share != null ? (1 - share) * ADULTS_COVERED : 0;

  // The median implied by the published bands. Deliberately labelled as
  // derived wherever it is shown: the report does not headline a global
  // median, and secondary sources quoting one usually predate this band
  // structure — 41% of adults under USD 10,000 puts the median above it.
  const medianUsd = netWorthAtShare(0.5);

  return {
    ready,
    entered,
    negative,
    zero,
    /** Either end of the scale: shown with caveats, never with a rank. */
    unranked: zero || negative,
    usd,
    currency,
    // Carried on the result so the chart and table never import the constants
    // separately and drift out of step with what was actually evaluated.
    tiers: TIERS,
    adultsCovered: ADULTS_COVERED,
    share,
    topPercent: share != null ? (1 - share) * 100 : null,
    rankLabel: rankLabel(share),
    tier,
    adultsBelow,
    adultsAbove,
    medianUsd,
    multipleOfMedian: share != null && medianUsd > 0 ? usd / medianUsd : null,
    // Below the first published ceiling the interpolation is doing more work
    // than the data is; the UI says so rather than quietly rounding.
    indicative: share != null && usd < 1e4,
    wealthShareOfTier: tier.wealthShare,
    milestones: share != null ? nextMilestones(share) : [],
    curve: buildCurve(),
    verdict: ready ? verdictFor({ share: share ?? 0, tier, negative, zero }) : null,
  };
}
