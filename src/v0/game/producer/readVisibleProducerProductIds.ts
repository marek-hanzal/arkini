import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { isProductLineVisibleForGameSave } from "~/v0/game/producer/isProductLineVisibleForGameSave";

export namespace readVisibleProducerProductIds {
	export interface Props {
		config: GameConfig;
		productIds: readonly string[];
		save: GameSave;
	}
}

export const readVisibleProducerProductIds = ({
	config,
	productIds,
	save,
}: readVisibleProducerProductIds.Props) =>
	productIds.filter((productId) => {
		const product = config.products[productId];
		return Boolean(
			product &&
				isProductLineVisibleForGameSave({
					product,
					save,
				}),
		);
	});
