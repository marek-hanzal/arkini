import type { ActivationView } from "~/v0/board/view/ActivationViewSchema";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { readRuntimeProducerLineViewsFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeProducerLineViewsFromGameSave";
import type { GameSave, GameSaveBoardItem } from "~/v0/game/engine/model/GameSaveSchema";
import { readProducerDeliveryBlocked } from "~/v0/game/producer/readProducerDeliveryBlocked";
import { readProducerLineIds } from "~/v0/game/config/readProducerLineDefinition";

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
		producerItemInstanceId: boardItem.id,
		save,
	});

	return {
		deliveryBlocked,
		inputs: [],
		kind: "producer",
		producerLines: readRuntimeProducerLineViewsFromGameSave({
			config,
			maxQueueSize: producer.maxQueueSize,
			nowMs,
			producerDefinition: producer,
			lineIds: readProducerLineIds({
				producerDefinition: producer,
			}),
			save,
			targetItemInstanceId: boardItem.id,
		}),
		trigger: "click",
	};
};
