import type { FC } from "react";
import { inventoryContainerNodeId } from "~/inventory/inventoryContainerNodeId";
import { inventoryColumns } from "~/inventory/inventoryColumns";
import { inventorySourceId } from "~/inventory/inventorySourceId";
import { InventoryCell } from "~/inventory/ui/InventoryCell";
import { usePlayInventory } from "~/play/hook/usePlayInventory";
import { usePlayItems } from "~/play/hook/usePlayItems";
import type { InventorySlot } from "~/play/logic/playTypes";
import { SheetHeader } from "~/shared/ui/SheetHeader";

export namespace InventorySheet {
	export interface Props {
		isSourceHidden(sourceId: string): boolean;
		invalidInventorySlot?: number;
		onClose(): void;
		onSlotDoubleActivate(slot: InventorySlot): void;
	}
}

export const InventorySheet: FC<InventorySheet.Props> = ({
	isSourceHidden,
	invalidInventorySlot,
	onClose,
	onSlotDoubleActivate,
}) => {
	const inventory = usePlayInventory().data;
	const items = usePlayItems().data;

	if (!inventory || !items) return null;

	const slots = inventory.slots;
	const filled = slots.filter((slot) => slot.stack).length;

	return (
		<div className="flex max-h-[var(--ak-sheet-max-height)] min-h-0 flex-col">
			<SheetHeader
				eyebrow="Inventory"
				description={`${filled}/${slots.length} slots`}
				anchor="inventory-summary"
				onClose={onClose}
			/>

			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
				<div
					data-drag-boundary-id={inventoryContainerNodeId}
					className="ak-game-width mx-auto grid gap-0 overflow-hidden border-l border-t border-slate-800"
					style={{
						gridTemplateColumns: `repeat(${inventoryColumns}, minmax(0, 1fr))`,
					}}
				>
					{slots.map((slot) => (
						<InventoryCell
							key={slot.slotIndex}
							slot={slot}
							item={slot.stack ? items[slot.stack.itemId] : undefined}
							hidden={isSourceHidden(inventorySourceId(slot.slotIndex))}
							invalid={invalidInventorySlot === slot.slotIndex}
							onDoubleActivate={() => onSlotDoubleActivate(slot)}
						/>
					))}
				</div>
			</div>
		</div>
	);
};
