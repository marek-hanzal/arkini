import type { GameConfig } from "~/config/GameConfigSchema";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readProducerCapabilityDefinition } from "~/config/readProducerCapabilityDefinition";

export const readProducerRemainingCharges = ({
	config,
	producerId,
	itemInstanceId,
	save,
}: {
	config: GameConfig;
	producerId: string;
	itemInstanceId: string;
	save: GameSave;
}) => {
	const producer = readProducerCapabilityDefinition({
		config,
		producerId,
	});
	if (producer?.charges === undefined) return undefined;

	return save.producerCharges[itemInstanceId]?.remainingCharges ?? producer.charges;
};
