import { match } from "ts-pattern";
import { cellKey } from "~/board/cellKey";
import type { BoardView } from "~/board/view/BoardViewSchema";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import { isItemStorageAllowed } from "~/config/isItemStorageAllowed";
import type { InventoryView } from "~/inventory/view/InventoryViewSchema";
import { readExpectedInventorySlotStack } from "~/inventory/view/readExpectedInventorySlotStack";
import type { ExpectedInventorySlotStack } from "~/inventory/view/readExpectedInventorySlotStack";
import { resolveItemToBoardItemInteractionPlan } from "~/play/interaction/resolveItemToBoardItemInteractionPlan";
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

export namespace resolveInventoryCellDropAction {
	export interface Props {
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
}

type InventoryItemToBoardItemDropInput = Extract<
	InventoryCellDropAction,
	{
		type: "apply-inventory-item-to-board-item";
	}
>["input"];

type SourceInventorySlotWithStack = {
	readonly slotIndex: number;
	readonly stack: ExpectedInventorySlotStack;
};

const createBoardCellRejectDropAction = (targetCellKey: string): InventoryCellDropAction => ({
	feedback: {
		kind: "board-cell",
		cellKey: targetCellKey,
	},
	type: "reject",
});

const createInventorySlotRejectDropAction = (slotIndex: number): InventoryCellDropAction => ({
	feedback: {
		kind: "inventory-slot",
		slotIndex,
	},
	type: "reject",
});

const readCurrentSourceInventorySlotWithStack = ({
	inventory,
	source,
}: {
	inventory: InventoryView;
	source: Extract<
		DragSource,
		{
			kind: "inventory";
		}
	>;
}): SourceInventorySlotWithStack | undefined => {
	const stack = readExpectedInventorySlotStack({
		expectedItemId: source.itemId,
		expectedStackId: source.slot.stack?.id ?? "",
		inventory,
		slotIndex: source.slotIndex,
	});
	if (!stack) return undefined;

	return {
		slotIndex: source.slotIndex,
		stack,
	};
};

const createInventoryItemToBoardItemDropInput = ({
	source,
	sourceSlot,
	targetItem,
}: {
	source: Extract<
		DragSource,
		{
			kind: "inventory";
		}
	>;
	sourceSlot: SourceInventorySlotWithStack;
	targetItem: BoardViewItem;
}): InventoryItemToBoardItemDropInput => ({
	expectedSourceItemId: sourceSlot.stack.itemId,
	expectedSourceStackId: sourceSlot.stack.id,
	expectedTargetItemId: targetItem.itemId,
	sourceSlotIndex: source.slotIndex,
	targetBoardItemId: targetItem.id,
});

const resolveInventoryItemToOccupiedBoardCellDropAction = ({
	config,
	input,
	sourceSlot,
	targetCellKey,
	targetItem,
}: {
	config: GameConfig;
	input: InventoryItemToBoardItemDropInput;
	sourceSlot: SourceInventorySlotWithStack;
	targetCellKey: string;
	targetItem: BoardViewItem;
}): InventoryCellDropAction => {
	const plan = resolveItemToBoardItemInteractionPlan({
		config,
		sourceItemId: sourceSlot.stack.itemId,
		targetItem,
	});

	return match(plan)
		.with(
			{
				type: "reject",
			},
			{
				type: "swap",
			},
			() => createBoardCellRejectDropAction(targetCellKey),
		)
		.with(
			{
				type: "merge",
			},
			{
				type: "producer-input",
			},
			() => ({
				input,
				type: "apply-inventory-item-to-board-item" as const,
			}),
		)
		.with(
			{
				type: "craft-input",
			},
			{
				type: "stash-input",
			},
			{
				type: "tile-remove",
			},
			(matchedPlan) => ({
				feedback: {
					cellKey: targetCellKey,
					variant: matchedPlan.feedbackVariant,
				},
				input,
				type: "apply-inventory-item-to-board-item" as const,
			}),
		)
		.exhaustive();
};

const resolveInventoryItemToEmptyBoardCellDropAction = ({
	config,
	source,
	sourceSlot,
	target,
	targetCellKey,
}: {
	config: GameConfig;
	source: Extract<
		DragSource,
		{
			kind: "inventory";
		}
	>;
	sourceSlot: SourceInventorySlotWithStack;
	target: Extract<
		DropTarget,
		{
			kind: "cell";
		}
	>;
	targetCellKey: string;
}): InventoryCellDropAction => {
	if (
		!isItemStorageAllowed({
			config,
			itemId: sourceSlot.stack.itemId,
			location: "board",
		})
	) {
		return createBoardCellRejectDropAction(targetCellKey);
	}

	return {
		input: {
			expectedItemId: sourceSlot.stack.itemId,
			expectedStackId: sourceSlot.stack.id,
			slotIndex: source.slotIndex,
			x: target.x,
			y: target.y,
		},
		type: "place-inventory-item",
	};
};

export const resolveInventoryCellDropAction = ({
	board,
	config,
	inventory,
	source,
	target,
}: resolveInventoryCellDropAction.Props): InventoryCellDropAction => {
	const targetCellKey = cellKey(target.x, target.y);
	const sourceSlot = readCurrentSourceInventorySlotWithStack({
		inventory,
		source,
	});
	if (!sourceSlot) return createInventorySlotRejectDropAction(source.slotIndex);

	const targetItem = board.byCellKey[targetCellKey];
	if (!targetItem) {
		return resolveInventoryItemToEmptyBoardCellDropAction({
			config,
			source,
			sourceSlot,
			target,
			targetCellKey,
		});
	}

	return resolveInventoryItemToOccupiedBoardCellDropAction({
		config,
		input: createInventoryItemToBoardItemDropInput({
			source,
			sourceSlot,
			targetItem,
		}),
		sourceSlot,
		targetCellKey,
		targetItem,
	});
};
