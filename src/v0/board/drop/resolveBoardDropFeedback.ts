import type { BoardCellView } from "~/v0/board/boardCells";
import type { BoardSurface } from "~/v0/board/BoardSurface.types";
import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { resolveDropIntent } from "~/v0/merge/resolveDropIntent";
import type { DragSource } from "~/v0/play/drag/DragSource";
import type { DropTarget } from "~/v0/play/drag/DropTarget";
import type { TileEngineNamespace as TileEngine } from "~/v0/tile-engine";

export namespace resolveBoardDropFeedback {
	export interface Props {
		board: BoardView;
		config: GameConfig;
		context: TileEngine.DragOverContext<
			BoardSurface.TileData,
			BoardCellView,
			DragSource,
			DropTarget
		>;
	}
}

export const resolveBoardDropFeedback = ({
	board,
	config,
	context,
}: resolveBoardDropFeedback.Props): TileEngine.DropFeedback | null => {
	const { source, target, targetTile } = context;
	if (target?.kind !== "cell") return null;

	const targetBoardItemId =
		targetTile?.data.kind === "board-item" ? targetTile.data.boardItemId : undefined;
	if (!targetBoardItemId) {
		return {
			effect: "empty",
		};
	}

	if (source.kind === "board" && targetBoardItemId === source.boardItemId) return null;

	const targetItem = board.byId[targetBoardItemId];
	if (!targetItem) {
		return {
			effect: "blocked",
		};
	}

	const intent = resolveDropIntent({
		config,
		sourceItemId: source.itemId,
		targetItem,
	});

	if (intent.type === "stored-requirement") {
		return {
			effect: "merge",
			variant: "primary",
		};
	}

	if (intent.type === "craft-input" || intent.type === "producer-input") {
		return {
			effect: "merge",
			variant: "secondary",
		};
	}

	if (intent.type === "merge") {
		return {
			effect: "merge",
		};
	}

	if (intent.type === "swap")
		return source.kind === "board"
			? null
			: {
					effect: "blocked",
				};

	return {
		effect: "blocked",
	};
};
