# World snapshot cleanup pass

Follow-up to the world snapshot hub refactor.

## Changes

- Moved craft job lifecycle normalization into `src/v0/game/world/readWorldCraftJobFacts.ts`.
- Moved replacement safety into `src/v0/game/world/readWorldReplacementSafetyFacts*` and reused it from board runtime-state reads and snapshot validation.
- Removed legacy producer queue/wake helpers that duplicated world facts.
- Made `readNextWakeAtMsFx`/`readWorldWakePlanFx` require `GameConfig`, so legacy wake reads cannot accidentally treat paused/blocked producer active effects as wakeable.
- Routed runtime producer activation UI through `readWorldProducerJobFacts` instead of old queue readers.

## Rationale

The old duplicated readers made timing behavior depend on which facade was called. A paused producer active effect, for example, could be ignored by the world hub but still wake through the legacy next-wake facade when no config was supplied. Wake planning and lifecycle facts now share the same normalized world-state view.

## Validation targets

- Craft lifecycle facts and craft wake reasons.
- Replacement safety facts without turning normal runtime state into an issue.
- Paused producer active effects do not wake through `readNextWakeAtMsFx`.
