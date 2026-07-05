import { readLineIds, readProducerCapabilityDefinition } from "~/config/GameItemCapabilities";
import { readGameConfigEffect } from "~/config/readGameConfigEffects";
import type { GameSaveProducerJob } from "~/engine/model/GameSaveShapeSchema";
import {
	addSaveIssue,
	type GameSaveValidationContext,
} from "~/engine/model/GameSaveConfigValidationContext";
import {
	readBoardItemDefinition,
	readItemInstanceDefinition,
	readLineFromJob,
} from "~/engine/model/GameSaveValidationReaders";

type ProducerJobEntry = {
	job: GameSaveProducerJob;
	jobId: string;
};

type ProducerJobValidationState = {
	jobCountByItemInstanceId: Map<string, number>;
	jobsByItemInstanceId: Map<string, ProducerJobEntry[]>;
};

const validateSaveProducerJobs = ({ config, ctx, save }: GameSaveValidationContext) => {
	const state: ProducerJobValidationState = {
		jobCountByItemInstanceId: new Map(),
		jobsByItemInstanceId: new Map(),
	};

	for (const [jobId, job] of Object.entries(save.producerJobs)) {
		if (job.id !== jobId) {
			addSaveIssue(
				ctx,
				[
					"producerJobs",
					jobId,
					"id",
				],
				`Producer job id must match record key "${jobId}".`,
			);
		}

		const target = readBoardItemDefinition({
			config,
			save,
			itemInstanceId: job.itemInstanceId,
		});
		const producerId = target?.boardItem.itemId;
		const producer = producerId
			? readProducerCapabilityDefinition({
					config,
					producerId,
				})
			: undefined;

		if (!target) {
			addSaveIssue(
				ctx,
				[
					"producerJobs",
					jobId,
					"itemInstanceId",
				],
				`Producer job target "${job.itemInstanceId}" must be a board item.`,
			);
		} else if (!producerId || !producer) {
			addSaveIssue(
				ctx,
				[
					"producerJobs",
					jobId,
					"itemInstanceId",
				],
				`Producer job target "${job.itemInstanceId}" must reference a producer-like item.`,
			);
		} else if (
			!readLineIds({
				producerDefinition: producer,
			}).includes(job.lineId)
		) {
			addSaveIssue(
				ctx,
				[
					"producerJobs",
					jobId,
					"lineId",
				],
				`Line "${job.lineId}" does not belong to producer "${producerId}".`,
			);
		}

		state.jobCountByItemInstanceId.set(
			job.itemInstanceId,
			(state.jobCountByItemInstanceId.get(job.itemInstanceId) ?? 0) + 1,
		);
		state.jobsByItemInstanceId.set(job.itemInstanceId, [
			...(state.jobsByItemInstanceId.get(job.itemInstanceId) ?? []),
			{
				job,
				jobId,
			},
		]);
	}

	return state;
};

const validateSaveActiveEffects = ({ config, ctx, save }: GameSaveValidationContext) => {
	const activeEffectIdsByProducerJobId = new Map<string, string[]>();

	for (const [activeEffectId, activeEffect] of Object.entries(save.activeEffects ?? {})) {
		if (activeEffect.id !== activeEffectId) {
			addSaveIssue(
				ctx,
				[
					"activeEffects",
					activeEffectId,
					"id",
				],
				`Active effect id must match record key "${activeEffectId}".`,
			);
		}

		if (
			!readGameConfigEffect({
				config,
				effectId: activeEffect.effectId,
			})
		) {
			addSaveIssue(
				ctx,
				[
					"activeEffects",
					activeEffectId,
					"effectId",
				],
				`Missing effect "${activeEffect.effectId}".`,
			);
		}

		if (
			!readItemInstanceDefinition({
				config,
				save,
				itemInstanceId: activeEffect.sourceItemInstanceId,
			})
		) {
			addSaveIssue(
				ctx,
				[
					"activeEffects",
					activeEffectId,
					"sourceItemInstanceId",
				],
				`Active effect source "${activeEffect.sourceItemInstanceId}" must reference a save item instance.`,
			);
		}

		if (activeEffect.producerJobId === undefined) continue;

		activeEffectIdsByProducerJobId.set(activeEffect.producerJobId, [
			...(activeEffectIdsByProducerJobId.get(activeEffect.producerJobId) ?? []),
			activeEffectId,
		]);
		const producerJob = save.producerJobs[activeEffect.producerJobId];
		const line = producerJob
			? readLineFromJob({
					config,
					save,
					job: producerJob,
				})
			: undefined;

		if (!producerJob) {
			addSaveIssue(
				ctx,
				[
					"activeEffects",
					activeEffectId,
					"producerJobId",
				],
				`Active effect producer job "${activeEffect.producerJobId}" must reference a producer job.`,
			);
			continue;
		}

		if (activeEffect.sourceItemInstanceId !== producerJob.itemInstanceId) {
			addSaveIssue(
				ctx,
				[
					"activeEffects",
					activeEffectId,
					"sourceItemInstanceId",
				],
				`Active effect source must match producer job "${producerJob.id}" source.`,
			);
		}
		if (activeEffect.startAtMs !== producerJob.startAtMs) {
			addSaveIssue(
				ctx,
				[
					"activeEffects",
					activeEffectId,
					"startAtMs",
				],
				`Active effect startAtMs must match producer job "${producerJob.id}" startAtMs.`,
			);
		}
		if (activeEffect.endAtMs !== producerJob.readyAtMs) {
			addSaveIssue(
				ctx,
				[
					"activeEffects",
					activeEffectId,
					"endAtMs",
				],
				`Active effect endAtMs must match producer job "${producerJob.id}" readyAtMs.`,
			);
		}
		if (line?.effect?.id !== activeEffect.effectId) {
			addSaveIssue(
				ctx,
				[
					"activeEffects",
					activeEffectId,
					"effectId",
				],
				`Active effect must match producer job "${producerJob.id}" activated effect.`,
			);
		}
	}

	return activeEffectIdsByProducerJobId;
};

const validateProducerJobActiveEffectLinks = ({
	activeEffectIdsByProducerJobId,
	config,
	ctx,
	save,
}: GameSaveValidationContext & {
	activeEffectIdsByProducerJobId: ReadonlyMap<string, readonly string[]>;
}) => {
	for (const [jobId, job] of Object.entries(save.producerJobs)) {
		const line = readLineFromJob({
			config,
			save,
			job,
		});
		if (!line?.effect) continue;

		const activeEffectIds = activeEffectIdsByProducerJobId.get(jobId) ?? [];
		const expectedActiveEffectCount = job.delivery ? 0 : 1;
		if (activeEffectIds.length !== expectedActiveEffectCount) {
			addSaveIssue(
				ctx,
				[
					"producerJobs",
					jobId,
				],
				job.delivery
					? `Blocked producer job "${jobId}" has completed activated effect "${line.effect.id}" and must not keep a linked active effect.`
					: `Producer job "${jobId}" activates effect "${line.effect.id}" and must have exactly one linked active effect.`,
			);
		}
	}
};

const validateProducerQueueSizes = ({
	config,
	ctx,
	jobCountByItemInstanceId,
	save,
}: Pick<GameSaveValidationContext, "config" | "ctx" | "save"> & {
	jobCountByItemInstanceId: ReadonlyMap<string, number>;
}) => {
	for (const [itemInstanceId, jobCount] of jobCountByItemInstanceId) {
		const target = readBoardItemDefinition({
			config,
			save,
			itemInstanceId,
		});
		const producerId = target?.boardItem.itemId;
		if (!producerId) continue;
		const producer = readProducerCapabilityDefinition({
			config,
			producerId,
		});
		if (!producer) continue;
		const maxQueueSize = producer.maxQueueSize;
		if (maxQueueSize !== undefined && jobCount > maxQueueSize) {
			addSaveIssue(
				ctx,
				[
					"producerJobs",
				],
				`Producer "${itemInstanceId}" queue has ${jobCount} jobs but maxQueueSize is ${maxQueueSize}.`,
			);
		}
	}
};

const isSaveProducerJobPaused = (job: GameSaveProducerJob) =>
	job.pausedAtMs !== undefined && job.remainingMs !== undefined;

const readProducerQueueBarrierAtMs = (job: GameSaveProducerJob) =>
	isSaveProducerJobPaused(job) ? undefined : (job.delivery?.nextAttemptAtMs ?? job.readyAtMs);

const readSortedProducerJobs = (producerJobs: readonly ProducerJobEntry[]) =>
	[
		...producerJobs,
	].sort(
		(left, right) =>
			left.job.startAtMs - right.job.startAtMs ||
			left.job.readyAtMs - right.job.readyAtMs ||
			left.jobId.localeCompare(right.jobId),
	);

const validateProducerQueueOrdering = ({
	ctx,
	jobsByItemInstanceId,
}: Pick<GameSaveValidationContext, "ctx"> & {
	jobsByItemInstanceId: ReadonlyMap<string, readonly ProducerJobEntry[]>;
}) => {
	for (const [itemInstanceId, producerJobs] of jobsByItemInstanceId) {
		const sortedProducerJobs = readSortedProducerJobs(producerJobs);
		for (let index = 1; index < sortedProducerJobs.length; index += 1) {
			const previous = sortedProducerJobs[index - 1];
			const current = sortedProducerJobs[index];
			if (!previous || !current) continue;

			if (current.job.delivery) {
				addSaveIssue(
					ctx,
					[
						"producerJobs",
						current.jobId,
						"delivery",
					],
					`Producer job "${current.jobId}" for "${itemInstanceId}" has blocked delivery but is not first in the producer queue.`,
				);
			}

			const previousQueueBarrierAtMs = readProducerQueueBarrierAtMs(previous.job);
			if (previousQueueBarrierAtMs === undefined) continue;

			if (current.job.startAtMs < previousQueueBarrierAtMs) {
				addSaveIssue(
					ctx,
					[
						"producerJobs",
						current.jobId,
						"startAtMs",
					],
					`Producer job "${current.jobId}" for "${itemInstanceId}" starts before previous job "${previous.jobId}" releases the queue.`,
				);
			}
		}

		for (const current of sortedProducerJobs) {
			if (
				!current.job.delivery ||
				current.job.delivery.lastBlockedAtMs >= current.job.readyAtMs
			) {
				continue;
			}

			addSaveIssue(
				ctx,
				[
					"producerJobs",
					current.jobId,
					"delivery",
					"lastBlockedAtMs",
				],
				`Producer job "${current.jobId}" cannot be blocked before it is ready.`,
			);
		}
	}
};

export const validateSaveProducerState = (validationContext: GameSaveValidationContext) => {
	const producerJobState = validateSaveProducerJobs(validationContext);
	const activeEffectIdsByProducerJobId = validateSaveActiveEffects(validationContext);
	validateProducerJobActiveEffectLinks({
		...validationContext,
		activeEffectIdsByProducerJobId,
	});
	validateProducerQueueSizes({
		config: validationContext.config,
		ctx: validationContext.ctx,
		jobCountByItemInstanceId: producerJobState.jobCountByItemInstanceId,
		save: validationContext.save,
	});
	validateProducerQueueOrdering({
		ctx: validationContext.ctx,
		jobsByItemInstanceId: producerJobState.jobsByItemInstanceId,
	});
};
