import { useSuspenseQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useMergeBoardItemsMutation } from "~/v0/board/action/useMergeBoardItemsMutation";
import { useMoveBoardItemMutation } from "~/v0/board/action/useMoveBoardItemMutation";
import { useSwapBoardItemsMutation } from "~/v0/board/action/useSwapBoardItemsMutation";
import { boardViewQueryOptions } from "~/v0/board/query/boardViewQueryOptions";
import { usePlaceInventoryItemMutation } from "~/v0/inventory/action/usePlaceInventoryItemMutation";
import { resolveInventoryDropFeedback } from "~/v0/inventory/drop/resolveInventoryDropFeedback";
import { resolveInventorySlotTapAction } from "~/v0/inventory/logic/resolveInventorySlotTapAction";
import { useStashBoardItemMutation } from "~/v0/inventory/action/useStashBoardItemMutation";
import { useSwapInventorySlotsMutation } from "~/v0/inventory/action/useSwapInventorySlotsMutation";
import type { InventorySurface } from "~/v0/inventory/InventorySurface.types";
import { inventoryViewQueryOptions } from "~/v0/inventory/query/inventoryViewQueryOptions";
import type { InventorySlot } from "~/v0/inventory/view/InventorySlotSchema";
import type { DragSource } from "~/v0/play/drag/DragSource";
import type { DropTarget } from "~/v0/play/drag/DropTarget";
import type { DropActions } from "~/v0/play/drop/DropActions";
import { resolveDrop } from "~/v0/play/drop/resolveDrop";
import type { Feedback } from "~/v0/play/feedback/Feedback";
import type { TileEngineNamespace as TileEngine } from "~/v0/tile-engine";

export namespace useInventoryTileEngineModel {
	export interface Props {
		feedback: Feedback.Type;
	}

	export interface Result {
		filled: number;
		slots: TileEngine.Slot<InventorySurface.SlotData>[];
		tiles: TileEngine.Tile<InventorySurface.TileData>[];
		drag: TileEngine.DragConfig<
			InventorySurface.TileData,
			InventorySurface.SlotData,
			DragSource,
			DropTarget
		>;
	}
}

export const useInventoryTileEngineModel = ({
	feedback,
}: useInventoryTileEngineModel.Props): useInventoryTileEngineModel.Result => {
	const { data: board } = useSuspenseQuery(boardViewQueryOptions());
	const { data: inventory } = useSuspenseQuery(inventoryViewQueryOptions());
	const mergeBoardItemsMutation = useMergeBoardItemsMutation();
	const moveBoardItemMutation = useMoveBoardItemMutation();
	const placeInventoryItemMutation = usePlaceInventoryItemMutation();
	const stashBoardItemMutation = useStashBoardItemMutation();
	const swapBoardItemsMutation = useSwapBoardItemsMutation();
	const swapInventorySlotsMutation = useSwapInventorySlotsMutation();

	const slotLayoutKey = inventory.slots.map((slot) => slot.slotIndex).join("|");
	const slots = useMemo(
		() =>
			inventory.slots.map((slot) => ({
				id: String(slot.slotIndex),
				dropId: `inventory-slot:${slot.slotIndex}`,
				renderKey: slot.slotIndex,
				data: {
					slotIndex: slot.slotIndex,
				},
			})) satisfies TileEngine.Slot<InventorySurface.SlotData>[],
		[
			slotLayoutKey,
		],
	);

	const tiles = useMemo(
		() =>
			inventory.slots.flatMap((slot) => {
				const stack = slot.stack;
				if (!stack) return [];

				return [
					{
						id: stack.id,
						slotId: String(slot.slotIndex),
						renderKey: `inventory:${stack.id}:${slot.slotIndex}:${stack.itemId}:${stack.quantity}`,
						data: {
							slotIndex: slot.slotIndex,
							stackId: stack.id,
							itemId: stack.itemId,
							quantity: stack.quantity,
						},
					},
				] satisfies TileEngine.Tile<InventorySurface.TileData>[];
			}),
		[
			inventory.slots,
		],
	);

	const placeInventoryOnBoard = useCallback(
		(slot: InventorySlot) => {
			const action = resolveInventorySlotTapAction({
				firstEmptyCell: board.firstEmptyCell,
				slot,
			});

			if (action.type === "flash-inventory-slot") {
				feedback.flashInventorySlot(action.slotIndex);
				return;
			}

			placeInventoryItemMutation.mutate({
				slotIndex: action.slotIndex,
				x: action.x,
				y: action.y,
			});
		},
		[
			board.firstEmptyCell,
			feedback,
			placeInventoryItemMutation.mutate,
		],
	);

	const actions = useMemo<DropActions>(
		() => ({
			mergeBoardItems: mergeBoardItemsMutation.mutateAsync,
			moveBoardItem: moveBoardItemMutation.mutateAsync,
			placeInventoryItem: placeInventoryItemMutation.mutateAsync,
			stashBoardItem: stashBoardItemMutation.mutateAsync,
			swapBoardItems: swapBoardItemsMutation.mutateAsync,
			swapInventorySlots: swapInventorySlotsMutation.mutateAsync,
		}),
		[
			mergeBoardItemsMutation.mutateAsync,
			moveBoardItemMutation.mutateAsync,
			placeInventoryItemMutation.mutateAsync,
			stashBoardItemMutation.mutateAsync,
			swapBoardItemsMutation.mutateAsync,
			swapInventorySlotsMutation.mutateAsync,
		],
	);

	const drag = useMemo<
		TileEngine.DragConfig<
			InventorySurface.TileData,
			InventorySurface.SlotData,
			DragSource,
			DropTarget
		>
	>(
		() => ({
			tile(tile) {
				const slot = inventory.bySlotIndex[String(tile.data.slotIndex)];
				const stack = slot?.stack;
				if (!slot || !stack) return undefined;

				return {
					id: `inventory:${slot.slotIndex}`,
					data: {
						kind: "inventory",
						slotIndex: slot.slotIndex,
						itemId: stack.itemId,
						slot,
					},
					onDoubleActivate: () => placeInventoryOnBoard(slot),
				};
			},
			slot(slot) {
				return {
					data: {
						kind: "inventory-slot",
						slotIndex: slot.data.slotIndex,
					},
				};
			},
			dropFeedback(context) {
				return resolveInventoryDropFeedback({
					context,
				});
			},
			onDrop(context) {
				return resolveDrop({
					context,
					board,
					inventory,
					feedback,
					actions,
				});
			},
		}),
		[
			actions,
			board,
			feedback,
			inventory,
			placeInventoryOnBoard,
		],
	);

	return {
		drag,
		filled: inventory.slots.filter((slot) => slot.stack).length,
		slots,
		tiles,
	};
};
