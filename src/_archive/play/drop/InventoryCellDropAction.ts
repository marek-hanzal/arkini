import type { BoardView } from "~/board/view/BoardViewSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { InventoryView } from "~/inventory/view/InventoryViewSchema";
import type { ExpectedInventorySlotStack } from "~/inventory/view/readExpectedInventorySlotStack";
import type { DragSource } from "~/play/drag/DragSource";
import type { DropTarget } from "~/play/drag/DropTarget";
import type { TileEngine } from "~/tile-engine/TileEngine.types";

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
			type: "apply-inventory-item-to-board-item";
			feedback?: {
				cellKey: string;
				variant: TileEngine.DropFeedbackVariant;
			};
			input: {
				expectedSourceItemId: string;
				expectedSourceStackId: string;
				expectedTargetItemId: string;
				sourceSlotIndex: number;
				targetBoardItemId: string;
			};
	  }
	| {
			type: "place-inventory-item";
			input: {
				expectedItemId: string;
				expectedStackId: string;
				slotIndex: number;
				x: number;
				y: number;
			};
	  };

export type InventoryItemToBoardItemDropInput = Extract<
	InventoryCellDropAction,
	{
		type: "apply-inventory-item-to-board-item";
	}
>["input"];

export type SourceInventorySlotWithStack = {
	readonly slotIndex: number;
	readonly stack: ExpectedInventorySlotStack;
};

export interface ResolveInventoryCellDropActionProps {
	board: BoardView;
	config: GameConfig;
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
