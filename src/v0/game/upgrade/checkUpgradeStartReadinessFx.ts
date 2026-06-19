import { Effect } from "effect";
import { checkActivationInputsFx } from "~/v0/game/requirements/checkActivationInputsFx";
import { readUpgradeCompletedTierCountFx } from "~/v0/game/upgrade/readUpgradeCompletedTierCountFx";
import { readUpgradeCostInputsFx } from "~/v0/game/upgrade/readUpgradeCostInputsFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionUpgradeStartSchema } from "~/v0/game/action/GameActionUpgradeStartSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace checkUpgradeStartReadinessFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionUpgradeStartSchema.Type;
	}
}

export const checkUpgradeStartReadinessFx = Effect.fn("checkUpgradeStartReadinessFx")(function* ({
	config,
	save,
	action,
}: checkUpgradeStartReadinessFx.Props) {
	const upgrade = config.upgrades[action.upgradeId];
	if (!upgrade) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing upgrade "${action.upgradeId}".`),
		);
	}

	const runningJob = Object.values(save.upgradeJobs).find(
		(job) => job.upgradeId === action.upgradeId,
	);
	if (runningJob) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"upgrade_in_progress",
				`Upgrade "${action.upgradeId}" is already in progress.`,
			),
		);
	}

	const tierIndex = yield* readUpgradeCompletedTierCountFx({
		save,
		upgradeId: action.upgradeId,
	});
	if (tierIndex >= upgrade.tiers.length) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"upgrade_complete",
				`Upgrade "${action.upgradeId}" has no remaining tiers.`,
			),
		);
	}

	const costInputs = yield* readUpgradeCostInputsFx({
		tierIndex,
		upgrade,
	});
	yield* checkActivationInputsFx({
		inputRefs: action.inputRefs,
		inputs: costInputs,
		save,
	});

	return {
		costInputs,
		tier: upgrade.tiers[tierIndex],
		tierIndex,
		upgrade,
	};
});
