# 2026-06-30 visible effect requirements review

Follow-up deep review after effect/grant migration.

Findings fixed:

- Product `grantSelector` was still treated as visibility in `readEffectiveProducerProductLine`, which made ordinary visible lines disappear when their effect requirements were missing. This was wrong for proximity/owned requirements such as Lumberjack needing a nearby Tree. Visible product lines now stay visible and expose unmet effect requirements; start/runtime gates still reject with `effect:missing-grant`.
- Truly hidden/unlock lines are now represented by `visibility: "hidden"` plus grants/effect reveal semantics. Hidden grant-gated lines stay hidden until their grant selector is ready.
- Producer product line runtime views now include `effectRequirementsReady` and `effectRequirements` so UI can show missing/satisfied effect requirements instead of hiding the line.
- Product-line run-state now disables the action and labels the line as `Requirements missing` when effect requirements are unmet.
- Queued producer start gate now requires both `visible` and `grantsReady`, otherwise queued jobs could pass the visibility gate after visible/missing lines were split.
- Stash activation view no longer leaks drops/inputs for a hidden stash product line. The shared product-line view already hid it, but the stash top-level preview was still reading the effective loot directly.

Important invariant:

- `grantSelector` is a runtime gate.
- `visibility: "visible" + grantSelector missing` means: show line, mark requirements missing, reject start.
- `visibility: "hidden" + grantSelector missing` means: keep line hidden until grant-ready/unlocked.
- `line.hide` / `line.reveal` remain visibility effects with nearest-local-effect priority.
