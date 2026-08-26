# How to Split

`tools/split/js/model.js` is deliberately the smallest model in this suite. Every
other tool earns its complexity — compounding, a Trinity Study citation, a
month-by-month payoff simulation. This one doesn't need any of that: splitting a
bill between two people is proportional arithmetic, and a tool that tried to be
cleverer than that would just be worse at the one job it exists for.

## The flow matches how a statement is actually read

The first version of this tool asked for a full line-by-line itemisation of the
bill — every row tagged as shared or 100% one person's. It was wrong, and not
in a subtle way: nobody re-types their whole grocery run from a statement.

What people actually have is a total, a ratio they already split by, and a
short list of exceptions — the handful of lines on that statement that were
never really shared at all. So the tool asks for exactly that, in the order
you'd naturally arrive at the answer:

1. **The total bill** — everything on it, before anything gets set aside.
2. **The split ratio** — 60/40, not assumed to be 50/50, because it usually
   isn't. One person's income, or whose idea the trip was, makes an uneven
   split the honest number far more often than an even one is.
3. **What was paid individually** — a PS5, a makeup order: things that rode
   the same card but were never anyone's to share.
4. **The result** — exactly what each person pays, in one line, with the
   arithmetic that got there laid out underneath it.

## The arithmetic

```
shared amount = total bill − individual items
each person's total = their ratio share of the shared amount
                     + whatever was individually theirs
```

`evaluate()` computes both totals unconditionally and returns them alongside
the shared amount and the individual total, so the results panel can show the
full derivation — total, minus individuals, times ratio, plus individuals back
— rather than presenting a final number with no visible working. A reader who
doesn't trust a calculator's arithmetic should be able to check it by hand from
what's on screen, the same standard `docs/debt-payoff.md` holds its own
numbers to.

Individual items are subtracted from the total and added back **in full**,
never touched by the ratio at any point — `sharedAmount` is computed before
the ratio is applied to anything, and an individual item's `owner` field only
ever feeds directly into that person's final total. There is no path in the
code where an individual item's amount is multiplied by the ratio.

## When the numbers don't add up

If the individual items alone exceed the total bill, there is nothing left to
split and something above is almost certainly a typo — a bill entered short,
or an item double-counted. `sharedAmount` clamps to zero rather than going
negative, and `overAllocated` is returned as its own flag rather than left for
the UI to infer from a suspicious-looking number.

Critically, the tool doesn't hide the broken state to avoid showing bad
numbers — it still renders each person's total (now equal to just their own
individual items, since nothing is shared), still draws the bar, and adds an
"Over by" figure stating the shortfall directly. The `bad`-tone verdict badge
and headline carry the warning; the underlying figures stay honest rather than
disappearing, which would just replace one confusing state with a blanker one.

## The bar, not a chart

There's no time axis, so this isn't a line chart — it's the same non-chart
treatment `tools/runway/`'s gauge bar gives a single number, extended to two
segments instead of one fill against a track. `splitbar.js` sets one CSS
variable (`--fill-a-pct`); the second segment is `flex: 1 1 auto` and simply
takes whatever's left, so the two segments can never disagree about the total
regardless of rounding.

The bar plots the **final** amounts (ratio share plus individual items), not
the raw ratio — at a 60/40 ratio with a lopsided individual item on one side,
the bar can show 75/25. That's not a bug: the bar's job is to show what each
person actually owes, and the figures row directly above it already shows the
ratio separately from the final totals, so nothing here misrepresents what the
ratio itself was set to.

Names and amounts are never painted as text on top of the coloured fill. A
segment can be a sliver at a lopsided split — nowhere to put a label even if
color contrast weren't a concern, and it is one: this reuses the exact
`--series-a` / `--series-b` palette slots `tools/invest/invest.css` validated,
including the Lavender override, and `docs/invest-vs-buy.md`'s finding that
slot 2's orange sits under 3:1 against a light surface applies here exactly as
it does there. The legend below the bar is the one true source for every name,
amount, and percentage; the bar itself is illustration, not data.

## Figures, the bar's legend, and the individual-items summary don't repeat each other

Three places on the results side show numbers, and each was written to answer
a genuinely different question rather than restate the same fact three times:

- **The figures row** — the derivation: total bill, what was set aside, what's
  actually split. A per-**step** view.
- **The bar's legend** — a per-**person** view: what each of the two people
  pays in total, with a colour key tying it to the bar.
- **The individual-items summary** — a per-**item** view: exactly what was set
  aside and who it belongs to, so a reader can double-check the one part of
  the input that isn't a single number.

None of the three shows a figure either of the others already shows.

## What it deliberately doesn't do

No line-by-line itemisation of the whole bill — see above for why that was
tried and reverted. No more than two people — a third person turns "one
ratio" into a genuinely different problem that this tool would need a
redesign, not an extra field, to handle honestly. No tracking of who actually
holds the card or whether a transfer has happened — it computes what each
person owes for whatever's currently entered and trusts the two people to
settle it; clearing the form is the reset for the next bill, not a bug. And it
never guesses a ratio — 50/50 is the default because it's the least
assumption, not because it's usually right.
