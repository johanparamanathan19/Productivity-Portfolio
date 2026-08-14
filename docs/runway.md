# How long could I last?

`tools/runway/js/model.js` answers the question personal finance keeps coming
back to under different names — freedom, security, "F-you money" — but rarely
states plainly: how long could you go without a paycheque? It's savings
divided by burn, and it deliberately stops there. It doesn't say whether that's
enough, only what it is.

## Why the burn rate isn't just "essentials"

The naive version — `savings / essentials` — is what most runway calculators
do, and it flatters the person using it. People can name their rent, their
electricity bill, their groceries. They chronically underestimate everything
else: the subscriptions, the takeout, the impulse purchases that don't feel
like a category. Trusting the stated essentials figure alone produces a number
that's wrong in exactly the direction that feels good.

The affordability tool already asks for two numbers this tool can reuse:
monthly income and what gets saved in a normal month. Together they imply a
second, more honest burn rate — `income − monthlySaving` — because whatever
isn't saved has, definitionally, been spent. When both are known, `derive()`
computes both figures and uses the larger one (`impliedBurn`, floored at the
stated essentials-plus-debt total so a data-entry quirk can't make the honest
number smaller than the flattering one).

The gap between the two — `unaccounted` — is the tool's real finding, not a
side effect. It's shown as its own figure and its own guidance line, in money
terms rather than months, because "about 4,200 a month leaves your account
that you haven't named" is a more useful sentence to someone than a runway
figure that quietly baked the same gap in.

When income or monthly saving is blank, the model falls back to
`essentials + debtPayments` alone and says so via the figure's own label —
never silently substituting one burn rate for the other.

## Two runway figures, on purpose

The result carries both `months` (from the real burn) and `leanMonths` (from
essentials alone, ignoring income). They're shown side by side as "your actual
runway" and "if you cut to essentials only" — the second is the ceiling on
what cutting harder could buy, not a claim about what will happen. Keeping
both visible, rather than picking one, is what stops the tool from either
overstating comfort (essentials-only) or understating the floor available in
a genuine emergency (implied-burn-only).

## Everything is a floor, not a forecast

Like `tools/invest/`, this runs entirely in today's money — but where that
tool's whole point is discounting the future, this one's is refusing to
model it at all. No growth on the savings balance, no inflation eating into
it, no tax on withdrawals, no emergency costing more than plan. Modelling any
one of those without the others would be worse than modelling none of them:
a "runway" that quietly assumes your savings keep earning while nothing else
changes is a more dangerous number than an honest, static one. The
disclaimer says this outright rather than burying it in a footnote.

## The bar is capped at 24 months

A gauge that scales to the actual runway looks impressive for anyone with a
long one and useless for anyone who needs it — a forty-year runway squashes
the 3- and 6-month reference ticks into a sliver at the origin, which is
exactly where the tool is doing its most important work. Capping the scale at
24 months keeps those ticks legible regardless of the number; anything past
the cap still fills the bar and states its true value in the label and the
screen-reader text, it just stops trying to be proportionate about it.

The three ticks — 3, 6, and 12 months — aren't arbitrary: they're the same
emergency-fund bands `tools/affordability/js/model.js` checks a purchase's
buffer against (`BUFFER_TARGET_MONTHS`, `BUFFER_COMFORTABLE_MONTHS`), plus the
twelve-month mark where the tool's own verdict language shifts from "safety
net" to "optionality." The constants are duplicated rather than imported —
every tool's model.js stays self-contained, the same choice `tools/time/`
made when it read the affordability tool's storage directly instead of
importing its module — but they're pinned to the same values on purpose, so
the two tools can't quietly disagree about what "enough" means.

## What one change is worth

The skipped-purchase section exists because a one-off saving and a cancelled
recurring cost are not the same shape of decision, and collapsing them into
one number would hide the more useful of the two:

- **One-off**, amount `A`: adds `A / netBurn` months. Linear — skip a bigger
  thing, get proportionally more runway.
- **Recurring**, amount `r` cancelled for good: the new runway is
  `savings / (netBurn − r)`. Non-linear, and it dominates the one-off case for
  any r worth naming, because it changes the denominator rather than adding to
  the numerator once.

Both read from the same amount field behind a toggle, so the size of that gap
is visible rather than asserted. If cancelling would eliminate the burn
entirely (`netBurn − r ≤ 0`), the result is the same indefinite state a
income-covers-costs profile gets — not a divide-by-zero, and not a made-up
number of months.

## What it deliberately doesn't do

It never suggests a target number of months, or implies six is "safe" and
three is "risky" beyond restating the same published bands the affordability
tool already uses. It has no opinion on what to cut. Like the invest tool, it
prices one side of a decision and leaves the judgment to the person holding
the number.
