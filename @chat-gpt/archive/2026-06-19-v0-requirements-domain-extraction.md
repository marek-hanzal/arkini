# v0 requirements domain extraction

Status: done.

Moved requirement/input-ref runtime behavior out of `src/v0/game/engine/fx` into top-level `src/v0/game/requirements`.

## Why

`engine/fx` is being reduced to orchestration and generic engine glue. Stored requirements were not an isolated helper: the same requirement/input-ref subsystem is used by producer, craft, stash, upgrade, merge/remove, and stored-requirement actions.

A narrow `stored-requirements` folder would have been misleading. The domain is `requirements`:

- passive requirement checks
- stored requirement store/withdraw/readiness/readers
- activation input check/consume helpers
- input ref resolve/sum/consume helpers

## Guardrails

- Do not add a capability legality layer here. `GameConfigSchema` remains the legality gate.
- Requirements can fail runtime actions, but they do not decide whether an item/capability combination is legal.
- Keep `game/requirements` flat unless a nested folder clearly earns its existence.
- Engine orchestration may import requirements; requirements should not become a new dumping ground for unrelated placement, producer, craft, or stash rules.
