import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";

export const isBoardViewItemRuntimeBusy = (boardItem: BoardViewItem) =>
	Boolean(
		(boardItem.craft && boardItem.craft.phase !== "collecting_inputs") ||
			boardItem.activation?.deliveryBlocked ||
			boardItem.activation?.productLines?.some(
				(line) =>
					line.inProgress ||
					line.deliveryBlocked ||
					line.queueBlockedReason !== undefined ||
					line.producerQueuedJobs > 0,
			),
	);
