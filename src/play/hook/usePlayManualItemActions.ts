import { useCallback } from "react";
import { boardSourceId } from "~/board/boardIdentity";
import { cellKey } from "~/board/util/cell";
import { inventorySourceId } from "~/inventory/inventoryIdentity";
import { inventorySinkRect } from "~/inventory/util/inventory";
import type { GameDragFeedback } from "~/play/hook/usePlayDraggableControl";
import { usePlayAction } from "~/play/hook/usePlayAction";
import { usePlayBoard } from "~/play/hook/usePlayBoard";
import { usePlayItems } from "~/play/hook/usePlayItems";
import { usePlayDataInvalidation } from "~/play/hook/usePlayDataInvalidation";
import type { BoardViewItem, InventorySlot } from "~/play/logic/playTypes";
import type { FlyerKind, GameVisualMeta, RectLike } from "~/play/types";
import { playBottomNavPulse } from "~/play/util/animation";
import { queryElement } from "~/shared/util/queryElement";
import { queryRect } from "~/shared/util/queryRect";
import { waitForPaint } from "~/shared/util/waitForPaint";

export namespace usePlayManualItemActions {
	export interface Props {
		addFlyer(
			itemId: string,
			from: RectLike,
			to: RectLike,
			kind?: FlyerKind,
			meta?: GameVisualMeta,
		): Promise<void>;
		feedback: GameDragFeedback;
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
	const items = usePlayItems().data;
	const invalidatePlayData = usePlayDataInvalidation();
	const placeInventory = usePlayAction(
		(
			db,
			input: {
				slotIndex: number;
				x: number;
				y: number;
			},
		) => db.placeInventoryItem(input.slotIndex, input.x, input.y),
		{
			invalidateOnSuccess: false,
		},
	);
	const stashBoard = usePlayAction(
		(
			db,
			input: {
				boardItemId: string;
				slotIndex?: number;
			},
		) => db.stashBoardItem(input.boardItemId, input.slotIndex),
		{
			invalidateOnSuccess: false,
		},
	);
	const collectBoard = usePlayAction(
		(
			db,
			input: {
				boardItemId: string;
			},
		) => db.collectBoardItem(input.boardItemId),
		{
			invalidateOnSuccess: false,
		},
	);

	const canCollect = useCallback(
		(boardItem: BoardViewItem) => Boolean(items?.[boardItem.itemId]?.collectible),
		[
			items,
		],
	);

	const collectBoardWithFly = useCallback(
		async (boardItem: BoardViewItem) => {
			await schedule("collect board item", async () => {
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

					await collectBoard.mutateAsync({
						boardItemId: boardItem.id,
					});

					if (from) {
						await addFlyer(
							boardItem.itemId,
							from,
							inventorySinkRect(from, queryRect('[data-bottom-nav-sheet="player"]')),
							"stash",
						);
					}

					await invalidatePlayData([
						"board",
						"playerInventory",
						"upgrades",
						"databaseStatus",
					]);
					pulseBottomNav("player");
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
			collectBoard,
			feedback,
			hideSources,
			invalidatePlayData,
			schedule,
		],
	);

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

					await stashBoard.mutateAsync({
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
			stashBoard,
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

					await placeInventory.mutateAsync({
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
			placeInventory,
			schedule,
		],
	);

	return {
		canCollect,
		collectBoardWithFly,
		stashBoardWithFly,
		placeInventoryOnBoardWithFly,
	};
}

function pulseBottomNav(sheet: "inventory" | "player") {
	const element = queryElement(`[data-bottom-nav-sheet="${sheet}"]`);
	if (element) playBottomNavPulse(element);
}
