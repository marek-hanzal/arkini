import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import type { ActivationRequirementView } from "~/v0/board/view/ActivationRequirementViewSchema";
import type { ProducerProductLineView } from "~/v0/board/view/ProducerProductLineViewSchema";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";

export namespace readProducerMissingResourceHintTileIds {
	export interface Props {
		board: BoardView;
		config: GameConfig;
		producerItem: BoardViewItem;
		productId?: string;
	}
}

const readSelectedProductLine = ({
	producerItem,
	productId,
}: {
	producerItem: BoardViewItem;
	productId?: string;
}): ProducerProductLineView | undefined => {
	const productLines = producerItem.activation?.productLines ?? [];
	if (productId) return productLines.find((line) => line.productId === productId);

	return productLines.find((line) => line.isDefault);
};

const readBoardItemQuantity = ({
	board,
	itemId,
	producerItemId,
}: {
	board: BoardView;
	itemId: string;
	producerItemId: string;
}) =>
	board.items.filter(
		(boardItem) => boardItem.id !== producerItemId && boardItem.itemId === itemId,
	).length;

const addUnsatisfiedRequirementItemIds = ({
	itemIds,
	line,
}: {
	itemIds: Set<string>;
	line: ProducerProductLineView;
}) => {
	if (!line.requirements) {
		for (const itemId of line.missingRequirementItemIds) itemIds.add(itemId);
		return;
	}

	for (const requirement of line.requirements) {
		if (requirement.type === "stored") continue;

		if (requirement.type === "proximity") {
			if (requirement.satisfied) continue;
			for (const itemId of requirement.itemIds) itemIds.add(itemId);
			continue;
		}

		if (requirement.stored >= requirement.quantity) continue;
		itemIds.add(requirement.itemId);
	}
};

const readRequirementSatisfied = (requirement: ActivationRequirementView) => {
	if (requirement.type === "proximity") return requirement.satisfied;

	return requirement.stored >= requirement.quantity;
};

const readInputItemIdsMissingOnBoard = ({
	board,
	line,
	producerItemId,
}: {
	board: BoardView;
	line: ProducerProductLineView;
	producerItemId: string;
}) => {
	const itemIds = new Set<string>();
	for (const input of line.inputs) {
		const boardQuantity = readBoardItemQuantity({
			board,
			itemId: input.itemId,
			producerItemId,
		});
		if (input.stored + boardQuantity >= input.quantity) continue;

		itemIds.add(input.itemId);
	}

	return itemIds;
};

const addLootOutputItemIds = ({
	config,
	itemIds,
	outputTableId,
}: {
	config: GameConfig;
	itemIds: Set<string>;
	outputTableId: string | undefined;
}) => {
	if (!outputTableId) return;

	const table = config.lootTables[outputTableId];
	if (!table) return;

	for (const output of table.output) {
		if (output.type === "weighted") {
			for (const entry of output.entries) itemIds.add(entry.itemId);
			continue;
		}

		itemIds.add(output.itemId);
	}
};

const readProducedItemIds = ({
	boardItem,
	config,
}: {
	boardItem: BoardViewItem;
	config: GameConfig;
}): Set<string> => {
	const item = config.items[boardItem.itemId];
	const producerId = item?.producerId;
	const producer = producerId ? config.producers[producerId] : undefined;
	const itemIds = new Set<string>();
	if (!producer) return itemIds;

	for (const productId of producer.productIds) {
		addLootOutputItemIds({
			config,
			itemIds,
			outputTableId: config.products[productId]?.outputTableId,
		});
	}

	return itemIds;
};

const lineHasUnsatisfiedRequirement = (line: ProducerProductLineView) => {
	if (line.requirements) {
		return line.requirements.some((requirement) => !readRequirementSatisfied(requirement));
	}

	return line.missingRequirementItemIds.length > 0 || !line.requirementsReady;
};

export const readProducerMissingResourceHintTileIds = ({
	board,
	config,
	producerItem,
	productId,
}: readProducerMissingResourceHintTileIds.Props): readonly string[] => {
	const line = readSelectedProductLine({
		producerItem,
		productId,
	});
	if (!line || line.queueFull || line.blocked) return [];

	const requirementItemIds = new Set<string>();
	addUnsatisfiedRequirementItemIds({
		itemIds: requirementItemIds,
		line,
	});

	const inputItemIds = readInputItemIdsMissingOnBoard({
		board,
		line,
		producerItemId: producerItem.id,
	});
	if (requirementItemIds.size === 0 && inputItemIds.size === 0) return [];
	if (!lineHasUnsatisfiedRequirement(line) && inputItemIds.size === 0) return [];

	const tileIds: string[] = [];
	for (const boardItem of board.items) {
		if (requirementItemIds.has(boardItem.itemId)) {
			tileIds.push(boardItem.id);
			continue;
		}

		const producedItemIds = readProducedItemIds({
			boardItem,
			config,
		});
		for (const itemId of inputItemIds) {
			if (!producedItemIds.has(itemId)) continue;

			tileIds.push(boardItem.id);
			break;
		}
	}

	return [
		...new Set(tileIds),
	];
};
