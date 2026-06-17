import { Effect } from "effect";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace readNextWakeAtMsFx {
	export interface Props {
		save: GameSave;
	}
}

export const readNextWakeAtMsFx = Effect.fn("readNextWakeAtMsFx")(function* ({
	save,
}: readNextWakeAtMsFx.Props) {
	const wakeTimes = [
		...Object.values(save.scheduledEvents).map((event) => event.dueAtMs),
		...Object.values(save.producerJobs).map((job) => job.completesAtMs),
		...Object.values(save.craftJobs).map((job) => job.completesAtMs),
	];

	if (wakeTimes.length === 0) {
		return null;
	}

	return Math.min(...wakeTimes);
});
