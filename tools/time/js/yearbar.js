/**
 * The "year at a glance" chart — a single horizontal stacked bar.
 *
 * A pie/donut was the obvious first instinct (it looks like a year, like a
 * clock), but a part-to-whole breakdown across up to eight named categories
 * is exactly the case the dataviz guidance steers toward a bar instead:
 * angle judgement is weak, length judgement is strong, and long category
 * names need a legend anyway. So: one bar, segmented proportionally, with a
 * full legend underneath doing the precise work the bar only gestures at.
 *
 * Colour is assigned by the caller (model.js's assignColorSlots) to a
 * contiguous prefix of a fixed category order, never by sorted size — this
 * file only ever reads `row.slot` and turns it into `--cat-N`. Segments
 * render in that same fixed order for the same reason: on-screen neighbours
 * must stay within the palette's validated adjacent pairs.
 *
 * "Unaccounted" and "Other" are deliberately *not* palette hues — they are
 * not activities, so colouring them like one would overstate them. They get
 * a neutral, non-categorical treatment instead (hatch / muted respectively).
 */

const MAX_SLOTTED = 8;

function segClass(row) {
  if (row.id === '__unaccounted') return 'yearbar-seg is-neutral';
  if (row.id === '__other') return 'yearbar-seg is-other';
  return 'yearbar-seg';
}

function segStyle(row) {
  return row.slot != null ? `--seg-color: var(--cat-${row.slot + 1})` : '';
}

/** Rows in fixed display order for the bar: slotted rows first, then Other, then Unaccounted last. */
function orderForBar(rows, otherRow, unaccountedRow) {
  const slotted = rows.filter((r) => r.slot != null).sort((a, b) => a.slot - b.slot);
  const rest = [];
  if (otherRow) rest.push(otherRow);
  if (unaccountedRow) rest.push(unaccountedRow);
  return [...slotted, ...rest];
}

function describe(row, money) {
  const hours = Math.round(row.yearlyHours).toLocaleString();
  const pct = row.pct.toFixed(row.pct < 1 ? 1 : 0);
  const moneyBit = row.moneyValue > 0 ? `, worth about ${money(row.moneyValue)} a year` : '';
  return `${row.label}: ${hours} hours a year (${pct}%)${moneyBit}`;
}

/**
 * @param {{track: HTMLElement, legend: HTMLElement}} refs
 * @param {ReturnType<import('./model.js').evaluate>} result
 * @param {(n:number)=>string} money
 */
export function renderYearbar(refs, result, money) {
  const total = Math.max(result.allocatedHours, 8760);

  // Fold anything beyond the palette's contiguous prefix into "Other" — a
  // second custom category, say — rather than starving the last slot of a
  // colour nobody validated for it.
  const overflow = result.rows.filter((r) => r.slot == null);
  const otherHours = overflow.reduce((sum, r) => sum + r.yearlyHours, 0);

  const withPct = (r) => ({ ...r, pct: (r.yearlyHours / total) * 100 });

  const slottedRows = result.rows.filter((r) => r.slot != null).map(withPct);
  const otherRow = otherHours > 0
    ? withPct({
        id: '__other',
        label: overflow.length === 1 ? overflow[0].label : `Other (${overflow.length} more)`,
        icon: '➕',
        yearlyHours: otherHours,
        moneyValue: result.hourlyRate * otherHours,
        slot: null,
      })
    : null;
  const unaccountedRow = result.unaccountedHours > 0
    ? withPct({
        id: '__unaccounted',
        label: 'Unaccounted',
        icon: '❔',
        yearlyHours: result.unaccountedHours,
        moneyValue: result.unaccountedMoneyValue,
        slot: null,
      })
    : null;

  const barRows = orderForBar(slottedRows, otherRow, unaccountedRow);

  refs.track.replaceChildren(
    ...barRows.map((row) => {
      const seg = document.createElement('div');
      seg.className = segClass(row);
      seg.style.cssText = segStyle(row);
      seg.style.flexGrow = String(Math.max(row.yearlyHours, 1));
      seg.tabIndex = 0;
      seg.title = describe(row, money);
      seg.setAttribute('role', 'img');
      seg.setAttribute('aria-label', describe(row, money));
      return seg;
    }),
  );

  // Legend: precise numbers, sorted by size — the bar's job was gestalt,
  // this list's job is "look up the exact figure."
  const legendRows = [...slottedRows, ...(otherRow ? [otherRow] : []), ...(unaccountedRow ? [unaccountedRow] : [])]
    .sort((a, b) => b.yearlyHours - a.yearlyHours);

  refs.legend.replaceChildren(
    ...legendRows.map((row) => {
      const li = document.createElement('li');
      li.className = 'legend-row';

      const swatch = document.createElement('span');
      swatch.className = 'legend-swatch' + (row.id === '__unaccounted' ? ' is-neutral' : row.id === '__other' ? ' is-other' : '');
      swatch.style.cssText = segStyle(row);
      swatch.setAttribute('aria-hidden', 'true');

      const name = document.createElement('span');
      name.className = 'legend-name';
      name.textContent = `${row.icon} ${row.label}`; // labels are untrusted (custom names) — textContent only

      const figs = document.createElement('span');
      figs.className = 'legend-figs';
      const strong = document.createElement('strong');
      strong.textContent = `${Math.round(row.yearlyHours).toLocaleString()}h`;
      figs.append(strong, document.createTextNode(` /yr · ${row.pct.toFixed(row.pct < 1 ? 1 : 0)}%`));
      if (row.moneyValue > 0) {
        figs.append(document.createTextNode(` · ${money(row.moneyValue)}`));
      }

      li.append(swatch, name, figs);
      return li;
    }),
  );
}

export { MAX_SLOTTED };
