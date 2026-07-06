# 2026-07-06 — quantity transfer refactor

Context: follow-up after inventory placement / excessive stack DnD bugs.

What made the last bugfix mentally expensive:

- Transfer quantity was computed in UI/drop planning, craft readiness, producer readiness, and engine consumption as separate local snippets.
- Board drop action carried `consumedQuantity` for animation, but runtime dispatch rebuilt the action from a fresh interaction plan and previously passed a full stack ref into the engine. Engine-side clamping saved correctness after the bugfix, but the handoff contract was dishonest.
- Inventory placement capacity had already proven that "can place" is not only empty board cells; existing stack capacity is real capacity and belongs in a shared quantity/capacity vocabulary.

Refactor decisions:

- `readAcceptedTransferQuantity` is the small shared math primitive for source-available vs target-remaining transfer quantity.
- Craft and producer stored-input readiness both use `readStoredActivationInputQuantityCandidateFx` to clamp resolved refs to remaining target capacity.
- Runtime board-item dispatch now rewrites consuming source refs to the interaction plan's `consumedQuantity` before creating engine actions. The engine still protects itself, but the UI/runtime handoff no longer lies by passing a full source stack where the plan only consumes one item.

Guardrail:

- Future DnD/input fixes should not add another `Math.min(sourceQuantity, remainingCapacity)` snippet. Route through the shared transfer helper or the stored activation candidate helper.
