import type { BoardView } from "~/board/view/BoardViewSchema";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";

export namespace readExpectedBoardViewItem {
	export interface Props {
		board: BoardView;
		expectedItemId: string;
		itemInstanceId: string;
	}
}

export const readExpectedBoardViewItem = ({
	board,
	expectedItemId,
	itemInstanceId,
}: readExpectedBoardViewItem.Props): BoardViewItem | undefined => {
	const item = board.byId[itemInstanceId];
	if (!item || item.itemId !== expectedItemId) return undefined;

	return item;
};
