# 2026-06-30 effect no-op cleanup review

Another effect stability/deep-review pass after line-owned effects and polarity grouping.

## Findings

- Craft runtime/view naming still carried `grantsReady`, even though craft start gates now include both start requirements and active `grant.blockStart` blockers. This was not a behavior bug anymore, but it was a semantic trap for the next poor bastard reading the code. The craft view/state now uses `startRequirementsReady` and `startGateReady = startRequirementsReady && !blocked`.
- `grant.loot.extraOutputChance.add` could target output item selectors that did not match any same-line non-weighted base output. Runtime then produced no bonus loot and only skipped the applied effect summary, while config and authoring data still looked like a real buff. Lovely little fake bonus, straight into the bin.
- Arkini authoring had 1,560 extra-output chance effects. 1,503 of them were no-ops, mostly broad Bountiful Offering copies pasted onto lines whose outputs could never match the target selector. They were removed from 139 product lines. 57 real same-output bonus effects remain on 56 products.

## Changes

- Config validation now rejects `grant.loot.extraOutputChance.add` effects on output-less lines, weighted-only lines, or selectors that match no same-line non-weighted base output item.
- Craft UI status now shows `Requirements missing` for collecting-input craft targets whose effect start requirements are not satisfied, instead of pretending they are merely collecting inputs.
- Docs updated to state that extra chance loot is a same-line non-weighted-output bonus and not a generic “add any tagged item” loot patch.

## Verification

- Targeted config/craft/UI tests added and run.
- Full validation/check pass should be run after formatting and compile in the final task step.
