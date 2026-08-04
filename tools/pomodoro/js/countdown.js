/**
 * Drift-free countdown.
 *
 * The interval only decides *when* to look at the clock; the remaining
 * time is always derived from a wall-clock target. That keeps the timer
 * accurate even when the tab is throttled in the background, where
 * `setInterval` fires late and irregularly.
 */

const POLL_MS = 250;

/**
 * @param {object} handlers
 * @param {() => void} handlers.onTick   fired when the displayed second changes
 * @param {() => void} handlers.onFinish fired once when it reaches zero
 */
export function createCountdown({ onTick, onFinish }) {
  let duration = 0;
  let remaining = 0;
  let running = false;
  let endAt = 0;
  let poller = null;

  function stopPolling() {
    clearInterval(poller);
    poller = null;
  }

  /** Recompute from the wall clock and emit any resulting changes. */
  function sync() {
    if (!running) return;

    const next = Math.max(0, Math.round((endAt - Date.now()) / 1000));
    if (next !== remaining) {
      remaining = next;
      onTick();
    }
    if (remaining <= 0) {
      running = false;
      stopPolling();
      onFinish();
    }
  }

  return {
    get duration() { return duration; },
    get remaining() { return remaining; },
    get running() { return running; },

    /** Load a new duration (in seconds) and rewind to the start. */
    set(seconds) {
      duration = seconds;
      remaining = seconds;
      if (running) endAt = Date.now() + seconds * 1000;
    },

    start() {
      if (running || remaining <= 0) return;
      running = true;
      endAt = Date.now() + remaining * 1000;
      poller = setInterval(sync, POLL_MS);
    },

    pause() {
      if (!running) return;
      running = false;
      stopPolling();
    },

    /** Stop and rewind to the full duration. */
    reset() {
      running = false;
      stopPolling();
      remaining = duration;
    },

    /** Catch up after the tab was hidden. */
    sync,
  };
}
