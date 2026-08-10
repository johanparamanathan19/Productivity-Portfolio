# The Value Equation

`tools/value/js/model.js` implements Alex Hormozi's Value Equation from
*$100M Offers* (2021):

```
Value = (Dream Outcome × Perceived Likelihood of Achievement)
        ----------------------------------------------------
                 (Time Delay × Effort & Sacrifice)
```

The book uses this as a design lens for people building offers — maximise
the top, minimise the bottom — not as a calibrated formula with real units.
This tool turns it into a repeatable score anyway, on the book's own terms,
for someone on the other side of the offer deciding whether to say yes.

## Two levers are concrete, two are a feeling

Dream Outcome and Perceived Likelihood are genuinely subjective — there is
no unit for "how much you want something." Rather than leave that fully
abstract, every point on both 1–10 sliders is backed by a plain-language
example (`DREAM_OUTCOME_LEVELS`, `LIKELIHOOD_LEVELS` in `model.js`), so a
bare "6/10" never has to stand on its own.

Time Delay and Effort & Sacrifice don't need to stay abstract at all —
they're the same trap "take-home pay" turned out to be in the affordability
calculator: a number that sounds precise but is hard to answer honestly off
the top of your head. So neither is a slider:

- **Time Delay** asks for a real duration — hours, days, weeks, months, or
  years until the *result*, not until you start — and converts it to a
  1–10 score on a log scale (`delayScore`). Log, not linear, because the
  felt difference between a one-day wait and a one-week wait is much larger
  than between a 13-month wait and a 14-month one; a linear scale would
  flatten exactly the range most real offers live in.
- **Effort & Sacrifice** is a checklist of six concrete costs (ongoing
  discipline, giving something up, social discomfort, depending on other
  people, learning a new skill, extra money beyond the price), each with
  its own weight. You check what's actually true; the score is computed
  from that, never guessed directly.

## The score

`raw = (D × L) / (T × E)` ranges from 0.01 (worst case) to 100 (best case).
Rather than show that raw ratio — meaningless to look at on its own — it's
log-mapped onto a 0–100 "value score" (`scoreFromRaw`), chosen so that
**50 lands exactly where the numerator equals the denominator**, not at
some arbitrary point the raw scale happens to produce. Bands above and
below that midpoint (35 / 55 / 75) set the verdict tone, reusing the same
good/ok/bad status colours as the other two tools.

## The weakest lever

Alongside the score, the tool names whichever of the four inputs is
dragging hardest against a good outcome (`findWeakestLever`): all four are
normalised to a common 0–1 "how much is this helping" scale — Dream Outcome
and Likelihood directly, Time Delay and Effort inverted, since low is good
on those two — and the lowest one gets a targeted, book-consistent
suggestion (ask for a faster win, look for proof, pay to remove effort,
and so on) rather than a generic "improve everything."

## Worked examples, not a blank form

The three "try an example" presets (`EXAMPLES` in `model.js`) are chosen to
land in different bands on purpose — a gym membership most people quietly
know they won't use, a coaching program with a guarantee and a fast first
win, and a free webinar pitching an expensive course on vague promises —
so the tool teaches its own scoring by demonstration before anyone has to
trust an empty form.

## What this deliberately leaves out

The equation as stated has no price term — Hormozi's model treats "value"
as independent of what something costs; price is what you weigh the value
*against*, not an input to it. Adding a price field here would have
answered a different question than the one asked, so it stays out. Nothing
you type leaves your device, and none of the four inputs are measurements —
they're your own honest estimate, which is what the disclaimer on the page
says outright rather than dressing the result up as more certain than it is.
