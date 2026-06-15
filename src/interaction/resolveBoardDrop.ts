import { cellKey } from "~/board/util/cell";
import { visualBoardItemKey } from "~/play/hook/useVisualItemMotions";
import type { DropPlan } from "~/drag/DropPlan";
import type { ItemId } from "~/manifest/manifestId";
import { resolveDropIntent } from "~/merge/resolveDropIntent";
import type { VisualTransitionKind, VisualMeta } from "~/play/types";
import { accept } from "./accept";
import { reject } from "./reject";
import type { Runtime, TypedDropContext } from "./types";

export namespace resolveBoardDrop {
	export interface Props {
		context: TypedDropContext<"board", "cell">;
		runtime: Runtime;
	}
}

const consumeSourceAnimation = (props: {
	itemId: string;
	boardItemId: string;
	targetNodeId: string;
}) => ({
	itemId: props.itemId,
	actorKey: visualBoardItemKey(props.boardItemId),
	fromDrag: true,
	toNodeId: props.targetNodeId,
	kind: "consume" as const,
});

export const resolveBoardDrop = ({
	context: { source, target },
	runtime,
}: resolveBoardDrop.Props): DropPlan<string, VisualTransitionKind, VisualMeta> => {
	if (target.target.boardItemId === source.source.boardItemId)
		return {
			type: "ignore",
		};

	if (!target.target.boardItemId) {
		return accept({
			animations: [
				{
					itemId: source.itemId,
					actorKey: visualBoardItemKey(source.source.boardItemId),
					fromDrag: true,
					toNodeId: target.targetNodeId,
					kind: "move",
				},
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
			animations: [
				{
					itemId: source.itemId,
					actorKey: visualBoardItemKey(source.source.boardItemId),
					fromDrag: true,
					toNodeId: target.targetNodeId,
					kind: "move",
				},
				{
					itemId: targetItem.itemId,
					actorKey: visualBoardItemKey(targetBoardItemId),
					fromNodeId: target.targetNodeId,
					toNodeId: source.sourceNodeId,
					kind: "move",
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

	return accept({
		animationTiming: "beforeCommit",
		animations: [
			consumeSourceAnimation({
				itemId: source.itemId,
				boardItemId: source.source.boardItemId,
				targetNodeId: target.targetNodeId,
			}),
		],
		commit: () =>
			runtime.run({
				type: "board.merge",
				sourceBoardItemId: source.source.boardItemId,
				targetBoardItemId,
			}),
		feedback: () => runtime.feedback.pulseMergeCell(cellKey(target.target.x, target.target.y)),
	});
};
