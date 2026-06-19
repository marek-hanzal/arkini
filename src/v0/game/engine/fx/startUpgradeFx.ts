import { Effect } from "effect";
import { checkUpgradeStartReadinessFx } from "~/v0/game/engine/fx/checkUpgradeStartReadinessFx";
import { cloneGameSaveFx } from "~/v0/game/engine/fx/cloneGameSaveFx";
import { consumeActivationInputsFx } from "~/v0/game/requirements/consumeActivationInputsFx";
import { createGameJobIdFx } from "~/v0/game/engine/fx/createGameJobIdFx";
import { readNextWakeAtMsFx } from "~/v0/game/engine/fx/readNextWakeAtMsFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionUpgradeStartSchema } from "~/v0/game/engine/model/GameActionUpgradeStartSchema";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace startUpgradeFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionUpgradeStartSchema.Type;
		nowMs: number;
	}
}

export const startUpgradeFx = Effect.fn("startUpgradeFx")(function* ({
	config,
	save,
	action,
	nowMs,
}: startUpgradeFx.Props) {
	const checked = yield* checkUpgradeStartReadinessFx({
		action,
		config,
		save,
	});
	const consumed = yield* consumeActivationInputsFx({
		inputRefs: action.inputRefs,
		inputs: checked.costInputs,
		nowMs,
		reason: "upgrade-cost",
		save,
	});
	const nextSave = yield* cloneGameSaveFx({
		save: consumed.save,
	});
	const jobId = yield* createGameJobIdFx();
	const completesAtMs = nowMs + checked.tier.durationMs;
	nextSave.upgradeJobs[jobId] = {
		completesAtMs,
		id: jobId,
		startedAtMs: nowMs,
		tierIndex: checked.tierIndex,
		upgradeId: action.upgradeId,
	};
	nextSave.updatedAtMs = nowMs;

	return {
		events: [
			...consumed.events,
			{
				completesAtMs,
				jobId,
				startedAtMs: nowMs,
				tierIndex: checked.tierIndex,
				type: "upgrade.started" as const,
				upgradeId: action.upgradeId,
			},
		],
		nextWakeAtMs: yield* readNextWakeAtMsFx({
			save: nextSave,
		}),
		save: nextSave,
	} satisfies GameEngineResult;
});
