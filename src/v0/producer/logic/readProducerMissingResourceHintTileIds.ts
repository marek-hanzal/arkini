import { readActivationInputRequiredQuantity } from "~/v0/game/requirements/readActivationInputRequiredQuantity";
import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import { readActivationRequirementViewReady } from "~/v0/board/logic/readActivationRequirementViewReady";
import type { ProducerProductLineView } from "~/v0/board/view/ProducerProductLineViewSchema";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { readProductOutputItemIds } from "~/v0/game/config/readProductOutputItemIds";

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

		if (readActivationRequirementViewReady(requirement)) continue;
		itemIds.add(requirement.itemId);
	}
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
		if (input.stored + boardQuantity >= readActivationInputRequiredQuantity(input)) continue;

		itemIds.add(input.itemId);
	}

	return itemIds;
};

const readProducedItemIds = ({
	boardItem,
	config,
}: {
	boardItem: BoardViewItem;
	config: GameConfig;
}): Set<string> => {
	const producer = config.producers[boardItem.itemId];
	const itemIds = new Set<string>();
	if (!producer) return itemIds;

	for (const productId of producer.productIds) {
		for (const itemId of readProductOutputItemIds({
			config,
			productId,
		})) {
			itemIds.add(itemId);
		}
	}

	return itemIds;
};

const lineHasUnsatisfiedRequirement = (line: ProducerProductLineView) => {
	if (line.requirements) {
		return line.requirements.some(
			(requirement) => !readActivationRequirementViewReady(requirement),
		);
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
