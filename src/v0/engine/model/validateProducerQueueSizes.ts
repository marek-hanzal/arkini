import { readProducerCapabilityDefinition } from "~/config/GameItemCapabilities";
import {
	addSaveIssue,
	type GameSaveValidationContext,
} from "~/engine/model/GameSaveConfigValidationContext";
import { readBoardItemDefinition } from "~/engine/model/GameSaveValidationReaders";

export const validateProducerQueueSizes = ({
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
