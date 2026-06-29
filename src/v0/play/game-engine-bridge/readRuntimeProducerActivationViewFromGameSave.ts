import type { ActivationView } from "~/v0/board/view/ActivationViewSchema";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { readProducerDefaultEffectProductId } from "~/v0/game/producer/readProducerDefaultEffectProductId";
import { readProducerDefaultProductId } from "~/v0/game/producer/readProducerDefaultProductId";
import { resolveGameRequirements } from "~/v0/game/requirements/resolveGameRequirements";
import { readRuntimeProducerProductLineViewsFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeProducerProductLineViewsFromGameSave";
import type { GameSave, GameSaveBoardItem } from "~/v0/game/engine/model/GameSaveSchema";
import { readVisibleProducerProductIds } from "~/v0/game/producer/readVisibleProducerProductIds";
import { readRuntimeActivationRequirementViewsFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeActivationRequirementViewsFromGameSave";
import { readProducerDeliveryBlocked } from "~/v0/game/producer/readProducerDeliveryBlocked";

export namespace readRuntimeProducerActivationViewFromGameSave {
	export interface Props {
		boardItem: GameSaveBoardItem;
		config: GameConfig;
		nowMs: number;
		save: GameSave;
	}
}

export const readRuntimeProducerActivationViewFromGameSave = ({
	boardItem,
	config,
	nowMs,
	save,
}: readRuntimeProducerActivationViewFromGameSave.Props): ActivationView | undefined => {
	const producerId = boardItem.itemId;
	const producer = config.producers[producerId];
	if (!producer) return undefined;

	const visibleProductIds = readVisibleProducerProductIds({
		config,
		nowMs,
		producerId,
		producerItemId: boardItem.itemId,
		producerItemInstanceId: boardItem.id,
		productIds: producer.productIds,
		save,
	});
	const selectedEffectProductId = readProducerDefaultEffectProductId({
		productIds: visibleProductIds,
		producerItemInstanceId: boardItem.id,
		save,
	});
	const selectedProductId =
		selectedEffectProductId ??
		readProducerDefaultProductId({
			productIds: visibleProductIds,
			producerItemInstanceId: boardItem.id,
			save,
		});
	const selectedProduct = selectedProductId ? config.products[selectedProductId] : undefined;

	const deliveryBlocked = readProducerDeliveryBlocked({
		producerItemInstanceId: boardItem.id,
		save,
	});

	return {
		deliveryBlocked,
		inputs: [],
		kind: "producer",
		productLines: readRuntimeProducerProductLineViewsFromGameSave({
			config,
			maxQueueSize: producer.maxQueueSize,
			nowMs,
			producerId,
			producerItemId: boardItem.itemId,
			productIds: producer.productIds,
			save,
			targetItemInstanceId: boardItem.id,
		}),
		requirements: readRuntimeActivationRequirementViewsFromGameSave({
			requirements: resolveGameRequirements({
				config,
				requirementIds: selectedProduct?.requirementIds ?? [],
			}),
			save,
			targetItemInstanceId: boardItem.id,
		}),
		trigger: "click",
	};
};
