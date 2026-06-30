# Producer domain extraction

Status: done.

Moved producer runtime files out of `src/v0/game/engine/fx` into top-level `src/v0/game/producer`.

Why:

- `engine/fx` was acting as an implementation-type bucket, not a domain.
- Producer is a gameplay domain, not an engine subfolder.
- `game/engine` should orchestrate producer workflows through imports; it should not own producer internals.

Moved without behavior changes:

- producer start/complete/process jobs
- producer input store/withdraw
- product line enable toggle
- producer readiness checks
- producer readers
- producer delivery timing
- producer action tests

Current shape:

- `src/v0/game/producer` = GameSave/GameConfig producer domain behavior used by the engine.
- Existing `src/v0/producer` still contains UI/live-view producer helpers. Do not merge these casually; evaluate later when doing a wider producer-domain pass.

Next safe domain move: craft runtime files from `src/v0/game/engine/fx` into `src/v0/game/craft`.
