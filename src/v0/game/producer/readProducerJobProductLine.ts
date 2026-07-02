import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import {
	readProducerCapabilityDefinition,
	readProducerProductLineDefinition,
} from "~/v0/game/config/GameItemCapabilities";
import type { GameSave, GameSaveProducerJob } from "~/v0/game/engine/model/GameSaveSchema";

export const readProducerJobProductLine = ({
	config,
	job,
	save,
}: {
	config: GameConfig;
	job: GameSaveProducerJob;
	save: GameSave;
}) => {
	const producerItem = save.board.items[job.producerItemInstanceId];
	const producerDefinition = producerItem
		? readProducerCapabilityDefinition({
				config,
				producerId: producerItem.itemId,
			})
		: undefined;

	return producerDefinition
		? readProducerProductLineDefinition({
				producerDefinition,
				productId: job.productId,
			})
		: undefined;
};
