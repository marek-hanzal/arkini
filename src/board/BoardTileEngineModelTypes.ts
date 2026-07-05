import type { BoardCellView } from "~/board/boardCells";
import type { BoardSurface } from "~/board/BoardSurface.types";
import type { DragSource } from "~/play/drag/DragSource";
import type { DropTarget } from "~/play/drag/DropTarget";
import type { TileEngine } from "~/tile-engine/TileEngine.types";

export type BoardTileEngineDragConfig = TileEngine.DragConfig<
	BoardSurface.TileData,
	BoardCellView,
	DragSource,
	DropTarget
>;

export type BoardTileEngineTile = Parameters<BoardTileEngineDragConfig["tile"]>[0];
export type BoardTileEngineSlot = Parameters<BoardTileEngineDragConfig["slot"]>[0];
export type BoardTileEngineTargetTile = Parameters<BoardTileEngineDragConfig["slot"]>[1];
