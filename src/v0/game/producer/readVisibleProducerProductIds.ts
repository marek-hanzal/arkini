import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { readEffectiveProducerProductLine } from "~/v0/game/effects/readEffectiveProducerProductLine";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace readVisibleProducerProductIds {
	export interface Props {
		config: GameConfig;
		nowMs?: number;
		producerItemInstanceId: string;
		productIds: readonly string[];
		save: GameSave;
	}
}

export const readVisibleProducerProductIds = ({
	config,
	nowMs,
	producerItemInstanceId,
	productIds,
	save,
}: readVisibleProducerProductIds.Props) =>
	productIds.filter((productId) => {
		const product = config.products[productId];
		return Boolean(
			product &&
				readEffectiveProducerProductLine({
					baseDurationMs: product.durationMs,
					config,
					nowMs,
					producerItemInstanceId,
					product,
					productId,
					save,
				}).visible,
		);
	});
