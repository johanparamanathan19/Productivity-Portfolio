# Portfolio — small, useful tools

A personal portfolio built around a growing collection of focused web tools.
No framework, no build step, no tracking: plain HTML, CSS, and ES modules,
deployed to GitHub Pages on every push to `main`.

**Live:** https://johanparamanathan19.github.io/Productivity-Portfolio/

## Tools

| Tool | What it does | Status |
| --- | --- | --- |
| [Pomodoro](tools/pomodoro/) | Focus timer with tasks, statistics, synthesised background soundscapes, and a garden that grows as you work | Live |
| [Can I Afford This?](tools/affordability/) | Runs a purchase past the affordability rules lenders and planners use, and says what would change the answer | Live |

Every tool keeps its data in `localStorage` — nothing is sent anywhere.

## Project structure

```
.
├── index.html              Portfolio home: hero, tool grid, about
├── 404.html                Pages fallback
├── assets/
│   ├── css/
│   │   ├── tokens.css      Design tokens + the six colour themes
│   │   ├── base.css        Reset, background, buttons, cards, modals, toast
│   │   └── home.css        Home page only
│   └── js/
│       ├── tools.js        Tool registry — the source of truth for the grid
│       ├── theme.js        Site-wide theming (persisted, shared across tools)
│       ├── modal.js        Modal open/close/Escape behaviour
│       ├── store.js        Guarded localStorage helpers
│       ├── toast.js        Transient status messages
│       └── home.js         Home page entry point
└── tools/
    ├── pomodoro/
    │   ├── index.html
    │   ├── pomodoro.css      Timer-specific styles
    │   └── js/
    │       ├── main.js         Phase machine + wiring
    │       ├── config.js       Constants, defaults, storage keys
    │       ├── state.js        Persisted settings, tasks, stats
    │       ├── countdown.js    Drift-free wall-clock timer
    │       ├── tasks.js        Task list behaviour
    │       ├── stats.js        History, streaks, charts
    │       ├── audio-context.js  One shared AudioContext
    │       ├── audio.js        Web Audio chimes and ticks
    │       ├── soundscape.js   Synthesised background ambience
    │       ├── confetti.js     Canvas celebration
    │       └── notify.js       Desktop notifications
    └── affordability/
        ├── index.html
        ├── affordability.css
        └── js/
            ├── model.js      The rules engine — pure, no DOM
            └── main.js       Form reading and rendering
```

### How the soundscapes work

`tools/pomodoro/js/soundscape.js` generates rain, ocean, café, white noise, and
an ambient pad at runtime from noise buffers and oscillators. There are no
audio files, so there is nothing to download, nothing to licence, and no
megabytes in the repository — and because nothing is sampled, the ambience
never loops.

Broadly: white noise is a flat random signal, pink falls off at 3 dB per
octave, and brown (integrated) noise is the rumble under most natural sound.
Rain is band-limited noise plus scheduled droplet transients; ocean is brown
noise under slow filter and gain swells; café is room tone plus randomised
bursts in the speech range; the ambient pad plays a minor pentatonic through a
synthesised reverb. Scene levels are matched against each other so switching
does not jump in volume.

### How the affordability engine works

`tools/affordability/js/model.js` holds every rule and threshold, as pure
functions with no DOM or storage access, so the logic can be read — or
tested — on its own. It does not invent a score. It runs the purchase past
published guidelines and reports which ones it clears:

- a 3–6 month emergency fund,
- 50/30/20 budgeting (needs / wants / savings),
- the 28/36 debt-to-income rule from mortgage underwriting,
- the 30% housing-cost threshold used to define "cost burdened",
- 20/4/10 for vehicles (20% down, ≤4 years, ≤10% of income).

Thresholds are applied to **take-home** pay rather than gross, which makes
them stricter than a lender's version. When the answer is no, the tool
bisects the same model to find the price that *would* clear every check,
which is usually the more useful number.

## Running locally

ES modules must be served over HTTP — opening `index.html` straight from the
filesystem will not work. Any static server does the job:

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000.

## Adding a tool

1. Create `tools/<slug>/index.html`, plus a stylesheet and a `js/` folder.
2. Link the shared layers first, then your own:
   ```html
   <link rel="stylesheet" href="../../assets/css/tokens.css" />
   <link rel="stylesheet" href="../../assets/css/base.css" />
   <link rel="stylesheet" href="<slug>.css" />
   ```
3. Copy the inline theme script from an existing page's `<head>` so the saved
   theme applies before first paint.
4. Add an entry to `assets/js/tools.js` — the home page grid renders from it.

Reuse `assets/js/` rather than reimplementing: `store.js` for persistence,
`modal.js` for dialogs, `toast.js` for status messages, `theme.js` for the
palette picker.

## Theming

Six themes ship in `assets/css/tokens.css`. Components only reference semantic
variables (`--accent`, `--surface`, `--text`, …), so adding a theme means adding
one block of tokens and one entry in `assets/js/theme.js`. The choice is stored
under `site.theme` and shared by every tool.

## Deployment

`.github/workflows/deploy.yml` publishes the repository root to GitHub Pages on
every push to `main`. There is no build step — what is committed is what ships.

## License

[MIT](LICENSE)
