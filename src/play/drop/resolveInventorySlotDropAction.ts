import type { InventoryView } from "~/inventory/view/InventoryViewSchema";
import type { DragSource } from "~/play/drag/DragSource";
import type { DropTarget } from "~/play/drag/DropTarget";

export type InventorySlotDropAction =
	| {
			type: "ignore";
	  }
	| {
			type: "reject";
	  }
	| {
			type: "swap-inventory-slots";
			animation: "parallel-swap";
			input: {
				expectedSourceItemId: string;
				expectedSourceStackId: string;
				expectedTargetItemId?: string;
				expectedTargetStackId?: string;
				sourceSlotIndex: number;
				targetSlotIndex: number;
			};
	  };

export namespace resolveInventorySlotDropAction {
	export interface Props {
		inventory: InventoryView;
		source: Extract<
			DragSource,
			{
				kind: "inventory";
			}
		>;
		target: Extract<
			DropTarget,
			{
				kind: "inventory-slot";
			}
		>;
	}
}

export const resolveInventorySlotDropAction = ({
	inventory,
	source,
	target,
}: resolveInventorySlotDropAction.Props): InventorySlotDropAction => {
	if (source.slotIndex === target.slotIndex) {
		return {
			type: "ignore",
		};
	}

	const sourceStack = inventory.bySlotIndex[String(source.slotIndex)]?.stack;
	if (
		!sourceStack ||
		sourceStack.id !== source.slot.stack?.id ||
		sourceStack.itemId !== source.itemId
	) {
		return {
			type: "reject",
		};
	}

	const targetStack = inventory.bySlotIndex[String(target.slotIndex)]?.stack;

	return {
		type: "swap-inventory-slots",
		animation: "parallel-swap",
		input: {
			expectedSourceItemId: sourceStack.itemId,
			expectedSourceStackId: sourceStack.id,
			expectedTargetItemId: targetStack?.itemId,
			expectedTargetStackId: targetStack?.id,
			sourceSlotIndex: source.slotIndex,
			targetSlotIndex: target.slotIndex,
		},
	};
};
