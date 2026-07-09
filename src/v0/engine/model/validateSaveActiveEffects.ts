import { readGameConfigEffect } from "~/config/readGameConfigEffects";
import {
	addSaveIssue,
	type GameSaveValidationContext,
} from "~/engine/model/GameSaveConfigValidationContext";
import {
	readItemInstanceDefinition,
	readLineFromJob,
} from "~/engine/model/GameSaveValidationReaders";

export const validateSaveActiveEffects = ({ config, ctx, save }: GameSaveValidationContext) => {
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
