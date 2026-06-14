import { boardContainerNodeId, boardSourceId } from "~/board/boardIdentity";
import { cellKey } from "~/board/util/cell";
import type { GameCommand } from "~/game/action/GameCommand";
import { resolveBoardItemDropIntent } from "~/game/merge/resolveBoardItemDropIntent";
import {
	inventoryContainerNodeId,
	inventorySlotNodeId,
	inventorySourceId,
} from "~/inventory/inventoryIdentity";
import type { ItemId } from "~/manifest/manifestId";
import type { GameDragView } from "~/play/logic/playTypes";
import type { FlyerKind, GameDragSource, GameDropTarget, GameVisualMeta } from "~/play/types";
import type {
	DraggableAnimation,
	DraggablePayload,
	DroppablePayload,
	DropContext,
	DropPlan,
} from "~/drag/hook/useDraggableControl";

export interface GameDragFeedback {
	pulseMergeCell(key: string | undefined): void;
	pulseImprintCell(key: string | undefined): void;
	flashBoardCell(key: string | undefined, tone: "error"): void;
	flashInventorySlot(slotIndex: number | undefined, tone: "error"): void;
	showError(error: unknown): void;
}

export namespace resolveGameDrop {
	export interface Props {
		context: DropContext<string, GameDragSource, GameDropTarget, GameVisualMeta>;
		game: GameDragView | undefined;
		feedback: GameDragFeedback;
		runCommand(command: GameCommand): Promise<unknown>;
	}
}

export const resolveGameDrop = ({
	context,
	game,
	feedback,
	runCommand,
}: resolveGameDrop.Props): DropPlan<string, FlyerKind, GameVisualMeta> => {
	if (!game || !context.target)
		return reject(() =>
			flashGameDrop({
				context,
				game,
				feedback,
			}),
		);

	const source = context.source.source;
	const target = context.target.target;
	const route = `${source.kind}->${target.kind}`;

	switch (route) {
		case "inventory->inventory-slot":
			return inventoryToInventory({
				context: context as GameDropContext<"inventory", "inventory-slot">,
				game,
				runCommand,
			});
		case "board->cell":
			return boardToCell({
				context: context as GameDropContext<"board", "cell">,
				game,
				feedback,
				runCommand,
			});
		default:
			return reject(() =>
				flashGameDrop({
					context,
					game,
					feedback,
				}),
			);
	}
};

export namespace flashGameDrop {
	export interface Props {
		context: DropContext<string, GameDragSource, GameDropTarget, GameVisualMeta>;
		game: GameDragView | undefined;
		feedback: GameDragFeedback;
	}
}

export const flashGameDrop = ({ context, game, feedback }: flashGameDrop.Props) => {
	flashSource({
		source: context.source.source,
		game,
		feedback,
	});

	const target = context.target?.target;
	if (!target) return;
	if (target.kind === "cell") feedback.flashBoardCell(cellKey(target.x, target.y), "error");
	if (target.kind === "inventory-slot") feedback.flashInventorySlot(target.slotIndex, "error");
};

export namespace getGameDragBoundaryNodeId {
	export interface Props {
		source: DraggablePayload<string, GameDragSource, GameVisualMeta>;
	}
}

export const getGameDragBoundaryNodeId = ({ source }: getGameDragBoundaryNodeId.Props) =>
	source.source.kind === "board" ? boardContainerNodeId : inventoryContainerNodeId;

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

namespace inventoryToInventory {
	export interface Props {
		context: GameDropContext<"inventory", "inventory-slot">;
		game: GameDragView;
		runCommand(command: GameCommand): Promise<unknown>;
	}
}

const inventoryToInventory = ({
	context,
	game,
	runCommand,
}: inventoryToInventory.Props): DropPlan<string, FlyerKind, GameVisualMeta> => {
	const { source, target } = context;
	if (source.source.slotIndex === target.target.slotIndex)
		return {
			type: "ignore",
		};

	const targetStack = game.inventoryBySlotIndex[target.target.slotIndex]?.stack;
	const animations = inventoryMoveAnimations({
		context,
		targetStack,
	});
	const hide = [
		source.sourceId,
		...(targetStack
			? [
					inventorySourceId(target.target.slotIndex),
				]
			: []),
	];

	return accept({
		hide,
		animations,
		commit: () =>
			runCommand({
				type: "inventory.swap",
				sourceSlotIndex: source.source.slotIndex,
				targetSlotIndex: target.target.slotIndex,
			}),
	});
};

namespace boardToCell {
	export interface Props {
		context: GameDropContext<"board", "cell">;
		game: GameDragView;
		feedback: GameDragFeedback;
		runCommand(command: GameCommand): Promise<unknown>;
	}
}

const boardToCell = ({
	context: { source, target },
	game,
	feedback,
	runCommand,
}: boardToCell.Props): DropPlan<string, FlyerKind, GameVisualMeta> => {
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
				dragToTargetAnimation({
					source,
					target,
				}),
			],
			commit: () =>
				runCommand({
					type: "board.move",
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

	const intent = resolveBoardItemDropIntent({
		sourceItemId: source.itemId as ItemId,
		targetItem,
	});

	if (intent.type === "reject") {
		return reject(() =>
			feedback.flashBoardCell(cellKey(target.target.x, target.target.y), "error"),
		);
	}

	if (intent.type === "swap") {
		return accept({
			hide: [
				source.sourceId,
				boardSourceId(targetBoardItemId),
			],
			animations: [
				dragToTargetAnimation({
					source,
					target,
				}),
				{
					itemId: targetItem.itemId,
					fromNodeId: target.targetNodeId,
					toNodeId: source.sourceNodeId,
					overlay: {
						activation: targetItem.activation ?? undefined,
					},
				},
			],
			commit: () =>
				runCommand({
					type: "board.swap",
					sourceBoardItemId: source.source.boardItemId,
					targetBoardItemId,
				}),
		});
	}

	if (intent.type === "merge" && intent.directed) {
		return accept({
			hide: [
				source.sourceId,
			],
			animationTiming: "afterCommit",
			animations: [
				{
					itemId: source.itemId,
					fromNodeId: source.sourceNodeId,
					toNodeId: source.sourceNodeId,
					kind: "imprint-source",
					overlay: source.overlay,
				},
			],
			commit: () =>
				runCommand({
					type: "board.merge",
					sourceBoardItemId: source.source.boardItemId,
					targetBoardItemId,
				}),
			feedback: () => feedback.pulseImprintCell(cellKey(target.target.x, target.target.y)),
		});
	}

	const mergeCrossFadeMeta =
		intent.type === "merge" && intent.resultItemId
			? {
					crossFadeItemId: intent.resultItemId,
				}
			: undefined;

	return accept({
		hide: [
			source.sourceId,
		],
		animationTiming: "beforeCommit",
		animations: [
			dragToTargetAnimation({
				source,
				target,
				kind: "merge-source",
				overlay: mergeCrossFadeMeta,
			}),
			{
				itemId: targetItem.itemId,
				fromNodeId: target.targetNodeId,
				toNodeId: target.targetNodeId,
				kind: "merge-target",
				overlay: {
					activation: targetItem.activation ?? undefined,
					...mergeCrossFadeMeta,
				},
			},
		],
		commit: () =>
			runCommand({
				type: "board.merge",
				sourceBoardItemId: source.source.boardItemId,
				targetBoardItemId,
			}),
		feedback: () => feedback.pulseMergeCell(cellKey(target.target.x, target.target.y)),
	});
};

namespace inventoryMoveAnimations {
	export interface Props {
		context: GameDropContext<"inventory", "inventory-slot">;
		targetStack:
			| {
					itemId: string;
					quantity: number;
			  }
			| undefined;
	}
}

const inventoryMoveAnimations = ({
	context,
	targetStack,
}: inventoryMoveAnimations.Props): DraggableAnimation<string, FlyerKind, GameVisualMeta>[] => {
	const { source, target } = context;
	const animations: DraggableAnimation<string, FlyerKind, GameVisualMeta>[] = [
		dragToTargetAnimation({
			source,
			target,
		}),
	];

	if (targetStack) {
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
};

namespace dragToTargetAnimation {
	export interface Props {
		source: DraggablePayload<string, GameDragSource, GameVisualMeta>;
		target: DroppablePayload<GameDropTarget>;
		kind?: FlyerKind;
		overlay?: GameVisualMeta;
	}
}

const dragToTargetAnimation = ({
	source,
	target,
	kind = "move",
	overlay,
}: dragToTargetAnimation.Props): DraggableAnimation<string, FlyerKind, GameVisualMeta> => ({
	itemId: source.itemId,
	fromDrag: true,
	toNodeId: target.targetNodeId,
	kind,
	overlay: {
		...source.overlay,
		...overlay,
	},
});

type AcceptPlan = Omit<
	Extract<
		DropPlan<string, FlyerKind, GameVisualMeta>,
		{
			type: "accept";
		}
	>,
	"type"
>;

const accept = (plan: AcceptPlan): DropPlan<string, FlyerKind, GameVisualMeta> => ({
	type: "accept",
	animationTiming: "afterCommit",
	...plan,
	hide: (plan.hide ?? []).filter(Boolean),
});

const reject = (feedback?: () => void): DropPlan<string, FlyerKind, GameVisualMeta> => ({
	type: "reject",
	feedback,
});

namespace flashSource {
	export interface Props {
		source: GameDragSource;
		game: GameDragView | undefined;
		feedback: GameDragFeedback;
	}
}

const flashSource = ({ source, game, feedback }: flashSource.Props) => {
	if (source.kind === "inventory") {
		feedback.flashInventorySlot(source.slotIndex, "error");
		return;
	}

	const boardItem = game?.boardItemsById[source.boardItemId];
	feedback.flashBoardCell(boardItem ? cellKey(boardItem.x, boardItem.y) : undefined, "error");
};
