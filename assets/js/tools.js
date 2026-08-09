/**
 * The tool registry — the single source of truth for the home page grid.
 *
 * To add a tool: build it under `tools/<slug>/`, then add an entry here.
 * `status: 'live'` renders a real link; anything else renders a
 * non-interactive "coming soon" card.
 *
 * @typedef {object} Tool
 * @property {string} name
 * @property {string} tagline   one line, shown on the card
 * @property {string} icon      emoji used as the card mark
 * @property {string[]} tags    short keywords
 * @property {'live'|'soon'} status
 * @property {string} [href]    required when status is 'live'
 */

/** @type {Tool[]} */
export const TOOLS = [
  {
    name: 'Pomodoro',
    tagline: 'A focus timer that grows a small garden while you work.',
    icon: '🌱',
    tags: ['Focus', 'Timer', 'Tasks'],
    status: 'live',
    href: 'tools/pomodoro/',
  },
  {
    name: 'Can I Afford This?',
    tagline: 'Run a purchase past the rules of thumb lenders and planners actually use.',
    icon: '💸',
    tags: ['Money', 'Budgeting', 'Decisions'],
    status: 'live',
    href: 'tools/affordability/',
  },
  {
    name: 'How Much Time Do I Spend?',
    tagline: 'See where your 8,760 hours a year actually go, and what they are worth.',
    icon: '⏳',
    tags: ['Time', 'Life audit', 'Money'],
    status: 'live',
    href: 'tools/time/',
  },
];
