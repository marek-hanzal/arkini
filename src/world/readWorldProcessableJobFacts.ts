import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { isGameTimeDue } from "~/time/GameTime";
import { isItemSpawnJobWaitingForDependencies } from "~/world/isItemSpawnJobWaitingForDependencies";
import { readWorldActiveEffectFacts } from "~/world/readWorldActiveEffectFacts";
import { readWorldCraftJobFacts } from "~/world/readWorldCraftJobFacts";
import { readWorldProducerJobFacts } from "~/world/readWorldProducerJobFacts";
import type { WorldEntityRef } from "~/world/WorldEntityRef";
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

const readDueProcessableJob = ({
	entity,
	nowMs,
	readyAtMs,
	reason,
}: {
	entity: WorldEntityRef;
	nowMs: number;
	readyAtMs: number | undefined;
	reason: WorldProcessableJobFacts["reason"];
}): WorldProcessableJobFacts | undefined => {
	if (
		readyAtMs === undefined ||
		!isGameTimeDue({
			nowMs,
			readyAtMs,
		})
	) {
		return undefined;
	}

	return {
		entity,
		readyAtMs,
		reason,
	};
};

const readProcessableItemSpawnJobs = ({
	nowMs,
	save,
}: Pick<readWorldProcessableJobFacts.Props, "nowMs" | "save">): WorldProcessableJobFacts[] =>
	Object.values(save.itemSpawnJobs).flatMap((job): WorldProcessableJobFacts[] => {
		if (
			isItemSpawnJobWaitingForDependencies({
				job,
				save,
			})
		) {
			return [];
		}

		const processableJob = readDueProcessableJob({
			entity: {
				id: job.id,
				kind: "itemSpawnJob",
			},
			nowMs,
			readyAtMs: job.readyAtMs,
			reason: "item_spawn_ready",
		});
		return processableJob ? [processableJob] : [];
	});

const readProcessableProducerJobs = ({
	nowMs,
	save,
}: Pick<readWorldProcessableJobFacts.Props, "nowMs" | "save">): WorldProcessableJobFacts[] =>
	readWorldProducerJobFacts({
		nowMs,
		save,
	}).flatMap((producerJobFacts): WorldProcessableJobFacts[] => {
		if (producerJobFacts.queueIndex !== 0) return [];

		const processableJob = readDueProcessableJob({
			entity: {
				id: producerJobFacts.job.id,
				kind: "producerJob",
			},
			nowMs,
			readyAtMs: producerJobFacts.releaseAtMs,
			reason: "producer_queue_ready",
		});
		return processableJob ? [processableJob] : [];
	});

const readProcessableCraftJobs = ({
	nowMs,
	save,
}: Pick<readWorldProcessableJobFacts.Props, "nowMs" | "save">): WorldProcessableJobFacts[] =>
	readWorldCraftJobFacts({
		nowMs,
		save,
	}).flatMap((craftJobFacts): WorldProcessableJobFacts[] => {
		const processableJob = readDueProcessableJob({
			entity: {
				id: craftJobFacts.job.id,
				kind: "craftJob",
			},
			nowMs,
			readyAtMs: craftJobFacts.releaseAtMs,
			reason: "craft_ready",
		});
		return processableJob ? [processableJob] : [];
	});

const readProcessableActiveEffects = ({
	config,
	nowMs,
	save,
}: readWorldProcessableJobFacts.Props): WorldProcessableJobFacts[] =>
	readWorldActiveEffectFacts({
		config,
		nowMs,
		save,
	}).flatMap((effectFacts): WorldProcessableJobFacts[] => {
		if (
			effectFacts.status === "producer_paused" ||
			effectFacts.status === "blocked_by_paused_queue_head"
		) {
			return [];
		}

		const processableJob = readDueProcessableJob({
			entity: {
				id: effectFacts.effect.id,
				kind: "activeEffect",
			},
			nowMs,
			readyAtMs: effectFacts.effect.endAtMs,
			reason: "active_effect_end",
		});
		return processableJob ? [processableJob] : [];
	});

export const readWorldProcessableJobFacts = ({
	config,
	nowMs,
	save,
}: readWorldProcessableJobFacts.Props): WorldProcessableJobFacts[] =>
	[
		readProcessableItemSpawnJobs({
			nowMs,
			save,
		}),
		readProcessableProducerJobs({
			nowMs,
			save,
		}),
		readProcessableCraftJobs({
			nowMs,
			save,
		}),
		readProcessableActiveEffects({
			config,
			nowMs,
			save,
		}),
	]
		.flat()
		.sort(sortProcessableJobs);
