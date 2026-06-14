import { motion } from "motion/react";
import { memo, type CSSProperties, type FC } from "react";
import { inventoryColumns } from "~/inventory/inventoryColumns";
import { inventorySourceId } from "~/inventory/inventorySourceId";
import { InventoryTile } from "~/inventory/ui/InventoryTile";
import type { InventorySlot, ViewItem } from "~/play/logic/playTypes";

const layoutTransition = {
	duration: 0.26,
	ease: [
		0.22,
		1,
		0.36,
		1,
	],
} as const;

const inventoryItemSlotStyle = (slot: InventorySlot, slotCount: number): CSSProperties => {
	const rowCount = Math.ceil(slotCount / inventoryColumns);
	const column = slot.slotIndex % inventoryColumns;
	const row = Math.floor(slot.slotIndex / inventoryColumns);

	return {
		left: `${(column * 100) / inventoryColumns}%`,
		top: `${(row * 100) / rowCount}%`,
		width: `${100 / inventoryColumns}%`,
		height: `${100 / rowCount}%`,
		paddingRight: 1,
		paddingBottom: 1,
	};
};

export namespace InventoryItemLayer {
	export interface Props {
		slots: readonly InventorySlot[];
		items: Record<string, ViewItem>;
		isSourceHidden(sourceId: string): boolean;
		onSlotDoubleActivate(slot: InventorySlot): void;
	}
}

/**
 * Renders inventory stack tiles as stable actors above inventory slots.
 *
 * Inventory cells stay as drop targets. Stack DOM nodes stay in this single layer
 * and only their mathematical slot coordinates change, so slot swaps do not
 * remount or blink through a flyer handoff.
 */
export const InventoryItemLayer: FC<InventoryItemLayer.Props> = memo(
	({ slots, items, isSourceHidden, onSlotDoubleActivate }) => (
		<div className="pointer-events-none absolute inset-0 z-10">
			{slots.map((slot) => {
				const stack = slot.stack;
				if (!stack) return null;

				const item = items[stack.itemId];
				if (!item) return null;

				return (
					<motion.div
						key={stack.id}
						layout="position"
						transition={layoutTransition}
						className="pointer-events-auto absolute box-border"
						style={inventoryItemSlotStyle(slot, slots.length)}
					>
						<InventoryTile
							slot={slot}
							item={item}
							hidden={isSourceHidden(inventorySourceId(slot.slotIndex))}
							onDoubleActivate={onSlotDoubleActivate}
						/>
					</motion.div>
				);
			})}
		</div>
	),
);
