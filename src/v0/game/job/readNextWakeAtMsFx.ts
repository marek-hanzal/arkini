import { Effect } from "effect";
import type { GameSave, GameSaveItemSpawnJob } from "~/v0/game/engine/model/GameSaveSchema";
import { readProducerQueueWakeAtMsValues } from "~/v0/game/producer/readProducerQueueWakeAtMsValues";
import { readMinGameWakeAtMs } from "~/v0/game/time/GameTime";

export namespace readNextWakeAtMsFx {
	export interface Props {
		nowMs?: number;
		save: GameSave;
	}
}

const isWaitingForItemSpawnDependencies = ({
	job,
	save,
}: {
	job: GameSaveItemSpawnJob;
	save: GameSave;
}) => Boolean(job.afterJobIds?.some((jobId) => save.itemSpawnJobs[jobId]));

const readItemSpawnWakeTimes = (save: GameSave) =>
	Object.values(save.itemSpawnJobs).flatMap((job) => {
		if (
			isWaitingForItemSpawnDependencies({
				job,
				save,
			})
		) {
			return [];
		}

		return [
			job.readyAtMs,
		];
	});

export const readNextWakeAtMsFx = Effect.fn("readNextWakeAtMsFx")(function* ({
	nowMs,
	save,
}: readNextWakeAtMsFx.Props) {
	return readMinGameWakeAtMs({
		nowMs,
		values: [
			...readItemSpawnWakeTimes(save),
			...readProducerQueueWakeAtMsValues(save),
			...Object.values(save.activeEffects ?? {}).flatMap((effect) => [
				effect.startAtMs,
				effect.endAtMs,
			]),
			...Object.values(save.craftJobs).map((job) => job.readyAtMs),
		],
	});
});
