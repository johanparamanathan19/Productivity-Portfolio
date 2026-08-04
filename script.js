/* ============================================================
   Grove — a focus timer
   A dependency-free Pomodoro engine with persistence,
   tasks, stats, sound, notifications, and animation.
   ============================================================ */
(() => {
  'use strict';

  // ---------- Constants ----------
  const RING_CIRCUMFERENCE = 2 * Math.PI * 132; // matches r=132 in SVG
  const THEMES = [
    { id: 'forest',   name: 'Forest',   c: ['#2f7d5b', '#7bc4a0'] },
    { id: 'sakura',   name: 'Sakura',   c: ['#e06a94', '#ffd0dd'] },
    { id: 'midnight', name: 'Midnight', c: ['#4f6bff', '#a99bff'] },
    { id: 'sunset',   name: 'Sunset',   c: ['#ff7a4d', '#ffd98a'] },
    { id: 'ocean',    name: 'Ocean',    c: ['#1fb0c9', '#9af0e6'] },
    { id: 'lavender', name: 'Lavender', c: ['#b8a4f0', '#efe6ff'] },
  ];
  const MODE_META = {
    focus: { label: 'Time to focus',  short: 'Focus',       sprout: '🌱' },
    short: { label: 'Take a breather', short: 'Short Break', sprout: '🍃' },
    long:  { label: 'Rest and reset',  short: 'Long Break',  sprout: '🌳' },
  };
  const DEFAULTS = {
    focus: 25, short: 5, long: 15, rounds: 4,
    autoBreak: false, autoFocus: false,
    sound: true, tick: false, notify: false, volume: 60,
    theme: 'forest',
  };

  // ---------- Persistence ----------
  const store = {
    load(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
      catch { return fallback; }
    },
    save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
  };

  let settings = Object.assign({}, DEFAULTS, store.load('grove.settings', {}));
  let tasks = store.load('grove.tasks', []);
  let stats = store.load('grove.stats', { total: 0, days: {}, streak: 0, lastDay: null });

  // ---------- State ----------
  let mode = 'focus';          // focus | short | long
  let remaining = settings.focus * 60;
  let duration = settings.focus * 60;
  let running = false;
  let ticker = null;
  let endAt = 0;               // wall-clock target (drift-free)
  let completedInCycle = 0;    // focus sessions since last long break
  let activeTaskId = null;
  let pendingEst = 1;

  // ---------- DOM ----------
  const $ = (s) => document.querySelector(s);
  const el = {
    body: document.body,
    root: document.documentElement,
    time: $('#time'),
    phaseLabel: $('#phase-label'),
    sprout: $('#sprout'),
    ring: $('.ring-progress'),
    roundDots: $('#round-dots'),
    startBtn: $('#start-btn'),
    startLabel: $('#start-btn .ctrl-label'),
    resetBtn: $('#reset-btn'),
    skipBtn: $('#skip-btn'),
    glider: $('.mode-glider'),
    modeTabs: document.querySelectorAll('.mode-tab'),
    // tasks
    taskForm: $('#task-form'),
    taskInput: $('#task-input'),
    taskList: $('#task-list'),
    tasksMeta: $('#tasks-meta'),
    emptyHint: $('#empty-hint'),
    estValue: $('#est-value'),
    // modals
    settingsModal: $('#settings-modal'),
    statsModal: $('#stats-modal'),
    themeGrid: $('#theme-grid'),
    confetti: $('#confetti'),
    toast: $('#toast'),
  };

  const modeOrder = ['focus', 'short', 'long'];

  // ---------- Ring ----------
  el.ring.style.strokeDasharray = RING_CIRCUMFERENCE.toFixed(2);
  function paintRing() {
    const progress = duration > 0 ? 1 - remaining / duration : 0;
    el.ring.style.strokeDashoffset = (RING_CIRCUMFERENCE * (1 - progress)).toFixed(2);
    // sprout grows with focus progress (1 → 1.9), stays calm on breaks
    const grow = mode === 'focus' ? 1 + progress * 0.9 : 1.15;
    el.sprout.style.transform = `scale(${grow.toFixed(3)})`;
  }

  // ---------- Display ----------
  function fmt(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  function render() {
    el.time.textContent = fmt(remaining);
    el.phaseLabel.textContent = MODE_META[mode].label;
    el.sprout.textContent = MODE_META[mode].sprout;
    document.title = running
      ? `${fmt(remaining)} · ${MODE_META[mode].short} — Grove`
      : 'Grove — a focus timer';
    paintRing();
    renderRoundDots();
  }
  function renderRoundDots() {
    const total = settings.rounds;
    let html = '';
    for (let i = 0; i < total; i++) {
      let cls = '';
      if (i < completedInCycle) cls = 'done';
      else if (i === completedInCycle && mode === 'focus') cls = 'current';
      html += `<span class="${cls}"></span>`;
    }
    el.roundDots.innerHTML = html;
  }

  // ---------- Mode ----------
  function moveGlider() {
    const idx = modeOrder.indexOf(mode);
    el.glider.style.transform = `translateX(${idx * 100}%)`;
    el.modeTabs.forEach((t) => t.classList.toggle('is-active', t.dataset.setMode === mode));
    el.root.setAttribute('data-mode', mode);
  }
  function durationFor(m) { return settings[m] * 60; }

  function setMode(next, { auto = false } = {}) {
    mode = next;
    duration = durationFor(mode);
    remaining = duration;
    moveGlider();
    render();
    if (!auto) stopTimer(true);
  }

  // ---------- Timer engine (drift-free via wall clock) ----------
  function startTimer() {
    if (running) return;
    running = true;
    endAt = Date.now() + remaining * 1000;
    el.body.classList.add('running');
    el.startLabel.textContent = 'Pause';
    if (settings.notify && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    audio.resume();
    ticker = setInterval(tick, 250);
    render();
  }
  function pauseTimer() {
    if (!running) return;
    running = false;
    clearInterval(ticker);
    el.body.classList.remove('running');
    el.startLabel.textContent = 'Resume';
    render();
  }
  function stopTimer(reset) {
    running = false;
    clearInterval(ticker);
    el.body.classList.remove('running');
    el.startLabel.textContent = 'Start';
    if (reset) { remaining = duration; render(); }
  }
  function toggleTimer() { running ? pauseTimer() : startTimer(); }

  function tick() {
    const now = Date.now();
    const newRemaining = Math.max(0, Math.round((endAt - now) / 1000));
    if (newRemaining !== remaining) {
      remaining = newRemaining;
      render();
      if (settings.tick && mode === 'focus' && remaining > 0) audio.tick();
    }
    if (remaining <= 0) completeSession();
  }

  // ---------- Session completion ----------
  function completeSession() {
    clearInterval(ticker);
    running = false;
    el.body.classList.remove('running');

    const finished = mode;
    if (finished === 'focus') {
      recordFocus();
      completedInCycle++;
      creditActiveTask();
      burstConfetti();
    }

    audio.chime(finished === 'focus');
    notify(finished);

    // Decide next phase
    let next;
    if (finished === 'focus') {
      next = completedInCycle >= settings.rounds ? 'long' : 'short';
      if (next === 'long') completedInCycle = 0;
    } else {
      next = 'focus';
    }

    setMode(next, { auto: true });
    el.startLabel.textContent = 'Start';

    const shouldAuto = (next === 'focus' && settings.autoFocus) ||
                       (next !== 'focus' && settings.autoBreak);
    if (shouldAuto) {
      setTimeout(startTimer, 900);
    }
  }

  function skip() {
    // Manually advance without crediting focus work
    let next;
    if (mode === 'focus') {
      next = (completedInCycle + 1) >= settings.rounds ? 'long' : 'short';
    } else {
      next = 'focus';
    }
    setMode(next);
  }

  // ---------- Stats ----------
  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function recordFocus() {
    const key = todayKey();
    stats.total = (stats.total || 0) + 1;
    stats.days[key] = (stats.days[key] || 0) + 1;
    // streak
    if (stats.lastDay !== key) {
      const yst = new Date(); yst.setDate(yst.getDate() - 1);
      const ystKey = `${yst.getFullYear()}-${String(yst.getMonth() + 1).padStart(2, '0')}-${String(yst.getDate()).padStart(2, '0')}`;
      stats.streak = stats.lastDay === ystKey ? (stats.streak || 0) + 1 : 1;
      stats.lastDay = key;
    }
    store.save('grove.stats', stats);
  }

  // ---------- Notifications ----------
  function notify(finished) {
    const msg = finished === 'focus'
      ? 'Focus complete — nice work. Time for a break 🌿'
      : 'Break over — ready to focus again? 🌱';
    showToast(msg);
    if (settings.notify && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('Grove', { body: msg, silent: true,
          icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ctext y=".9em" font-size="90"%3E🌱%3C/text%3E%3C/svg%3E' });
      } catch {}
    }
  }
  let toastTimer;
  function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), 3500);
  }

  // ---------- Audio (Web Audio, no external files) ----------
  const audio = {
    ctx: null,
    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
      }
      return this.ctx;
    },
    resume() { const c = this.ensure(); if (c && c.state === 'suspended') c.resume(); },
    vol() { return (settings.volume / 100); },
    tone(freq, start, dur, type = 'sine', peak = 0.3) {
      const c = this.ensure(); if (!c) return;
      const t0 = c.currentTime + start;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = type; osc.frequency.value = freq;
      const v = peak * this.vol();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g).connect(c.destination);
      osc.start(t0); osc.stop(t0 + dur + 0.05);
    },
    chime(isFocus) {
      if (!settings.sound) return;
      this.resume();
      // A gentle rising arpeggio (major triad) — warmer for focus completion
      const notes = isFocus ? [523.25, 659.25, 783.99, 1046.5] : [659.25, 523.25, 392.0];
      notes.forEach((f, i) => this.tone(f, i * 0.14, 0.55, 'sine', 0.32));
    },
    tick() {
      if (!settings.sound) return;
      this.tone(1600, 0, 0.03, 'square', 0.05);
    },
  };

  // ---------- Confetti (canvas, self-contained) ----------
  const confetti = (() => {
    const cv = el.confetti;
    const ctx = cv.getContext('2d');
    let parts = [];
    let raf = null;
    function resize() {
      cv.width = window.innerWidth * devicePixelRatio;
      cv.height = window.innerHeight * devicePixelRatio;
    }
    resize();
    window.addEventListener('resize', resize);
    function colors() {
      const cs = getComputedStyle(el.root);
      return [cs.getPropertyValue('--accent').trim(), cs.getPropertyValue('--accent-2').trim(), '#ffffff'];
    }
    function launch() {
      const pal = colors();
      const cx = cv.width / 2, cy = cv.height * 0.42;
      for (let i = 0; i < 110; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (4 + Math.random() * 9) * devicePixelRatio;
        parts.push({
          x: cx, y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 6 * devicePixelRatio,
          g: 0.28 * devicePixelRatio,
          size: (4 + Math.random() * 5) * devicePixelRatio,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.3,
          color: pal[i % pal.length],
          life: 1,
          decay: 0.006 + Math.random() * 0.006,
        });
      }
      if (!raf) raf = requestAnimationFrame(frame);
    }
    function frame() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      parts = parts.filter((p) => p.life > 0);
      parts.forEach((p) => {
        p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= p.decay;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      });
      if (parts.length) raf = requestAnimationFrame(frame);
      else { cancelAnimationFrame(raf); raf = null; ctx.clearRect(0, 0, cv.width, cv.height); }
    }
    return { launch };
  })();
  function burstConfetti() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    confetti.launch();
  }

  // ---------- Tasks ----------
  function saveTasks() { store.save('grove.tasks', tasks); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function renderTasks() {
    el.taskList.innerHTML = '';
    tasks.forEach((t) => el.taskList.appendChild(taskNode(t)));
    const done = tasks.filter((t) => t.done).length;
    el.tasksMeta.textContent = `${done} / ${tasks.length}`;
    el.emptyHint.style.display = tasks.length ? 'none' : 'block';
    if (activeTaskId && !tasks.some((t) => t.id === activeTaskId)) activeTaskId = null;
  }
  function taskNode(t) {
    const li = document.createElement('li');
    li.className = 'task-item' + (t.done ? ' done' : '') + (t.id === activeTaskId ? ' active' : '');
    li.dataset.id = t.id;

    const check = document.createElement('button');
    check.className = 'task-check' + (t.done ? ' checked' : '');
    check.type = 'button';
    check.setAttribute('aria-label', 'Mark done');
    check.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    check.addEventListener('click', (e) => { e.stopPropagation(); toggleDone(t.id); });

    const text = document.createElement('span');
    text.className = 'task-text';
    text.textContent = t.text;

    const pomos = document.createElement('span');
    pomos.className = 'task-pomos';
    pomos.textContent = `${t.done_pomos || 0}/${t.est}`;

    const del = document.createElement('button');
    del.className = 'task-del';
    del.type = 'button';
    del.setAttribute('aria-label', 'Delete task');
    del.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
    del.addEventListener('click', (e) => { e.stopPropagation(); deleteTask(t.id); });

    li.append(check, text, pomos, del);
    li.addEventListener('click', () => selectTask(t.id));
    return li;
  }
  function addTask(text, est) {
    tasks.push({ id: uid(), text, est, done_pomos: 0, done: false });
    saveTasks(); renderTasks();
  }
  function toggleDone(id) {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    t.done = !t.done;
    if (t.done && id === activeTaskId) activeTaskId = null;
    saveTasks(); renderTasks();
  }
  function deleteTask(id) {
    tasks = tasks.filter((x) => x.id !== id);
    if (activeTaskId === id) activeTaskId = null;
    saveTasks(); renderTasks();
  }
  function selectTask(id) {
    const t = tasks.find((x) => x.id === id);
    if (!t || t.done) return;
    activeTaskId = activeTaskId === id ? null : id;
    renderTasks();
  }
  function creditActiveTask() {
    if (!activeTaskId) return;
    const t = tasks.find((x) => x.id === activeTaskId);
    if (!t) return;
    t.done_pomos = (t.done_pomos || 0) + 1;
    if (t.done_pomos >= t.est) t.done = true;
    if (t.done) activeTaskId = null;
    saveTasks(); renderTasks();
  }

  // ---------- Settings UI ----------
  function buildThemeGrid() {
    el.themeGrid.innerHTML = '';
    THEMES.forEach((th) => {
      const s = document.createElement('button');
      s.type = 'button';
      s.className = 'theme-swatch' + (th.id === settings.theme ? ' selected' : '');
      s.style.background = `linear-gradient(135deg, ${th.c[0]}, ${th.c[1]})`;
      s.innerHTML = `<span>${th.name}</span>`;
      s.addEventListener('click', () => applyTheme(th.id));
      el.themeGrid.appendChild(s);
    });
  }
  function applyTheme(id) {
    settings.theme = id;
    el.root.setAttribute('data-theme', id);
    const meta = THEMES.find((t) => t.id === id);
    const themeColor = document.querySelector('meta[name=theme-color]');
    if (themeColor && meta) themeColor.setAttribute('content', meta.c[0]);
    store.save('grove.settings', settings);
    buildThemeGrid();
  }

  function syncSettingsInputs() {
    $('#dur-focus').value = settings.focus;
    $('#dur-short').value = settings.short;
    $('#dur-long').value = settings.long;
    $('#rounds').value = settings.rounds;
    $('#auto-break').checked = settings.autoBreak;
    $('#auto-focus').checked = settings.autoFocus;
    $('#sound-on').checked = settings.sound;
    $('#tick-on').checked = settings.tick;
    $('#notify-on').checked = settings.notify;
    $('#volume').value = settings.volume;
  }

  function bindSettings() {
    const num = (id, key, min, max) => {
      $(id).addEventListener('change', (e) => {
        let v = parseInt(e.target.value, 10);
        if (isNaN(v)) v = DEFAULTS[key];
        v = Math.min(max, Math.max(min, v));
        e.target.value = v;
        settings[key] = v;
        store.save('grove.settings', settings);
        // If the current (idle) mode's duration changed, reflect it live
        if (!running && durationFor(mode) !== duration) {
          duration = durationFor(mode);
          remaining = duration;
          render();
        }
        renderRoundDots();
      });
    };
    num('#dur-focus', 'focus', 1, 180);
    num('#dur-short', 'short', 1, 60);
    num('#dur-long', 'long', 1, 90);
    num('#rounds', 'rounds', 2, 12);

    const toggle = (id, key) => $(id).addEventListener('change', (e) => {
      settings[key] = e.target.checked;
      store.save('grove.settings', settings);
      if (key === 'notify' && e.target.checked && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    });
    toggle('#auto-break', 'autoBreak');
    toggle('#auto-focus', 'autoFocus');
    toggle('#sound-on', 'sound');
    toggle('#tick-on', 'tick');
    toggle('#notify-on', 'notify');

    $('#volume').addEventListener('input', (e) => {
      settings.volume = parseInt(e.target.value, 10);
      store.save('grove.settings', settings);
    });
    $('#volume').addEventListener('change', () => audio.chime(true));

    $('#reset-defaults').addEventListener('click', () => {
      const theme = settings.theme;
      settings = Object.assign({}, DEFAULTS, { theme });
      store.save('grove.settings', settings);
      syncSettingsInputs();
      duration = durationFor(mode); remaining = duration;
      stopTimer(true); render();
      showToast('Settings reset to defaults');
    });
  }

  // ---------- Stats UI ----------
  function openStats() {
    const key = todayKey();
    $('#stat-today').textContent = stats.days[key] || 0;
    $('#stat-focus').textContent = `${(stats.days[key] || 0) * settings.focus}m`;
    $('#stat-streak').textContent = stats.streak || 0;
    $('#stat-total').textContent = stats.total || 0;
    buildWeekChart();
    buildGrove(stats.days[key] || 0);
    openModal(el.statsModal);
  }
  function buildWeekChart() {
    const chart = $('#week-chart');
    chart.innerHTML = '';
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      days.push({ key, count: stats.days[key] || 0, label: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()] });
    }
    const max = Math.max(1, ...days.map((d) => d.count));
    days.forEach((d) => {
      const col = document.createElement('div');
      col.className = 'week-col';
      const h = Math.round((d.count / max) * 100);
      col.innerHTML = `<div class="week-bar ${d.count ? '' : 'empty'}" style="height:0"></div><div class="week-day">${d.label}</div>`;
      chart.appendChild(col);
      const bar = col.querySelector('.week-bar');
      requestAnimationFrame(() => { bar.style.height = d.count ? `${Math.max(6, h)}%` : '4px'; });
      col.title = `${d.count} session${d.count === 1 ? '' : 's'}`;
    });
  }
  function buildGrove(n) {
    const grove = $('#grove');
    grove.innerHTML = '';
    if (!n) { grove.innerHTML = '<span style="font-size:13px;color:var(--text-dim);animation:none">No sessions yet today — plant your first 🌱</span>'; return; }
    const icons = ['🌱', '🌿', '🌳'];
    for (let i = 0; i < Math.min(n, 60); i++) {
      const s = document.createElement('span');
      s.textContent = icons[Math.min(2, Math.floor(i / 4))];
      s.style.animationDelay = `${i * 40}ms`;
      grove.appendChild(s);
    }
  }

  // ---------- Modals ----------
  function openModal(m) { m.hidden = false; }
  function closeModal(m) { m.hidden = true; }
  document.querySelectorAll('[data-close]').forEach((b) =>
    b.addEventListener('click', () => closeModal(b.closest('.modal-backdrop'))));
  [el.settingsModal, el.statsModal].forEach((m) =>
    m.addEventListener('click', (e) => { if (e.target === m) closeModal(m); }));

  // ---------- Events ----------
  el.startBtn.addEventListener('click', toggleTimer);
  el.resetBtn.addEventListener('click', () => { stopTimer(true); });
  el.skipBtn.addEventListener('click', skip);
  el.modeTabs.forEach((t) => t.addEventListener('click', () => setMode(t.dataset.setMode)));
  $('#settings-btn').addEventListener('click', () => openModal(el.settingsModal));
  $('#stats-btn').addEventListener('click', openStats);
  $('#reset-stats').addEventListener('click', () => {
    stats = { total: 0, days: {}, streak: 0, lastDay: null };
    store.save('grove.stats', stats);
    openStats();
    showToast('Statistics cleared');
  });

  // Estimate stepper
  el.estValue.textContent = pendingEst;
  document.querySelectorAll('.est-btn').forEach((b) =>
    b.addEventListener('click', () => {
      pendingEst = Math.min(20, Math.max(1, pendingEst + parseInt(b.dataset.est, 10)));
      el.estValue.textContent = pendingEst;
    }));

  el.taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = el.taskInput.value.trim();
    if (!text) return;
    addTask(text, pendingEst);
    el.taskInput.value = '';
    pendingEst = 1; el.estValue.textContent = pendingEst;
    el.taskInput.focus();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
    const modalOpen = !el.settingsModal.hidden || !el.statsModal.hidden;
    if (e.key === 'Escape' && modalOpen) {
      closeModal(el.settingsModal); closeModal(el.statsModal); return;
    }
    if (typing || modalOpen) return;
    if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); toggleTimer(); }
    else if (e.key === 'r' || e.key === 'R') { stopTimer(true); }
    else if (e.key === 's' || e.key === 'S') { skip(); }
  });

  // Keep countdown accurate after tab was backgrounded
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && running) { tick(); }
  });

  // ---------- Init ----------
  function init() {
    applyTheme(settings.theme);
    buildThemeGrid();
    syncSettingsInputs();
    bindSettings();
    setMode('focus', { auto: true });
    renderTasks();
    render();
  }
  init();
})();
