# Board removal boundary pass

Follow-up senior deep-review pass after `f5600b17`, focused on remaining duplicated low-level board item deletion routes.

## Changed

- Added `src/board/removeBoardItemFromSaveFx.ts` as the single low-level board item removal boundary.
- The boundary always deletes `save.board.items[itemInstanceId]` and requires an explicit `runtimeState: "remove" | "preserve"` decision.
- Rewired raw board removal call sites:
  - activation input consumption
  - board item -> inventory transfer
  - tile removal
  - debug delete
  - finite capacity depletion removal
  - producer charge depletion removal
  - depleted producer source-cell replacement cleanup
- Tightened `audit:current` so raw `delete *.board.items[...]` outside the removal boundary fails the repo audit.

## Current surface estimate

- `src/**/logic`: 0 files.
- exported `Effect.fn` without `Fx` symbol/file boundary: 0 files.
- raw board-item deletes outside `removeBoardItemFromSaveFx`: 0 files.
- `jscpd`: 0 clones.
- `knip`: no reported unused files/exports.
- Remaining meaningful cleanup surface is mostly structural, not obvious duplicate-code rot:
  - big config/schema validators (`GameConfigValidation.ts`, `GameSaveSchema.ts`), likely 2-3 heavy passes if we decide to split without losing central validation clarity;
  - effect evaluation (`readEffectiveLine.ts`), likely 1-2 heavy passes;
  - runtime/view bridge + visual/audio planners, likely 2-3 medium passes;
  - local `Context.Tag` scope-heavy Fx orchestrators, about 30+ files but only some are actually painful; likely 4-6 targeted passes, not a blanket purge.

