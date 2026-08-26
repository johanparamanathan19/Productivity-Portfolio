# How to Split

`tools/split/js/model.js` is deliberately the smallest model in this suite. Every
other tool earns its complexity — compounding, a Trinity Study citation, a
month-by-month payoff simulation. This one doesn't need any of that: splitting a
bill between two people is proportional arithmetic, and a tool that tried to be
cleverer than that would just be worse at the one job it exists for.

## Two people, one ratio, one exception

Every item is either:

- **shared**, split by one ratio the two people agree on up front — not
  assumed to be 50/50, because it usually isn't. One person's take-home pay,
  or whose idea the trip was, or a dozen other reasons make 60/40 the honest
  number far more often than an even split is.
- **100% one person's**, ignoring the ratio entirely.

That second case is the actual point of this tool. A shared credit card
collects things that were never shared — a personal subscription, a solo
lunch, a gift for someone else's family. Forcing those through the same ratio
as the genuinely shared costs would be wrong on every one of them. So the
ratio only ever touches items marked "split by ratio"; a 100% item is fully
whoever it's marked for, and `splitItem()` never blends the two.

There's no per-item ratio override and no third person. Both are real features
a bigger app would want. Neither is what makes this tool useful — the two
things above are — so neither is here.

## The settlement is the useful conversion

Fair shares alone are already something (`owedA`, `owedB` — what each person
should put toward the total). But "sharing a credit card" implies a specific
shape: one card, all the charges land on it, and at the end you need to know
who owes whom, not just what everyone's theoretical share is.

`evaluate()` takes an optional `paidBy`. When set, whichever person **didn't**
front the card owes the other their own fair share, full stop — the payer's
own share was already covered by paying the bill, so it collapses to one
transfer:

```
paidBy = 'a'  →  B owes A: owedB
paidBy = 'b'  →  A owes B: owedA
```

This is why the model computes both people's full fair share unconditionally,
even though only one of the two numbers survives into the settlement — the
other one is what makes the transfer amount correct rather than just
"whatever's left," and it's what the legend under the split bar shows on its
own, independent of who paid.

A settlement below half a cent is treated as no settlement at all
(`SETTLE_EPSILON`) — the alternative is a UI that occasionally asks someone to
transfer 0.003 of a currency unit, which is a bug wearing a decimal point.

## Nominal, nothing derived

Every amount is exactly what was typed, in whatever currency is selected —
there's no time horizon, no growth, nothing to compound. That puts this tool
closer to `tools/value/`'s plain arithmetic than to `tools/invest/`'s modelling;
the interesting design decisions here are about what the tool *asks for*, not
what it computes from the answer.

## The bar, not a chart

There's no time axis, so this isn't a line chart — it's the same non-chart
treatment `tools/runway/`'s gauge bar gives a single number, extended to two
segments instead of one fill against a track. `splitbar.js` sets one CSS
variable (`--fill-a-pct`); the second segment is `flex: 1 1 auto` and simply
takes whatever's left, so the two segments can never disagree about the total
regardless of rounding.

Names and amounts are never painted as text on top of the coloured fill. At a
95/5 split one segment is a five-pixel sliver — nowhere to put a label even if
color contrast weren't a concern, and it is one: this reuses the exact
`--series-a` / `--series-b` palette slots `tools/invest/invest.css` validated,
including the Lavender override, and `docs/invest-vs-buy.md`'s finding that
slot 2's orange sits under 3:1 against a light surface applies here exactly as
it does there. The legend below the bar is the one true source for every name,
amount, and percentage; the bar itself is illustration, not data.

## Figures, the bar's legend, and the breakdown table don't repeat each other

Three places on the results side show numbers, and each was written to answer
a genuinely different question rather than restate the same fact three times
— the mistake `docs/debt-payoff.md`'s changelog records fixing once already:

- **The bar's legend** — a per-**person** view: what each of the two people
  owes in total, with a colour key tying it to the bar.
- **The figures row** — a per-**category** view: the grand total, how much
  ran through the shared ratio, how much was 100%-items, and the settlement
  transfer if there is one. None of these numbers appear in the legend.
- **The breakdown table** — a per-**item** view: every line, its split, and
  what it contributed to each person's total. This is the only place a single
  item's own numbers are visible, and it's always shown rather than hidden
  behind a toggle — a bill split rarely has enough lines to need one.

## What it deliberately doesn't do

No more than two people — a third person turns "one ratio" into a genuinely
different problem (whose ratio, split against whom), and this tool would need
a redesign, not an extra field, to do that honestly. No history and no concept
of "already paid" — it computes the answer for whatever's currently listed and
trusts the two people to actually make the transfer; clearing the list and
starting over is the reset for a new round, not a bug. And it never guesses a
ratio — 50/50 is the default because it's the least assumption, not because
it's usually right.
