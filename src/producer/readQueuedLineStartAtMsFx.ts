import { Effect } from "effect";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { LineStartExecutionScope } from "~/producer/LineStartExecutionTypes";
import { readWorldProducerJobFacts } from "~/world/readWorldProducerJobFacts";

export const readQueuedLineStartAtMsFx = Effect.fn("startLineFx.readQueuedLineStartAtMsFx")(
	function* (
		scope: LineStartExecutionScope,
		{
			nextSave,
		}: {
			nextSave: GameSave;
		},
	) {
		const { action, nowMs } = scope;
		return Math.max(
			nowMs,
			...readWorldProducerJobFacts({
				nowMs,
				save: nextSave,
			})
				.filter((facts) => facts.itemInstanceId === action.itemInstanceId)
				.map((facts) => facts.releaseAtMs)
				.filter((wakeAtMs): wakeAtMs is number => wakeAtMs !== undefined),
		);
	},
);
