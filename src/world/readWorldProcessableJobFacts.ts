import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { isGameTimeDue } from "~/time/GameTime";
import { isItemSpawnJobWaitingForDependencies } from "~/world/isItemSpawnJobWaitingForDependencies";
import { readWorldActiveEffectFacts } from "~/world/readWorldActiveEffectFacts";
import { readWorldCraftJobFacts } from "~/world/readWorldCraftJobFacts";
import { readWorldProducerJobFacts } from "~/world/readWorldProducerJobFacts";
import type { WorldProcessableJobFacts } from "~/world/WorldProcessableJobFacts";

export namespace readWorldProcessableJobFacts {
	export interface Props {
		config: GameConfig;
		nowMs: number;
		save: GameSave;
	}
}

const sortProcessableJobs = (left: WorldProcessableJobFacts, right: WorldProcessableJobFacts) =>
	left.readyAtMs - right.readyAtMs ||
	left.reason.localeCompare(right.reason) ||
	JSON.stringify(left.entity).localeCompare(JSON.stringify(right.entity));

export const readWorldProcessableJobFacts = ({
	config,
	nowMs,
	save,
}: readWorldProcessableJobFacts.Props): WorldProcessableJobFacts[] => {
	const processableJobs: WorldProcessableJobFacts[] = [];

	for (const job of Object.values(save.itemSpawnJobs)) {
		if (
			isItemSpawnJobWaitingForDependencies({
				job,
				save,
			}) ||
			!isGameTimeDue({
				nowMs,
				readyAtMs: job.readyAtMs,
			})
		) {
			continue;
		}

		processableJobs.push({
			entity: {
				id: job.id,
				kind: "itemSpawnJob",
			},
			readyAtMs: job.readyAtMs,
			reason: "item_spawn_ready",
		});
	}

	for (const producerJobFacts of readWorldProducerJobFacts({
		nowMs,
		save,
	})) {
		if (
			producerJobFacts.queueIndex !== 0 ||
			producerJobFacts.releaseAtMs === undefined ||
			!isGameTimeDue({
				nowMs,
				readyAtMs: producerJobFacts.releaseAtMs,
			})
		) {
			continue;
		}

		processableJobs.push({
			entity: {
				id: producerJobFacts.job.id,
				kind: "producerJob",
			},
			readyAtMs: producerJobFacts.releaseAtMs,
			reason: "producer_queue_ready",
		});
	}

	for (const craftJobFacts of readWorldCraftJobFacts({
		nowMs,
		save,
	})) {
		if (
			craftJobFacts.releaseAtMs === undefined ||
			!isGameTimeDue({
				nowMs,
				readyAtMs: craftJobFacts.releaseAtMs,
			})
		) {
			continue;
		}

		processableJobs.push({
			entity: {
				id: craftJobFacts.job.id,
				kind: "craftJob",
			},
			readyAtMs: craftJobFacts.releaseAtMs,
			reason: "craft_ready",
		});
	}

	for (const effectFacts of readWorldActiveEffectFacts({
		config,
		nowMs,
		save,
	})) {
		if (
			effectFacts.status === "producer_paused" ||
			effectFacts.status === "blocked_by_paused_queue_head" ||
			!isGameTimeDue({
				nowMs,
				readyAtMs: effectFacts.effect.endAtMs,
			})
		) {
			continue;
		}

		processableJobs.push({
			entity: {
				id: effectFacts.effect.id,
				kind: "activeEffect",
			},
			readyAtMs: effectFacts.effect.endAtMs,
			reason: "active_effect_end",
		});
	}

	return processableJobs.sort(sortProcessableJobs);
};
