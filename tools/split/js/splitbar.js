/**
 * The split bar — a single two-segment bar showing each person's share of
 * the total, instead of a line chart. There's no time axis here, so this
 * tool doesn't get one; it gets the same non-chart treatment tools/runway/'s
 * gauge bar gives a single number, extended to two segments.
 *
 * Names and amounts are never painted as text on top of the coloured fill —
 * a segment can be a sliver at a 95/5 split, too narrow to hold a label, and
 * relying on color alone to carry "whose share is whose" fails the same
 * contrast check documented in docs/invest-vs-buy.md. The legend below the
 * bar is the one true source of every figure; the bar is illustration.
 */

/**
 * @param {{track: HTMLElement, legend: HTMLElement, srText: HTMLElement}} refs
 * @param {{owedA:number, owedB:number, aName:string, bName:string}} data
 * @param {(n:number)=>string} money
 */
export function renderSplitBar(refs, data, money) {
  const { owedA, owedB, aName, bName } = data;
  const total = owedA + owedB;
  const pctA = total > 0 ? (owedA / total) * 100 : 50;
  const pctB = 100 - pctA;

  refs.track.style.setProperty('--fill-a-pct', `${pctA}%`);
  refs.track.setAttribute('role', 'img');

  const label = `${aName}: ${money(owedA)} (${Math.round(pctA)}%). ${bName}: ${money(owedB)} (${Math.round(pctB)}%).`;
  refs.track.setAttribute('aria-label', label);
  refs.srText.textContent = label;

  const entry = (cls, name, amount, pct) => {
    const li = document.createElement('li');
    li.className = 'split-legend-row';
    const key = document.createElement('span');
    key.className = `split-key ${cls}`;
    const nameEl = document.createElement('span');
    nameEl.className = 'split-legend-name';
    nameEl.textContent = name;
    const fig = document.createElement('span');
    fig.className = 'split-legend-fig';
    fig.textContent = `${money(amount)} · ${Math.round(pct)}%`;
    li.append(key, nameEl, fig);
    return li;
  };

  refs.legend.replaceChildren(
    entry('split-a', aName, owedA, pctA),
    entry('split-b', bName, owedB, pctB),
  );
}
