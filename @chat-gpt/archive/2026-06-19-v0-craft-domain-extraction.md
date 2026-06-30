# v0 craft domain extraction

Status: done.

Moved craft runtime files and the craft action test from `src/v0/game/engine/fx` to top-level `src/v0/game/craft`.

Reason: craft is a game domain. `game/engine` should orchestrate craft actions/ticks through imports, not own craft behavior as files in an `fx` megabucket.

Scope:

- No gameplay behavior changes.
- No public action contract changes.
- No new nested folders.
- `GameConfigSchema` remains the legality gate.

Moved family:

- craft start/store/withdraw/complete/process effects
- craft readiness effects
- craft board item/input readers
- craft requirements splitter
- craft action test

Next recommended domain extraction: stash.
