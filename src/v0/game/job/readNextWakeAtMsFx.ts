import { Effect } from "effect";
import type { GameSave, GameSaveItemSpawnJob } from "~/v0/game/engine/model/GameSaveSchema";
import { readCraftJobWakeAtMs } from "~/v0/game/craft/craftCompletionTiming";
import { readProducerQueueWakeAtMsValues } from "~/v0/game/producer/readProducerQueueWakeAtMsValues";
import { readMinGameWakeAtMs } from "~/v0/game/time/GameTime";

export const pastDueGameJobWakeDelayMs = 1;

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

const readProcessableJobWakeAtMs = ({ nowMs, readyAtMs }: { nowMs?: number; readyAtMs: number }) =>
	nowMs !== undefined && readyAtMs <= nowMs ? nowMs + pastDueGameJobWakeDelayMs : readyAtMs;

const readItemSpawnWakeTimes = ({ nowMs, save }: { nowMs?: number; save: GameSave }) =>
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
			readProcessableJobWakeAtMs({
				nowMs,
				readyAtMs: job.readyAtMs,
			}),
		];
	});

const readProducerWakeTimes = ({ nowMs, save }: { nowMs?: number; save: GameSave }) =>
	readProducerQueueWakeAtMsValues(save).map((readyAtMs) =>
		readProcessableJobWakeAtMs({
			nowMs,
			readyAtMs,
		}),
	);

const readCraftWakeTimes = ({ nowMs, save }: { nowMs?: number; save: GameSave }) =>
	Object.values(save.craftJobs).map((job) =>
		readProcessableJobWakeAtMs({
			nowMs,
			readyAtMs: readCraftJobWakeAtMs(job),
		}),
	);

const readActiveEffectWakeTimes = ({ nowMs, save }: { nowMs?: number; save: GameSave }) =>
	Object.values(save.activeEffects ?? {}).flatMap((effect) => [
		effect.startAtMs,
		readProcessableJobWakeAtMs({
			nowMs,
			readyAtMs: effect.endAtMs,
		}),
	]);

export const readNextWakeAtMsFx = Effect.fn("readNextWakeAtMsFx")(function* ({
	nowMs,
	save,
}: readNextWakeAtMsFx.Props) {
	return readMinGameWakeAtMs({
		nowMs,
		values: [
			...readItemSpawnWakeTimes({
				nowMs,
				save,
			}),
			...readProducerWakeTimes({
				nowMs,
				save,
			}),
			...readActiveEffectWakeTimes({
				nowMs,
				save,
			}),
			...readCraftWakeTimes({
				nowMs,
				save,
			}),
		],
	});
});
