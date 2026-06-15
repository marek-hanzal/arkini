import { memo, type FC, useCallback, useMemo } from "react";
import { inventoryColumns } from "~/inventory/inventoryColumns";
import { inventorySlotNodeId } from "~/inventory/inventorySlotNodeId";
import { inventorySourceId } from "~/inventory/inventorySourceId";
import { InventoryCell } from "~/inventory/ui/InventoryCell";
import { InventoryTile } from "~/inventory/ui/InventoryTile";
import { usePlayInventory } from "~/play/hook/usePlayInventory";
import { usePlayItems } from "~/play/hook/usePlayItems";
import {
	visualInventorySlotKey,
	visualInventoryStackKey,
	type useVisualItemMotions,
} from "~/play/hook/useVisualItemMotions";
import type { InventorySlot, ViewItem } from "~/play/logic/playTypes";
import type { DragData, DropData, RectLike } from "~/play/types";
import { SheetHeader } from "~/shared/ui/SheetHeader";
import { TileEngine } from "~/tile-engine/ui/TileEngine";

export namespace InventorySheet {
	export interface DragState {
		activeDropTargetNodeId?: string | null;
		isSourceHidden(sourceId: string): boolean;
		setActiveDropTargetNodeId(nodeId: string | null): void;
		start(props: { source: DragData; previewRect: Pick<RectLike, "width" | "height"> }): void;
		drop(props: { source: DragData; target: DropData | null; dragRect: RectLike | null }): void;
		cancel(): void;
	}

	export interface Props {
		drag: DragState;
		invalidInventorySlot?: number;
		onClose(): void;
		onSlotDoubleActivate(slot: InventorySlot): void;
		visualMotions: useVisualItemMotions.State;
	}
}

interface InventoryTileData {
	slot: InventorySlot;
	item: ViewItem;
}

export const InventorySheet: FC<InventorySheet.Props> = memo(
	({ drag, invalidInventorySlot, onClose, onSlotDoubleActivate, visualMotions }) => {
		const inventory = usePlayInventory().data;
		const items = usePlayItems().data;

		const slots = useMemo(
			() => inventory?.slots ?? [],
			[
				inventory?.slots,
			],
		);
		const filled = useMemo(
			() => slots.filter((slot) => slot.stack).length,
			[
				slots,
			],
		);
		const engineSlots = useMemo(
			() =>
				slots.map((slot) => ({
					id: String(slot.slotIndex),
					data: slot,
				})),
			[
				slots,
			],
		);
		const engineTiles = useMemo(
			() =>
				items
					? slots.flatMap((slot) => {
							const stack = slot.stack;
							if (!stack) return [];

							const item = items[stack.itemId];
							if (!item) return [];

							const stackMotionKey = visualInventoryStackKey(stack.id);
							const slotMotionKey = visualInventorySlotKey(slot.slotIndex);
							const visualMotion =
								visualMotions.motions[stackMotionKey] ??
								visualMotions.motions[slotMotionKey];

							return [
								{
									id: stack.id,
									slotId: String(slot.slotIndex),
									hidden: drag.isSourceHidden(inventorySourceId(slot.slotIndex)),
									motion: visualMotion,
									onMotionSettle: visualMotion
										? () => {
												visualMotions.settle(
													stackMotionKey,
													visualMotion.nonce,
												);
												visualMotions.settle(
													slotMotionKey,
													visualMotion.nonce,
												);
											}
										: undefined,
									data: {
										slot,
										item,
									} satisfies InventoryTileData,
								},
							];
						})
					: [],
			[
				drag.isSourceHidden,
				items,
				slots,
				visualMotions,
			],
		);
		const dragConfig = useMemo<
			TileEngine.DragConfig<InventoryTileData, InventorySlot, DragData, DropData>
		>(
			() => ({
				activeDropTargetNodeId: drag.activeDropTargetNodeId ?? null,
				onDragStart: (source, rect) =>
					drag.start({
						source,
						previewRect: {
							width: rect.width,
							height: rect.height,
						},
					}),
				onDragOver: (_source, _target, targetNodeId) => {
					drag.setActiveDropTargetNodeId(targetNodeId);
				},
				onDrop: (source, target, dragRect) =>
					drag.drop({
						source,
						target,
						dragRect,
					}),
				onDragCancel: drag.cancel,
				tile: (tile) => {
					const stack = tile.data.slot.stack;
					if (!stack) return undefined;
					const sourceId = inventorySourceId(tile.data.slot.slotIndex);
					const nodeId = `${sourceId}:drag-node`;
					return {
						id: `${sourceId}:drag`,
						nodeId,
						data: {
							sourceId,
							sourceNodeId: nodeId,
							itemId: stack.itemId,
							source: {
								kind: "inventory" as const,
								slotIndex: tile.data.slot.slotIndex,
								stackId: stack.id,
								quantity: stack.quantity,
							},
							overlay: {
								quantity: stack.quantity,
							},
							hideWhenActive: true,
						} satisfies DragData,
						hidden: drag.isSourceHidden(sourceId),
						hideWhenActive: true,
						onDoubleActivate: () => onSlotDoubleActivate(tile.data.slot),
					};
				},
				slot: (slot) => {
					const nodeId = inventorySlotNodeId(slot.data.slotIndex);
					return {
						id: nodeId,
						nodeId,
						data: {
							targetId: nodeId,
							targetNodeId: nodeId,
							target: {
								kind: "inventory-slot" as const,
								slotIndex: slot.data.slotIndex,
							},
						} satisfies DropData,
					};
				},
			}),
			[
				drag.cancel,
				drag.drop,
				drag.isSourceHidden,
				drag.setActiveDropTargetNodeId,
				drag.start,
				onSlotDoubleActivate,
			],
		);
		const renderSlot = useCallback(
			({ slot, isOver }: TileEngine.RenderSlotProps<InventorySlot>) => (
				<InventoryCell
					slot={slot.data}
					invalid={invalidInventorySlot === slot.data.slotIndex}
					isOver={isOver}
				/>
			),
			[
				invalidInventorySlot,
			],
		);
		const renderTile = useCallback(
			({ tile }: TileEngine.RenderTileProps<InventoryTileData>) => (
				<InventoryTile
					slot={tile.data.slot}
					item={tile.data.item}
					onDoubleActivate={onSlotDoubleActivate}
				/>
			),
			[
				onSlotDoubleActivate,
			],
		);

		if (!inventory || !items) return null;

		return (
			<div className="flex max-h-[var(--ak-sheet-max-height)] min-h-0 flex-col">
				<SheetHeader
					eyebrow="Inventory"
					description={`${filled}/${slots.length} slots`}
					anchor="inventory-summary"
					onClose={onClose}
				/>

				<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
					<TileEngine<InventoryTileData, InventorySlot, DragData, DropData>
						id="inventory"
						columns={inventoryColumns}
						slots={engineSlots}
						tiles={engineTiles}
						gapPx={1}
						className="ak-game-width mx-auto border-l border-t border-slate-800"
						itemLayerClassName="pointer-events-none"
						activeDropTargetNodeId={drag.activeDropTargetNodeId ?? null}
						drag={dragConfig}
						renderSlot={renderSlot}
						renderTile={renderTile}
					/>
				</div>
			</div>
		);
	},
);
