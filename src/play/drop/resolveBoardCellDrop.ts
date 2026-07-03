import type { BoardView } from "~/board/view/BoardViewSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { InventoryView } from "~/inventory/view/InventoryViewSchema";
import type { DragSource } from "~/play/drag/DragSource";
import type { DropTarget } from "~/play/drag/DropTarget";
import type { Feedback } from "~/play/feedback/Feedback";
import type { TileEngine } from "~/tile-engine/TileEngine.types";
import { acceptDrop } from "~/play/drop/acceptDrop";
import type { DropActions } from "~/play/drop/DropActions";
import { ignoreDrop } from "~/play/drop/ignoreDrop";
import { rejectDrop } from "~/play/drop/rejectDrop";
import { resolveBoardCellDropAction } from "~/play/drop/resolveBoardCellDropAction";

export namespace resolveBoardCellDrop {
	export interface Props {
		source: Extract<
			DragSource,
			{
				kind: "board";
			}
		>;
		target: Extract<
			DropTarget,
			{
				kind: "cell";
			}
		>;
		board: BoardView;
		config: GameConfig;
		feedback: Feedback.Type;
		actions: DropActions;
		inventory: InventoryView;
	}
}

export const resolveBoardCellDrop = ({
	actions,
	board,
	config,
	feedback,
	inventory,
	source,
	target,
}: resolveBoardCellDrop.Props): TileEngine.DropOutcome => {
	const action = resolveBoardCellDropAction({
		board,
		config,
		inventory,
		source,
		target,
	});

	if (action.type === "ignore") return ignoreDrop();

	if (action.type === "reject") {
		return rejectDrop(() => feedback.flashBoardCell(action.feedback.cellKey));
	}

	if (action.type === "delete-board-item") {
		return acceptDrop(
			async () => {
				await actions.deleteBoardItem(action.input);
				feedback.pulseBoardCellFeedback(action.feedback.cellKey, action.feedback.variant);
			},
			{
				animation: action.animation,
			},
		);
	}

	if (action.type === "move-board-item") {
		return acceptDrop(() => actions.moveBoardItem(action.input));
	}

	if (action.type === "swap-board-items") {
		return acceptDrop(() => actions.swapBoardItems(action.input), {
			animation: action.animation,
		});
	}

	if (action.type === "store-board-item-in-inventory") {
		return acceptDrop(async () => {
			await actions.storeBoardItem(action.input);
			feedback.pulseBoardCellFeedback(action.feedback.cellKey, action.feedback.variant);
		});
	}

	const options =
		action.type === "merge-board-items"
			? {
					animation: action.animation,
				}
			: undefined;

	return acceptDrop(async () => {
		await actions.applyBoardItemToBoardItem(action.input);
		if (action.feedback?.kind === "merge-cell") {
			feedback.pulseMergeCell(action.feedback.cellKey);
		}
		if (action.feedback?.kind === "cell-feedback") {
			feedback.pulseBoardCellFeedback(action.feedback.cellKey, action.feedback.variant);
		}
	}, options);
};
