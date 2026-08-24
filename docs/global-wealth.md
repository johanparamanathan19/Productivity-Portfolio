# Where you are in the global wealth distribution

`tools/world/js/model.js` does something none of the other tools do: it does
not model your future, it locates you inside somebody else's published
dataset. That changes what the work is. There is no projection to get right
and no rate to argue about — there is only the question of whether the numbers
are what the source actually says, and whether the answer is presented in a way
that does not mislead.

So most of the effort here went into the second half of that.

## The four numbers everything rests on

The empirical basis is the UBS Global Wealth Report's wealth pyramid (the
series Credit Suisse used to publish), in its 2025/2026 edition:

| Net worth band | Adults | Share of wealth |
| --- | ---: | ---: |
| Under $10,000 | 1.55bn | 0.6% |
| $10,000 – $100,000 | 1.57bn | 12% |
| $100,000 – $1m | 628m | 39.2% |
| Over $1m | 60m | 48.1% |

Two arithmetic checks were run on transcription before any code was written,
because a mis-typed digit here would poison every figure downstream: the adult
counts sum to **3.808 billion**, and the wealth shares sum to **99.9%**. Both
land where they should.

Note what 3.808 billion is *not*: every adult alive. World adult population is
nearer 5.5 billion, and the report covers 56 markets. The UI therefore never
says "richer than 98% of the world" — it says how many of *the adults the
report covers* hold less. That distinction costs a few words and prevents a
real overclaim.

The cumulative anchors (40.7% below $10k, 81.9% below $100k, 98.4% below $1m)
are **derived from the adult counts** in `ANCHORS` rather than typed out
separately, so the two can never drift apart in a later edit.

## Three regimes, and honesty about which is which

`shareBelow()` has three branches, and they are not equally trustworthy. The
model says so, and so does the interface.

**Above $1 million — a fitted power law.** This is the best-attested part.
A Pareto tail is the standard description of top wealth, and two published
counts three decades apart determine it exactly: ~60 million millionaires and
~3,000 billionaires give α ≈ 1.434.

That fit is trusted because it was checked against two figures it was *not*
built from. It predicts ~2.2 million adults above $10m and ~81,000 above
$100m; reported values are roughly 2.2–2.5 million and ~80,000. A two-point fit
landing that close on two held-out decades is why the tail is drawn as a smooth
curve rather than left as a single "top 1.6%" step.

**Between $1 and $1 million — log-linear interpolation between the published
band ceilings.** This is the weak link and it is worth being precise about why.
Interpolating in log space assumes adults are spread evenly across each band on
a log scale. They are not: real density bunches toward the bottom of every band.
So percentiles in the lower bands read slightly *high*. Anything under $10,000
is flagged in the UI as indicative rather than measured, with a note saying to
read it as a range.

**Zero or negative — no percentile at all.** `shareBelow()` returns null and the
tool shows the verdict and the caveats but no rank, no chart position, and no
milestones. This is deliberate. The source does not break the bottom band down,
and a person with debts is precisely the case where a net worth percentile is
least meaningful. Manufacturing a number there would be the single worst thing
this tool could do.

## The inverse has to agree with the forward function

`netWorthAtShare()` powers the "what the next rungs cost" list, which means it
must be the exact inverse of `shareBelow()`. If it were even slightly off, the
tool would tell someone they are in the top 1.4% and, two cards later, that the
top 1% starts below where they already are — contradicting itself on the same
screen.

It round-trips exactly (agreement to 1e-9 across every rung from the median to
the top 0.01%), and the model is monotonic across all six decades. Both were
checked before the UI was built.

## Why the median is not headlined

The bands imply a global median of about **$16,800**. Secondary sources often
quote something nearer $9,000, and those two cannot both be right: if 40.7% of
adults hold under $10,000, the median is necessarily *above* $10,000. The lower
figure predates this band structure.

Rather than pick a side, the tool shows the median only as a "times the median
adult" comparison, explicitly labelled as *implied by the published bands*.
Headlining a global median that the report itself does not headline would be
inventing precision.

## The chart is logarithmic and cumulative, for two different reasons

**Logarithmic** is not a style choice. On a linear axis every adult on earth
except the billionaires collapses onto the left edge — a true picture of the
inequality and a useless picture of where any individual is.

**Cumulative** rather than a histogram is doing teaching work. The curve goes
nearly flat above $1m, so a reader can see for themselves that moving from $1m
to $10m is a tenfold change in money and about one and a half percentage points
of rank. A histogram would show the distribution's shape but not that, and that
is the fact most likely to recalibrate someone.

The four published bands render as neutral background shading, not as a second
series. They are the source's own divisions — a reference the reader needs in
order to know which stretches of curve are measured and which are interpolated
— so they get the same non-categorical treatment `tools/invest/`'s uncertainty
band and `tools/fi/`'s target zone get.

## No colour-coding of a person's net worth

Every other tool in the suite tints its verdict green, amber, or red. This one
does not. Every verdict uses the neutral accent, and the reader's own row in the
band table is marked with a tint rather than a status colour.

A percentile is a fact about a dataset. Rendering someone's position in red
would turn it into a grade, which is both a claim the data cannot support and a
thing no tool should be doing to a person about their bank balance.

## Static exchange rates, and why that is fine

Nothing in this project talks to the network, so `USD_RATES` is a static table
with a visible "as of" date. That sounds like a compromise and mostly is not
one: the distribution spans six orders of magnitude, so a 10% currency move
shifts a percentile by a fraction of a percentage point. The date is shown
anyway — a stale number with a visible date is honest; a stale number without
one is not.

The currency dropdown is filtered to codes the model actually holds a rate for,
so it is structurally impossible to rank a figure the tool cannot convert.

## What the tool refuses to do

It does not prefill net worth from the sibling tools. Both
`afford.inputs.savings` and `runway.data.savings` mean *liquid cash* — the
runway tool's own hint says "not index funds or a pension" — and neither is a
net worth. Only the currency is carried across.

And it never presents the rank as a verdict on a life. Half the results page is
given over to what the number leaves out: that it is a stock and not an income,
that market exchange rates flatter rich countries against purchasing power, that
mixing every age into one distribution disguises how much apparent inequality is
just the same person at different ages, and that a newly-qualified doctor with
student debt ranks below a subsistence farmer with a goat — which is not a bug
in the arithmetic but a precise demonstration of what net worth measures and
what it ignores.
