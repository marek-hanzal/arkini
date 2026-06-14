import { useCallback } from "react";
import { boardSourceId } from "~/board/boardSourceId";
import { cellKey } from "~/board/util/cell";
import { inventorySourceId } from "~/inventory/inventorySourceId";
import { inventorySinkRect } from "~/inventory/util/inventory";
import type { Feedback } from "~/play/hook/usePlayDraggableControl";
import { useCommand } from "~/play/hook/useCommand";
import { usePlayBoard } from "~/play/hook/usePlayBoard";
import { usePlayDataInvalidation } from "~/play/hook/usePlayDataInvalidation";
import type { BoardViewItem, InventorySlot } from "~/play/logic/playTypes";
import type { FlyerKind, VisualMeta, RectLike } from "~/play/types";
import { queryRect } from "~/shared/util/queryRect";
import { waitForPaint } from "~/shared/util/waitForPaint";
import { pulseBottomNav } from "./pulseBottomNav";

export namespace usePlayManualItemActions {
	export interface Props {
		addFlyer(
			itemId: string,
			from: RectLike,
			to: RectLike,
			kind?: FlyerKind,
			meta?: VisualMeta,
		): Promise<void>;
		feedback: Feedback;
		schedule(label: string, operation: () => Promise<void>): Promise<void>;
		hideSources(ids: readonly string[]): void;
		clearHiddenSources(): void;
	}
}

export function usePlayManualItemActions({
	addFlyer,
	feedback,
	schedule,
	hideSources,
	clearHiddenSources,
}: usePlayManualItemActions.Props) {
	const board = usePlayBoard().data;
	const invalidatePlayData = usePlayDataInvalidation();
	const command = useCommand({
		invalidateOnSuccess: false,
	});

	const stashBoardWithFly = useCallback(
		async (boardItem: BoardViewItem) => {
			await schedule("stash board item", async () => {
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

					await command.mutateAsync({
						type: "inventory.stash",
						boardItemId: boardItem.id,
					});

					if (from) {
						await addFlyer(
							boardItem.itemId,
							from,
							inventorySinkRect(
								from,
								queryRect('[data-bottom-nav-sheet="inventory"]'),
							),
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
			});
		},
		[
			addFlyer,
			clearHiddenSources,
			feedback,
			hideSources,
			invalidatePlayData,
			schedule,
			command,
		],
	);

	const placeInventoryOnBoardWithFly = useCallback(
		async (slot: InventorySlot) => {
			await schedule("place inventory item", async () => {
				const stack = slot.stack;
				const target = board?.firstEmptyCell ?? null;

				if (!stack || !target) {
					feedback.flashInventorySlot(slot.slotIndex, "error");
					return;
				}

				const sourceId = inventorySourceId(slot.slotIndex);
				const from = queryRect(`[data-inventory-slot="${slot.slotIndex}"]`);
				const to = queryRect(`[data-board-cell="${target.x}:${target.y}"]`);

				try {
					if (from && to && stack.quantity <= 1) {
						hideSources([
							sourceId,
						]);
						await waitForPaint();
					}

					await command.mutateAsync({
						type: "inventory.place",
						slotIndex: slot.slotIndex,
						x: target.x,
						y: target.y,
					});

					if (from && to)
						await addFlyer(stack.itemId, from, to, "place", {
							quantity: stack.quantity,
						});

					await invalidatePlayData([
						"board",
						"inventory",
						"databaseStatus",
					]);
				} catch (error) {
					feedback.flashInventorySlot(slot.slotIndex, "error");
					feedback.showError(error);
				} finally {
					clearHiddenSources();
				}
			});
		},
		[
			addFlyer,
			clearHiddenSources,
			feedback,
			board,
			hideSources,
			invalidatePlayData,
			command,
			schedule,
		],
	);

	return {
		stashBoardWithFly,
		placeInventoryOnBoardWithFly,
	};
}
