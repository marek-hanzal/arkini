import { cellKey } from "~/board/util/cell";
import type { DragSource } from "~/play/types";
import type { Feedback } from "./types";
import type { GameDragView } from "~/play/logic/playTypes";

export namespace flashSource {
	export interface Props {
		source: DragSource;
		game: GameDragView | undefined;
		feedback: Feedback;
	}
}

export const flashSource = ({ source, game, feedback }: flashSource.Props) => {
	if (source.kind === "inventory") {
		feedback.flashInventorySlot(source.slotIndex, "error");
		return;
	}

	const boardItem = game?.boardItemsById[source.boardItemId];
	feedback.flashBoardCell(boardItem ? cellKey(boardItem.x, boardItem.y) : undefined, "error");
};
