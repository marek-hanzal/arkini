import type { BoardCellView } from "~/v0/board/boardCells";
import type { BoardSurface } from "~/v0/board/BoardSurface.types";
import { cellKey } from "~/v0/board/cellKey";
import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { InventoryView } from "~/v0/inventory/view/InventoryViewSchema";
import { resolveDropIntent } from "~/v0/merge/resolveDropIntent";
import type { DragSource } from "~/v0/play/drag/DragSource";
import type { DropTarget } from "~/v0/play/drag/DropTarget";
import type { TileEngineNamespace as TileEngine } from "~/v0/tile-engine";

export namespace resolveBoardDropFeedback {
	export interface Props {
		board: BoardView;
		config: GameConfig;
		inventory: InventoryView;
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
	inventory,
}: resolveBoardDropFeedback.Props): TileEngine.DropFeedback | null => {
	const { source, target } = context;
	if (target?.kind !== "cell") return null;

	const targetItem = board.byCellKey[cellKey(target.x, target.y)];
	if (!targetItem) {
		return {
			effect: "empty",
		};
	}

	if (source.kind === "board" && targetItem.id === source.boardItemId) return null;

	const sourceItemId =
		source.kind === "board"
			? board.byId[source.boardItemId]?.itemId
			: inventory.bySlotIndex[String(source.slotIndex)]?.stack?.itemId;
	if (!sourceItemId) {
		return {
			effect: "blocked",
		};
	}

	const intent = resolveDropIntent({
		config,
		sourceItemId,
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
