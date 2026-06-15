import { useCallback, useMemo } from "react";
import { inventorySlotNodeId } from "~/inventory/inventorySlotNodeId";
import { inventorySourceId } from "~/inventory/inventorySourceId";
import { useInventoryView } from "~/inventory/hook/useInventoryView";
import { InventoryCell } from "~/inventory/ui/InventoryCell";
import { InventoryTile } from "~/inventory/ui/InventoryTile";
import type { InventorySlot } from "~/inventory/view/InventorySlotSchema";
import type { ViewItem } from "~/item/view/ViewItemSchema";
import { usePlayItems } from "~/play/hook/usePlayItems";
import {
	visualInventorySlotKey,
	visualInventoryStackKey,
	type useVisualItemMotions,
} from "~/play/hook/useVisualItemMotions";
import type { DragData, DropData, RectLike } from "~/play/types";
import { TileEngine } from "~/tile-engine/ui/TileEngine";

export namespace useInventoryTileEngine {
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
		onSlotDoubleActivate(slot: InventorySlot): void;
		visualMotions: useVisualItemMotions.State;
	}

	export interface InventoryTileData {
		slot: InventorySlot;
		item: ViewItem;
	}
}

export const useInventoryTileEngine = ({
	drag,
	invalidInventorySlot,
	onSlotDoubleActivate,
	visualMotions,
}: useInventoryTileEngine.Props) => {
	const inventory = useInventoryView();
	const items = usePlayItems();
	const slots = inventory.slots;
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
			slots.flatMap((slot) => {
				const stack = slot.stack;
				if (!stack) return [];

				const item = items[stack.itemId];
				if (!item) return [];

				const stackMotionKey = visualInventoryStackKey(stack.id);
				const slotMotionKey = visualInventorySlotKey(slot.slotIndex);
				const visualMotion =
					visualMotions.motions[stackMotionKey] ?? visualMotions.motions[slotMotionKey];

				return [
					{
						id: stack.id,
						slotId: String(slot.slotIndex),
						hidden: drag.isSourceHidden(inventorySourceId(slot.slotIndex)),
						motion: visualMotion,
						onMotionSettle: visualMotion
							? () => {
									visualMotions.settle(stackMotionKey, visualMotion.nonce);
									visualMotions.settle(slotMotionKey, visualMotion.nonce);
								}
							: undefined,
						data: {
							slot,
							item,
						} satisfies useInventoryTileEngine.InventoryTileData,
					},
				];
			}),
		[
			drag.isSourceHidden,
			items,
			slots,
			visualMotions,
		],
	);
	const dragConfig = useMemo<
		TileEngine.DragConfig<
			useInventoryTileEngine.InventoryTileData,
			InventorySlot,
			DragData,
			DropData
		>
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
							kind: "inventory",
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
							kind: "inventory-slot",
							slotIndex: slot.data.slotIndex,
						},
					} satisfies DropData,
				};
			},
		}),
		[
			drag.activeDropTargetNodeId,
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
		({ tile }: TileEngine.RenderTileProps<useInventoryTileEngine.InventoryTileData>) => (
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

	return {
		filled,
		slotCount: slots.length,
		slots: engineSlots,
		tiles: engineTiles,
		dragConfig,
		renderSlot,
		renderTile,
	};
};
