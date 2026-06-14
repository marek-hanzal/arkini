import { AnimatePresence, motion } from "motion/react";
import { memo, type CSSProperties, type FC, useCallback, useRef } from "react";
import { useVisualItemMotionAnimation } from "~/animation/useVisualItemMotionAnimation";
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

const exitTransition = {
	duration: 0.18,
	ease: [
		0.65,
		0,
		0.35,
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
		visualMotions: useVisualItemMotions.State;
		onSlotDoubleActivate(slot: InventorySlot): void;
	}
}

namespace InventoryItemActor {
	export interface Props {
		slot: InventorySlot;
		item: ViewItem;
		slotCount: number;
		stackMotionKey: string;
		slotMotionKey: string;
		visualMotion?: VisualItemMotion;
		settleMotion: useVisualItemMotions.State["settle"];
		hidden: boolean;
		onSlotDoubleActivate(slot: InventorySlot): void;
	}
}

const InventoryItemActor: FC<InventoryItemActor.Props> = memo(
	({
		slot,
		item,
		slotCount,
		stackMotionKey,
		slotMotionKey,
		visualMotion,
		settleMotion,
		hidden,
		onSlotDoubleActivate,
	}) => {
		const ref = useRef<HTMLDivElement | null>(null);
		const settle = useCallback(() => {
			if (!visualMotion) return;
			settleMotion(stackMotionKey, visualMotion.nonce);
			settleMotion(slotMotionKey, visualMotion.nonce);
		}, [
			settleMotion,
			slotMotionKey,
			stackMotionKey,
			visualMotion,
		]);
		useVisualItemMotionAnimation({
			ref,
			motion: visualMotion,
			onSettle: settle,
		});

		return (
			<motion.div
				ref={ref}
				exit={{
					opacity: 0,
					y: 26,
					scale: 0.9,
				}}
				transition={exitTransition}
				className="pointer-events-auto absolute box-border origin-top-left"
				style={inventoryItemSlotStyle(slot, slotCount)}
			>
				<InventoryTile
					slot={slot}
					item={item}
					hidden={hidden}
					onDoubleActivate={onSlotDoubleActivate}
				/>
			</motion.div>
		);
	},
);

/**
 * Renders inventory stack tiles as stable actors above inventory slots.
 *
 * Inventory cells stay as drop targets. Stack DOM nodes stay in this single layer
 * and only staged actors receive explicit movement, so unrelated stacks do not
 * run layout projection when inventory data refreshes.
 */
export const InventoryItemLayer: FC<InventoryItemLayer.Props> = memo(
	({ slots, items, isSourceHidden, visualMotions, onSlotDoubleActivate }) => (
		<div className="pointer-events-none absolute inset-0">
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
						<InventoryItemActor
							key={stack.id}
							slot={slot}
							item={item}
							slotCount={slots.length}
							stackMotionKey={stackMotionKey}
							slotMotionKey={slotMotionKey}
							visualMotion={visualMotion}
							settleMotion={visualMotions.settle}
							hidden={isSourceHidden(inventorySourceId(slot.slotIndex))}
							onSlotDoubleActivate={onSlotDoubleActivate}
						/>
					);
				})}
			</AnimatePresence>
		</div>
	),
);
