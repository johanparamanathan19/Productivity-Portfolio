<div align="center">

# Productivity Portfolio

**Small, focused web tools that do one thing well.**

No framework · no build step · no tracking · nothing leaves your device

[![Deploy](https://github.com/johanparamanathan19/Productivity-Portfolio/actions/workflows/deploy.yml/badge.svg)](https://github.com/johanparamanathan19/Productivity-Portfolio/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-informational.svg)](LICENSE)

[**Open the site →**](https://johanparamanathan19.github.io/Productivity-Portfolio/)

</div>

---

## The tools

| | Tool | What it does |
| :--: | --- | --- |
| 🌱 | **[Pomodoro](tools/pomodoro/)** | Focus timer with tasks, statistics, synthesised background soundscapes, and a garden that grows as you work |
| 💸 | **[Can I Afford This?](tools/affordability/)** | Runs a purchase past the affordability rules lenders and planners actually use, and tells you what would change the answer |
| ⏳ | **[How Much Time Do I Spend?](tools/time/)** | Treats a year as a fixed budget of 8,760 hours, prices your time from your own salary and work hours, and charts where it actually goes |
| ⚖️ | **[Is This Offer Worth It?](tools/value/)** | Scores any offer with Alex Hormozi's Value Equation — dream outcome, belief, time delay, and effort |
| 📈 | **[Buy It, or Invest It?](tools/invest/)** | Charts a purchase against leaving the same money in an index fund, in today's money, with the resale value you'd keep |
| 🪂 | **[How Long Could I Last?](tools/runway/)** | Divides your savings by your real monthly burn and shows the answer as months of runway, with a bar and what skipping one purchase is worth |
| 🏁 | **[When Could I Stop?](tools/fi/)** | Turns a year of spending into a financial independence target from the Trinity Study's 4% rule, charts when you would reach it, and prices what one permanent cut in spending is worth |
| 🪜 | **[Debt Escape Plan](tools/debt/)** | Charts avalanche vs. snowball payoff for whatever you owe, and prices the interest saved in money and life-hours |

Every tool stores its data in `localStorage`. There is no backend, no account,
and no analytics — see [SECURITY.md](SECURITY.md) for what that means in practice.

## Getting started

ES modules must be served over HTTP; opening `index.html` from the filesystem
will not work. Any static server does the job:

```bash
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

## How it fits together

```
├── index.html          Portfolio home — hero, tool grid, about
├── 404.html            Pages fallback (self-contained)
├── assets/
│   ├── css/            tokens.css · base.css · home.css
│   └── js/             tools.js · theme.js · modal.js · store.js · toast.js · home.js · currency.js
├── docs/               Design notes for the non-obvious parts
└── tools/
    ├── pomodoro/       index.html · pomodoro.css · js/ (12 modules)
    ├── affordability/  index.html · affordability.css · js/ (model + main)
    ├── time/           index.html · time.css · js/ (model + yearbar chart + main)
    ├── value/          index.html · value.css · js/ (model + main)
    ├── invest/         index.html · invest.css · js/ (model + growth chart + main)
    ├── runway/         index.html · runway.css · js/ (model + bar + main)
    ├── fi/             index.html · fi.css · js/ (model + accumulation chart + main)
    └── debt/           index.html · debt.css · js/ (model + payoff chart + main)
```

Three layers, in load order:

1. **`tokens.css`** — design tokens and the six colour themes. Nothing else
   defines a raw colour.
2. **`base.css`** — reset, page chrome, and the primitives every tool reuses:
   buttons, cards, modals, toasts.
3. **The tool's own stylesheet** — only what is genuinely specific to it.

Shared behaviour lives in `assets/js/`: `store.js` for persistence, `modal.js`
for dialogs, `toast.js` for status messages, `theme.js` for the palette.

### Design notes

Two parts are worth reading about before changing them:

- **[The affordability model](docs/affordability-model.md)** — which published
  guidelines the calculator applies, and why it answers *how much* rather than
  just *whether*.
- **[Synthesised soundscapes](docs/soundscapes.md)** — how rain, ocean, café,
  white noise, and the ambient pad are generated without any audio files.
- **[The time model and its chart](docs/time-model.md)** — how the hourly rate
  is derived, and how the yearly overview's colours were chosen and validated
  rather than picked.
- **[The Value Equation](docs/value-equation.md)** — how Alex Hormozi's
  four-lever formula was turned into concrete questions instead of an
  abstract 1–10 guess, and how the score and its weakest-lever advice work.
- **[Buying it vs. investing it](docs/invest-vs-buy.md)** — why the whole model
  runs in real terms, how the uncertainty band and depreciation keep the
  comparison honest, and how the chart's colours were validated.
- **[The runway model](docs/runway.md)** — why the burn rate is derived from
  income minus savings rather than trusted essentials alone, and why the bar
  is capped at 24 months.
- **[Financial independence](docs/financial-independence.md)** — what the
  Trinity Study actually found, why the withdrawal rate is a slider rather
  than a hardcoded 25×, and why the target is drawn as a band.
- **[The debt payoff model](docs/debt-payoff.md)** — why this tool runs in
  nominal terms unlike the rest of the suite, the evidence for avalanche vs.
  snowball, and why cutting the rate is priced as its own lever.

## Adding a tool

1. Create `tools/<slug>/index.html`, plus a stylesheet and a `js/` folder.
2. Link the shared layers first, then your own:
   ```html
   <link rel="stylesheet" href="../../assets/css/tokens.css" />
   <link rel="stylesheet" href="../../assets/css/base.css" />
   <link rel="stylesheet" href="<slug>.css" />
   ```
3. Copy the inline theme script from an existing page's `<head>`, so the saved
   theme applies before first paint instead of flashing.
4. Add an entry to `assets/js/tools.js` — the home page grid renders from it.

## Theming

Six themes ship in `assets/css/tokens.css`. Components only ever reference
semantic variables (`--accent`, `--surface`, `--text`, …), so a new theme is one
block of tokens plus one entry in `assets/js/theme.js`. The choice persists
under `site.theme` and is shared across every tool.

## Deployment

`.github/workflows/deploy.yml` publishes the repository root to GitHub Pages on
every push to `main`. There is no build step — what is committed is what ships.

## Contributing

Issues and pull requests are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md)
for the conventions this repo follows, and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
for the ground rules.

## License

[MIT](LICENSE) © Johan Paramanathan
