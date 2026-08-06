# Security policy

## What this project is

A static site: HTML, CSS, and ES modules served by GitHub Pages. There is no
backend, no database, no authentication, and no analytics. Every tool keeps its
data in the browser's `localStorage` and nothing is transmitted anywhere.

That makes the attack surface small, and it is worth being clear about where it
actually is rather than implying more rigour than a static site can have.

## What is in scope

- Cross-site scripting through any tool's inputs — the affordability
  calculator's fields, the Pomodoro task list, or an imported backup file.
- Anything that causes stored data to be exfiltrated, corrupted, or destroyed.
- Malicious input to the backup importer (`tools/pomodoro/js/backup.js`) that
  gets past validation.
- A supply-chain problem in the GitHub Actions workflow.

## What is out of scope

- **Anything relying on physical or browser-profile access.** If someone can
  open your browser, they can read `localStorage`. That is expected; the data
  is stored locally by design.
- **The absence of a login.** These tools deliberately have no accounts.
- Missing security headers that GitHub Pages does not allow a static site to
  set.
- Clickjacking or similar on pages with no authenticated action to hijack.
- The financial guidance in the affordability calculator being wrong for your
  situation. That is a correctness issue — please open a normal issue.

## Reporting a vulnerability

Please report privately rather than opening a public issue.

Use GitHub's private vulnerability reporting: go to the
[Security tab](https://github.com/johanparamanathan19/Productivity-Portfolio/security)
and choose **Report a vulnerability**. That opens a private channel visible only
to the maintainer.

> **Maintainer note:** private reporting must be switched on once per repository
> under *Settings → Code security and analysis → Private vulnerability
> reporting*. Enable it so the link above works.

Helpful things to include:

- What the issue is and roughly how severe you think it is.
- Steps to reproduce, or a short proof of concept.
- Which browser and version you saw it in.

This is a personal project maintained in spare time, so please expect a first
response within about a week rather than within hours. You will get credit in
the release notes for the fix unless you would rather not.

## Supported versions

Only the currently deployed site — whatever is on `main` — receives fixes.
There are no released versions or maintenance branches.
