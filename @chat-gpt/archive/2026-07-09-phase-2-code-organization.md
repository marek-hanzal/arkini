# 2026-07-09 phase 2 code organization

Not part of the current pass. Keep this as the next layer after runtime/input-bag flattening.

## Goals
- replace `src/play/*` junk-drawer layering with clearer engine/ui boundaries
- move game logic ownership closer to domain modules and reduce view/runtime bridge churn
- evaluate top-level split into `engine/`, `ui/`, `config/`, `compiler/`, `cli/`
- keep runtime selectors/projections authoritative and stop spreading derived state across multiple wrapper layers

## Notes from phase 1
- drop/runtime flows had transport bags that mixed store, snapshot and derived views
- board tap flow mixed UI callbacks with runtime-derived board/item state in one context object
- producer readiness had redundant repacking of the same definition payload

## Expected phase 2 targets
- `src/play/*`
- runtime readers / bridge naming and ownership
- board/inventory interaction boundaries
- config/compiler split and runtime-facing compiled config contract
