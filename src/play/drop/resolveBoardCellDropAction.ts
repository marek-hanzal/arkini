import { match } from "ts-pattern";
import { cellKey } from "~/board/cellKey";
import { cheatBoardItemId, isInventoryBoardItemId } from "~/board/BoardUtilityItem";
import type { BoardView } from "~/board/view/BoardViewSchema";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import { resolveItemToBoardItemInteractionPlan } from "~/play/interaction/resolveItemToBoardItemInteractionPlan";
import type { ItemToBoardItemInteractionPlan } from "~/play/interaction/ItemToBoardItemInteractionPlan";
import type { DragSource } from "~/play/drag/DragSource";
import type { DropTarget } from "~/play/drag/DropTarget";
import type { TileEngine } from "~/tile-engine/TileEngine.types";
import type { InventoryView } from "~/inventory/view/InventoryViewSchema";
import { readBoardItemInventoryStorageReadiness } from "~/play/drop/readBoardItemInventoryStorageReadiness";

export type BoardCellDropAction =
	| {
			type: "ignore";
	  }
	| {
			type: "reject";
			feedback: {
				kind: "board-cell";
				cellKey: string;
			};
	  }
	| {
			type: "delete-board-item";
			animation: "remove";
			feedback: {
				kind: "cell-feedback";
				cellKey: string;
				variant: TileEngine.DropFeedbackVariant;
			};
			input: {
				boardItemId: string;
				expectedItemId: string;
			};
	  }
	| {
			type: "move-board-item";
			input: {
				boardItemId: string;
				expectedItemId: string;
				x: number;
				y: number;
			};
	  }
	| {
			type: "swap-board-items";
			animation: "parallel-swap";
			input: {
				expectedSourceItemId: string;
				expectedTargetItemId: string;
				sourceBoardItemId: string;
				targetBoardItemId: string;
			};
	  }
	| {
			type: "merge-board-items";
			animation: "parallel-merge";
			feedback?: {
				kind: "merge-cell";
				cellKey: string;
			};
			input: {
				expectedSourceItemId: string;
				expectedTargetItemId: string;
				sourceBoardItemId: string;
				targetBoardItemId: string;
			};
	  }
	| {
			type: "apply-board-item-to-board-item";
			animation?: "remove";
			feedback?: {
				kind: "cell-feedback";
				cellKey: string;
				variant: TileEngine.DropFeedbackVariant;
			};
			input: {
				expectedSourceItemId: string;
				expectedTargetItemId: string;
				sourceBoardItemId: string;
				targetBoardItemId: string;
			};
	  }
	| {
			type: "store-board-item-in-inventory";
			animation: "remove";
			feedback: {
				kind: "cell-feedback";
				cellKey: string;
				variant: TileEngine.DropFeedbackVariant;
			};
			input: {
				boardItemId: string;
				expectedItemId: string;
			};
	  };

export namespace resolveBoardCellDropAction {
	export interface Props {
		source: Extract<
			DragSource,
			{
				kind: "board";
			}
		>;
		target: Extract<
			DropTarget,
			{
				kind: "cell";
			}
		>;
		board: BoardView;
		config: GameConfig;
		inventory: InventoryView;
	}
}

type BoardItemToBoardItemActionInput = Extract<
	BoardCellDropAction,
	{
		type: "apply-board-item-to-board-item" | "merge-board-items" | "swap-board-items";
	}
>["input"];

const createBoardCellRejectDropAction = (targetCellKey: string): BoardCellDropAction => ({
	feedback: {
		kind: "board-cell",
		cellKey: targetCellKey,
	},
	type: "reject",
});

const createBoardItemToBoardItemActionInput = ({
	source,
	sourceItem,
	targetItem,
}: {
	source: Extract<
		DragSource,
		{
			kind: "board";
		}
	>;
	sourceItem: BoardViewItem;
	targetItem: BoardViewItem;
}): BoardItemToBoardItemActionInput => ({
	expectedSourceItemId: sourceItem.itemId,
	expectedTargetItemId: targetItem.itemId,
	sourceBoardItemId: source.boardItemId,
	targetBoardItemId: targetItem.id,
});

const createMoveBoardItemDropAction = ({
	source,
	sourceItem,
	target,
}: {
	source: Extract<
		DragSource,
		{
			kind: "board";
		}
	>;
	sourceItem: BoardViewItem;
	target: Extract<
		DropTarget,
		{
			kind: "cell";
		}
	>;
}): BoardCellDropAction => ({
	input: {
		boardItemId: source.boardItemId,
		expectedItemId: sourceItem.itemId,
		x: target.x,
		y: target.y,
	},
	type: "move-board-item",
});

const createDeleteBoardItemDropAction = ({
	source,
	sourceItem,
	targetCellKey,
}: {
	source: Extract<
		DragSource,
		{
			kind: "board";
		}
	>;
	sourceItem: BoardViewItem;
	targetCellKey: string;
}): BoardCellDropAction => ({
	animation: "remove",
	feedback: {
		cellKey: targetCellKey,
		kind: "cell-feedback",
		variant: "danger",
	},
	input: {
		boardItemId: source.boardItemId,
		expectedItemId: sourceItem.itemId,
	},
	type: "delete-board-item",
});

const createStoreBoardItemInInventoryDropAction = ({
	source,
	sourceItem,
	targetCellKey,
}: {
	source: Extract<
		DragSource,
		{
			kind: "board";
		}
	>;
	sourceItem: BoardViewItem;
	targetCellKey: string;
}): BoardCellDropAction => ({
	animation: "remove",
	feedback: {
		cellKey: targetCellKey,
		kind: "cell-feedback",
		variant: "primary",
	},
	input: {
		boardItemId: source.boardItemId,
		expectedItemId: sourceItem.itemId,
	},
	type: "store-board-item-in-inventory",
});

const resolveInventoryUtilityBoardCellDropAction = ({
	config,
	inventory,
	source,
	sourceItem,
	targetCellKey,
}: {
	config: GameConfig;
	inventory: InventoryView;
	source: Extract<
		DragSource,
		{
			kind: "board";
		}
	>;
	sourceItem: BoardViewItem;
	targetCellKey: string;
}): BoardCellDropAction => {
	const readiness = readBoardItemInventoryStorageReadiness({
		config,
		inventory,
		sourceItem,
	});

	if (!readiness.canStore) return createBoardCellRejectDropAction(targetCellKey);

	return createStoreBoardItemInInventoryDropAction({
		source,
		sourceItem,
		targetCellKey,
	});
};

const resolveBoardItemInteractionPlanDropAction = ({
	input,
	plan,
	targetCellKey,
}: {
	input: BoardItemToBoardItemActionInput;
	plan: ItemToBoardItemInteractionPlan;
	targetCellKey: string;
}): BoardCellDropAction =>
	match(plan)
		.with(
			{
				type: "reject",
			},
			() => createBoardCellRejectDropAction(targetCellKey),
		)
		.with(
			{
				type: "swap",
			},
			() => ({
				animation: "parallel-swap" as const,
				input,
				type: "swap-board-items" as const,
			}),
		)
		.with(
			{
				type: "merge",
			},
			() => ({
				animation: "parallel-merge" as const,
				feedback: {
					kind: "merge-cell" as const,
					cellKey: targetCellKey,
				},
				input,
				type: "merge-board-items" as const,
			}),
		)
		.with(
			{
				type: "producer-input",
			},
			() => ({
				animation: "remove" as const,
				input,
				type: "apply-board-item-to-board-item" as const,
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
				...(matchedPlan.consumesSource
					? {
							animation: "remove" as const,
						}
					: {}),
				feedback: {
					cellKey: targetCellKey,
					kind: "cell-feedback" as const,
					variant: matchedPlan.feedbackVariant,
				},
				input,
				type: "apply-board-item-to-board-item" as const,
			}),
		)
		.exhaustive();

export const resolveBoardCellDropAction = ({
	board,
	config,
	inventory,
	source,
	target,
}: resolveBoardCellDropAction.Props): BoardCellDropAction => {
	const targetCellKey = cellKey(target.x, target.y);
	const sourceItem = board.byId[source.boardItemId];

	if (!sourceItem || sourceItem.itemId !== source.itemId) {
		return createBoardCellRejectDropAction(targetCellKey);
	}

	const targetItem = board.byCellKey[targetCellKey];
	if (targetItem?.id === source.boardItemId) {
		return {
			type: "ignore",
		};
	}

	if (!targetItem) {
		return createMoveBoardItemDropAction({
			source,
			sourceItem,
			target,
		});
	}

	if (targetItem.itemId === cheatBoardItemId) {
		return createDeleteBoardItemDropAction({
			source,
			sourceItem,
			targetCellKey,
		});
	}

	if (isInventoryBoardItemId(targetItem.itemId)) {
		return resolveInventoryUtilityBoardCellDropAction({
			config,
			inventory,
			source,
			sourceItem,
			targetCellKey,
		});
	}

	return resolveBoardItemInteractionPlanDropAction({
		input: createBoardItemToBoardItemActionInput({
			source,
			sourceItem,
			targetItem,
		}),
		plan: resolveItemToBoardItemInteractionPlan({
			config,
			sourceItemId: sourceItem.itemId,
			targetItem,
		}),
		targetCellKey,
	});
};
