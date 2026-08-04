/**
 * Modal behaviour shared by every tool.
 *
 * Markup contract:
 *   <div class="modal-backdrop" id="…" hidden>
 *     <div class="modal" role="dialog" aria-modal="true"> … </div>
 *     <button data-close> …
 *
 * Closing is wired for the close buttons, backdrop clicks, and Escape.
 */

/** @param {HTMLElement} backdrop */
export function openModal(backdrop) {
  backdrop.hidden = false;
  // Move focus into the dialog so keyboard and screen-reader users land there.
  const focusable = backdrop.querySelector('button, [href], input, select, textarea');
  if (focusable) focusable.focus({ preventScroll: true });
}

/** @param {HTMLElement} backdrop */
export function closeModal(backdrop) {
  backdrop.hidden = true;
}

/** @returns {boolean} true when any registered modal is open */
export function isAnyModalOpen(backdrops) {
  return backdrops.some((m) => !m.hidden);
}

/**
 * Wire close-on-button, close-on-backdrop, and close-on-Escape.
 * @param {HTMLElement[]} backdrops
 */
export function bindModals(backdrops) {
  backdrops.forEach((backdrop) => {
    backdrop.querySelectorAll('[data-close]').forEach((btn) => {
      btn.addEventListener('click', () => closeModal(backdrop));
    });
    // Only a click on the backdrop itself — not on the dialog inside it.
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) closeModal(backdrop);
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const open = backdrops.filter((m) => !m.hidden);
    if (!open.length) return;
    event.preventDefault();
    open.forEach(closeModal);
  });
}
