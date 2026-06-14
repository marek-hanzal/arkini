import { boardSourceId } from "~/board/boardSourceId";
import { cellKey } from "~/board/util/cell";
import type { DraggableAnimation } from "~/drag/DraggableAnimation";
import type { DropPlan } from "~/drag/DropPlan";
import type { ItemId } from "~/manifest/manifestId";
import { resolveDropIntent } from "~/merge/resolveDropIntent";
import type { FlyerKind, VisualMeta } from "~/play/types";
import { accept } from "./accept";
import { dragToTargetAnimation } from "./dragToTargetAnimation";
import { reject } from "./reject";
import type { Runtime, TypedDropContext } from "./types";

export namespace resolveBoardDrop {
	export interface Props {
		context: TypedDropContext<"board", "cell">;
		runtime: Runtime;
	}
}

export const resolveBoardDrop = ({
	context: { source, target },
	runtime,
}: resolveBoardDrop.Props): DropPlan<string, FlyerKind, VisualMeta> => {
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
				runtime.run({
					type: "board.move",
					boardItemId: source.source.boardItemId,
					x: target.target.x,
					y: target.target.y,
				}),
		});
	}

	const targetBoardItemId = target.target.boardItemId;
	const targetItem = runtime.game.boardItemsById[targetBoardItemId];
	if (!targetItem) {
		return reject(() =>
			runtime.feedback.flashBoardCell(cellKey(target.target.x, target.target.y), "error"),
		);
	}

	const intent = resolveDropIntent({
		sourceItemId: source.itemId as ItemId,
		targetItem,
	});

	if (intent.type === "reject") {
		return reject(() =>
			runtime.feedback.flashBoardCell(cellKey(target.target.x, target.target.y), "error"),
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
				runtime.run({
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
				runtime.run({
					type: "board.merge",
					sourceBoardItemId: source.source.boardItemId,
					targetBoardItemId,
				}),
			feedback: () =>
				runtime.feedback.pulseImprintCell(cellKey(target.target.x, target.target.y)),
		});
	}

	if (intent.type === "merge" && intent.resultItemId && source.itemId === targetItem.itemId) {
		return accept({
			hide: [
				source.sourceId,
				boardSourceId(targetBoardItemId),
			],
			animationTiming: "beforeCommit",
			animations: [
				{
					itemId: source.itemId,
					fromDrag: true,
					toDrag: true,
					kind: "fade-out",
					overlay: source.overlay,
				},
				{
					itemId: targetItem.itemId,
					fromNodeId: target.targetNodeId,
					toNodeId: target.targetNodeId,
					kind: "merge-crossfade",
					overlay: {
						activation: targetItem.activation ?? undefined,
						crossFadeItemId: intent.resultItemId,
					},
				},
			],
			commit: () =>
				runtime.run({
					type: "board.merge",
					sourceBoardItemId: source.source.boardItemId,
					targetBoardItemId,
				}),
		});
	}

	const consumeAnimation: DraggableAnimation<string, FlyerKind, VisualMeta> = {
		itemId: source.itemId,
		fromDrag: true,
		toDrag: true,
		kind: "consume",
		overlay: source.overlay,
	};

	return accept({
		hide: [
			source.sourceId,
		],
		animationTiming: "beforeCommit",
		animations: [
			consumeAnimation,
		],
		commit: () =>
			runtime.run({
				type: "board.merge",
				sourceBoardItemId: source.source.boardItemId,
				targetBoardItemId,
			}),
	});
};
