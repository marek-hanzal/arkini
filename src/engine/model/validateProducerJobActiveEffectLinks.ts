import {
	addSaveIssue,
	type GameSaveValidationContext,
} from "~/engine/model/GameSaveConfigValidationContext";
import { readLineFromJob } from "~/engine/model/GameSaveValidationReaders";

export const validateProducerJobActiveEffectLinks = ({
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
