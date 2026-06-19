import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readProducerDefaultProductId } from "~/v0/game/producer/readProducerDefaultProductId";

export namespace readProducerProductIdsByPriority {
	export interface Props {
		productIds: readonly string[];
		producerItemInstanceId: string;
		save: GameSave;
	}
}

export const readProducerProductIdsByPriority = ({
	productIds,
	producerItemInstanceId,
	save,
}: readProducerProductIdsByPriority.Props) => {
	const defaultProductId = readProducerDefaultProductId({
		productIds,
		producerItemInstanceId,
		save,
	});
	if (!defaultProductId)
		return [
			...productIds,
		];

	return [
		defaultProductId,
		...productIds.filter((productId) => productId !== defaultProductId),
	];
};
