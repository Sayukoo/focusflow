# FocusFlow voice packs

Drop ElevenLabs `.mp3` files into these folders:

```text
public/audio/voices/calm-female/
```

Current female pack filenames:

- `session-start.mp3` — first work block / session start
- `work-start.mp3` — returning to work after a break
- `break-start.mp3` — every break, regardless of its duration
- `session-complete.mp3` — optional finite timer completion cue

The app uses the calm female pack by default. If a file is missing, it falls back to
system `speechSynthesis`.

Polish scripts ready for ElevenLabs are in [`docs/voice-cues-pl.md`](../../docs/voice-cues-pl.md).
