import type { ActivationView } from "~/v0/board/view/ActivationViewSchema";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave, GameSaveBoardItem } from "~/v0/game/engine/model/GameSaveSchema";
import { readEffectiveLine } from "~/v0/game/effects/readEffectiveLine";
import { readLineDurationMs } from "~/v0/game/producer/readLineDurationMs";
import { readProducerRemainingCharges } from "~/v0/game/producer/readProducerRemainingCharges";
import { readRuntimeActivationInputAvailableQuantityFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeActivationInputAvailableQuantityFromGameSave";
import { readRuntimeActivationInputView } from "~/v0/play/game-engine-bridge/readRuntimeActivationInputView";
import { readRuntimeLootDropViewsFromEffectiveLine } from "~/v0/play/game-engine-bridge/readRuntimeLootDropViewsFromEffectiveLine";
import { readRuntimeLineViewsFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeLineViewsFromGameSave";
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
