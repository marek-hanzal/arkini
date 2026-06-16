import { cellKey } from "~/v0/board/cellKey";
import type { InventoryView } from "~/v0/inventory/view/InventoryViewSchema";
import type { DragSource } from "~/v0/play/drag/DragSource";
import type { DropTarget } from "~/v0/play/drag/DropTarget";

export type InventoryCellDropAction =
	| {
			type: "reject";
			feedback:
				| {
						kind: "board-cell";
						cellKey: string;
				  }
				| {
						kind: "inventory-slot";
						slotIndex: number;
				  };
	  }
	| {
			type: "place-inventory-item";
			input: {
				slotIndex: number;
				x: number;
				y: number;
			};
	  };

export namespace resolveInventoryCellDropAction {
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
				kind: "cell";
			}
		>;
		inventory: InventoryView;
	}
}

export const resolveInventoryCellDropAction = ({
	inventory,
	source,
	target,
}: resolveInventoryCellDropAction.Props): InventoryCellDropAction => {
	if (target.boardItemId) {
		return {
			type: "reject",
			feedback: {
				kind: "board-cell",
				cellKey: cellKey(target.x, target.y),
			},
		};
	}

	const sourceSlot = inventory.bySlotIndex[String(source.slotIndex)];
	if (!sourceSlot?.stack) {
		return {
			type: "reject",
			feedback: {
				kind: "inventory-slot",
				slotIndex: source.slotIndex,
			},
		};
	}

	return {
		type: "place-inventory-item",
		input: {
			slotIndex: source.slotIndex,
			x: target.x,
			y: target.y,
		},
	};
};
