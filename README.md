# Portfolio — small, useful tools

A personal portfolio built around a growing collection of focused web tools.
No framework, no build step, no tracking: plain HTML, CSS, and ES modules,
deployed to GitHub Pages on every push to `main`.

**Live:** https://johanparamanathan19.github.io/Productivity-Portfolio/

## Tools

| Tool | What it does | Status |
| --- | --- | --- |
| [Grove](tools/pomodoro/) | Pomodoro focus timer with tasks, statistics, and a garden that grows as you work | Live |
| Notes | Fast local scratchpad | Planned |
| Dev Toolbox | JSON formatting, base64, UUIDs | Planned |
| Converter | Units and everyday maths | Planned |

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
    └── pomodoro/
        ├── index.html
        ├── pomodoro.css      Timer-specific styles
        └── js/
            ├── main.js       Phase machine + wiring
            ├── config.js     Constants, defaults, storage keys
            ├── state.js      Persisted settings, tasks, stats
            ├── countdown.js  Drift-free wall-clock timer
            ├── tasks.js      Task list behaviour
            ├── stats.js      History, streaks, charts
            ├── audio.js      Web Audio chimes and ticks
            ├── confetti.js   Canvas celebration
            └── notify.js     Desktop notifications
```

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
