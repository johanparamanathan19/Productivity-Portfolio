/**
 * Background soundscapes, synthesised in the browser.
 *
 * Everything here is generated from noise and oscillators at runtime — there
 * are no audio files, so nothing to download, nothing to licence, and no
 * megabytes in the repository. It also means the ambience never repeats,
 * which is the usual giveaway of a short sampled loop.
 *
 * The building blocks:
 *  - White noise is a flat random signal; pink falls off at 3 dB per octave
 *    and brown (integrated) noise is the deep rumble under most natural sound.
 *  - Rain is band-limited noise plus scheduled droplet transients.
 *  - Ocean is brown noise with slow filter and gain swells — the swell is what
 *    the ear reads as waves.
 *  - Café is low room tone plus randomised bursts of band-limited noise
 *    standing in for speech, and the occasional cup.
 *  - Ambient is a generative pad on a minor pentatonic through a synthesised
 *    reverb, so it never resolves and never loops.
 */

import { getAudioContext, resumeAudio } from './audio-context.js';

export const SOUNDSCAPES = [
  { id: 'none', label: 'Off', icon: '🔇' },
  { id: 'rain', label: 'Rain', icon: '🌧️' },
  { id: 'ocean', label: 'Ocean', icon: '🌊' },
  { id: 'cafe', label: 'Café', icon: '☕' },
  { id: 'white', label: 'White noise', icon: '📻' },
  { id: 'ambient', label: 'Ambient', icon: '🎹' },
];

/** Long enough that the ear cannot pick out the loop point. */
const NOISE_SECONDS = 8;
const FADE_SECONDS = 1.4;

const random = (min, max) => min + Math.random() * (max - min);

// ---------- Noise ----------

/**
 * Generate a noise buffer. Expensive, so a scene builds each colour once and
 * shares the buffer across every source that needs it — including the short
 * bursts, which vary by starting at a random offset instead.
 *
 * @param {'white'|'pink'|'brown'} colour
 */
function noiseBuffer(ctx, colour) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * NOISE_SECONDS, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  if (colour === 'white') {
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  } else if (colour === 'pink') {
    // Paul Kellet's filter approximation — cheap and close enough to -3dB/oct.
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < data.length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  } else {
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
  }

  // Integrated noise drifts, so the loop point would click. Tilting the whole
  // buffer by that drift makes the last sample meet the first.
  const drift = data[data.length - 1] - data[0];
  if (drift !== 0) {
    for (let i = 0; i < data.length; i++) data[i] -= drift * (i / (data.length - 1));
  }
  return buffer;
}

/** A looping player for an existing buffer, started at a random offset. */
function play(ctx, buffer, { loop = true } = {}) {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = loop;
  return source;
}

/** A decaying noise burst used as a reverb impulse response. */
function reverb(ctx, seconds = 3.2, decay = 2.4) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  const node = ctx.createConvolver();
  node.buffer = impulse;
  return node;
}

/** Routes an oscillator into an AudioParam so it modulates rather than sounds. */
function modulate(ctx, param, { rate, depth }) {
  const lfo = ctx.createOscillator();
  const amount = ctx.createGain();
  lfo.frequency.value = rate;
  amount.gain.value = depth;
  lfo.connect(amount).connect(param);
  lfo.start();
  return lfo;
}

/** Bookkeeping so every scene tears down the same way. */
function parts() {
  const sources = [];
  const timers = [];
  return {
    sources,
    timers,
    stop() {
      timers.forEach(clearInterval);
      sources.forEach((source) => {
        try {
          source.stop();
        } catch {
          /* already stopped */
        }
      });
    },
  };
}

// ---------- Scenes ----------
// Each returns { output, stop }. The engine owns volume and fading, so scenes
// mix themselves at roughly matched loudness and no louder.

function buildRain(ctx) {
  const kit = parts();
  const out = ctx.createGain();
  const white = noiseBuffer(ctx, 'white');

  const noise = play(ctx, white);
  const body = ctx.createBiquadFilter();
  body.type = 'bandpass';
  body.frequency.value = 1400;
  body.Q.value = 0.5;

  const tame = ctx.createBiquadFilter();
  tame.type = 'lowpass';
  tame.frequency.value = 7200;

  const level = ctx.createGain();
  level.gain.value = 0.5;

  noise.connect(body).connect(tame).connect(level).connect(out);
  noise.start();
  kit.sources.push(noise);

  // Gusts — without this it reads as static rather than weather.
  kit.sources.push(modulate(ctx, level.gain, { rate: 0.05, depth: 0.16 }));

  // Individual droplets close to the listener.
  kit.timers.push(
    setInterval(() => {
      if (Math.random() > 0.45) return;
      const now = ctx.currentTime;

      const drop = play(ctx, white);
      const ping = ctx.createBiquadFilter();
      ping.type = 'bandpass';
      ping.frequency.value = random(1800, 5200);
      ping.Q.value = random(6, 14);

      const env = ctx.createGain();
      const length = random(0.05, 0.13);
      env.gain.setValueAtTime(0.0001, now);
      env.gain.exponentialRampToValueAtTime(random(0.05, 0.16), now + 0.004);
      env.gain.exponentialRampToValueAtTime(0.0001, now + length);

      drop.connect(ping).connect(env).connect(out);
      drop.start(now, random(0, NOISE_SECONDS - 1));
      drop.stop(now + length + 0.05);
    }, 110),
  );

  return { output: out, stop: kit.stop };
}

function buildOcean(ctx) {
  const kit = parts();
  const out = ctx.createGain();

  const noise = play(ctx, noiseBuffer(ctx, 'brown'));
  const surf = ctx.createBiquadFilter();
  surf.type = 'lowpass';
  surf.frequency.value = 620;
  surf.Q.value = 0.8;

  const level = ctx.createGain();
  level.gain.value = 0.5;

  noise.connect(surf).connect(level).connect(out);
  noise.start();
  kit.sources.push(noise);

  // Swells at unrelated rates, so the waves never fall into a pattern.
  kit.sources.push(modulate(ctx, surf.frequency, { rate: 0.07, depth: 340 }));
  kit.sources.push(modulate(ctx, surf.frequency, { rate: 0.031, depth: 160 }));
  kit.sources.push(modulate(ctx, level.gain, { rate: 0.07, depth: 0.26 }));
  kit.sources.push(modulate(ctx, level.gain, { rate: 0.023, depth: 0.1 }));

  // Foam on top of the rumble.
  const foam = play(ctx, noiseBuffer(ctx, 'pink'));
  const hiss = ctx.createBiquadFilter();
  hiss.type = 'highpass';
  hiss.frequency.value = 2600;
  const foamLevel = ctx.createGain();
  foamLevel.gain.value = 0.1;

  foam.connect(hiss).connect(foamLevel).connect(out);
  foam.start();
  kit.sources.push(foam);
  kit.sources.push(modulate(ctx, foamLevel.gain, { rate: 0.07, depth: 0.09 }));

  return { output: out, stop: kit.stop };
}

function buildCafe(ctx) {
  const kit = parts();
  const out = ctx.createGain();
  // Trimmed so the murmur transients sit level with the other scenes rather
  // than jumping out when you switch to it.
  out.gain.value = 0.85;
  const pink = noiseBuffer(ctx, 'pink');

  // Room tone.
  const room = play(ctx, noiseBuffer(ctx, 'brown'));
  const walls = ctx.createBiquadFilter();
  walls.type = 'lowpass';
  walls.frequency.value = 420;
  const roomLevel = ctx.createGain();
  roomLevel.gain.value = 0.42;

  room.connect(walls).connect(roomLevel).connect(out);
  room.start();
  kit.sources.push(room);
  kit.sources.push(modulate(ctx, roomLevel.gain, { rate: 0.04, depth: 0.1 }));

  // Murmur: band-limited noise in the speech range. Not speech, but the ear
  // assembles a busy room from the rhythm and the spacing.
  kit.timers.push(
    setInterval(() => {
      if (Math.random() > 0.62) return;
      const now = ctx.currentTime;

      const voice = play(ctx, pink);
      const formant = ctx.createBiquadFilter();
      formant.type = 'bandpass';
      formant.frequency.value = random(280, 1250);
      formant.Q.value = random(1.5, 4);

      const env = ctx.createGain();
      const length = random(0.18, 0.5);
      env.gain.setValueAtTime(0.0001, now);
      env.gain.exponentialRampToValueAtTime(random(0.02, 0.07), now + length * 0.35);
      env.gain.exponentialRampToValueAtTime(0.0001, now + length);

      const pan = ctx.createStereoPanner();
      pan.pan.value = random(-0.8, 0.8);

      voice.connect(formant).connect(env).connect(pan).connect(out);
      voice.start(now, random(0, NOISE_SECONDS - 1));
      voice.stop(now + length + 0.05);
    }, 220),
  );

  // The occasional cup meeting a saucer.
  kit.timers.push(
    setInterval(() => {
      if (Math.random() > 0.22) return;
      const now = ctx.currentTime;

      const clink = ctx.createOscillator();
      clink.type = 'triangle';
      clink.frequency.value = random(1900, 3400);

      const env = ctx.createGain();
      const length = random(0.14, 0.3);
      env.gain.setValueAtTime(0.0001, now);
      env.gain.exponentialRampToValueAtTime(0.022, now + 0.005);
      env.gain.exponentialRampToValueAtTime(0.0001, now + length);

      const pan = ctx.createStereoPanner();
      pan.pan.value = random(-0.6, 0.6);

      clink.connect(env).connect(pan).connect(out);
      clink.start(now);
      clink.stop(now + length + 0.05);
    }, 1700),
  );

  return { output: out, stop: kit.stop };
}

function buildWhite(ctx) {
  const kit = parts();
  const out = ctx.createGain();

  const noise = play(ctx, noiseBuffer(ctx, 'white'));
  // Unfiltered white noise is fatiguing across a 25-minute session; rolling
  // off the very top keeps it maskable without changing its character.
  const soften = ctx.createBiquadFilter();
  soften.type = 'lowpass';
  soften.frequency.value = 11000;
  soften.Q.value = 0.7;

  const level = ctx.createGain();
  level.gain.value = 0.34;

  noise.connect(soften).connect(level).connect(out);
  noise.start();
  kit.sources.push(noise);

  return { output: out, stop: kit.stop };
}

/** A minor pentatonic — no semitones, so any two notes agree. */
const PAD_NOTES = [110, 130.81, 146.83, 164.81, 196, 220, 261.63, 293.66, 329.63, 392];

function buildAmbient(ctx) {
  const kit = parts();
  const out = ctx.createGain();
  // A sparse pad measures far quieter than continuous noise, so it needs a
  // lift to sit at the same level as the other scenes when switching.
  out.gain.value = 2.4;

  const space = reverb(ctx);
  const wet = ctx.createGain();
  wet.gain.value = 0.55;
  space.connect(wet).connect(out);

  const dry = ctx.createGain();
  dry.gain.value = 0.45;
  dry.connect(out);

  // A drone underneath, so the gaps between notes never feel like a dropout.
  const drone = ctx.createOscillator();
  drone.type = 'sine';
  drone.frequency.value = 55;
  const droneLevel = ctx.createGain();
  droneLevel.gain.value = 0.09;

  drone.connect(droneLevel).connect(dry);
  drone.start();
  kit.sources.push(drone);
  kit.sources.push(modulate(ctx, droneLevel.gain, { rate: 0.05, depth: 0.045 }));

  function playNote() {
    const now = ctx.currentTime;
    const freq = PAD_NOTES[Math.floor(Math.random() * PAD_NOTES.length)];

    const voice = ctx.createOscillator();
    voice.type = 'sine';
    voice.frequency.value = freq;

    // A slightly detuned partner is what turns a beep into a pad.
    const shimmer = ctx.createOscillator();
    shimmer.type = 'triangle';
    shimmer.frequency.value = freq * 1.005;

    const colour = ctx.createBiquadFilter();
    colour.type = 'lowpass';
    colour.frequency.value = random(900, 1800);

    // Hold the peak in a local — reading gain.value here would sample the
    // pre-attack value and cut the note off the moment it arrived.
    const peak = random(0.05, 0.11);
    const attack = random(2.5, 4.5);
    const hold = random(2, 4);
    const release = random(5, 8);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(peak, now + attack);
    env.gain.setValueAtTime(peak, now + attack + hold);
    env.gain.linearRampToValueAtTime(0.0001, now + attack + hold + release);

    const pan = ctx.createStereoPanner();
    pan.pan.value = random(-0.7, 0.7);

    voice.connect(colour);
    shimmer.connect(colour);
    colour.connect(env).connect(pan);
    pan.connect(space);
    pan.connect(dry);

    const total = attack + hold + release;
    voice.start(now);
    shimmer.start(now);
    voice.stop(now + total + 0.2);
    shimmer.stop(now + total + 0.2);
  }

  playNote();
  kit.timers.push(
    setInterval(() => {
      if (Math.random() > 0.55) return;
      playNote();
    }, 2400),
  );

  return { output: out, stop: kit.stop };
}

const BUILDERS = {
  rain: buildRain,
  ocean: buildOcean,
  cafe: buildCafe,
  white: buildWhite,
  ambient: buildAmbient,
};

// ---------- Engine ----------

/**
 * @param {() => number} getVolume 0–1, read on every change so the slider is
 *   live rather than sampled once when the scene starts
 */
export function createSoundscape(getVolume) {
  let currentId = 'none';
  /** @type {{gain: GainNode, stop: () => void} | null} */
  let active = null;

  /** Ramp a scene down, then tear it down once it is inaudible. */
  function retire(scene) {
    const ctx = getAudioContext();
    if (!ctx || !scene) return;

    const now = ctx.currentTime;
    scene.gain.gain.cancelScheduledValues(now);
    scene.gain.gain.setValueAtTime(scene.gain.gain.value, now);
    scene.gain.gain.linearRampToValueAtTime(0.0001, now + FADE_SECONDS);

    setTimeout(() => {
      scene.stop();
      try {
        scene.gain.disconnect();
      } catch {
        /* already detached */
      }
    }, FADE_SECONDS * 1000 + 150);
  }

  function stop() {
    if (active) retire(active);
    active = null;
    currentId = 'none';
  }

  /** Switch scene, cross-fading from whatever is playing. */
  function start(id) {
    if (id === currentId && active) return;
    if (!BUILDERS[id]) {
      stop();
      return;
    }

    const ctx = resumeAudio();
    if (!ctx) return;

    if (active) retire(active);

    const built = BUILDERS[id](ctx);
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    built.output.connect(gain).connect(ctx.destination);
    gain.gain.linearRampToValueAtTime(Math.max(0.0001, getVolume()), ctx.currentTime + FADE_SECONDS);

    active = { gain, stop: built.stop };
    currentId = id;
  }

  /** Called while the volume slider moves. */
  function setVolume() {
    const ctx = getAudioContext();
    if (!ctx || !active) return;
    const now = ctx.currentTime;
    active.gain.gain.cancelScheduledValues(now);
    active.gain.gain.setValueAtTime(active.gain.gain.value, now);
    active.gain.gain.linearRampToValueAtTime(Math.max(0.0001, getVolume()), now + 0.12);
  }

  return {
    get current() {
      return currentId;
    },
    play: start,
    stop,
    setVolume,
  };
}
