import { boardSourceId } from "~/board/boardSourceId";
import { cellKey } from "~/board/util/cell";
import { inventorySinkRect } from "~/inventory/util/inventory";
import type { Feedback } from "~/play/hook/usePlayDraggableControl";
import type { BoardViewItem } from "~/play/logic/playTypes";
import type { FlyerKind, RectLike, VisualMeta } from "~/play/types";
import { queryRect } from "~/shared/util/queryRect";
import { waitForPaint } from "~/shared/util/waitForPaint";
import { pulseBottomNav } from "../hook/pulseBottomNav";

export namespace stashBoardWithFly {
	export interface Props {
		boardItem: BoardViewItem;
		addFlyer(
			itemId: string,
			from: RectLike,
			to: RectLike,
			kind?: FlyerKind,
			meta?: VisualMeta,
		): Promise<void>;
		run(command: { type: "inventory.stash"; boardItemId: string }): Promise<unknown>;
		feedback: Feedback;
		hideSources(ids: readonly string[]): void;
		clearHiddenSources(): void;
		invalidatePlayData(
			targets: readonly ("board" | "inventory" | "databaseStatus")[],
		): Promise<void>;
	}
}

export const stashBoardWithFly = async ({
	boardItem,
	addFlyer,
	run,
	feedback,
	hideSources,
	clearHiddenSources,
	invalidatePlayData,
}: stashBoardWithFly.Props) => {
	const sourceId = boardSourceId(boardItem.id);
	const from =
		queryRect(`[data-board-item-id="${boardItem.id}"]`) ??
		queryRect(`[data-board-cell="${boardItem.x}:${boardItem.y}"]`);

	try {
		if (from) {
			hideSources([
				sourceId,
			]);
			await waitForPaint();
		}

		await run({
			type: "inventory.stash",
			boardItemId: boardItem.id,
		});

		if (from) {
			await addFlyer(
				boardItem.itemId,
				from,
				inventorySinkRect(from, queryRect('[data-bottom-nav-sheet="inventory"]')),
				"stash",
			);
		}

		await invalidatePlayData([
			"board",
			"inventory",
			"databaseStatus",
		]);
		pulseBottomNav("inventory");
	} catch (error) {
		feedback.flashBoardCell(cellKey(boardItem.x, boardItem.y), "error");
		feedback.showError(error);
	} finally {
		clearHiddenSources();
	}
};
