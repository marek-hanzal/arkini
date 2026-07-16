import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readProducerCapabilityDefinition } from "~/config/GameItemCapabilities";

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
