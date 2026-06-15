import { inventorySourceId } from "~/inventory/inventorySourceId";
import type { Feedback } from "~/play/hook/usePlayDraggableControl";
import { visualBoardItemKey, type useVisualItemMotions } from "~/play/hook/useVisualItemMotions";
import type { BoardView, InventoryPlaceResult, InventorySlot } from "~/play/logic/playTypes";
import { queryPaddingBoxRect } from "~/shared/util/queryPaddingBoxRect";

export namespace placeInventoryOnBoardWithFly {
	export interface Props {
		board: BoardView | undefined;
		slot: InventorySlot;
		visualMotions: Pick<useVisualItemMotions.State, "stage">;
		run(command: {
			type: "inventory.place";
			slotIndex: number;
			x: number;
			y: number;
		}): Promise<InventoryPlaceResult>;
		feedback: Feedback;
		invalidatePlayData(
			targets: readonly ("board" | "inventory" | "databaseStatus")[],
		): Promise<void>;
	}
}

export const placeInventoryOnBoardWithFly = async ({
	board,
	slot,
	visualMotions,
	run,
	feedback,
	invalidatePlayData,
}: placeInventoryOnBoardWithFly.Props) => {
	const stack = slot.stack;
	const target = board?.firstEmptyCell ?? null;

	if (!stack || !target) {
		feedback.flashInventorySlot(slot.slotIndex, "error");
		return;
	}

	const from =
		queryPaddingBoxRect(`[data-inventory-slot-tile="${slot.slotIndex}"]`) ??
		queryPaddingBoxRect(`[data-inventory-slot="${slot.slotIndex}"]`);
	const to = queryPaddingBoxRect(`[data-board-cell="${target.x}:${target.y}"]`);

	try {
		const result = await run({
			type: "inventory.place",
			slotIndex: slot.slotIndex,
			x: target.x,
			y: target.y,
		});

		if (from && to) {
			visualMotions.stage([
				{
					key: visualBoardItemKey(result.boardItemId),
					from,
					to,
					priority: "raised",
					kind: "place",
				},
			]);
		}

		await invalidatePlayData([
			"board",
			"inventory",
			"databaseStatus",
		]);
	} catch (error) {
		feedback.flashInventorySlot(slot.slotIndex, "error");
		feedback.showError(error);
	}
};
