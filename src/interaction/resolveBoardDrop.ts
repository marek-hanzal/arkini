import { cellKey } from "~/board/util/cell";
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

export const resolveBoardDrop = ({
	context: { source, target },
	runtime,
}: resolveBoardDrop.Props): DropPlan<ItemId, VisualTransitionKind, VisualMeta> => {
	if (target.target.boardItemId === source.source.boardItemId)
		return {
			type: "ignore",
		};

	if (!target.target.boardItemId) {
		return accept({
			hide: [
				source.sourceId,
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
		sourceItemId: source.itemId,
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
			],
			commit: () =>
				runtime.run({
					type: "board.swap",
					sourceBoardItemId: source.source.boardItemId,
					targetBoardItemId,
				}),
		});
	}

	return accept({
		hide: [
			source.sourceId,
		],
		commit: () =>
			runtime.run({
				type: "board.merge",
				sourceBoardItemId: source.source.boardItemId,
				targetBoardItemId,
			}),
		feedback: () =>
			intent.type === "merge" && intent.directed
				? runtime.feedback.pulseImprintCell(cellKey(target.target.x, target.target.y))
				: runtime.feedback.pulseMergeCell(cellKey(target.target.x, target.target.y)),
	});
};
