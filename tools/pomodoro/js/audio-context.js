/**
 * One AudioContext for the whole tool.
 *
 * Browsers cap how many contexts a page may open, and both the chimes and
 * the soundscapes need one, so they share this rather than each building
 * their own. It is created lazily and starts suspended until a user
 * gesture resumes it — autoplay policy, not a bug.
 */

/** @type {AudioContext | null} */
let ctx = null;

/** @returns {AudioContext | null} null when the browser has no Web Audio */
export function getAudioContext() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) ctx = new AudioCtx();
  }
  return ctx;
}

/** Call from inside a click handler — anywhere else the browser ignores it. */
export function resumeAudio() {
  const audio = getAudioContext();
  if (audio && audio.state === 'suspended') audio.resume();
  return audio;
}
