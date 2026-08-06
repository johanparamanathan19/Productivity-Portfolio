# Contributing

Thanks for taking an interest. This is a small personal project, so the bar is
less "follow this process exactly" and more "leave it as readable as you found
it".

## Getting set up

There is no toolchain, no `npm install`, and no build step. Clone it and serve
the folder:

```bash
python3 -m http.server 8000
```

ES modules need HTTP — opening `index.html` from the filesystem will not work.

## The constraints worth knowing

These are deliberate. A change that breaks one is probably the wrong change:

- **No dependencies and no build step.** What is committed is what ships. If
  something seems to need a library, it is worth asking whether it needs doing
  at all.
- **Nothing leaves the device.** No analytics, no fonts-with-tracking, no API
  calls. Tools persist to `localStorage` and that is it.
- **Themes are semantic.** Only `assets/css/tokens.css` defines raw colours.
  Everything else references `--accent`, `--surface`, `--text`, and friends —
  which is what lets all six themes work without per-theme overrides.
- **Shared before specific.** If two tools need it, it belongs in `assets/`.
  The top bar moved there the moment a second tool wanted it.
- **Logic apart from the DOM.** The affordability rules live in `model.js` as
  pure functions; the timer engine in `countdown.js` knows nothing about
  elements. Keep judgement separate from rendering.

## House style

- Two-space indent, single quotes in JS, semicolons. `.editorconfig` covers it.
- Comments explain **why**, not what. If a line needs a comment to say what it
  does, rename something instead.
- Prefer clarity over cleverness; this code is meant to be readable in an
  afternoon.

## Before opening a pull request

Please check the tools actually still work — there is no test suite to lean on:

1. Serve the site and open both tools.
2. Confirm the browser console is clean.
3. Exercise what you touched. For the timer that means a full session
   completing, crediting a task, and recording a session. For the calculator,
   a cash purchase, a financed one, and one with fields left blank.
4. Try a light theme (Lavender) as well as a dark one — contrast bugs hide
   there.

If you changed anything that persists, check it survives a reload and that
existing stored data is not orphaned. Storage keys are still namespaced
`grove.*` from the timer's former name for exactly this reason.

## Commit messages

A short imperative subject, then a body explaining *why* the change was needed
and anything a reviewer would otherwise have to reverse-engineer. Mention what
you verified and how.

## Reporting bugs and ideas

Use the [issue templates](https://github.com/johanparamanathan19/Productivity-Portfolio/issues/new/choose).
For anything security-related, follow [SECURITY.md](SECURITY.md) instead of
opening a public issue.
