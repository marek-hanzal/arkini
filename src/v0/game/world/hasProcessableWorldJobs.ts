import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { isGameTimeDue } from "~/v0/game/time/GameTime";
import { isItemSpawnJobWaitingForDependencies } from "~/v0/game/world/isItemSpawnJobWaitingForDependencies";
import { readWorldActiveEffectFacts } from "~/v0/game/world/readWorldActiveEffectFacts";
import { readWorldCraftJobFacts } from "~/v0/game/world/readWorldCraftJobFacts";
import { readWorldProducerJobFacts } from "~/v0/game/world/readWorldProducerJobFacts";

export namespace hasProcessableWorldJobs {
	export interface Props {
		config: GameConfig;
		nowMs: number;
		save: GameSave;
	}
}

export const hasProcessableWorldJobs = ({ config, nowMs, save }: hasProcessableWorldJobs.Props) => {
	if (
		Object.values(save.itemSpawnJobs).some(
			(job) =>
				!isItemSpawnJobWaitingForDependencies({
					job,
					save,
				}) &&
				isGameTimeDue({
					nowMs,
					readyAtMs: job.readyAtMs,
				}),
		)
	) {
		return true;
	}

	if (
		readWorldProducerJobFacts({
			nowMs,
			save,
		}).some(
			(facts) =>
				facts.queueIndex === 0 &&
				facts.releaseAtMs !== undefined &&
				isGameTimeDue({
					nowMs,
					readyAtMs: facts.releaseAtMs,
				}),
		)
	) {
		return true;
	}

	if (
		readWorldCraftJobFacts({
			nowMs,
			save,
		}).some((facts) =>
			isGameTimeDue({
				nowMs,
				readyAtMs: facts.releaseAtMs,
			}),
		)
	) {
		return true;
	}

	return readWorldActiveEffectFacts({
		config,
		nowMs,
		save,
	}).some(
		(facts) =>
			facts.status !== "producer_paused" &&
			facts.status !== "blocked_by_paused_queue_head" &&
			isGameTimeDue({
				nowMs,
				readyAtMs: facts.effect.endAtMs,
			}),
	);
};
