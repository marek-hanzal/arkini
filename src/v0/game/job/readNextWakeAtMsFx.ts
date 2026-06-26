import { Effect } from "effect";
import type { GameSave, GameSaveItemSpawnJob } from "~/v0/game/engine/model/GameSaveSchema";
import { readProducerQueueWakeAtMsValues } from "~/v0/game/producer/readProducerQueueWakeAtMsValues";

export namespace readNextWakeAtMsFx {
	export interface Props {
		nowMs?: number;
		save: GameSave;
	}
}

const readWakeTime = ({ nowMs, value }: { nowMs?: number; value: number }) => {
	if (nowMs === undefined) return value;
	return value > nowMs ? value : undefined;
};

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
			job.dueAtMs,
		];
	});

export const readNextWakeAtMsFx = Effect.fn("readNextWakeAtMsFx")(function* ({
	nowMs,
	save,
}: readNextWakeAtMsFx.Props) {
	const wakeTimes = [
		...readItemSpawnWakeTimes(save),
		...readProducerQueueWakeAtMsValues(save),
		...Object.values(save.activeEffects ?? {}).flatMap((effect) => [
			readWakeTime({
				nowMs,
				value: effect.activatedAtMs,
			}),
			effect.expiresAtMs,
		]),
		...Object.values(save.craftJobs).map((job) => job.completesAtMs),
	].filter((value): value is number => value !== undefined);

	if (wakeTimes.length === 0) {
		return null;
	}

	return Math.min(...wakeTimes);
});
