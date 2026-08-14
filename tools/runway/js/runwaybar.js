/**
 * The runway gauge — a single horizontal bar with reference ticks at 3, 6,
 * and 12 months, so the headline number lands against something instead of
 * floating on its own.
 *
 * Capped at 24 months of scale on purpose: an uncapped axis lets a 40-year
 * runway squash the 3-month mark into the origin, which is exactly where a
 * tool about survival time is most useful. Anything past the cap fills the
 * bar and reports its true value in the label instead of drawing off-scale.
 */

const SCALE_CAP_MONTHS = 24;
const TICKS = [3, 6, 12];

function toneVar(tone) {
  return tone === 'bad' ? 'var(--bad)' : tone === 'ok' ? 'var(--ok)' : 'var(--good)';
}

/**
 * @param {{track: HTMLElement, ticks: HTMLElement, srText: HTMLElement}} refs
 * @param {number} months finite, non-negative — callers resolve INDEFINITE before calling
 * @param {string} tone 'good' | 'ok' | 'bad'
 * @param {string} label e.g. "7.4 months of runway"
 */
export function renderRunwayBar(refs, months, tone, label) {
  const scaleMax = Math.max(SCALE_CAP_MONTHS, TICKS[TICKS.length - 1]);
  const pct = Math.min(100, (months / scaleMax) * 100);

  refs.track.style.setProperty('--fill-pct', `${pct}%`);
  refs.track.style.setProperty('--fill-color', toneVar(tone));
  refs.track.setAttribute('role', 'img');
  refs.track.setAttribute('aria-label', label);

  refs.ticks.replaceChildren(
    ...TICKS.map((t) => {
      const mark = document.createElement('span');
      mark.className = 'runway-tick';
      mark.style.left = `${Math.min(100, (t / scaleMax) * 100)}%`;
      const num = document.createElement('span');
      num.className = 'runway-tick-num';
      num.textContent = `${t}mo`;
      mark.append(num);
      return mark;
    }),
  );

  refs.srText.textContent = label;
}

export function renderIndefiniteBar(refs, label) {
  refs.track.style.setProperty('--fill-pct', '100%');
  refs.track.style.setProperty('--fill-color', 'var(--good)');
  refs.track.setAttribute('role', 'img');
  refs.track.setAttribute('aria-label', label);
  refs.ticks.replaceChildren();
  refs.srText.textContent = label;
}

export { SCALE_CAP_MONTHS };
