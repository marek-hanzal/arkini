import { match } from "ts-pattern";
import { cellKey } from "~/v0/board/cellKey";
import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import { resolveDropIntent } from "~/v0/merge/resolveDropIntent";
import type { DragSource } from "~/v0/play/drag/DragSource";
import type { DropTarget } from "~/v0/play/drag/DropTarget";
import type { Feedback } from "~/v0/play/feedback/Feedback";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";
import { acceptDrop } from "~/v0/play/drop/acceptDrop";
import type { DropActions } from "~/v0/play/drop/DropActions";
import { ignoreDrop } from "~/v0/play/drop/ignoreDrop";
import { rejectDrop } from "~/v0/play/drop/rejectDrop";

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
		feedback: Feedback.Type;
		actions: DropActions;
	}
}

export const resolveBoardCellDrop = ({
	source,
	target,
	board,
	feedback,
	actions,
}: resolveBoardCellDrop.Props): TileEngine.DropOutcome => {
	if (target.boardItemId === source.boardItemId) return ignoreDrop();

	if (!target.boardItemId) {
		return acceptDrop(() =>
			actions.moveBoardItem({
				boardItemId: source.boardItemId,
				x: target.x,
				y: target.y,
			}),
		);
	}

	const targetItem = board.byId[target.boardItemId];
	if (!targetItem) {
		return rejectDrop(() => feedback.flashBoardCell(cellKey(target.x, target.y)));
	}

	const intent = resolveDropIntent({
		sourceItemId: source.itemId,
		targetItem,
	});

	return match(intent)
		.with(
			{
				type: "reject",
			},
			() => rejectDrop(() => feedback.flashBoardCell(cellKey(target.x, target.y))),
		)
		.with(
			{
				type: "swap",
			},
			() =>
				acceptDrop(() =>
					actions.swapBoardItems({
						sourceBoardItemId: source.boardItemId,
						targetBoardItemId: targetItem.id,
					}),
				),
		)
		.with(
			{
				type: "merge",
			},
			(merge) =>
				acceptDrop(async () => {
					await actions.mergeBoardItems({
						sourceBoardItemId: source.boardItemId,
						targetBoardItemId: targetItem.id,
					});
					if (merge.directed) feedback.pulseImprintCell(cellKey(target.x, target.y));
					else feedback.pulseMergeCell(cellKey(target.x, target.y));
				}),
		)
		.with(
			{
				type: "craft-input",
			},
			{
				type: "producer-input",
			},
			() =>
				acceptDrop(() =>
					actions.mergeBoardItems({
						sourceBoardItemId: source.boardItemId,
						targetBoardItemId: targetItem.id,
					}),
				),
		)
		.exhaustive();
};
