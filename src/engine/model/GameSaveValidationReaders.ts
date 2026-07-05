import {
	readLineDefinition,
	readProducerCapabilityDefinition,
} from "~/config/GameItemCapabilities";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave, GameSaveProducerJob } from "~/engine/model/GameSaveShapeSchema";

export const readBoardItemDefinition = ({
	config,
	itemInstanceId,
	save,
}: {
	config: GameConfig;
	save: GameSave;
	itemInstanceId: string;
}) => {
	const boardItem = save.board.items[itemInstanceId];
	if (!boardItem) return undefined;
	const item = config.items[boardItem.itemId];
	if (!item) return undefined;
	return {
		boardItem,
		item,
	};
};

export const readItemInstanceDefinition = ({
	config,
	itemInstanceId,
	save,
}: {
	config: GameConfig;
	save: GameSave;
	itemInstanceId: string;
}) => {
	const board = readBoardItemDefinition({
		config,
		save,
		itemInstanceId,
	});
	if (board) {
		return {
			item: board.item,
			itemId: board.boardItem.itemId,
			location: "board" as const,
		};
	}

	for (const [slotIndex, slot] of save.inventory.slots.entries()) {
		if (!slot || !("kind" in slot) || slot.kind !== "instance" || slot.id !== itemInstanceId) {
			continue;
		}

		const item = config.items[slot.itemId];
		if (!item) return undefined;
		return {
			item,
			itemId: slot.itemId,
			location: "inventory" as const,
			slotIndex,
		};
	}

	return undefined;
};

export const readEffectiveLineInputSlots = ({
	producer,
	lineId,
}: {
	producer: NonNullable<ReturnType<typeof readProducerCapabilityDefinition>>;
	lineId: string;
}) =>
	readLineDefinition({
		producerDefinition: producer,
		lineId,
	})?.inputs ?? [];

export const readLineFromJob = ({
	config,
	job,
	save,
}: {
	config: GameConfig;
	job: GameSaveProducerJob;
	save: GameSave;
}) => {
	const producerItem = save.board.items[job.itemInstanceId];
	const producer = producerItem
		? readProducerCapabilityDefinition({
				config,
				producerId: producerItem.itemId,
			})
		: undefined;

	return producer
		? readLineDefinition({
				producerDefinition: producer,
				lineId: job.lineId,
			})
		: undefined;
};
