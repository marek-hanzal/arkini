# 2026-06-30 - Line-owned effect rules hard cutover

Refactored the effect system away from source-target mutators.

New invariant:

- Effect definitions only publish global grant facts through `grantIds`.
- Passive and active effect sources no longer target, mutate, reveal, hide, block, replace loot, change duration, or apply proximity rules to other game objects.
- Product lines own their own `effects` rules:
  - `grant.require` for visibility/start gates
  - `grant.blockStart` for explicit counter-path/runtime blockers
  - `nearby.require` for visible board proximity requirements
  - `nearby.duration.multiply` for exact distance-band modifiers
  - `grant.duration.multiply` for grant-driven duration modifiers
  - `grant.loot.extraOutputChance.add` for grant-driven loot modifiers
- Craft recipes own their own grant gates/blockers through the same line-effect model.
- UI renders evaluated line effects from runtime view state in config order using each rule display policy.
- Old mutator operation files and item/create effect gates were removed instead of kept as compatibility shims.

Reasoning:

The previous source-owned mutator model was powerful but too distributed: a source item could carry rules about unrelated targets, proximity, visibility, creation blocking, and loot/runtime mutation. That made source identity, stack movement, cell replacement, hidden links, and UI truth fragile. The new model makes each line the single authority for its own behavior while effects become simple global facts.

Validation notes:

- Compiled Arkini config no longer contains `grantSelector` or source `operations`.
- Existing old-source-mutator tests were removed/replaced because they asserted deleted behavior.
- New tests assert global grants, visible vs hidden line requirements, line-owned nearby requirements, grant blockers, grant duration/loot modifiers, and realtime board-state duration changes.
