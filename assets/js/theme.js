/**
 * Site-wide theming.
 *
 * The chosen theme is stored as a plain string (not JSON) so the tiny
 * inline script in each page's <head> can apply it before first paint
 * without pulling in this module. Keep both in sync if the key changes.
 */

const STORAGE_KEY = 'site.theme';
const LEGACY_KEY = 'grove.settings'; // pre-portfolio home of the theme setting

export const THEMES = [
  { id: 'forest', name: 'Forest', colors: ['#2f7d5b', '#7bc4a0'] },
  { id: 'sakura', name: 'Sakura', colors: ['#e06a94', '#ffd0dd'] },
  { id: 'midnight', name: 'Midnight', colors: ['#4f6bff', '#a99bff'] },
  { id: 'sunset', name: 'Sunset', colors: ['#ff7a4d', '#ffd98a'] },
  { id: 'ocean', name: 'Ocean', colors: ['#1fb0c9', '#9af0e6'] },
  { id: 'lavender', name: 'Lavender', colors: ['#b8a4f0', '#efe6ff'] },
];

export const DEFAULT_THEME = 'forest';

/** Fires on <html> whenever the theme changes, so tools can repaint. */
export const THEME_CHANGE_EVENT = 'themechange';

const isKnown = (id) => THEMES.some((t) => t.id === id);

/** @returns {string} the persisted theme id, or the default */
export function getTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isKnown(stored)) return stored;

    // One-time migration from when the timer owned the theme setting.
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || '{}');
    if (isKnown(legacy.theme)) return legacy.theme;
  } catch {
    /* fall through to the default */
  }
  return DEFAULT_THEME;
}

/**
 * Apply a theme to the document and persist it.
 * @param {string} id
 */
export function applyTheme(id) {
  const theme = THEMES.find((t) => t.id === id) || THEMES[0];

  document.documentElement.setAttribute('data-theme', theme.id);

  // Keep the mobile browser chrome in step with the palette.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme.colors[0]);

  try {
    localStorage.setItem(STORAGE_KEY, theme.id);
  } catch {
    /* ignore — the theme still applies for this session */
  }

  document.documentElement.dispatchEvent(
    new CustomEvent(THEME_CHANGE_EVENT, { detail: theme, bubbles: true }),
  );
  return theme.id;
}

/** Apply whatever is stored. Safe to call on every page load. */
export function initTheme() {
  return applyTheme(getTheme());
}

/**
 * Render the swatch picker into a container and keep it in sync.
 * @param {HTMLElement} container
 */
export function mountThemePicker(container) {
  if (!container) return;

  const paint = () => {
    const current = document.documentElement.getAttribute('data-theme');
    container.replaceChildren(
      ...THEMES.map((theme) => {
        const swatch = document.createElement('button');
        swatch.type = 'button';
        swatch.className = 'theme-swatch' + (theme.id === current ? ' selected' : '');
        swatch.style.background = `linear-gradient(135deg, ${theme.colors[0]}, ${theme.colors[1]})`;
        swatch.setAttribute('aria-pressed', String(theme.id === current));
        swatch.setAttribute('aria-label', `${theme.name} theme`);

        const label = document.createElement('span');
        label.textContent = theme.name;
        swatch.append(label);

        swatch.addEventListener('click', () => applyTheme(theme.id));
        return swatch;
      }),
    );
  };

  paint();
  document.documentElement.addEventListener(THEME_CHANGE_EVENT, paint);
}
