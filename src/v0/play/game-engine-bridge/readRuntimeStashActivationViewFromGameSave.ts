import type { ActivationView } from "~/board/view/ActivationViewSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave, GameSaveBoardItem } from "~/engine/model/GameSaveSchema";
import { readEffectiveLine } from "~/effects/readEffectiveLine";
import { readLineDurationMs } from "~/producer/readLineDurationMs";
import { readProducerRemainingCharges } from "~/producer/readProducerRemainingCharges";
import { readRuntimeActivationInputAvailableQuantityFromGameSave } from "~/play/game-engine-bridge/readRuntimeActivationInputAvailableQuantityFromGameSave";
import { readRuntimeActivationInputView } from "~/play/game-engine-bridge/readRuntimeActivationInputView";
import { readRuntimeLootDropViewsFromEffectiveLine } from "~/play/game-engine-bridge/readRuntimeLootDropViewsFromEffectiveLine";
import { readRuntimeLineViewsFromGameSave } from "~/play/game-engine-bridge/readRuntimeLineViewsFromGameSave";
import { readProducerDeliveryBlocked } from "~/producer/readProducerDeliveryBlocked";

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
	const lineId = stash?.line.id;
	const line = stash?.line;
	if (!stash || !lineId || !line) return undefined;

	const storedInputs = save.producerInputs[boardItem.id]?.lineInputs[lineId]?.items ?? {};
	const effectiveLine = readEffectiveLine({
		baseDurationMs: readLineDurationMs({
			line,
		}),
		config,
		nowMs,
		itemInstanceId: boardItem.id,
		line,
		lineId,
		save,
	});
	const lines = readRuntimeLineViewsFromGameSave({
		config,
		maxQueueSize: stash.maxQueueSize,
		nowMs,
		producerDefinition: stash,
		lineIds: [
			stash.line.id,
		],
		save,
		targetItemInstanceId: boardItem.id,
	});
	const deliveryBlocked = readProducerDeliveryBlocked({
		itemInstanceId: boardItem.id,
		save,
	});
	const lineVisible = effectiveLine.visible;

	return {
		deliveryBlocked,
		drops: lineVisible
			? readRuntimeLootDropViewsFromEffectiveLine({
					effectiveLine,
				})
			: undefined,
		inputs: lineVisible
			? (line.inputs ?? []).map((input) =>
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
		lines,
		remainingCharges: readProducerRemainingCharges({
			config,
			producerId: boardItem.itemId,
			itemInstanceId: boardItem.id,
			save,
		}),
		trigger: "click",
	};
};
