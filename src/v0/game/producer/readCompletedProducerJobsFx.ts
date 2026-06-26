import { Effect } from "effect";
import { readFirstProducerQueueJobs } from "~/v0/game/producer/readFirstProducerQueueJobs";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readProducerJobWakeAtMs } from "~/v0/game/producer/producerDeliveryTiming";

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
	return readFirstProducerQueueJobs(save)
		.filter((job) => readProducerJobWakeAtMs(job) <= nowMs)
		.sort(
			(left, right) =>
				readProducerJobWakeAtMs(left) - readProducerJobWakeAtMs(right) ||
				left.id.localeCompare(right.id),
		);
});
