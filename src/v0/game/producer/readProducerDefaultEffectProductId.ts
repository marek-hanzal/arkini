import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace readProducerDefaultEffectProductId {
	export interface Props {
		productIds: readonly string[];
		producerItemInstanceId: string;
		save: GameSave;
	}
}

export const readProducerDefaultEffectProductId = ({
	productIds,
	producerItemInstanceId,
	save,
}: readProducerDefaultEffectProductId.Props) => {
	const savedDefaultProductId =
		save.producerLines[producerItemInstanceId]?.defaultEffectProductId;
	if (savedDefaultProductId && productIds.includes(savedDefaultProductId)) {
		return savedDefaultProductId;
	}

	return undefined;
};
