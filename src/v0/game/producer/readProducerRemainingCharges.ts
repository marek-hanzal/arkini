import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readProducerCapabilityDefinition } from "~/v0/game/config/readProducerCapabilityDefinition";

export const readProducerRemainingCharges = ({
	config,
	producerId,
	producerItemInstanceId,
	save,
}: {
	config: GameConfig;
	producerId: string;
	producerItemInstanceId: string;
	save: GameSave;
}) => {
	const producer = readProducerCapabilityDefinition({
		config,
		producerId,
	});
	if (producer?.charges === undefined) return undefined;

	return save.producerCharges[producerItemInstanceId]?.remainingCharges ?? producer.charges;
};
