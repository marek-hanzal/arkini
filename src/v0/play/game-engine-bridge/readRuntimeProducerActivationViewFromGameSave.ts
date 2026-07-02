import type { ActivationView } from "~/v0/board/view/ActivationViewSchema";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { readRuntimeLineViewsFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeLineViewsFromGameSave";
import type { GameSave, GameSaveBoardItem } from "~/v0/game/engine/model/GameSaveSchema";
import { readProducerDeliveryBlocked } from "~/v0/game/producer/readProducerDeliveryBlocked";
import { readLineIds } from "~/v0/game/config/readLineDefinition";

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
	const producer = config.items[producerId]?.producer;
	if (!producer) return undefined;

	const deliveryBlocked = readProducerDeliveryBlocked({
		itemInstanceId: boardItem.id,
		save,
	});

	return {
		deliveryBlocked,
		inputs: [],
		kind: "producer",
		lines: readRuntimeLineViewsFromGameSave({
			config,
			maxQueueSize: producer.maxQueueSize,
			nowMs,
			producerDefinition: producer,
			lineIds: readLineIds({
				producerDefinition: producer,
			}),
			save,
			targetItemInstanceId: boardItem.id,
		}),
		trigger: "click",
	};
};
