/**
 * Task list: add, complete, delete, and pick the one you are focusing on.
 * The active task is session-only — it is not persisted.
 */

import { tasks, saveTasks, setTasks } from './state.js';

const CHECK_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" ' +
  'stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

const TRASH_ICON =
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" ' +
  'stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/>' +
  '<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/**
 * @param {object} refs
 * @param {HTMLElement} refs.list
 * @param {HTMLElement} refs.meta       "done / total" counter
 * @param {HTMLElement} refs.emptyHint
 */
export function createTaskList({ list, meta, emptyHint }) {
  let activeId = null;

  function node(task) {
    const item = document.createElement('li');
    item.className =
      'task-item' + (task.done ? ' done' : '') + (task.id === activeId ? ' active' : '');
    item.dataset.id = task.id;

    const check = document.createElement('button');
    check.type = 'button';
    check.className = 'task-check' + (task.done ? ' checked' : '');
    check.setAttribute('aria-label', task.done ? 'Mark as not done' : 'Mark as done');
    check.innerHTML = CHECK_ICON;
    check.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleDone(task.id);
    });

    const text = document.createElement('span');
    text.className = 'task-text';
    text.textContent = task.text;

    const pomos = document.createElement('span');
    pomos.className = 'task-pomos';
    pomos.textContent = `${task.donePomos || 0}/${task.est}`;

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'task-del';
    del.setAttribute('aria-label', `Delete "${task.text}"`);
    del.innerHTML = TRASH_ICON;
    del.addEventListener('click', (event) => {
      event.stopPropagation();
      remove(task.id);
    });

    item.append(check, text, pomos, del);
    item.addEventListener('click', () => select(task.id));
    return item;
  }

  function render() {
    // An active task that was deleted elsewhere should not linger.
    if (activeId && !tasks.some((t) => t.id === activeId)) activeId = null;

    list.replaceChildren(...tasks.map(node));

    const done = tasks.filter((t) => t.done).length;
    meta.textContent = `${done} / ${tasks.length}`;
    emptyHint.hidden = tasks.length > 0;
  }

  function add(text, est) {
    setTasks([...tasks, { id: uid(), text, est, donePomos: 0, done: false }]);
    render();
  }

  function toggleDone(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    task.done = !task.done;
    if (task.done && id === activeId) activeId = null;
    saveTasks();
    render();
  }

  function remove(id) {
    setTasks(tasks.filter((t) => t.id !== id));
    if (activeId === id) activeId = null;
    render();
  }

  /** Clicking the active task deselects it. */
  function select(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task || task.done) return;
    activeId = activeId === id ? null : id;
    render();
  }

  /** Called when a focus session completes: bank one pomodoro. */
  function creditActive() {
    const task = tasks.find((t) => t.id === activeId);
    if (!task) return;

    task.donePomos = (task.donePomos || 0) + 1;
    if (task.donePomos >= task.est) {
      task.done = true;
      activeId = null;
    }
    saveTasks();
    render();
  }

  return { render, add, creditActive };
}
