import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { DragSource } from "~/v0/play/drag/DragSource";
import type { DropTarget } from "~/v0/play/drag/DropTarget";
import type { Feedback } from "~/v0/play/feedback/Feedback";
import type { TileEngineNamespace as TileEngine } from "~/v0/tile-engine";
import { acceptDrop } from "~/v0/play/drop/acceptDrop";
import type { DropActions } from "~/v0/play/drop/DropActions";
import { ignoreDrop } from "~/v0/play/drop/ignoreDrop";
import { rejectDrop } from "~/v0/play/drop/rejectDrop";
import { resolveBoardCellDropAction } from "~/v0/play/drop/resolveBoardCellDropAction";

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
	}
}

export const resolveBoardCellDrop = ({
	actions,
	board,
	config,
	feedback,
	source,
	target,
}: resolveBoardCellDrop.Props): TileEngine.DropOutcome => {
	const action = resolveBoardCellDropAction({
		board,
		config,
		source,
		target,
	});

	if (action.type === "ignore") return ignoreDrop();

	if (action.type === "reject") {
		return rejectDrop(() => feedback.flashBoardCell(action.feedback.cellKey));
	}

	if (action.type === "move-board-item") {
		return acceptDrop(() => actions.moveBoardItem(action.input));
	}

	if (action.type === "swap-board-items") {
		return acceptDrop(() => actions.swapBoardItems(action.input), {
			animation: action.animation,
		});
	}

	return acceptDrop(
		async () => {
			await actions.applyBoardItemToBoardItem(action.input);
			if (action.feedback?.kind === "imprint-cell") {
				feedback.pulseImprintCell(action.feedback.cellKey);
			}
			if (action.feedback?.kind === "merge-cell") {
				feedback.pulseMergeCell(action.feedback.cellKey);
			}
		},
		{
			animation: action.animation,
		},
	);
};
