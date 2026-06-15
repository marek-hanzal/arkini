import { memo, type FC, useCallback, useMemo } from "react";
import { inventoryContainerNodeId } from "~/inventory/inventoryContainerNodeId";
import { inventoryColumns } from "~/inventory/inventoryColumns";
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
import { SheetHeader } from "~/shared/ui/SheetHeader";
import { TileEngine } from "~/tile-engine/ui/TileEngine";

export namespace InventorySheet {
	export interface Props {
		isSourceHidden(sourceId: string): boolean;
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
	({ isSourceHidden, invalidInventorySlot, onClose, onSlotDoubleActivate, visualMotions }) => {
		const inventory = usePlayInventory().data;
		const items = usePlayItems().data;

		const renderSlot = useCallback(
			({ slot }: TileEngine.RenderSlotProps<InventorySlot>) => (
				<InventoryCell
					slot={slot.data}
					invalid={invalidInventorySlot === slot.data.slotIndex}
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
					hidden={Boolean(tile.hidden)}
					onDoubleActivate={onSlotDoubleActivate}
				/>
			),
			[
				onSlotDoubleActivate,
			],
		);

		if (!inventory || !items) return null;

		const slots = inventory.slots;
		const filled = slots.filter((slot) => slot.stack).length;
		const engineSlots = slots.map((slot) => ({
			id: String(slot.slotIndex),
			data: slot,
		}));
		const engineTiles = slots.flatMap((slot) => {
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
					hidden: isSourceHidden(inventorySourceId(slot.slotIndex)),
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
					} satisfies InventoryTileData,
				},
			];
		});

		return (
			<div className="flex max-h-[var(--ak-sheet-max-height)] min-h-0 flex-col">
				<SheetHeader
					eyebrow="Inventory"
					description={`${filled}/${slots.length} slots`}
					anchor="inventory-summary"
					onClose={onClose}
				/>

				<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
					<TileEngine<InventoryTileData, InventorySlot>
						id="inventory"
						columns={inventoryColumns}
						slots={engineSlots}
						tiles={engineTiles}
						gapPx={1}
						className="ak-game-width mx-auto border-l border-t border-slate-800"
						itemLayerClassName="pointer-events-none"
						renderSlot={renderSlot}
						renderTile={renderTile}
					/>
				</div>
			</div>
		);
	},
);
