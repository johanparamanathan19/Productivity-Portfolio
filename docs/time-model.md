# The time model and its chart

`tools/time/js/model.js` treats a year as a fixed budget of hours — the same
move the affordability tool makes with a paycheque. Every category you fill in
is a claim against that budget; whatever is left over is either free time or
time nobody has counted yet, and that number is usually the point of running
the tool at all.

## A year is 8,760 hours

365 days × 24 hours, not fussed over for leap years. Every category can be
entered in whichever unit is natural — hours a night for sleep, hours a week
for work, hours a year for something like an annual holiday — and the model
converts everything to yearly hours underneath (`toYearlyHours`). 52 weeks a
year is used rather than 52.14 for the same reason the affordability tool uses
a nominal 160-hour month: a clean, round constant that is honest about being
an estimate, not a disguised claim of precision.

## The hourly rate comes from your own inputs

Asking "what's your hourly rate?" and "how many hours do you work?" as two
separate questions duplicates information the tool already has once you've
filled in the **Work** category. So it doesn't ask twice: the hourly rate is
your yearly salary divided by whatever you entered for Work, converted to a
yearly figure. Leave Work blank and it falls back to a standard 40-hour week
(2,080 hours a year), and says so in the UI rather than presenting a silent
assumption as a fact.

Every category's "worth" — shown inline and in the legend — is just that rate
multiplied by the category's yearly hours. Nothing here is a claim about what
your time is worth in some abstract sense; it is a paycheque figure applied
consistently.

## Blank fields, and one bug worth remembering

Form inputs hand back strings — `element.value` is a string even for
`type="number"`. The model's `clampPositive` coerces before checking
(`typeof n === 'number' ? n : parseFloat(n)`) specifically because the first
version used `Number.isFinite(n)` directly, which returns `false` for any
string without parsing it. That silently zeroed out every category a user
typed into by hand — quickfilled categories worked, because the quick-fill
button assigns real JS numbers straight into state, bypassing the input
element entirely, which is exactly why the bug didn't show up until testing
covered manual entry specifically. It's the same lesson as the affordability
tool's blank-vs-zero handling, from the opposite direction: there, a blank
needed to stay a blank; here, a typed value needed to stop being read as one.

## The chart: a bar, not a pie

A ring chart echoing the Pomodoro timer's dial was the obvious first idea —
visually appealing, thematically consistent. It was dropped because the
dataviz guidance this project follows is explicit about the form a
part-to-whole breakdown across several named categories should take: a
**stacked bar**, not a pie or donut. Angle judgement is weak; length judgement
is strong; and long category names need a legend regardless of chart shape.
The legend does the precise work; the bar gives the gestalt.

### Colour, computed rather than picked

The eight category colours are the validated reference categorical palette
from this project's dataviz skill, used verbatim — no hand-picked hex values.
Before writing any chart code, the palette was run through the skill's own
validator (`validate_palette.js`, loaded as a browser module since this
machine has no Node) against **all six of this site's actual theme
surfaces** — specifically each theme's `--bg-1`, an opaque colour, since the
chart renders on its own solid card background rather than the translucent
glass `--surface` the rest of the UI uses (saturated chart colours read as
muddy through frosted glass with this many segments).

Result: no hard failures on any theme. A few expected contrast WARNs (one
slot on three dark themes, four slots on the light Lavender theme) are
mitigated the way the skill requires — visible text labels and a full legend,
never colour carrying meaning alone. Category names are never rendered in
their category's colour; the swatch carries identity, the text stays in the
page's normal ink.

### Assigning colour without breaking the validation

The palette's adjacency checks only cover *neighbouring* slots in a fixed
order (1↔2, 2↔3, … 7↔8) — not arbitrary pairs. Skipping a slot to reach a
later one would put two colours on screen next to each other that were never
actually checked against each other.

So colours are assigned to a **contiguous prefix** of a fixed master category
order (`assignColorSlots` in `model.js`): walk the master order, and give the
next slot to each category that currently has hours entered, skipping blank
ones without leaving a gap in the slot numbers. Whichever categories are
present, their on-screen neighbours are always a subset of the pairs the
palette was validated on.

Two categories get a deliberately different treatment rather than a ninth
colour:

- **Unaccounted** is not an activity, so colouring it like one would overstate
  it. It renders as a neutral hatched fill instead of a hue.
- A **second** custom category (the first gets the reserved 8th slot) folds
  into an "Other" bucket — also neutral, not a generated colour — since a
  generated ninth hue is indistinguishable from an existing one under colour
  vision deficiency and would invalidate everything the validator checked.
  It's still itemised by name in the legend underneath; only the bar segment
  is merged.
