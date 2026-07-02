import type { BoardCellView } from "~/board/boardCells";
import type { BoardSurface } from "~/board/BoardSurface.types";
import { cellKey } from "~/board/cellKey";
import { isInventoryBoardItemId } from "~/board/BoardUtilityItem";
import type { BoardView } from "~/board/view/BoardViewSchema";
import type { GameConfig } from "~/config/GameConfigSchema";
import { isItemStorageAllowed } from "~/config/isItemStorageAllowed";
import type { InventoryView } from "~/inventory/view/InventoryViewSchema";
import { resolveDropIntent } from "~/merge/resolveDropIntent";
import type { DragSource } from "~/play/drag/DragSource";
import type { DropTarget } from "~/play/drag/DropTarget";
import type { TileEngineNamespace as TileEngine } from "~/tile-engine";
import { readBoardItemInventoryStorageReadiness } from "~/play/drop/readBoardItemInventoryStorageReadiness";

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
	const sourceItemId =
		source.kind === "board"
			? board.byId[source.boardItemId]?.itemId
			: inventory.bySlotIndex[String(source.slotIndex)]?.stack?.itemId;
	const sourceStackId =
		source.kind === "inventory"
			? inventory.bySlotIndex[String(source.slotIndex)]?.stack?.id
			: undefined;
	if (
		!sourceItemId ||
		sourceItemId !== source.itemId ||
		(source.kind === "inventory" && sourceStackId !== source.slot.stack?.id)
	) {
		return {
			effect: "blocked",
		};
	}

	if (!targetItem) {
		if (
			source.kind === "inventory" &&
			!isItemStorageAllowed({
				config,
				itemId: sourceItemId,
				location: "board",
			})
		) {
			return {
				effect: "blocked",
			};
		}

		return {
			effect: "empty",
		};
	}

	if (source.kind === "board" && targetItem.id === source.boardItemId) return null;

	if (isInventoryBoardItemId(targetItem.itemId)) {
		if (source.kind !== "board") {
			return {
				effect: "blocked",
			};
		}

		const sourceItem = board.byId[source.boardItemId];
		if (!sourceItem) {
			return {
				effect: "blocked",
			};
		}

		const readiness = readBoardItemInventoryStorageReadiness({
			config,
			inventory,
			sourceItem,
		});

		return readiness.canStore
			? {
					effect: "merge",
					variant: "primary",
				}
			: {
					effect: "blocked",
				};
	}

	const intent = resolveDropIntent({
		config,
		sourceItemId,
		targetItem,
	});

	if (
		intent.type === "craft-input" ||
		intent.type === "producer-input" ||
		intent.type === "stash-input" ||
		intent.type === "tile-remove"
	) {
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

	if (intent.type === "swap") {
		return {
			effect: "blocked",
		};
	}

	return {
		effect: "blocked",
	};
};
