# Financial independence

`tools/fi/js/model.js` computes the number everyone quotes — annual expenses
× 25 — and then spends most of its effort undermining the confidence that
multiplier invites. The affordability tool answers *can you*; the runway tool
answers *how long could you last*; this one answers *when could you stop*, and
the honest answer is a range with a date attached to it, not a figure.

## What the Trinity Study actually found

The 4% rule comes from Cooley, Hubbard & Walz (1998), who tested historical
30-year windows of US stock/bond portfolios and found that withdrawing 4% of
the starting balance in year one, then raising that amount with inflation each
year afterwards, left the portfolio intact in nearly all of them. 25× falls
out of that as `1 / 0.04`.

Three properties of that result are load-bearing, and the tool refuses to hide
any of them:

- It is a **historical success frequency**, not a guarantee — and it is drawn
  from one country's unusually good century. Nothing about it is a law.
- It was tested over **30 years**. Someone retiring at 40 is asking it a
  question it never answered, and the failure modes get worse as the horizon
  extends past the window that was measured.
- **Later work disputes it downward.** Wade Pfau and others argue for 3–3.5%
  when starting yields are low, on the grounds that sequence-of-returns risk
  in the first decade dominates the outcome far more than the average return
  does.

That last point is why the tool says, in its guidance, that sequence matters
more than average — and admits in the same breath that no single line on a
chart can show it. A projection with one return assumption is structurally
incapable of representing the risk that the argument is actually about. Saying
so is better than implying the chart has covered it.

## The rate is a slider, and the target is a band

Hardcoding ×25 would make this tool a worse citizen than the study it quotes.
So the withdrawal rate is an input spanning **3% to 5%**, defaulting to 4%,
with the multiplier shown live beside it (×33.3 → ×25 → ×20). Watching the
target move as that slider does is the fastest way to understand that the
number was never precise.

The chart takes the same position structurally: the target renders as a
**shaded band between the 3% and 4% targets, not a single line**. A line would
imply the finish is a known quantity, when it is the most contested figure in
the model. This is the same reasoning `docs/invest-vs-buy.md` gives for banding
its return.

Only one thing gets banded. Banding the return *as well* would put two
uncertainties in the same ink and let the reader attribute the width to
whichever they preferred. The target is the more disputed of the two, so it
wins the band; the return stays a single stated assumption.

## Real terms, and the constant that is duplicated on purpose

Everything runs in today's money, exactly as `tools/invest/` does — a real
return, a real target, no nominal figures anywhere. The default real return is
pinned to the same 7% that tool uses, because the two model the same asset over
the same kind of horizon and it would be indefensible for them to disagree.

The constant is **duplicated rather than imported**. Every tool's `model.js`
stays self-contained — the same call `tools/runway/` made with the
emergency-fund bands — but the comment at the declaration says what it is
pinned to and why, so the duplication is a decision rather than an accident.

## Solving for the date

Time-to-target is the standard future-value-of-an-annuity equation solved for
`n`, in closed form rather than by iterating:

```
FV = P(1+r)^n + s·((1+r)^n − 1)/r
```

Setting `FV = target` and letting `x = (1+r)^n` gives `x(P + s/r) = target + s/r`,
so `n = ln((target + s/r)/(P + s/r)) / ln(1+r)`. The `r = 0` case divides by
zero in that form and gets its own linear path, as does the case where nothing
is being contributed and compounding alone has to close the gap.

Contributions land at **period end** here, unlike `tools/invest/`'s
annuity-due. That difference is deliberate in both places and a bug in
neither: the invest tool models money you would otherwise have spent that
morning, so it is diverted at the start of the period; this models a year's
saving accumulating across that year. Both files say so at the relevant
function, because two sibling tools doing the same arithmetic differently is
exactly the kind of thing that looks like an error at a glance.

## The savings rate is the finding

`savingsRate` is a first-class returned value, not an intermediate, because it
is the insight the tool exists to deliver: **time to independence depends on
the share of income you keep, almost not at all on the size of it.** Two people
saving the same percentage arrive at nearly the same time whatever their
salaries, because an income that is fully spent raises the target exactly as
fast as it fills it.

That is also why the lever section prices a **permanent cut** rather than a
windfall. A recurring cut hits both sides of the equation at once — it lowers
the target by the cut times the multiplier, *and* raises annual saving by the
same cut. The tool computes the same amount as a one-off windfall directly
beneath it, so the asymmetry falls out of the arithmetic on screen instead of
being asserted in prose. It is usually enormous, and it is the single most
counter-intuitive thing here.

## The prefill trap

The tool prefills from `runway.data` and `afford.inputs` on first run only,
persisting immediately, the same pattern `tools/runway/js/main.js` documents.

It deliberately does **not** prefill invested assets from either tool's savings
field. Both `runway.data.savings` and `afford.inputs.savings` mean *liquid cash
you could spend this week* — the runway tool's own hint says "not index funds
or a pension." That is the opposite quantity to invested assets. Filling
someone's retirement target with their emergency fund would produce a
confidently wrong date, which is worse than an empty field, so invested assets
stays a question this tool asks for itself.

Expenses, by contrast, are genuinely shared: the runway tool's honest burn rate
(income minus what is saved) is the same quantity a year apart, so that one is
carried across and multiplied by twelve.

## Coast

Given an age, the tool also reports the **coast number** — `target / (1+r)^(65−age)`,
the portfolio that would reach the target by 65 on compounding alone with
nothing further added. It costs one input and one line of arithmetic, and for
many people it arrives years before the full number does, which makes it the
more actionable of the two figures.

## What it deliberately doesn't do

It never suggests anyone should retire, never implies 4% is safe, and never
converts the target into a monthly savings prescription. It prices one side of
a decision and leaves the judgement to the person holding the number — the same
line `tools/invest/` draws, for the same reason.
