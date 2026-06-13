import { useCallback } from "react";
import { boardSourceId } from "~/board/boardIdentity";
import { cellKey } from "~/board/util/cell";
import { inventorySourceId } from "~/inventory/inventoryIdentity";
import { inventorySinkRect } from "~/inventory/util/inventory";
import type { BoardViewItem, ProducerDropResult, ProducerPlacement } from "~/play/logic/playTypes";
import { usePlayAction } from "~/play/hook/usePlayAction";
import { usePlayDataInvalidation } from "~/play/hook/usePlayDataInvalidation";
import type { GameDragFeedback } from "~/play/hook/usePlayDraggableControl";
import type { ActiveSheet } from "~/play/ui/BottomNavigation";
import type { FlyerKind, GameVisualMeta, RectLike } from "~/play/types";
import { playBottomNavHold } from "~/play/util/animation";
import { queryElement } from "~/shared/util/queryElement";
import { queryRect } from "~/shared/util/queryRect";
import { waitForPaint } from "~/shared/util/waitForPaint";

export namespace usePlayProducerActions {
	export interface Props {
		activeSheet?: ActiveSheet;
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

export function usePlayProducerActions({
	activeSheet,
	addFlyer,
	feedback,
	schedule,
	hideSources,
	clearHiddenSources,
}: usePlayProducerActions.Props) {
	const invalidatePlayData = usePlayDataInvalidation();
	const produce = usePlayAction(
		(
			db,
			input: {
				boardItemId: string;
				activation?: "single" | "exhaust";
			},
		) => db.produceBoardItem(input.boardItemId, input.activation),
		{
			invalidateOnSuccess: false,
		},
	);

	const animateProducerDrops = useCallback(
		async (results: ProducerDropResult[], stepDelayMs = 0) => {
			const animations: Promise<void>[] = [];

			for (const result of results) {
				const sourceRect = queryRect(
					`[data-board-item-id="${result.producerBoardItemId}"]`,
				);
				if (!sourceRect) continue;
				const from = sourceRect;

				for (const placement of result.placements) {
					const targetRect =
						placement.kind === "board"
							? queryRect(`[data-board-cell="${placement.x}:${placement.y}"]`)
							: activeSheet === "inventory"
								? queryRect(`[data-inventory-slot="${placement.slotIndex}"]`)
								: null;

					if (placement.kind === "board") {
						if (!targetRect) continue;
						animations.push(addFlyer(placement.itemId, from, targetRect, "place"));
					} else {
						animations.push(
							addFlyer(
								placement.itemId,
								from,
								targetRect ?? inventorySinkRect(from),
								"place",
							),
						);
					}

					if (stepDelayMs > 0)
						await new Promise((resolve) => window.setTimeout(resolve, stepDelayMs));
				}
			}

			await Promise.all(animations);
		},
		[
			activeSheet,
			addFlyer,
		],
	);

	const startProducerDepletion = useCallback(
		(boardItem: BoardViewItem, result: ProducerDropResult) => {
			if (result.depletion?.kind !== "remove") return null;

			const sourceId = boardSourceId(boardItem.id);
			const sourceRect =
				queryRect(`[data-board-item-id="${boardItem.id}"]`) ??
				queryRect(`[data-board-cell="${boardItem.x}:${boardItem.y}"]`);
			if (!sourceRect) return null;

			hideSources([
				sourceId,
			]);
			return addFlyer(boardItem.itemId, sourceRect, sourceRect, "deplete", {
				producer: boardItem.producer ?? undefined,
			});
		},
		[
			addFlyer,
			hideSources,
		],
	);

	const produceFrom = useCallback(
		async (boardItem: BoardViewItem, activation: "single" | "exhaust" = "single") => {
			await schedule(`producer ${activation}`, async () => {
				try {
					const result = await produce.mutateAsync({
						boardItemId: boardItem.id,
						activation,
					});
					hideSources(producerPlacementSourceIds(result.placements));
					await animateProducerDrops(
						[
							result,
						],
						activation === "exhaust" ? 130 : 0,
					);
					if (result.placements.some((placement) => placement.kind === "inventory")) {
						highlightInventoryNav();
					}

					const depletion = startProducerDepletion(boardItem, result);
					await waitForPaint();
					await invalidatePlayData([
						"board",
						"inventory",
						"buildRecipes",
						"databaseStatus",
					]);
					await waitForPaint();
					clearHiddenSources();
					await depletion;
				} catch (error) {
					feedback.flashBoardCell(cellKey(boardItem.x, boardItem.y), "error");
					feedback.showError(error);
				} finally {
					clearHiddenSources();
				}
			});
		},
		[
			animateProducerDrops,
			clearHiddenSources,
			feedback,
			hideSources,
			invalidatePlayData,
			produce,
			startProducerDepletion,
			schedule,
		],
	);

	return {
		produceFrom,
	};
}

function producerPlacementSourceIds(placements: readonly ProducerPlacement[]) {
	return placements.flatMap((placement) => {
		if (placement.kind === "board" && placement.boardItemId) {
			return [
				boardSourceId(placement.boardItemId),
			];
		}

		if (placement.kind === "inventory" && placement.slotIndex !== undefined) {
			return [
				inventorySourceId(placement.slotIndex),
			];
		}

		return [];
	});
}

function highlightInventoryNav() {
	const element = queryElement('[data-bottom-nav-sheet="inventory"]');
	if (element) playBottomNavHold(element);
}
