import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";

export const readBoardViewItemQuantity = (item: BoardViewItem | undefined): number =>
	item?.quantity ?? 1;
