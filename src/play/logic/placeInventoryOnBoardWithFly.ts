import { inventorySourceId } from "~/inventory/inventorySourceId";
import type { Feedback } from "~/play/hook/usePlayDraggableControl";
import { visualBoardItemKey, type useVisualItemMotions } from "~/play/hook/useVisualItemMotions";
import type { BoardView } from "~/board/view/BoardViewSchema";
import type { InventoryPlaceResult } from "~/inventory/view/InventoryPlaceResultSchema";
import type { InventorySlot } from "~/inventory/view/InventorySlotSchema";
import { queryPaddingBoxRect } from "~/shared/util/queryPaddingBoxRect";
import type { Command } from "~/command/Command";
import type { CommandResult } from "~/command/CommandResult";

export namespace placeInventoryOnBoardWithFly {
	export interface Props {
		board: BoardView | undefined;
		slot: InventorySlot;
		visualMotions: Pick<useVisualItemMotions.State, "stage">;
		run(command: { type: "inventory.place"; slotIndex: number; x: number; y: number }): Promise<
			CommandResult<
				Extract<
					Command,
					{
						type: "inventory.place";
					}
				>
			>
		>;
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
		const { inventoryPlace } = result;

		if (from && to) {
			visualMotions.stage([
				{
					key: visualBoardItemKey(inventoryPlace.boardItemId),
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
