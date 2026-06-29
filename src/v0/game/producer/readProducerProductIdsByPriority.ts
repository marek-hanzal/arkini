import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readProducerDefaultEffectProductId } from "~/v0/game/producer/readProducerDefaultEffectProductId";
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
	const defaultEffectProductId = readProducerDefaultEffectProductId({
		productIds,
		producerItemInstanceId,
		save,
	});
	const defaultProductId = readProducerDefaultProductId({
		productIds,
		producerItemInstanceId,
		save,
	});
	const defaultProductIds = [
		defaultEffectProductId,
		defaultProductId,
	].filter((productId): productId is string => Boolean(productId));

	if (defaultProductIds.length === 0) {
		return [
			...productIds,
		];
	}

	return [
		...defaultProductIds,
		...productIds.filter((productId) => !defaultProductIds.includes(productId)),
	];
};
