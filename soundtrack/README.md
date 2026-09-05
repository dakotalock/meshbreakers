# Meshbreakers — Original Soundtrack

co-created by **Dakota Rain Lock and GPT Astra**

An original instrumental score composed as explicit notes and orchestrated for synthesized piano, strings, plucked strings, bass, bells, lead and percussion. The resistance motif is D–A–C–F–E. No external music accounts, third-party samples or adapted songs were used.

| Cue | Title | Tempo | Length |
| --- | --- | ---: | ---: |
| Title | A Light Between Seconds | 86 BPM | 89.3 s |
| Battle | A Hundred Small Rebellions | 124 BPM | 61.9 s |
| Boss | The Hour That Devours | 132 BPM | 58.2 s |
| Refuge | Somewhere the Rain Can Find Us | 76 BPM | 75.8 s |
| Victory | Tomorrow Is Ours | 96 BPM | 20.0 s |

`compose.py` contains the melodies, harmony, orchestration, instrument synthesis, deterministic noise seed, stereo ambience and mastering. Each `.score.json` contains the pitched note events for its cue. The script also specifies percussion. Game-ready stereo recordings are in `public/music/`, encoded as 128 kbps MP3 at 32 kHz. Looped cues wrap their reverb tails into the beginning. Victory ends with a fade.

To reproduce the recordings, install Python with NumPy and FFmpeg, then run from the repository root:

```sh
python soundtrack/compose.py
```

The game caches the recordings with its other offline assets and decodes up to two cues at a time. Scene transitions crossfade over 1.8 seconds. Audio starts only after a player gesture. Settings provide independent effects/music switches, a music volume slider and reduced motion. Credits & soundtrack offers in-game playback of all five cues.
