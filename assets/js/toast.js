/**
 * Transient status message. Expects a `<div class="toast" role="status">`
 * somewhere in the page.
 */

let timer;

/**
 * @param {string} message
 * @param {number} [ms] how long the toast stays up
 */
export function showToast(message, ms = 3500) {
  const el = document.querySelector('.toast');
  if (!el) return;

  el.textContent = message;
  el.classList.add('show');

  clearTimeout(timer);
  timer = setTimeout(() => el.classList.remove('show'), ms);
}
