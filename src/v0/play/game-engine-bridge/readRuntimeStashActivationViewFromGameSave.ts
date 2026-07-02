import type { ActivationView } from "~/v0/board/view/ActivationViewSchema";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave, GameSaveBoardItem } from "~/v0/game/engine/model/GameSaveSchema";
import { readEffectiveProducerLine } from "~/v0/game/effects/readEffectiveProducerLine";
import { readProducerLineDurationMs } from "~/v0/game/producer/readProducerLineDurationMs";
import { readProducerRemainingCharges } from "~/v0/game/producer/readProducerRemainingCharges";
import { readRuntimeActivationInputAvailableQuantityFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeActivationInputAvailableQuantityFromGameSave";
import { readRuntimeActivationInputView } from "~/v0/play/game-engine-bridge/readRuntimeActivationInputView";
import { readRuntimeLootDropViewsFromEffectiveProducerLine } from "~/v0/play/game-engine-bridge/readRuntimeLootDropViewsFromEffectiveProducerLine";
import { readRuntimeProducerLineViewsFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeProducerLineViewsFromGameSave";
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
	const lineId = stash?.line.id;
	const line = stash?.line;
	if (!stash || !lineId || !line) return undefined;

	const storedInputs = save.producerInputs[boardItem.id]?.lineInputs[lineId]?.items ?? {};
	const effectiveProducerLine = readEffectiveProducerLine({
		baseDurationMs: readProducerLineDurationMs({
			line,
		}),
		config,
		nowMs,
		producerItemInstanceId: boardItem.id,
		line,
		lineId,
		save,
	});
	const producerLines = readRuntimeProducerLineViewsFromGameSave({
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
		producerItemInstanceId: boardItem.id,
		save,
	});
	const lineVisible = effectiveProducerLine.visible;

	return {
		deliveryBlocked,
		drops: lineVisible
			? readRuntimeLootDropViewsFromEffectiveProducerLine({
					effectiveProducerLine,
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
		producerLines,
		remainingCharges: readProducerRemainingCharges({
			config,
			producerId: boardItem.itemId,
			producerItemInstanceId: boardItem.id,
			save,
		}),
		trigger: "click",
	};
};
