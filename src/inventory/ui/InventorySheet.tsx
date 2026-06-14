import { memo, type FC } from "react";
import { inventoryContainerNodeId } from "~/inventory/inventoryContainerNodeId";
import { inventoryColumns } from "~/inventory/inventoryColumns";
import { InventoryCell } from "~/inventory/ui/InventoryCell";
import { InventoryItemLayer } from "~/inventory/ui/InventoryItemLayer";
import { usePlayInventory } from "~/play/hook/usePlayInventory";
import { usePlayItems } from "~/play/hook/usePlayItems";
import type { useVisualItemMotions } from "~/play/hook/useVisualItemMotions";
import type { InventorySlot } from "~/play/logic/playTypes";
import { SheetHeader } from "~/shared/ui/SheetHeader";

const inventoryGridStyle = {
	gridTemplateColumns: `repeat(${inventoryColumns}, minmax(0, 1fr))`,
};

export namespace InventorySheet {
	export interface Props {
		isSourceHidden(sourceId: string): boolean;
		invalidInventorySlot?: number;
		onClose(): void;
		onSlotDoubleActivate(slot: InventorySlot): void;
		visualMotions: useVisualItemMotions.State;
	}
}

export const InventorySheet: FC<InventorySheet.Props> = memo(
	({ isSourceHidden, invalidInventorySlot, onClose, onSlotDoubleActivate, visualMotions }) => {
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
						className="ak-game-width relative mx-auto grid gap-0 overflow-hidden border-l border-t border-slate-800"
						style={inventoryGridStyle}
					>
						{slots.map((slot) => (
							<InventoryCell
								key={slot.slotIndex}
								slot={slot}
								invalid={invalidInventorySlot === slot.slotIndex}
							/>
						))}
						<InventoryItemLayer
							slots={slots}
							items={items}
							isSourceHidden={isSourceHidden}
							visualMotions={visualMotions}
							onSlotDoubleActivate={onSlotDoubleActivate}
						/>
					</div>
				</div>
			</div>
		);
	},
);
