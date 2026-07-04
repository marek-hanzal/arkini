import { readExpectedInventorySlotStack } from "~/inventory/view/readExpectedInventorySlotStack";
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

	const sourceStack = readExpectedInventorySlotStack({
		expectedItemId: source.itemId,
		expectedStackId: source.slot.stack?.id ?? "",
		inventory,
		slotIndex: source.slotIndex,
	});
	if (!sourceStack) {
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
