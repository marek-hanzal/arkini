import type { DragSource } from "~/v0/play/drag/DragSource";
import type { DropTarget } from "~/v0/play/drag/DropTarget";

export type InventorySlotDropAction =
	| {
			type: "ignore";
	  }
	| {
			type: "swap-inventory-slots";
			animation: "parallel-swap";
			input: {
				sourceSlotIndex: number;
				targetSlotIndex: number;
			};
	  };

export namespace resolveInventorySlotDropAction {
	export interface Props {
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
	source,
	target,
}: resolveInventorySlotDropAction.Props): InventorySlotDropAction => {
	if (source.slotIndex === target.slotIndex) {
		return {
			type: "ignore",
		};
	}

	return {
		type: "swap-inventory-slots",
		animation: "parallel-swap",
		input: {
			sourceSlotIndex: source.slotIndex,
			targetSlotIndex: target.slotIndex,
		},
	};
};
