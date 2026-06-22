import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace readProducerDefaultProductId {
	export interface Props {
		productIds: readonly string[];
		producerItemInstanceId: string;
		save: GameSave;
	}
}

export const readProducerDefaultProductId = ({
	productIds,
	producerItemInstanceId,
	save,
}: readProducerDefaultProductId.Props) => {
	const savedDefaultProductId = save.producerLines[producerItemInstanceId]?.defaultProductId;
	if (savedDefaultProductId && productIds.includes(savedDefaultProductId)) {
		return savedDefaultProductId;
	}

	return undefined;
};
