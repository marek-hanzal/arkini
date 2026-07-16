import { Effect } from "effect";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace checkCraftTargetIdleFx {
	export interface Props {
		save: GameSave;
		targetItemInstanceId: string;
	}
}

export const checkCraftTargetIdleFx = Effect.fn("checkCraftTargetIdleFx")(function* ({
	save,
	targetItemInstanceId,
}: checkCraftTargetIdleFx.Props) {
	const runningCraftJob = Object.values(save.craftJobs).find(
		(job) => job.targetItemInstanceId === targetItemInstanceId,
	);
	if (runningCraftJob) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"craft_in_progress",
				`Craft target "${targetItemInstanceId}" already has running craft job "${runningCraftJob.id}".`,
			),
		);
	}

	const runningProducerJob = Object.values(save.producerJobs).find(
		(job) => job.itemInstanceId === targetItemInstanceId,
	);
	if (!runningProducerJob) return;

	return yield* Effect.fail(
		GameEngineError.actionRejected(
			"item_busy",
			`Craft target "${targetItemInstanceId}" already has running producer job "${runningProducerJob.id}".`,
		),
	);
});
