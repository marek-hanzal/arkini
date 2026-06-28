import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
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

const isCraftBusy = (craft: BoardViewItem["craft"]) =>
	craft !== undefined && craft.phase !== "collecting_inputs";

const isActivationBusy = (activation: BoardViewItem["activation"]) =>
	Boolean(
		activation?.deliveryBlocked ||
			activation?.productLines?.some(
				(line) =>
					line.inProgress ||
					line.deliveryBlocked ||
					line.queueBlockedReason !== undefined ||
					line.producerQueuedJobs > 0,
			),
	);

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

	if (isCraftBusy(boardItem.craft) || isActivationBusy(boardItem.activation)) {
		return {
			canStore: false,
			reason: "busy",
		};
	}

	return {
		canStore: true,
	};
};
