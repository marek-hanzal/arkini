import { Effect } from "effect";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readProducerJobWakeAtMs } from "~/v0/game/engine/fx/producerDeliveryTiming";

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
	return Object.values(save.producerJobs)
		.filter((job) => readProducerJobWakeAtMs(job) <= nowMs)
		.sort(
			(left, right) =>
				readProducerJobWakeAtMs(left) - readProducerJobWakeAtMs(right) ||
				left.id.localeCompare(right.id),
		);
});
