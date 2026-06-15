import { useCallback, useMemo, type ReactNode } from "react";
import { inventorySlotNodeId } from "~/inventory/inventorySlotNodeId";
import { inventorySourceId } from "~/inventory/inventorySourceId";
import { useInventoryView } from "~/inventory/hook/useInventoryView";
import { InventoryCell } from "~/inventory/ui/InventoryCell";
import { InventoryTile } from "~/inventory/ui/InventoryTile";
import type { InventorySlot } from "~/inventory/view/InventorySlotSchema";
import type { ViewItem } from "~/item/view/ViewItemSchema";
import { usePlayDragState } from "~/play/hook/usePlayDragState";
import { usePlayFeedbackState } from "~/play/hook/usePlayFeedbackState";
import { usePlayItems } from "~/play/hook/usePlayItems";
import { usePlayManualItemActions } from "~/play/hook/usePlayManualItemActions";
import { visualInventorySlotKey, visualInventoryStackKey } from "~/play/hook/useVisualItemMotions";
import { usePlayVisualMotionsState } from "~/play/hook/usePlayVisualMotionsState";
import type { DragData, DropData } from "~/play/types";
import { TileEngine } from "~/tile-engine/ui/TileEngine";

export namespace useInventoryTileEngine {
	export interface Props {}

	export interface InventoryTileData {
		slot: InventorySlot;
		item: ViewItem;
	}

	export interface Result {
		filled: number;
		slotCount: number;
		slots: readonly TileEngine.Slot<InventorySlot>[];
		tiles: readonly TileEngine.Tile<InventoryTileData>[];
		activeDropTargetNodeId: string | null;
		dragConfig: TileEngine.DragConfig<InventoryTileData, InventorySlot, DragData, DropData>;
		renderSlot(props: TileEngine.RenderSlotProps<InventorySlot>): ReactNode;
		renderTile(props: TileEngine.RenderTileProps<InventoryTileData>): ReactNode;
	}
}

export const useInventoryTileEngine = (
	_props?: useInventoryTileEngine.Props,
): useInventoryTileEngine.Result => {
	const inventory = useInventoryView();
	const items = usePlayItems();
	const drag = usePlayDragState();
	const feedback = usePlayFeedbackState();
	const visualMotions = usePlayVisualMotionsState();
	const manualActions = usePlayManualItemActions();
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
						actorKey: visualInventoryStackKey(stack.id),
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
					onDoubleActivate: () =>
						manualActions.placeInventoryOnBoardWithFly(tile.data.slot),
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
			drag.cancel,
			drag.drop,
			drag.isSourceHidden,
			drag.setActiveDropTargetNodeId,
			drag.start,
			manualActions.placeInventoryOnBoardWithFly,
		],
	);
	const renderSlot = useCallback(
		({ slot, isOver }: TileEngine.RenderSlotProps<InventorySlot>) => (
			<InventoryCell
				slot={slot.data}
				invalid={feedback.invalidInventorySlot === slot.data.slotIndex}
				isOver={isOver}
			/>
		),
		[
			feedback.invalidInventorySlot,
		],
	);
	const renderTile = useCallback(
		({ tile }: TileEngine.RenderTileProps<useInventoryTileEngine.InventoryTileData>) => (
			<InventoryTile
				slot={tile.data.slot}
				item={tile.data.item}
			/>
		),
		[],
	);

	return {
		filled,
		slotCount: slots.length,
		slots: engineSlots,
		tiles: engineTiles,
		activeDropTargetNodeId: drag.activeDropTargetNodeId ?? null,
		dragConfig,
		renderSlot,
		renderTile,
	};
};
