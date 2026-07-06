# Output-scoped active effects in line detail UI

Date: 2026-07-06

## Context

The producer detail UI used to render active runtime bonuses in a standalone green `Active bonuses` box at the line level.
That was misleading once effects were understood as being attached to concrete production line outputs/resources.
For example, Lumberjack `Log` should show all active bonuses that affect Log directly in the Log output row.

## Decision

Active effect summaries are now carried by output rows via `LineView.outputs[].bonusLines`.

- Duration effect operations carry `targetItemId` and `durationMultiplier` when produced from output effects.
- Runtime bonus summary generation exposes structured entries: `{ itemId?: string; label: string }`.
- `readRuntimeLineOutputViews` attaches item-scoped bonus entries only to matching output items.
- Unscoped entries remain supported and are attached to every output as fallback.
- The old line-level `effectBonusLines` remains available as a fallback for lines without outputs, but product output rows are the primary presentation point.
- `DetailLineCard` no longer renders the standalone `Active bonuses` note when outputs exist.
- `DetailLineOutputs` renders output bonus/drop-effect lines under an `Applied effects` label.

## Guardrail

Do not reintroduce a separate green line-level active bonus box for product outputs. If an active effect affects a resource, attach it to that resource output row. If we later need richer UX, evolve output-scoped effect rows, not another parallel summary layer.
