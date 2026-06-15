import { useSuspenseQuery } from "@tanstack/react-query";
import { memo, type ReactNode, useCallback, useMemo } from "react";
import { inventoryColumns } from "~/inventory/inventoryColumns";
import type { InventorySlot } from "~/inventory/view/InventorySlotSchema";
import { SheetHeader } from "~/shared/ui/SheetHeader";
import { boardViewQueryOptions } from "~/v0/query/boardViewQueryOptions";
import { inventoryViewQueryOptions } from "~/v0/query/inventoryViewQueryOptions";
import { itemCatalogQueryOptions } from "~/v0/query/itemCatalogQueryOptions";
import { useMergeBoardItemsMutation } from "~/v0/mutation/useMergeBoardItemsMutation";
import { useMoveBoardItemMutation } from "~/v0/mutation/useMoveBoardItemMutation";
import { usePlaceInventoryItemMutation } from "~/v0/mutation/usePlaceInventoryItemMutation";
import { useStashBoardItemMutation } from "~/v0/mutation/useStashBoardItemMutation";
import { useSwapBoardItemsMutation } from "~/v0/mutation/useSwapBoardItemsMutation";
import { useSwapInventorySlotsMutation } from "~/v0/mutation/useSwapInventorySlotsMutation";
import type { DragSource, DropTarget } from "~/v0/play/DragTypes";
import { InventoryCell } from "~/v0/inventory/InventoryCell";
import type { InventorySurface as InventorySurfaceType } from "~/v0/inventory/InventorySurface.types";
import { renderInventoryTile } from "~/v0/inventory/renderInventoryTile";
import type { DropActions } from "~/v0/play/drop/DropActions";
import { resolveDrop } from "~/v0/play/resolveDrop";
import { TileEngine } from "~/v0/tile-engine/TileEngine";
import type { TileEngine as TileEngineType } from "~/v0/tile-engine/TileEngine.types";

export const InventorySurface = memo(
	({ feedback, hasFeedback, onClose }: InventorySurfaceType.Props) => {
		const { data: board } = useSuspenseQuery(boardViewQueryOptions());
		const { data: inventory } = useSuspenseQuery(inventoryViewQueryOptions());
		const { data: items } = useSuspenseQuery(itemCatalogQueryOptions());
		const mergeBoardItemsMutation = useMergeBoardItemsMutation();
		const moveBoardItemMutation = useMoveBoardItemMutation();
		const placeInventoryItemMutation = usePlaceInventoryItemMutation();
		const stashBoardItemMutation = useStashBoardItemMutation();
		const swapBoardItemsMutation = useSwapBoardItemsMutation();
		const swapInventorySlotsMutation = useSwapInventorySlotsMutation();
		const slots = useMemo(
			() =>
				inventory.slots.map((slot) => ({
					id: String(slot.slotIndex),
					data: slot,
				})),
			[
				inventory.slots,
			],
		);
		const tiles = useMemo(
			() =>
				inventory.slots.flatMap((slot) => {
					const stack = slot.stack;
					if (!stack) return [];

					const item = items[stack.itemId];
					if (!item) return [];

					return [
						{
							id: stack.id,
							slotId: String(slot.slotIndex),
							data: {
								slot,
								item,
							},
						},
					] satisfies TileEngineType.Tile<InventorySurfaceType.TileData>[];
				}),
			[
				inventory.slots,
				items,
			],
		);
		const placeInventoryOnBoard = useCallback(
			(slot: InventorySlot) => {
				const target = board.firstEmptyCell;
				if (!slot.stack || !target) {
					feedback.flashInventorySlot(slot.slotIndex);
					return;
				}

				placeInventoryItemMutation.mutate({
					slotIndex: slot.slotIndex,
					x: target.x,
					y: target.y,
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
			TileEngineType.DragConfig<
				InventorySurfaceType.TileData,
				InventorySlot,
				DragSource,
				DropTarget
			>
		>(
			() => ({
				tile(tile) {
					const stack = tile.data.slot.stack;
					if (!stack) return undefined;

					return {
						id: `inventory:${tile.data.slot.slotIndex}`,
						data: {
							kind: "inventory",
							slotIndex: tile.data.slot.slotIndex,
							itemId: stack.itemId,
							slot: tile.data.slot,
						},
						onDoubleActivate: () => placeInventoryOnBoard(tile.data.slot),
					};
				},
				slot(slot) {
					return {
						id: `inventory-slot:${slot.data.slotIndex}`,
						data: {
							kind: "inventory-slot",
							slotIndex: slot.data.slotIndex,
						},
					};
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
		const filled = inventory.slots.filter((slot) => slot.stack).length;
		const renderSlot = useCallback(
			({ slot, isOver }: TileEngineType.RenderSlotProps<InventorySlot>): ReactNode => (
				<InventoryCell
					slot={slot.data}
					invalid={hasFeedback(`inventory:error:${slot.data.slotIndex}`)}
					isOver={isOver}
				/>
			),
			[
				hasFeedback,
			],
		);

		return (
			<div className="flex max-h-[var(--ak-sheet-max-height)] min-h-0 flex-col">
				<SheetHeader
					eyebrow="Inventory"
					description={`${filled}/${inventory.slots.length} slots`}
					onClose={onClose}
				/>
				<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
					<TileEngine<
						InventorySurfaceType.TileData,
						InventorySlot,
						DragSource,
						DropTarget
					>
						id="inventory"
						columns={inventoryColumns}
						slots={slots}
						tiles={tiles}
						gapPx={1}
						className="ak-game-width mx-auto border-l border-t border-slate-800"
						itemLayerClassName="pointer-events-none"
						drag={drag}
						renderSlot={renderSlot}
						renderTile={renderInventoryTile}
					/>
				</div>
			</div>
		);
	},
);
