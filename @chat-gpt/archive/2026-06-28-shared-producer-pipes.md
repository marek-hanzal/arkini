# 2026-06-28 shared producer/craft/stash pipe pass

Focus: remove duplicated timing/view plumbing after craft, producer, and stash semantics converged.

## What changed

- Added shared pausable-job timing helpers for producer/craft pause detection, wake planning, remaining-time calculation, and resume timing.
- Producer and craft realtime sync now use the same pause/resume timing math instead of local copies.
- Craft runtime duration reads through one `readCraftRecipeDurationMs` helper so engine timing and UI duration use the same proximity multiplier path.
- Producer activation product-line view construction moved into one shared bridge helper.
- Stash activation now reuses the same producer product-line view helper for running/queued/progress state. Stash board progress can therefore read the same product-line timing pipe as producers.
- Stash detail hides default-line controls. Producer defaults remain explicit player selection only; no implicit first-line default was introduced.

## Validation notes

- Full Vitest dot suite passes: 69 files, 467 tests.
- Typecheck passes.
- Dead-code audit passes.
- Known generated asset-size warning remains unrelated to gameplay/runtime.
