import { cellKey } from "~/board/util/cell";
import { flashSource } from "./flashSource";
import type { AnyDropContext, Feedback } from "./types";
import type { GameDragView } from "~/drag/view/GameDragViewSchema";

export namespace flashDrop {
	export interface Props {
		context: AnyDropContext;
		game: GameDragView | undefined;
		feedback: Feedback;
	}
}

export const flashDrop = ({ context, game, feedback }: flashDrop.Props) => {
	flashSource({
		source: context.source.source,
		game,
		feedback,
	});

	const target = context.target?.target;
	if (!target) return;
	if (target.kind === "cell") feedback.flashBoardCell(cellKey(target.x, target.y), "error");
	if (target.kind === "inventory-slot") feedback.flashInventorySlot(target.slotIndex, "error");
};
