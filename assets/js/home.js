/**
 * Home page: renders the tool grid and wires the theme picker.
 */

import { TOOLS } from './tools.js';
import { initTheme, mountThemePicker } from './theme.js';
import { bindModals, openModal } from './modal.js';

const ARROW_ICON =
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" ' +
  'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
  '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';

/**
 * @param {import('./tools.js').Tool} tool
 * @returns {HTMLElement} a link for live tools, a plain div for upcoming ones
 */
function toolCard(tool) {
  const isLive = tool.status === 'live';
  const card = document.createElement(isLive ? 'a' : 'div');
  card.className = 'card tool-card' + (isLive ? '' : ' is-soon');

  if (isLive) {
    card.href = tool.href;
  } else {
    card.setAttribute('aria-disabled', 'true');
  }

  const status = document.createElement('span');
  status.className = `tool-status ${isLive ? 'live' : 'soon'}`;
  status.textContent = isLive ? 'Live' : 'Soon';

  const icon = document.createElement('div');
  icon.className = 'tool-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = tool.icon;

  const name = document.createElement('h3');
  name.className = 'tool-name';
  name.textContent = tool.name;

  const tagline = document.createElement('p');
  tagline.className = 'tool-tagline';
  tagline.textContent = tool.tagline;

  const tags = document.createElement('div');
  tags.className = 'tool-tags';
  tags.append(
    ...tool.tags.map((label) => {
      const tag = document.createElement('span');
      tag.className = 'tool-tag';
      tag.textContent = label;
      return tag;
    }),
  );

  card.append(status, icon, name, tagline, tags);

  if (isLive) {
    const open = document.createElement('span');
    open.className = 'tool-open';
    open.innerHTML = `Open ${ARROW_ICON}`;
    card.append(open);
  }

  return card;
}

function renderTools() {
  const grid = document.querySelector('#tool-grid');
  if (!grid) return;
  grid.replaceChildren(...TOOLS.map(toolCard));
}

function init() {
  initTheme();
  renderTools();

  const themeModal = document.querySelector('#theme-modal');
  mountThemePicker(document.querySelector('#theme-grid'));
  bindModals([themeModal]);
  document.querySelector('#theme-btn').addEventListener('click', () => openModal(themeModal));

  document.querySelector('#year').textContent = String(new Date().getFullYear());
}

init();
