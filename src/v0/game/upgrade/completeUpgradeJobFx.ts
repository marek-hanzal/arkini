import { Effect } from "effect";
import { cloneGameSaveFx } from "~/v0/game/save/cloneGameSaveFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameEngineCompletionResult } from "~/v0/game/engine/model/GameEngineCompletionResult";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave, GameSaveUpgradeJob } from "~/v0/game/engine/model/GameSaveSchema";

export namespace completeUpgradeJobFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		job: GameSaveUpgradeJob;
		nowMs: number;
	}
}

export const completeUpgradeJobFx = Effect.fn("completeUpgradeJobFx")(function* ({
	config,
	save,
	job,
	nowMs,
}: completeUpgradeJobFx.Props) {
	const liveJob = save.upgradeJobs[job.id];
	if (!liveJob) {
		return {
			events: [],
			save,
			type: "completed" as const,
		} satisfies GameEngineCompletionResult;
	}

	const upgrade = config.upgrades[liveJob.upgradeId];
	if (!upgrade) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing upgrade "${liveJob.upgradeId}".`),
		);
	}
	if (!upgrade.tiers[liveJob.tierIndex]) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(
				`Missing tier ${liveJob.tierIndex} on upgrade "${liveJob.upgradeId}".`,
			),
		);
	}

	const nextSave = yield* cloneGameSaveFx({
		save,
	});
	const currentState = nextSave.upgrades[liveJob.upgradeId] ?? {
		completedTiers: 0,
	};
	nextSave.upgrades[liveJob.upgradeId] = {
		completedTiers: Math.max(currentState.completedTiers, liveJob.tierIndex + 1),
	};
	delete nextSave.upgradeJobs[liveJob.id];
	nextSave.updatedAtMs = nowMs;

	return {
		events: [
			{
				completedAtMs: nowMs,
				jobId: liveJob.id,
				tierIndex: liveJob.tierIndex,
				type: "upgrade.completed" as const,
				upgradeId: liveJob.upgradeId,
			},
		],
		save: nextSave,
		type: "completed" as const,
	} satisfies GameEngineCompletionResult;
});
