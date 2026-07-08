import { Effect } from "effect";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readWorldProducerJobFacts } from "~/world/readWorldProducerJobFacts";

export const readQueuedLineStartAtMsFx = Effect.fn("startLineFx.readQueuedLineStartAtMsFx")(
	function* ({
		itemInstanceId,
		nextSave,
		nowMs,
	}: {
		itemInstanceId: string;
		nextSave: GameSave;
		nowMs: number;
	}) {
		return Math.max(
			nowMs,
			...readWorldProducerJobFacts({
				nowMs,
				save: nextSave,
			})
				.filter((facts) => facts.itemInstanceId === itemInstanceId)
				.map((facts) => facts.releaseAtMs)
				.filter((wakeAtMs): wakeAtMs is number => wakeAtMs !== undefined),
		);
	},
);
