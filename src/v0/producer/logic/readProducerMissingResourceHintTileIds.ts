import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
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

	return productLines.find((line) => line.isDefault) ?? productLines[0];
};

const lineNeedsResourceHint = (line: ProducerProductLineView) =>
	line.enabled &&
	!line.queueFull &&
	((!line.inputsReady && !line.inputsAvailable) || !line.requirementsReady);

const addRequirementItemIds = ({
	itemIds,
	line,
}: {
	itemIds: Set<string>;
	line: ProducerProductLineView;
}) => {
	for (const requirement of line.requirements ?? []) {
		if (requirement.type === "stored") continue;

		if (requirement.type === "proximity") {
			for (const itemId of requirement.itemIds) itemIds.add(itemId);
			continue;
		}

		itemIds.add(requirement.itemId);
	}

	for (const itemId of line.requirementItemIds) itemIds.add(itemId);
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
	if (!line || !lineNeedsResourceHint(line)) return [];

	const requirementItemIds = new Set<string>();
	addRequirementItemIds({
		itemIds: requirementItemIds,
		line,
	});

	const inputItemIds = new Set(line.inputItemIds);
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
