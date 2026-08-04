/**
 * Chimes and ticks synthesised with the Web Audio API — no audio files,
 * so nothing to download and nothing to cache.
 */

/**
 * @param {() => {sound: boolean, volume: number}} getSettings
 *   read lazily so volume changes take effect immediately
 */
export function createAudio(getSettings) {
  /** @type {AudioContext | null} */
  let ctx = null;

  function ensure() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) ctx = new AudioCtx();
    }
    return ctx;
  }

  /**
   * One enveloped sine/square blip.
   * @param {number} freq  hertz
   * @param {number} start seconds from now
   * @param {number} dur   seconds
   */
  function tone(freq, start, dur, type = 'sine', peak = 0.3) {
    const audio = ensure();
    if (!audio) return;

    const at = audio.currentTime + start;
    const osc = audio.createOscillator();
    const gain = audio.createGain();

    osc.type = type;
    osc.frequency.value = freq;

    // Exponential ramps avoid the click a hard gain change produces.
    const level = Math.max(0.0002, peak * (getSettings().volume / 100));
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(level, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);

    osc.connect(gain).connect(audio.destination);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }

  return {
    /** Browsers start the context suspended until a user gesture. */
    resume() {
      const audio = ensure();
      if (audio && audio.state === 'suspended') audio.resume();
    },

    /** @param {boolean} isFocus rising arpeggio for focus, falling for breaks */
    chime(isFocus) {
      if (!getSettings().sound) return;
      this.resume();
      const notes = isFocus ? [523.25, 659.25, 783.99, 1046.5] : [659.25, 523.25, 392.0];
      notes.forEach((freq, i) => tone(freq, i * 0.14, 0.55, 'sine', 0.32));
    },

    tick() {
      if (!getSettings().sound) return;
      tone(1600, 0, 0.03, 'square', 0.05);
    },
  };
}
