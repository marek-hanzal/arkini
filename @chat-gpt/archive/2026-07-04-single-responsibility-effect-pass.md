# Single-responsibility / Effect-context pass - 2026-07-04

Follow-up quality pass focused on long, cyclomatically dense functions and Effect-first boundaries.

Changes:
- Split inventory-to-board placement into a scoped Effect program. Shared action/config/save/now data now flows through an Effect `Context.Tag` instead of being prop-drilled through every sub-step.
- Split inventory placement readiness into focused Fx steps and used `ts-pattern` for exact vs nearest placement and instance vs stack branching.
- Split gameplay source construction in config validation into focused source family builders for starting state, passive grants, merges, removals, crafts, line outputs, and active line grants.
- Split drop-effect, blueprint dependency cycle, reachability, and grant blocker validation into smaller single-purpose functions. Used `ts-pattern` where variant coverage matters.
- Split `validateGameSaveAgainstConfig` from a thousand-line schema validator into focused board, inventory, producer job, active effect, line state, input, craft, charge, capacity, board-memory, and spawn-job validation blocks.

Verification notes:
- Active function scan after the pass found no non-test `src` function body at 40+ lines using the local brace-based scanner used during review.
- Expected game validation warnings remain only the known limited-deposit softlock warnings.
