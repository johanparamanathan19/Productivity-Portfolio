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
    name: 'Grove',
    tagline: 'A Pomodoro timer that grows a small garden while you focus.',
    icon: '🌱',
    tags: ['Focus', 'Timer', 'Tasks'],
    status: 'live',
    href: 'tools/pomodoro/',
  },
  {
    name: 'Notes',
    tagline: 'A fast scratchpad for the thoughts you do not want to lose.',
    icon: '📝',
    tags: ['Writing', 'Markdown'],
    status: 'soon',
  },
  {
    name: 'Dev Toolbox',
    tagline: 'Format JSON, encode base64, generate UUIDs — without a round trip.',
    icon: '⚙️',
    tags: ['JSON', 'Encoding', 'UUID'],
    status: 'soon',
  },
  {
    name: 'Converter',
    tagline: 'Units, currencies, and the everyday maths you keep re-googling.',
    icon: '📐',
    tags: ['Units', 'Maths'],
    status: 'soon',
  },
];
