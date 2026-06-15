import { useSuspenseQuery } from "@tanstack/react-query";
import { memo, type ReactNode, useCallback, useMemo } from "react";
import type { Command } from "~/command/Command";
import { inventoryColumns } from "~/inventory/inventoryColumns";
import type { InventorySlot } from "~/inventory/view/InventorySlotSchema";
import { GameItemView } from "~/item/ui/GameItemView";
import type { ViewItem } from "~/item/view/ViewItemSchema";
import { cn } from "~/shared/cn";
import { SheetHeader } from "~/shared/ui/SheetHeader";
import { boardViewQueryOptions } from "~/v0/query/boardViewQueryOptions";
import { inventoryViewQueryOptions } from "~/v0/query/inventoryViewQueryOptions";
import { itemCatalogQueryOptions } from "~/v0/query/itemCatalogQueryOptions";
import { useGameCommandMutation } from "~/v0/mutation/useGameCommandMutation";
import type { V0DragSource, V0DropTarget } from "~/v0/play/V0DragTypes";
import type { V0Feedback } from "~/v0/play/V0Feedback";
import { resolveV0Drop } from "~/v0/play/resolveV0Drop";
import { TileEngine } from "~/v0/tile-engine/TileEngine";
import type { TileEngine as TileEngineType } from "~/v0/tile-engine/TileEngine.types";

export namespace V0InventorySurface {
	export interface Props {
		feedback: V0Feedback;
		hasFeedback(key: string): boolean;
		onClose(): void;
	}

	export interface TileData {
		slot: InventorySlot;
		item: ViewItem;
	}
}

const InventoryCell = memo(
	({ slot, invalid, isOver }: { slot: InventorySlot; invalid: boolean; isOver: boolean }) => (
		<div
			data-v0-inventory-slot={slot.slotIndex}
			className={cn(
				"relative aspect-square border-b border-r border-slate-800 bg-slate-900/70",
				isOver && "bg-slate-800 outline outline-2 -outline-offset-2 outline-emerald-300/80",
				invalid && "ak-cell-error",
			)}
		/>
	),
);

const renderInventoryTile = ({
	tile,
}: TileEngineType.RenderTileProps<V0InventorySurface.TileData>) => {
	const stack = tile.data.slot.stack;
	if (!stack) return null;

	return (
		<div
			data-v0-inventory-stack-id={stack.id}
			className="h-full w-full"
		>
			<GameItemView
				item={tile.data.item}
				variant="inventory"
				quantity={stack.quantity}
			/>
		</div>
	);
};

export const V0InventorySurface = memo(
	({ feedback, hasFeedback, onClose }: V0InventorySurface.Props) => {
		const { data: board } = useSuspenseQuery(boardViewQueryOptions());
		const { data: inventory } = useSuspenseQuery(inventoryViewQueryOptions());
		const { data: items } = useSuspenseQuery(itemCatalogQueryOptions());
		const command = useGameCommandMutation();
		const run = command.mutateAsync;
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
					] satisfies TileEngineType.Tile<V0InventorySurface.TileData>[];
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

				command.mutate({
					type: "inventory.place",
					slotIndex: slot.slotIndex,
					x: target.x,
					y: target.y,
				});
			},
			[
				board.firstEmptyCell,
				command.mutate,
				feedback,
			],
		);
		const drag = useMemo<
			TileEngineType.DragConfig<
				V0InventorySurface.TileData,
				InventorySlot,
				V0DragSource,
				V0DropTarget
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
					return resolveV0Drop({
						context,
						board,
						inventory,
						feedback,
						run,
					});
				},
			}),
			[
				board,
				feedback,
				inventory,
				placeInventoryOnBoard,
				run,
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
						V0InventorySurface.TileData,
						InventorySlot,
						V0DragSource,
						V0DropTarget
					>
						id="v0-inventory"
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
