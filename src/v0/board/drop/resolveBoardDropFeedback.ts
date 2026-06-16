import type { BoardCellView } from "~/v0/board/boardCells";
import type { BoardSurface } from "~/v0/board/BoardSurface.types";
import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import { resolveDropIntent } from "~/v0/merge/resolveDropIntent";
import type { DragSource } from "~/v0/play/drag/DragSource";
import type { DropTarget } from "~/v0/play/drag/DropTarget";
import type { TileEngineNamespace as TileEngine } from "~/v0/tile-engine";

export namespace resolveBoardDropFeedback {
	export interface Props {
		board: BoardView;
		context: TileEngine.DragOverContext<
			BoardSurface.TileData,
			BoardCellView,
			DragSource,
			DropTarget
		>;
	}
}

const isMergeLikeIntent = (intent: ReturnType<typeof resolveDropIntent>) =>
	intent.type === "merge" || intent.type === "craft-input" || intent.type === "producer-input";

export const resolveBoardDropFeedback = ({
	board,
	context,
}: resolveBoardDropFeedback.Props): TileEngine.DropFeedback | null => {
	const { source, target, targetTile } = context;
	if (source.kind !== "board" || target?.kind !== "cell") return null;

	const targetBoardItemId =
		targetTile?.data.kind === "board-item" ? targetTile.data.boardItemId : undefined;
	if (!targetBoardItemId) {
		return {
			effect: "empty",
		};
	}

	if (targetBoardItemId === source.boardItemId) return null;

	const targetItem = board.byId[targetBoardItemId];
	if (!targetItem) {
		return {
			effect: "blocked",
		};
	}

	const intent = resolveDropIntent({
		sourceItemId: source.itemId,
		targetItem,
	});

	return {
		effect: isMergeLikeIntent(intent) ? "merge" : "blocked",
	};
};
