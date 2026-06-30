# Line-owned effects deep review

Post-refactor review found and fixed a runtime/UI truth leak: active duration and loot modifier effects were still placed into the effective line `requirements` list with `ready: false`, so UI could render active bonuses as `Missing ...`. Product-line effect requirements are now only requirement-like/blocker rules; modifier effects are exposed through applied effect operations and bonus summaries.

Nearby duration modifiers now record one applied operation per matched source item instance, so bonus summaries can truthfully count stacked local sources instead of collapsing everything into one producer-owned fake source.

Runtime producer line views now keep hidden missing requirements blocking via `effectRequirementsReady: false` even when `display: "never"` hides the row. UI requirement rows now distinguish active `grant.blockStart` blockers from missing requirements.

Craft recipe validation now rejects producer-only effect kinds. Craft runtime supports only `grant.require` with `phase: "start"` and `grant.blockStart`; nearby/duration/loot craft effects are invalid until runtime explicitly supports them.

Docs/current notes were updated away from obsolete source-owned effect operations, `grantSelector`, creation blockers, and line reveal/hide language.
