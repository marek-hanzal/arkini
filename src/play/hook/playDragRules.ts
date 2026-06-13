import { boardContainerNodeId, boardSourceId } from "~/board/boardIdentity";
import { cellKey } from "~/board/util/cell";
import {
	inventoryContainerNodeId,
	inventorySlotNodeId,
	inventorySourceId,
} from "~/inventory/inventoryIdentity";
import type { ItemId } from "~/manifest/data/manifestId";
import { resolveItemMergeRule } from "~/manifest/data/resolveItemMergeRule";
import type { GameDragView } from "~/play/logic/playTypes";
import type { FlyerKind, GameDragSource, GameDropTarget, GameVisualMeta } from "~/play/types";
import type {
	DraggableAnimation,
	DraggablePayload,
	DroppablePayload,
	DropContext,
	DropPlan,
} from "~/drag/hook/useDraggableControl";

export interface GameDragActions {
	moveBoard(input: { boardItemId: string; x: number; y: number }): Promise<unknown>;
	swapInventory(input: { sourceSlotIndex: number; targetSlotIndex: number }): Promise<unknown>;
	mergeBoard(input: { sourceBoardItemId: string; targetBoardItemId: string }): Promise<unknown>;
	swapBoard(input: { sourceBoardItemId: string; targetBoardItemId: string }): Promise<unknown>;
}

export interface GameDragFeedback {
	pulseMergeCell(key: string | undefined): void;
	flashBoardCell(key: string | undefined, tone: "error"): void;
	flashInventorySlot(slotIndex: number | undefined, tone: "error"): void;
	showError(error: unknown): void;
}

export function resolveGameDrop(
	context: DropContext<string, GameDragSource, GameDropTarget, GameVisualMeta>,
	game: GameDragView | undefined,
	actions: GameDragActions,
	feedback: GameDragFeedback,
): DropPlan<string, FlyerKind, GameVisualMeta> {
	if (!game || !context.target) return reject(() => flashGameDrop(context, game, feedback));

	const source = context.source.source;
	const target = context.target.target;
	const route = `${source.kind}->${target.kind}`;

	switch (route) {
		case "inventory->inventory-slot":
			return inventoryToInventory(
				context as GameDropContext<"inventory", "inventory-slot">,
				game,
				actions,
			);
		case "board->cell":
			return boardToCell(
				context as GameDropContext<"board", "cell">,
				game,
				actions,
				feedback,
			);
		default:
			return reject(() => flashGameDrop(context, game, feedback));
	}
}

export function flashGameDrop(
	context: DropContext<string, GameDragSource, GameDropTarget, GameVisualMeta>,
	game: GameDragView | undefined,
	feedback: GameDragFeedback,
) {
	flashSource(context.source.source, game, feedback);

	const target = context.target?.target;
	if (!target) return;
	if (target.kind === "cell") feedback.flashBoardCell(cellKey(target.x, target.y), "error");
	if (target.kind === "inventory-slot") feedback.flashInventorySlot(target.slotIndex, "error");
}

export function getGameDragBoundaryNodeId(
	source: DraggablePayload<string, GameDragSource, GameVisualMeta>,
) {
	return source.source.kind === "board" ? boardContainerNodeId : inventoryContainerNodeId;
}

type SourceKind = GameDragSource["kind"];
type TargetKind = GameDropTarget["kind"];
type GameDropContext<Source extends SourceKind, Target extends TargetKind> = {
	source: DraggablePayload<
		string,
		Extract<
			GameDragSource,
			{
				kind: Source;
			}
		>,
		GameVisualMeta
	>;
	target: DroppablePayload<
		Extract<
			GameDropTarget,
			{
				kind: Target;
			}
		>
	>;
};

function inventoryToInventory(
	context: GameDropContext<"inventory", "inventory-slot">,
	game: GameDragView,
	actions: GameDragActions,
): DropPlan<string, FlyerKind, GameVisualMeta> {
	const { source, target } = context;
	if (source.source.slotIndex === target.target.slotIndex)
		return {
			type: "ignore",
		};

	const targetStack = game.inventoryBySlotIndex[target.target.slotIndex]?.stack;
	const animations = inventoryMoveAnimations(context, targetStack);
	const hide = [
		source.sourceId,
		...(targetStack && targetStack.itemId !== source.itemId
			? [
					inventorySourceId(target.target.slotIndex),
				]
			: []),
	];

	return accept({
		hide,
		animations,
		commit: () =>
			actions.swapInventory({
				sourceSlotIndex: source.source.slotIndex,
				targetSlotIndex: target.target.slotIndex,
			}),
	});
}

function boardToCell(
	{ source, target }: GameDropContext<"board", "cell">,
	game: GameDragView,
	actions: GameDragActions,
	feedback: GameDragFeedback,
): DropPlan<string, FlyerKind, GameVisualMeta> {
	if (target.target.boardItemId === source.source.boardItemId)
		return {
			type: "ignore",
		};

	if (!target.target.boardItemId) {
		return accept({
			hide: [
				source.sourceId,
			],
			animations: [
				dragToTargetAnimation(source, target),
			],
			commit: () =>
				actions.moveBoard({
					boardItemId: source.source.boardItemId,
					x: target.target.x,
					y: target.target.y,
				}),
		});
	}

	const targetBoardItemId = target.target.boardItemId;
	const targetItem = game.boardItemsById[targetBoardItemId];
	if (!targetItem) {
		return reject(() =>
			feedback.flashBoardCell(cellKey(target.target.x, target.target.y), "error"),
		);
	}

	if (!resolveItemMergeRule(source.itemId as ItemId, targetItem.itemId as ItemId)) {
		return accept({
			hide: [
				source.sourceId,
				boardSourceId(targetBoardItemId),
			],
			animations: [
				dragToTargetAnimation(source, target),
				{
					itemId: targetItem.itemId,
					fromNodeId: target.targetNodeId,
					toNodeId: source.sourceNodeId,
					overlay: {
						producer: targetItem.producer ?? undefined,
					},
				},
			],
			commit: () =>
				actions.swapBoard({
					sourceBoardItemId: source.source.boardItemId,
					targetBoardItemId,
				}),
		});
	}

	return accept({
		hide: [
			source.sourceId,
		],
		animationTiming: "beforeCommit",
		animations: [
			dragToTargetAnimation(source, target, "merge-source"),
			{
				itemId: targetItem.itemId,
				fromNodeId: target.targetNodeId,
				toNodeId: target.targetNodeId,
				kind: "merge-target",
				overlay: {
					producer: targetItem.producer ?? undefined,
				},
			},
		],
		commit: () =>
			actions.mergeBoard({
				sourceBoardItemId: source.source.boardItemId,
				targetBoardItemId,
			}),
		feedback: () => feedback.pulseMergeCell(cellKey(target.target.x, target.target.y)),
	});
}

function inventoryMoveAnimations(
	context: GameDropContext<"inventory", "inventory-slot">,
	targetStack:
		| {
				itemId: string;
				quantity: number;
		  }
		| undefined,
): DraggableAnimation<string, FlyerKind, GameVisualMeta>[] {
	const { source, target } = context;
	const animations: DraggableAnimation<string, FlyerKind, GameVisualMeta>[] = [
		dragToTargetAnimation(source, target),
	];

	if (targetStack && targetStack.itemId !== source.itemId) {
		animations.push({
			itemId: targetStack.itemId,
			fromNodeId: target.targetNodeId,
			toNodeId: inventorySlotNodeId(source.source.slotIndex),
			overlay: {
				quantity: targetStack.quantity,
			},
		});
	}

	return animations;
}

function dragToTargetAnimation(
	source: DraggablePayload<string, GameDragSource, GameVisualMeta>,
	target: DroppablePayload<GameDropTarget>,
	kind: FlyerKind = "move",
): DraggableAnimation<string, FlyerKind, GameVisualMeta> {
	return {
		itemId: source.itemId,
		fromDrag: true,
		toNodeId: target.targetNodeId,
		kind,
		overlay: source.overlay,
	};
}

type AcceptPlan = Omit<
	Extract<
		DropPlan<string, FlyerKind, GameVisualMeta>,
		{
			type: "accept";
		}
	>,
	"type"
>;

function accept(plan: AcceptPlan): DropPlan<string, FlyerKind, GameVisualMeta> {
	return {
		type: "accept",
		animationTiming: "afterCommit",
		...plan,
		hide: (plan.hide ?? []).filter(Boolean),
	};
}

function reject(feedback?: () => void): DropPlan<string, FlyerKind, GameVisualMeta> {
	return {
		type: "reject",
		feedback,
	};
}

function flashSource(
	source: GameDragSource,
	game: GameDragView | undefined,
	feedback: GameDragFeedback,
) {
	if (source.kind === "inventory") {
		feedback.flashInventorySlot(source.slotIndex, "error");
		return;
	}

	const boardItem = game?.boardItemsById[source.boardItemId];
	feedback.flashBoardCell(boardItem ? cellKey(boardItem.x, boardItem.y) : undefined, "error");
}
