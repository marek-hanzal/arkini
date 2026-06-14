import { AnimatePresence, motion } from "motion/react";
import { memo, type CSSProperties, type FC } from "react";
import { inventoryColumns } from "~/inventory/inventoryColumns";
import { inventorySourceId } from "~/inventory/inventorySourceId";
import { InventoryTile } from "~/inventory/ui/InventoryTile";
import {
	visualInventorySlotKey,
	visualInventoryStackKey,
	type useVisualItemMotions,
} from "~/play/hook/useVisualItemMotions";
import type { InventorySlot, ViewItem } from "~/play/logic/playTypes";
import type { VisualItemMotion } from "~/play/logic/visualItemMotionMachine";

const layoutTransition = {
	duration: 0.26,
	ease: [
		0.22,
		1,
		0.36,
		1,
	],
} as const;

const inventoryItemSlotStyle = (
	slot: InventorySlot,
	slotCount: number,
	motion: VisualItemMotion | undefined,
): CSSProperties => {
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
		zIndex: motion?.priority === "raised" ? 30 : 0,
	};
};

const initialFromMotion = (motion: VisualItemMotion | undefined) =>
	motion
		? {
				x: motion.from.left - motion.to.left,
				y: motion.from.top - motion.to.top,
				scaleX: motion.to.width > 0 ? motion.from.width / motion.to.width : 1,
				scaleY: motion.to.height > 0 ? motion.from.height / motion.to.height : 1,
				opacity: 1,
			}
		: false;

export namespace InventoryItemLayer {
	export interface Props {
		slots: readonly InventorySlot[];
		items: Record<string, ViewItem>;
		isSourceHidden(sourceId: string): boolean;
		visualMotions: useVisualItemMotions.State;
		onSlotDoubleActivate(slot: InventorySlot): void;
	}
}

/**
 * Renders inventory stack tiles as stable actors above inventory slots.
 *
 * Inventory cells stay as drop targets. Stack DOM nodes stay in this single layer
 * and only their mathematical slot coordinates change, so slot swaps do not
 * remount or blink through a parallel visual handoff.
 */
export const InventoryItemLayer: FC<InventoryItemLayer.Props> = memo(
	({ slots, items, isSourceHidden, visualMotions, onSlotDoubleActivate }) => (
		<div className="pointer-events-none absolute inset-0 z-10">
			<AnimatePresence initial={false}>
				{slots.map((slot) => {
					const stack = slot.stack;
					if (!stack) return null;

					const item = items[stack.itemId];
					if (!item) return null;

					const stackMotionKey = visualInventoryStackKey(stack.id);
					const slotMotionKey = visualInventorySlotKey(slot.slotIndex);
					const visualMotion =
						visualMotions.motions[stackMotionKey] ??
						visualMotions.motions[slotMotionKey];

					return (
						<motion.div
							key={stack.id}
							layout={visualMotion ? false : "position"}
							initial={initialFromMotion(visualMotion)}
							animate={{
								x: 0,
								y: 0,
								scaleX: 1,
								scaleY: 1,
								opacity: 1,
							}}
							exit={{
								opacity: 0,
								scale: 0.84,
							}}
							transition={layoutTransition}
							className="pointer-events-auto absolute box-border origin-top-left"
							style={inventoryItemSlotStyle(slot, slots.length, visualMotion)}
							onAnimationComplete={() => {
								if (!visualMotion) return;
								visualMotions.settle(stackMotionKey, visualMotion.nonce);
								visualMotions.settle(slotMotionKey, visualMotion.nonce);
							}}
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
			</AnimatePresence>
		</div>
	),
);
