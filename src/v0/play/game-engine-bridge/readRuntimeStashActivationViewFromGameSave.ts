import type { ActivationView } from "~/v0/board/view/ActivationViewSchema";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave, GameSaveBoardItem } from "~/v0/game/engine/model/GameSaveSchema";
import { readEffectiveProducerProductLine } from "~/v0/game/effects/readEffectiveProducerProductLine";
import { readProducerProductDurationMs } from "~/v0/game/producer/readProducerProductDurationMs";
import { readProducerRemainingCharges } from "~/v0/game/producer/readProducerRemainingCharges";
import { readRuntimeActivationInputAvailableQuantityFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeActivationInputAvailableQuantityFromGameSave";
import { readRuntimeActivationInputView } from "~/v0/play/game-engine-bridge/readRuntimeActivationInputView";
import { readRuntimeLootDropViewsFromEffectiveProductLine } from "~/v0/play/game-engine-bridge/readRuntimeLootDropViewsFromEffectiveProductLine";
import { readRuntimeProducerProductLineViewsFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeProducerProductLineViewsFromGameSave";
import { readProducerDeliveryBlocked } from "~/v0/game/producer/readProducerDeliveryBlocked";

export namespace readRuntimeStashActivationViewFromGameSave {
	export interface Props {
		boardItem: GameSaveBoardItem;
		config: GameConfig;
		nowMs: number;
		save: GameSave;
	}
}

export const readRuntimeStashActivationViewFromGameSave = ({
	boardItem,
	config,
	nowMs,
	save,
}: readRuntimeStashActivationViewFromGameSave.Props): ActivationView | undefined => {
	const stash = config.items[boardItem.itemId]?.stash;
	const productId = stash?.line.id;
	const product = stash?.line;
	if (!stash || !productId || !product) return undefined;

	const storedInputs = save.producerInputs[boardItem.id]?.productInputs[productId]?.items ?? {};
	const effectiveProductLine = readEffectiveProducerProductLine({
		baseDurationMs: readProducerProductDurationMs({
			product,
		}),
		config,
		nowMs,
		producerItemInstanceId: boardItem.id,
		product,
		productId,
		save,
	});
	const productLines = readRuntimeProducerProductLineViewsFromGameSave({
		config,
		maxQueueSize: stash.maxQueueSize,
		nowMs,
		productIds: [
			stash.line.id,
		],
		save,
		targetItemInstanceId: boardItem.id,
	});
	const deliveryBlocked = readProducerDeliveryBlocked({
		producerItemInstanceId: boardItem.id,
		save,
	});
	const productVisible = effectiveProductLine.visible;

	return {
		deliveryBlocked,
		drops: productVisible
			? readRuntimeLootDropViewsFromEffectiveProductLine({
					effectiveProductLine,
				})
			: undefined,
		inputs: productVisible
			? (product.inputs ?? []).map((input) =>
					readRuntimeActivationInputView({
						available: readRuntimeActivationInputAvailableQuantityFromGameSave({
							itemId: input.itemId,
							save,
							targetItemInstanceId: boardItem.id,
						}),
						input,
						stored: storedInputs[input.itemId] ?? 0,
					}),
				)
			: [],
		kind: "stash",
		productLines,
		remainingCharges: readProducerRemainingCharges({
			config,
			producerId: boardItem.itemId,
			producerItemInstanceId: boardItem.id,
			save,
		}),
		trigger: "click",
	};
};
