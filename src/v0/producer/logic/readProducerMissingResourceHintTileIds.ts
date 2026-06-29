import { readActivationInputRequiredQuantity } from "~/v0/game/activation/readActivationInputRequiredQuantity";
import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
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

	const inputItemIds = readInputItemIdsMissingOnBoard({
		board,
		line,
		producerItemId: producerItem.id,
	});
	if (inputItemIds.size === 0) return [];

	const tileIds: string[] = [];
	for (const boardItem of board.items) {
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
