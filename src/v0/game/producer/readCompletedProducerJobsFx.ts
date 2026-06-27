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
		.filter((job) => {
			const wakeAtMs = readProducerJobWakeAtMs(job);
			return wakeAtMs !== undefined && wakeAtMs <= nowMs;
		})
		.sort((left, right) => {
			const leftWakeAtMs = readProducerJobWakeAtMs(left) ?? Number.MAX_SAFE_INTEGER;
			const rightWakeAtMs = readProducerJobWakeAtMs(right) ?? Number.MAX_SAFE_INTEGER;
			return leftWakeAtMs - rightWakeAtMs || left.id.localeCompare(right.id);
		});
});
