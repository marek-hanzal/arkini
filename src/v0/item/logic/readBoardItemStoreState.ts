import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import { isBoardViewItemRuntimeBusy } from "~/v0/board/logic/isBoardViewItemRuntimeBusy";
import type { ViewItem } from "~/v0/item/view/ViewItemSchema";

export namespace readBoardItemStoreState {
	export interface Props {
		boardItem: BoardViewItem;
		item: ViewItem;
	}

	export interface Result {
		canStore: boolean;
		reason?: "busy" | "storage_restricted";
	}
}

export const readBoardItemStoreState = ({
	boardItem,
	item,
}: readBoardItemStoreState.Props): readBoardItemStoreState.Result => {
	if (item.storage === "board") {
		return {
			canStore: false,
			reason: "storage_restricted",
		};
	}

	if (isBoardViewItemRuntimeBusy(boardItem)) {
		return {
			canStore: false,
			reason: "busy",
		};
	}

	return {
		canStore: true,
	};
};
