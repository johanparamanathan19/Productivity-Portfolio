# Synthesised soundscapes

`tools/pomodoro/js/soundscape.js` generates rain, ocean, café, white noise, and
an ambient pad at runtime from noise buffers and oscillators.

## Why synthesise instead of ship audio files

- Nothing to download, so the timer starts instantly.
- Nothing to licence and no attribution to track.
- No megabytes in the repository and no bandwidth on every page load.
- **It never loops.** A short sampled ambience gives itself away within a
  minute or two; generated audio has no loop point to notice.

## The building blocks

Three noise colours do most of the work:

| Colour | Character | Made by |
| --- | --- | --- |
| White | Flat, hissy | Uniform random samples |
| Pink | Falls off 3 dB per octave | Paul Kellet's filter approximation |
| Brown | Deep rumble | Integrating white noise |

Brown noise drifts, which would click at the loop point, so each buffer is
tilted by its own drift to make the last sample meet the first.

## How each scene is built

- **Rain** — band-limited noise for the body, plus individually scheduled
  droplet transients close to the listener, plus a slow gain LFO so it reads as
  weather rather than static.
- **Ocean** — brown noise under a lowpass filter, with filter cutoff and gain
  swept by LFOs at unrelated rates (0.07 Hz, 0.031 Hz, 0.023 Hz) so the waves
  never fall into a pattern. Pink noise adds foam on top.
- **Café** — brown-noise room tone under randomised bursts of band-limited
  noise in the speech range, and the occasional cup. It is an impression of a
  room, not a field recording; the ear assembles "busy café" from the rhythm
  and spacing rather than from anything resembling words.
- **White noise** — rolled off above 11 kHz. Unfiltered white noise is
  fatiguing across a 25-minute session without being any more maskable.
- **Ambient** — a generative pad on a minor pentatonic (no semitones, so any
  two notes agree) through a synthesised convolution reverb, over a quiet
  drone. Notes get slow attacks and long releases, so it never resolves.

## Two things that are easy to get wrong

**Buffer reuse.** Each scene generates its noise colours once and shares the
`AudioBuffer` across every source, including the short bursts — those vary by
starting at a random offset instead. Allocating a fresh 8-second buffer per
raindrop is roughly 350k floats several times a second, which is how the first
version of this was written and why it isn't any more.

**Envelope peaks.** Reading `gain.value` to schedule a sustain level samples
the *pre-attack* value, which cuts the note off the instant it arrives. Hold
the peak in a local variable and schedule against that.

## Level matching

Scene loudness is matched by measured RMS so switching between them does not
jump in volume. A sparse pad measures far quieter than continuous noise for the
same perceived presence, so `buildAmbient` carries a deliberate lift; café is
trimmed because its murmur transients peaked well above everything else.

These were tuned by measuring output through an analyser node, not by ear —
worth re-checking on decent speakers if you change them.
