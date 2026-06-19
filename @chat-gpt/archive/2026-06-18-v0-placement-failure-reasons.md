# v0 placement failure reasons / tagged error checkpoint

Date: 2026-06-18

Placement capacity failures are no longer represented as the generic `placement_unavailable` action reason. The engine now has a dedicated tagged error in `GameEngineError`:

- `_tag: "GamePlacementFailed"`
- `reason: "board:full" | "inventory:full" | "placement-failed:unknown"`

The placement reason schema is `GamePlacementFailureReasonSchema`, but schema is only the serializable contract. Runtime placement helpers fail through the Effect error channel with `GamePlacementFailed`, so callers can catch the tag explicitly instead of parsing strings from result objects. Yes, shocking, using the type system for the thing it was built for.

Current mapping rules:

- inventory-only placement uses `inventory:full`
- board-then-inventory placement uses `board:full` when no board tile can be placed at all and there is no valid fallback
- board-then-inventory placement uses `inventory:full` when board placement partially succeeded but the remainder cannot fit inventory
- `placement-failed:unknown` is reserved for genuinely unexpected placement failures; do not use it as a lazy default

Callers that need gameplay-specific behavior catch the tag:

- producer completion catches `GamePlacementFailed` and turns it into a blocked delivery retry/event
- scheduled item spawn catches `GamePlacementFailed` and emits `item.spawn.blocked`
- action flows such as stash open, inventory seeded placement, craft input withdraw and producer input withdraw catch it and map it to `GameActionRejected` with the same concrete reason

Low-level placement helpers should not return `{ type: "blocked", reason }` anymore. If placement cannot fit, throw/catch the tagged Effect error.
