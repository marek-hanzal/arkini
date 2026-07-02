import { Effect } from "effect";
import { readWorldProducerJobFacts } from "~/world/readWorldProducerJobFacts";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace readCompletedProducerJobsFx {
	export interface Props {
		save: GameSave;
		nowMs: number;
	}
}

export const readCompletedProducerJobsFx = Effect.fn("readCompletedProducerJobsFx")(function* ({
	save,
	nowMs,
}: readCompletedProducerJobsFx.Props) {
	return readWorldProducerJobFacts({
		nowMs,
		save,
	})
		.filter(
			(facts) =>
				facts.queueIndex === 0 &&
				facts.releaseAtMs !== undefined &&
				facts.releaseAtMs <= nowMs,
		)
		.sort((left, right) => {
			const leftWakeAtMs = left.releaseAtMs ?? Number.MAX_SAFE_INTEGER;
			const rightWakeAtMs = right.releaseAtMs ?? Number.MAX_SAFE_INTEGER;
			return leftWakeAtMs - rightWakeAtMs || left.job.id.localeCompare(right.job.id);
		})
		.map((facts) => facts.job);
});
