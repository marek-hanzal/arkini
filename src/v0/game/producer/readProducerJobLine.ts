import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import {
	readProducerCapabilityDefinition,
	readLineDefinition,
} from "~/v0/game/config/GameItemCapabilities";
import type { GameSave, GameSaveProducerJob } from "~/v0/game/engine/model/GameSaveSchema";

export const readProducerJobLine = ({
	config,
	job,
	save,
}: {
	config: GameConfig;
	job: GameSaveProducerJob;
	save: GameSave;
}) => {
	const producerItem = save.board.items[job.itemInstanceId];
	const producerDefinition = producerItem
		? readProducerCapabilityDefinition({
				config,
				producerId: producerItem.itemId,
			})
		: undefined;

	return producerDefinition
		? readLineDefinition({
				producerDefinition,
				lineId: job.lineId,
			})
		: undefined;
};
