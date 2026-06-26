import { Effect } from "effect";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
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

export const readNextWakeAtMsFx = Effect.fn("readNextWakeAtMsFx")(function* ({
	nowMs,
	save,
}: readNextWakeAtMsFx.Props) {
	const wakeTimes = [
		...Object.values(save.itemSpawnJobs).map((job) => job.dueAtMs),
		...readProducerQueueWakeAtMsValues(save),
		...Object.values(save.activeEffects ?? {}).flatMap((effect) => [
			readWakeTime({ nowMs, value: effect.activatedAtMs }),
			effect.expiresAtMs,
		]),
		...Object.values(save.craftJobs).map((job) => job.completesAtMs),
	].filter((value): value is number => value !== undefined);

	if (wakeTimes.length === 0) {
		return null;
	}

	return Math.min(...wakeTimes);
});
