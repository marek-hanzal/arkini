# Synth audio subsystem

Status: completed 2026-07-03

- Added `src/audio` as a standalone synth SFX subsystem with no MP3 assets and no extra dependencies.
- `GameAudioProvider` owns lazy Web Audio unlock on first pointer/key gesture.
- `GameRuntimeAudioEffects` subscribes to runtime updates and maps `GameEvent[]` to a deduplicated `GameAudioPlan`.
- UI-only sounds are routed through the audio bus from `PlayShell` feedback/sheet open/close and TileEngine lifecycle callbacks.
- TileEngine stayed generic: it now exposes `onDropSettled` but does not import Arkini domains or audio.
- Added `cheat.speed_mode.changed` event so speed watch enable/disable has a real runtime event instead of component-side guessing.
- Added tests for audio plan dedupe/caps/stash distinction/cheat direction and cheat speed event emission.

Important design guard:

- Do not play sounds from producer/craft/item detail components directly. Runtime gameplay sounds come from `GameRuntimeAudioEffects`; UI interaction sounds go through `useGameAudio` at PlayShell/TileEngine adapter boundaries.
