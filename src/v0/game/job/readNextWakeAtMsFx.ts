import { Effect } from "effect";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readProducerQueueWakeAtMsValues } from "~/v0/game/producer/readProducerQueueWakeAtMsValues";

export namespace readNextWakeAtMsFx {
	export interface Props {
		save: GameSave;
	}
}

export const readNextWakeAtMsFx = Effect.fn("readNextWakeAtMsFx")(function* ({
	save,
}: readNextWakeAtMsFx.Props) {
	const wakeTimes = [
		...Object.values(save.itemSpawnJobs).map((job) => job.dueAtMs),
		...readProducerQueueWakeAtMsValues(save),
		...Object.values(save.activeEffects ?? {}).map((effect) => effect.expiresAtMs),
		...Object.values(save.craftJobs).map((job) => job.completesAtMs),
	];

	if (wakeTimes.length === 0) {
		return null;
	}

	return Math.min(...wakeTimes);
});
