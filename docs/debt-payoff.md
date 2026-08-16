# Debt Escape Plan

`tools/debt/js/model.js` is the mirror image of `tools/invest/js/model.js`: the same
monthly-step, compounding engine, run in the opposite direction. There, growth works for
you; here it works against you, and the tool's job is to show exactly what that costs and
how to stop it fastest.

Every other tool in this suite assumes there is surplus money to decide about — what to
do with it, how long it lasts, when it is enough. This is the one for before that: it is
the entry point for someone the rest of the site currently has nothing for.

## Nominal, not real — a deliberate break from the rest of the suite

`tools/invest/` and `tools/fi/` run in **real** (inflation-adjusted) terms, and both say
why: it stops a projection from quietly overstating what a future figure buys. This tool
runs in **nominal** terms instead, on purpose.

A debt contract is nominal. The APR on a statement is nominal, the balance owed is
nominal, and the payment leaving an account next month is a nominal number, not an
inflation-adjusted one. Deflating a payoff schedule would be technically defensible and
practically confusing — the debt-free month has to match the month on the actual
statement. Two tools on one site disagreeing about units without saying so would be a
real trap for a reader who uses both, so this is called out here, in the on-page
disclaimer, and at the top of `model.js`.

## The order that comes before strategy

Avalanche-vs-snowball is the interesting arithmetic question, but it is not the first
one. Above the results, a short "before the plan" list runs through the steps that
determine whether *any* payoff strategy survives contact with real life:

1. **Stop adding to the balances being paid down.** Every projection below assumes this
   silently; it has to be said out loud.
2. **Never miss a minimum.** A missed payment can trigger a default APR — commonly
   ~29.99% on a card that started well below that — which dwarfs anything a strategy
   choice saves. This is also *why* the model pays every minimum before it optimises
   anything: skipping one to throw more at the target debt is never correct.
3. **A small buffer before aggressive payoff.** Without roughly a month of essentials set
   aside, the next unplanned expense goes straight back on the card being paid down, and
   the plan unwinds. This is the part of Dave Ramsey's "baby steps" that survives
   criticism of the rest of the system, and it is the reason this guidance links to
   `tools/runway/`, which already computes the number.
4. **An employer retirement match, if there is one, usually outranks extra debt
   payments.** A 50–100% instant return beats even a punishing APR. This is presented
   behind an explicit toggle, not asserted as universal advice — it is a US 401(k)
   framing that does not translate cleanly (Norway's OTP is employer-funded with no
   match to forgo), and a tool that states it as fact for every visitor would simply be
   wrong for a large share of them.

None of this blocks the calculator. Nothing on this site gates its results behind a
wizard, and this tool does not start being the exception — the checklist is informational
context above results that are always live.

## Avalanche vs. snowball, and why both get computed

- **Avalanche** — pay minimums everywhere, throw every spare unit at the **highest-APR**
  balance. Provably optimal: for a fixed budget, no other ordering produces less total
  interest or a shorter payoff, ever.
- **Snowball** — same mechanism, ordered by **smallest balance** instead. It costs money
  relative to avalanche. It wins on a different axis: whether the plan gets finished at
  all.

The behavioural case for snowball is a real finding, not a folk theory, and belongs in
the guidance copy rather than being waved at:

- Amar, Ariely, Ayal, Cryder & Rick, *Winning the Battle but Losing the War: The
  Psychology of Debt Management*, Journal of Marketing Research (2011) — people close
  small accounts first even when it is not the cheapest move: "debt account aversion."
- Brown & Lahey, *Small Victories: Behavioral Insights into Attacking Consumer Debt*,
  Journal of Marketing Research (2015) — targeting the smallest balance first raises the
  odds of clearing debt overall.
- Kettle, Trudel, Blanchard & Häubl, *Repayment Concentration and Consumer Motivation to
  Get Out of Debt*, Journal of Consumer Research (2016) — motivation tracks the
  *proportion already repaid* on a concentrated account, which is the mechanism behind
  why snowball's early wins matter.

> Citation years, journals, and titles above should be checked against the original
> sources before publishing — this doc follows the same standard `financial-independence.md`
> holds itself to for the Trinity Study, and the substance is well established, but the
> bibliographic details were not re-verified against the primary text while writing this.

The tool's actual contribution is refusing to pick a side: it runs both, and prices the
difference in money and months. "Snowball costs an extra 4,200 kr and two months" lets
someone decide for themselves whether that is a fair price for a plan they will actually
finish — the same move `tools/invest/` makes when it prices a purchase against investing
without telling anyone whether to buy it.

**Both strategies use the same machine.** Avalanche is not a different algorithm from
snowball; it is the identical snowball mechanic — pay minimums, throw the surplus at one
target, roll a cleared debt's minimum into next month's surplus — with the target chosen
by APR instead of balance. Implementing them as two unrelated code paths would be a
correctness risk for no reason; `orderDebts(debts, strategyId)` is the only place the two
diverge.

## The minimum-payment trap

Card minimums are conventionally a **percentage of the balance** (roughly 2–3%) with a
floor (roughly 200–300 kr). Because the minimum falls as the balance falls, "just pay the
minimum" is not a slow payoff — on a typical card it is effectively never, stretched
across decades while interest outpaces the shrinking required payment. Modelling the
minimum as a flat amount would understate this dramatically, so `minimumFor()` computes
it as `max(floor, balance × pct)` every month, recalculated on the balance as it changes.

A third, always-visible line on the chart — **minimums only, no strategy** — exists
because of this. It is precedent, not decoration: the US CARD Act (2009) requires card
statements to disclose exactly this "if you only pay the minimum" figure, on the grounds
that seeing it changes behaviour.

## The simulation

One monthly step, matching `tools/invest/`'s cadence — cheap even at a 50-year horizon,
and accurate enough that nothing here is visibly wrong. Per month, per active strategy:

1. **Accrue interest** on every debt: `balance *= 1 + apr/100/12`. Real cards compound
   daily off an average daily balance; the monthly simplification is the same kind of
   conventional approximation `tools/invest/` makes with its own monthly step, off by a
   fraction of a percent, and it is a choice rather than an oversight.
2. **Pay every minimum**, each capped at that debt's current balance.
3. **Throw the remaining budget** at whichever debt the strategy currently targets.
4. **Cascade overflow within the same month.** If the target debt clears with money left
   over, the remainder does not wait for next month — it goes to the next debt in order,
   in the same pass. Dropping this is the single most common bug in a naive payoff
   simulator, and it silently overstates the payoff date by making the last debt or two
   look slower than they are.
5. **Roll freed minimums forward.** Once a debt is gone, its (now unneeded) minimum
   payment joins the surplus from the next month on. This is the mechanic that gives
   "snowball" its name, and avalanche gets it too — the two strategies differ only in
   *which* debt is the target, never in this rule.

**Tie-breaks are deterministic**, because without one the two strategies can jitter
against each other on equal inputs: avalanche ties on APR by preferring the smaller
balance; snowball ties on balance by preferring the higher APR. Either choice is
defensible; an *inconsistent* one is a bug.

## Edge cases, because each is a real person, not a test fixture

- **Budget below the sum of minimums.** No payoff strategy exists at that budget, and the
  tool says exactly that — `feasible: false`, the shortfall stated as a number, and a
  route to non-profit debt counselling (see below). It never fabricates a payoff date to
  avoid an uncomfortable result.
- **A debt whose monthly interest exceeds its minimum.** That balance grows without
  bound regardless of strategy; `neverPaidIds` names it explicitly rather than letting it
  silently distort the total.
- **A horizon past 600 months (50 years).** Reported as `truncated`, phrased as "more
  than 50 years at this rate" rather than a chart that trails off unexplained.
- **A single debt.** Avalanche and snowball are definitionally identical; the tool says
  the ordering question does not apply here instead of presenting two lines that overlap
  for no visible reason.
- **A 0% APR row** (family loan, 0% promo). Must not divide by zero anywhere in
  `minimumFor` or the interest step; still gets ordered correctly by snowball.

## What this deliberately does not decide

It never tells anyone to take a consolidation loan, a balance transfer, or any other
product — those are decisions for a specific offer with specific terms, and a generic
tool recommending one to a stranger would be irresponsible. It states, as guidance, that
**cutting the rate itself usually beats choosing an order** — a rate cut compounds across
every month of the remaining payoff, where reordering only reshuffles when each dollar of
interest is paid — and offers a lever to price *"what if this debt's rate were X%"*
against the plan already on screen, without recommending a way to get there.

It never converts a shortfall into a demand. When the budget cannot cover the minimums,
the honest next step is outside a calculator's competence, so the tool signposts
non-profit counselling — NFCC in the US, StepChange in the UK, NAV's economic and debt
counselling service in Norway — rather than either inventing false hope or leaving the
person with nothing.

It never rates the person. The `bad` verdict tone is reserved for structural facts — an
infeasible budget, a debt in negative amortisation — never for the size of the debt
itself or how it was accumulated. A tool that makes someone in debt feel judged is a tool
that gets closed before it helps.

## The chart

Same grammar as `tools/invest/js/growthchart.js` and `tools/fi/js/fichart.js`: trend over
time, on **one** money axis, never two y-scales. Two live series — avalanche and
snowball, both falling to zero — plus the minimums-only baseline as a muted dashed
reference rather than a third colour slot, the same treatment the invest chart gives its
uncertainty band and the fi chart gives its target zone. Direct end-labels and the
"Show the numbers" table are required, not optional, because slot 2 of this site's
palette sits under 3:1 against the surface on the light Lavender theme — recorded in
`docs/invest-vs-buy.md` and inherited here rather than re-litigated.

A second, smaller visual — an ordered timeline of payoff months per debt — sits beside
the chart. It is the concrete form of the Kettle et al. finding above: watching each
account's month arrive is what makes "proportion repaid" visible rather than abstract.

## Life-hours

The same conversion the affordability and time tools use: interest paid, divided by a
take-home hourly figure, is hours of a life spent servicing debt rather than anything
else. It is optional and additive — asking for one more number up front would cost more
in abandoned forms than the figure is worth to everyone who would skip it, so the tile
simply does not render without it, exactly as `tools/invest/`'s recurring-mode tile only
appears when it applies.

## What it deliberately doesn't do

It never says which strategy to pick — it prices both and lets the difference speak. It
never recommends a specific financial product. It never implies the model's simplified
monthly compounding matches a statement to the cent. And it never treats being in debt as
a verdict on the person holding it — only the plan gets scored.
