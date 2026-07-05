import type {
	InventoryTileEngineTile,
	PlaceInventoryOnBoardInput,
} from "~/inventory/InventoryTileEngineModelTypes";
import { useGameInventoryView } from "~/play/runtime/useGameRuntimeViews";

export const readInventoryTileDragActor = ({
	inventory,
	placeInventoryOnBoard,
	tile,
}: {
	inventory: ReturnType<typeof useGameInventoryView>;
	placeInventoryOnBoard(input: PlaceInventoryOnBoardInput): void;
	tile: InventoryTileEngineTile;
}) => {
	const slot = inventory.bySlotIndex[String(tile.data.slotIndex)];
	const stack = slot?.stack;
	if (!slot || !stack) return undefined;

	return {
		id: `inventory:${slot.slotIndex}`,
		data: {
			kind: "inventory" as const,
			slotIndex: slot.slotIndex,
			itemId: stack.itemId,
			slot,
		},
		onDoubleActivate: () =>
			placeInventoryOnBoard({
				expectedItemId: stack.itemId,
				expectedStackId: stack.id,
				slotIndex: slot.slotIndex,
			}),
	};
};
