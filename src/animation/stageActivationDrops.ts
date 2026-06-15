import { inventorySinkRect } from "~/inventory/util/inventory";
import {
	visualBoardItemKey,
	visualInventorySlotKey,
	type useVisualItemMotions,
} from "~/play/hook/useVisualItemMotions";
import type { ActiveSheet } from "~/play/logic/playSheetTypes";
import type { ActivationResultSchema } from "~/activation/type/ActivationResultSchema";
import { queryPaddingBoxRect } from "~/shared/util/queryPaddingBoxRect";
import { placementTargetRect } from "./placementTargetRect";

export namespace stageActivationDrops {
	export interface Props {
		results: readonly ActivationResultSchema.Type[];
		activeSheet?: ActiveSheet;
		visualMotions: Pick<useVisualItemMotions.State, "stage">;
	}
}

/**
 * Stages real post-commit item actors from the activation rect.
 *
 * The command already created final board/inventory rows. This only teaches the
 * soon-to-render actors where their visual journey starts, instead of creating a
 * parallel parallel DOM copy and hoping React commits land in the same frame.
 */
export const stageActivationDrops = ({
	results,
	activeSheet,
	visualMotions,
}: stageActivationDrops.Props) => {
	const entries: useVisualItemMotions.StageEntry[] = [];

	for (const result of results) {
		const sourceRect =
			queryPaddingBoxRect(`[data-board-item-tile-id="${result.activationBoardItemId}"]`) ??
			queryPaddingBoxRect(`[data-board-item-id="${result.activationBoardItemId}"]`);
		if (!sourceRect) continue;

		for (const placement of result.placements) {
			const targetRect = placementTargetRect({
				placement,
				activeSheet,
			});
			const to = targetRect ?? inventorySinkRect(sourceRect);

			if (placement.kind === "board" && placement.boardItemId) {
				entries.push({
					key: visualBoardItemKey(placement.boardItemId),
					from: sourceRect,
					to,
					priority: "raised",
					kind: "place",
				});
				continue;
			}

			if (placement.kind === "inventory" && placement.slotIndex !== undefined) {
				entries.push({
					key: visualInventorySlotKey(placement.slotIndex),
					from: sourceRect,
					to,
					priority: "raised",
					kind: "place",
				});
			}
		}
	}

	visualMotions.stage(entries);
};
