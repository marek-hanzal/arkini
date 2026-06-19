# v0 upgrade domain extraction

Status: done.

Moved upgrade lifecycle runtime files from `src/v0/game/engine/fx` into top-level `src/v0/game/upgrade`.

Files moved:

- `checkUpgradeStartReadinessFx.ts`
- `completeUpgradeJobFx.ts`
- `processCompletedUpgradeJobsFx.ts`
- `readCompletedUpgradeJobsFx.ts`
- `readUpgradeCompletedTierCountFx.ts`
- `readUpgradeCostInputsFx.ts`
- `startUpgradeFx.ts`
- `upgradeFx.test.ts`

Reason: upgrade lifecycle is a game domain. Engine dispatch/tick orchestration should import upgrade behavior, not own it inside `engine/fx`.

No behavior change intended.
