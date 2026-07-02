import { readActivationInputRequiredQuantity } from "~/activation/readActivationInputRequiredQuantity";
import type { BoardView } from "~/board/view/BoardViewSchema";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import type { LineView } from "~/board/view/LineViewSchema";

export namespace readProducerMissingResourceHintTileIds {
	export interface Props {
		board: BoardView;
		producerItem: BoardViewItem;
		lineId?: string;
	}
}

const readSelectedLine = ({
	producerItem,
	lineId,
}: {
	producerItem: BoardViewItem;
	lineId?: string;
}): LineView | undefined => {
	const lines = producerItem.activation?.lines ?? [];
	if (lineId) return lines.find((line) => line.lineId === lineId);

	return lines.find((line) => line.isDefault);
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
	line: LineView;
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

const canLineExposeUsefulOutput = (line: LineView) =>
	!line.blocked &&
	line.startRequirementsReady !== false &&
	!line.outputLimitBlocked &&
	(line.outputs ?? []).some((output) => output.enabled !== false);

const readProducedItemIds = ({ boardItem }: { boardItem: BoardViewItem }): Set<string> => {
	const itemIds = new Set<string>();

	for (const line of boardItem.activation?.lines ?? []) {
		if (!canLineExposeUsefulOutput(line)) continue;

		for (const output of line.outputs ?? []) {
			if (output.enabled === false) continue;
			itemIds.add(output.itemId);
		}
	}

	return itemIds;
};

export const readProducerMissingResourceHintTileIds = ({
	board,
	producerItem,
	lineId,
}: readProducerMissingResourceHintTileIds.Props): readonly string[] => {
	const line = readSelectedLine({
		producerItem,
		lineId,
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
