# Effect display + duplicate cleanup review

Completed a deep review pass after the line-owned effect and polarity work.

Findings/fixes:

- Runtime effect requirement rows now preserve their phase (`start` vs `visibility`) so UI readiness summaries do not treat visibility-only unlock conditions as start blockers.
- UI display policy for line-owned effect requirements now distinguishes active rows from missing rows:
  - `whenActive` shows satisfied `grant.require`/`nearby.require` rows and active `grant.blockStart` blockers.
  - `whenMissing` shows unsatisfied requirements/blocking rows.
  - `always` and `never` stay literal.
- Removed obsolete `producerId` / `producerItemId` plumbing from effective product-line readers. Line-owned effects resolve against the producer item instance and runtime save/config truth; the extra ids were dead props after the refactor.
- Shared duplicate helpers:
  - selector-id matching now lives in `src/v0/game/selector/doesResolvedDomainSelectorMatchId.ts` and is reused by config validation, compiler packaging, and effect selector code.
  - output target limit merging now lives in `src/v0/game/limit/mergeItemTargetLimits.ts`.
  - UI effect polarity labels/classes/sections now live in `src/v0/item/ui/effectPolarityUi.ts`.
- Added regression coverage for `whenActive` vs `whenMissing` requirement display behavior.

Validation after the pass:

- `npm run format:check`
- `npm run game:validate -- game/arkini`
- `npm run dc`
- `npm run typecheck`
- `npm run test -- --reporter=dot`
- `npm run audit:dead`
- `npm run audit:dupes`

`audit:dupes` reports 0 clones after the cleanup.
