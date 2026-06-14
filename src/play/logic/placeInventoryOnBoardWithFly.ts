import { inventorySourceId } from "~/inventory/inventorySourceId";
import type { Feedback } from "~/play/hook/usePlayDraggableControl";
import type { BoardView, InventorySlot } from "~/play/logic/playTypes";
import type { FlyerKind, RectLike, VisualMeta } from "~/play/types";
import { queryPaddingBoxRect } from "~/shared/util/queryPaddingBoxRect";
import { waitForPaint } from "~/shared/util/waitForPaint";

export namespace placeInventoryOnBoardWithFly {
	export interface Props {
		board: BoardView | undefined;
		slot: InventorySlot;
		addFlyer(
			itemId: string,
			from: RectLike,
			to: RectLike,
			kind?: FlyerKind,
			meta?: VisualMeta,
		): Promise<void>;
		run(command: {
			type: "inventory.place";
			slotIndex: number;
			x: number;
			y: number;
		}): Promise<unknown>;
		feedback: Feedback;
		hideSources(ids: readonly string[]): void;
		clearHiddenSources(): void;
		invalidatePlayData(
			targets: readonly ("board" | "inventory" | "databaseStatus")[],
		): Promise<void>;
	}
}

export const placeInventoryOnBoardWithFly = async ({
	board,
	slot,
	addFlyer,
	run,
	feedback,
	hideSources,
	clearHiddenSources,
	invalidatePlayData,
}: placeInventoryOnBoardWithFly.Props) => {
	const stack = slot.stack;
	const target = board?.firstEmptyCell ?? null;

	if (!stack || !target) {
		feedback.flashInventorySlot(slot.slotIndex, "error");
		return;
	}

	const sourceId = inventorySourceId(slot.slotIndex);
	const from =
		queryPaddingBoxRect(`[data-inventory-slot-tile="${slot.slotIndex}"]`) ??
		queryPaddingBoxRect(`[data-inventory-slot="${slot.slotIndex}"]`);
	const to = queryPaddingBoxRect(`[data-board-cell="${target.x}:${target.y}"]`);

	try {
		if (from && to && stack.quantity <= 1) {
			hideSources([
				sourceId,
			]);
			await waitForPaint();
		}

		await run({
			type: "inventory.place",
			slotIndex: slot.slotIndex,
			x: target.x,
			y: target.y,
		});

		const flyer =
			from && to
				? addFlyer(stack.itemId, from, to, "place", {
						quantity: stack.quantity,
					})
				: Promise.resolve();
		await waitForPaint();
		const invalidation = invalidatePlayData([
			"board",
			"inventory",
			"databaseStatus",
		]);
		await Promise.all([
			flyer,
			invalidation,
		]);
	} catch (error) {
		feedback.flashInventorySlot(slot.slotIndex, "error");
		feedback.showError(error);
	} finally {
		clearHiddenSources();
	}
};
