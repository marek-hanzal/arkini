import type { InventorySurface } from "~/inventory/InventorySurface.types";
import type { DragSource } from "~/play/drag/DragSource";
import type { DropTarget } from "~/play/drag/DropTarget";
import type { TileEngine } from "~/tile-engine/TileEngine.types";

export type InventoryTileEngineDragConfig = TileEngine.DragConfig<
	InventorySurface.TileData,
	InventorySurface.SlotData,
	DragSource,
	DropTarget
>;

export type InventoryTileEngineTile = Parameters<InventoryTileEngineDragConfig["tile"]>[0];
export type InventoryTileEngineSlot = Parameters<InventoryTileEngineDragConfig["slot"]>[0];

export type InventoryPlacementTarget = {
	x: number;
	y: number;
};

export type PlaceInventoryOnBoardInput = {
	expectedItemId: string;
	expectedStackId: string;
	slotIndex: number;
};
