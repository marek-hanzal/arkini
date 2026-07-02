import type { ActivationView } from "~/board/view/ActivationViewSchema";
import type { GameConfig } from "~/config/GameConfigSchema";
import { readRuntimeLineViewsFromGameSave } from "~/play/game-engine-bridge/readRuntimeLineViewsFromGameSave";
import type { GameSave, GameSaveBoardItem } from "~/engine/model/GameSaveSchema";
import { readProducerDeliveryBlocked } from "~/producer/readProducerDeliveryBlocked";
import { readLineIds } from "~/config/readLineDefinition";

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
