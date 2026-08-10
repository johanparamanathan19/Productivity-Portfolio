# Buying it vs. investing it

`tools/invest/js/model.js` prices the second, invisible half of a purchase: what
the money would have become if it had been left alone. The affordability tool
answers *can you*; the Value Equation tool answers *is it worth it*; this one
answers only *what does it cost you*, and deliberately stops there.

## Everything is in real terms

The whole model runs in **today's money**. The return is a real
(after-inflation) return, the item's price is held constant, and depreciation is
real depreciation. That choice is load-bearing rather than cosmetic: a nominal
model produces bigger, more exciting numbers that quietly overstate what they'd
actually buy in thirty years, and the caveat explaining that is exactly the kind
of thing people skim past. Better to be boring and right.

The default of ~7% is the figure most commonly cited for long-run real returns
on broad stock indices. It is a historical average over many decades, not a
forecast, and this repo has no privileged data to improve on it.

## The band exists because the average is a lie about any given decade

A single projected line implies a precision nobody has. The chart draws the same
money at three percentage points either side of the assumed rate, as an area
wash in the invested series' own hue — it is that series' uncertainty, not a
third series, so it does not take a second colour slot. The gap between the
optimistic and pessimistic edge is usually wide enough to make the point on its
own.

## What you'd still own

Treating the purchase price as simply vanishing would overstate the case for
investing on anything durable, and a sharp reader would notice. So the second
line tracks resale value, depreciating by category — 25%/yr for electronics,
20% for a new car, 3% for jewellery, and 100% immediately for anything consumed
(a holiday, a meal, a subscription). The rates are rules of thumb, and the
custom option exists because they are.

This is what stops the tool from being rigged. Buy something that holds its
value over a short horizon and the verdict genuinely says the gap is small.

## One time step, one code path

Any recurring amount is normalised to a monthly figure up front
(`monthlyAmount`), so a daily coffee and a yearly insurance premium run through
identical code. Stepping monthly keeps a 40-year horizon under 500 iterations
while staying accurate enough that the compounding isn't visibly wrong.

The invested side is an **annuity-due** — contributions land at the *start* of
each period, because this is money you'd otherwise have spent that morning, not
at the end of some accounting month. The owned side is computed iteratively
rather than in closed form: the recurring case is a stack of items of different
ages, and a fully-consumed category has to collapse to zero without dividing by
zero.

## "When does it pay for itself?"

The more useful framing than raw opportunity cost, and it differs by mode:

- **One-off** — the year the *gains alone* cover the price. At that point you
  could buy the thing outright and still hold your original stake, so the money
  has effectively bought it for free. That's the doubling point.
- **Recurring** — the year one month of real return covers one month of the
  cost. Past there the fund sustains the habit indefinitely without touching the
  principal. "Your coffee habit pays for itself from year 11" is a far more
  useful sentence than "it never breaks even."

Both land near the same number at any given rate, which looks like a bug and
isn't: solving `(1+r)^(n+1) = 2 + r` for the annuity case lands within a month
of the plain doubling time. It was checked by hand precisely because two
identical figures are suspicious.

## The chart

Trend over time for two distinct series, so: a multi-line chart on **one** money
axis. Never two y-scales — that invents a relationship the data doesn't contain,
and it is the single most common charting mistake.

Colours are slots 1 and 2 of the project's validated categorical palette, used
verbatim. Before any chart code was written they were run through the dataviz
skill's validator against all six of this site's theme surfaces (as the opaque
`--bg-1` the chart card renders on, not the translucent glass the rest of the UI
uses). All six pass under the strict all-pairs check: worst CVD ΔE 26.8 dark /
24.7 light, against a target of ≥8.

One result mattered: on the light Lavender theme the orange sits at 2.58:1
against the surface, below 3:1. Under the skill's relief rule that obligates
visible labels or a table view — which is why the direct end-labels and the
"Show the numbers" table are required parts of this chart rather than nice
extras. The crosshair tooltip behaves identically on keyboard focus (arrow keys,
Home, End), because a tooltip may enhance a chart but must never be the only way
to reach a value.

## What it deliberately doesn't do

It never says "don't buy it." It cannot know what the thing is worth to you —
that is a different question, and the last guidance card links to the tool that
actually asks it. Presenting an opportunity-cost figure as a verdict on
somebody's spending would be both preachy and wrong.
