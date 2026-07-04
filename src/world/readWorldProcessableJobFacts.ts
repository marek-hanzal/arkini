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

type ProcessableJobRouteScope = readWorldProcessableJobFacts.Props;

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
}: ProcessableJobRouteScope): WorldProcessableJobFacts[] =>
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
		return processableJob
			? [
					processableJob,
				]
			: [];
	});

const readProcessableProducerJobs = ({
	nowMs,
	save,
}: ProcessableJobRouteScope): WorldProcessableJobFacts[] =>
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
		return processableJob
			? [
					processableJob,
				]
			: [];
	});

const readProcessableCraftJobs = ({
	nowMs,
	save,
}: ProcessableJobRouteScope): WorldProcessableJobFacts[] =>
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
		return processableJob
			? [
					processableJob,
				]
			: [];
	});

const readProcessableActiveEffects = ({
	config,
	nowMs,
	save,
}: ProcessableJobRouteScope): WorldProcessableJobFacts[] =>
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
		return processableJob
			? [
					processableJob,
				]
			: [];
	});

const readProcessableJobRoutes = (
	props: ProcessableJobRouteScope,
): readonly WorldProcessableJobFacts[][] => [
	readProcessableItemSpawnJobs(props),
	readProcessableProducerJobs(props),
	readProcessableCraftJobs(props),
	readProcessableActiveEffects(props),
];

export const readWorldProcessableJobFacts = (
	props: readWorldProcessableJobFacts.Props,
): WorldProcessableJobFacts[] => readProcessableJobRoutes(props).flat().sort(sortProcessableJobs);
