import { readLineIds, readProducerCapabilityDefinition } from "~/config/GameItemCapabilities";
import {
	addSaveIssue,
	type GameSaveValidationContext,
} from "~/engine/model/GameSaveConfigValidationContext";
import { readBoardItemDefinition } from "~/engine/model/GameSaveValidationReaders";
import type { ProducerJobValidationState } from "~/engine/model/GameSaveProducerValidationTypes";

export const validateSaveProducerJobs = ({ config, ctx, save }: GameSaveValidationContext) => {
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
