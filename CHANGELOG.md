# Changelog

Notable changes to the site. Dates are when the change landed on `main`.

The format loosely follows [Keep a Changelog](https://keepachangelog.com/).
This project has no released versions — the deployed site is always whatever is
on `main` — so entries are grouped by date rather than version number.

## Unreleased

### Added

- **Debt Escape Plan** — enter what you owe and what you can put toward it
  each month; charts highest-rate-first against smallest-balance-first, plus
  a minimums-only baseline, and prices the gap between them in interest,
  months, and (given an hourly wage) life-hours. Runs in nominal terms, a
  deliberate break from the rest of the suite's real-terms modelling, because
  a debt contract is nominal. Includes a rate-cut lever, since cutting the
  rate on the worst debt usually beats choosing a payoff order.
- **When Could I Stop?** — the financial independence number from the Trinity
  Study's 4% rule, plus the year you would reach it. The withdrawal rate is a
  3–5% slider rather than a hardcoded 25×, and the chart draws the target as a
  band between the 4% and 3% figures, because that dispute is the real
  uncertainty in the model. Includes a lever section pricing a permanent cut in
  spending against a one-off windfall of the same size.
- **How Long Could I Last?** — savings divided by real monthly burn, shown as
  months of runway with a capped gauge bar. The burn rate is derived from
  income minus what you save, not just stated essentials, and the gap between
  the two is surfaced as its own figure. Includes a skipped-purchase section
  comparing a one-off saving against cancelling something recurring.
- **Pomodoro: a "How to use this" guide**, covering the method step by step and
  the research behind why it works — with an explicit note that the 25/5 split
  itself is not a research finding.
- **Pomodoro: backup and restore.** Sessions already persisted to
  `localStorage`; this covers the cases it cannot survive, such as clearing
  site data or moving machine. Restoring merges rather than replaces, so it
  cannot destroy existing history.
- **Calculator: a yearly take-home figure**, alongside the hours-of-work tile,
  showing what share of a year's pay the purchase represents.
- **Calculator: info boxes** on the three questions people most often answer
  wrong — after-tax income, monthly expenses, and what counts as spendable
  savings (cash, not index funds).
- Repository documentation: `SECURITY.md`, `CONTRIBUTING.md`,
  `CODE_OF_CONDUCT.md`, issue and pull request templates, and design notes
  under `docs/`.

### Changed

- Calculator questions rewritten in plain language, with a blank field no
  longer treated as a deliberate zero.
- README slimmed, with the deep-dive sections moved into `docs/`.

### Fixed

- An unanswered calculator question no longer counts as a financial warning,
  which could tip a clean "yes" into "go in deliberately".

## 2026-08-06

### Added

- **Synthesised background soundscapes** for the Pomodoro timer — rain, ocean,
  café, white noise, and a generative ambient pad, all generated in the browser
  with no audio files.
- **Can I Afford This?** — a purchase sanity check built on published
  affordability guidelines.

### Changed

- The focus timer was renamed from Grove to Pomodoro. Storage keys stay
  namespaced `grove.*` so existing history is not orphaned.
- The repository was restructured from a single-page app into a portfolio with
  a shared design system and per-tool folders.

### Fixed

- A dead `[data-mode="short"]` rule set `--accent` to a self-referential
  `var()`, risking the accent colour being dropped entirely.
- Button text was hardcoded to a dark colour, making it unreadable on light
  themes.
- The Pages workflow referenced a non-existent `actions/deploy-pages@v5`.
