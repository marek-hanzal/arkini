import { useCallback } from "react";
import { cellKey } from "~/board/util/cell";
import { animateProducerDrops } from "~/animation/animateProducerDrops";
import { highlightInventoryNav } from "~/animation/highlightInventoryNav";
import { producerPlacementSourceIds } from "~/animation/producerPlacementSourceIds";
import { startProducerDepletionFlyer } from "~/animation/startProducerDepletionFlyer";
import type { Command } from "~/action/command";
import { useCommand } from "~/play/hook/useCommand";
import { usePlayDataInvalidation } from "~/play/hook/usePlayDataInvalidation";
import type { Feedback } from "~/play/hook/usePlayDraggableControl";
import type { ActiveSheet } from "~/play/logic/playSheetTypes";
import type { BoardViewItem } from "~/play/logic/playTypes";
import type { FlyerKind, VisualMeta, RectLike } from "~/play/types";
import { waitForPaint } from "~/shared/util/waitForPaint";

export namespace usePlayProducerActions {
	export interface Props {
		activeSheet?: ActiveSheet;
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

export function usePlayProducerActions({
	activeSheet,
	addFlyer,
	feedback,
	schedule,
	hideSources,
	clearHiddenSources,
}: usePlayProducerActions.Props) {
	const invalidatePlayData = usePlayDataInvalidation();
	const command = useCommand<
		Extract<
			Command,
			{
				type: "producer.activate";
			}
		>
	>({
		invalidateOnSuccess: false,
	});

	const produceFrom = useCallback(
		async (boardItem: BoardViewItem, activation: "single" | "exhaust" = "single") => {
			await schedule(`producer ${activation}`, async () => {
				try {
					const result = await command.mutateAsync({
						type: "producer.activate",
						boardItemId: boardItem.id,
						activation,
					});
					hideSources(
						producerPlacementSourceIds({
							placements: result.placements,
						}),
					);
					await animateProducerDrops({
						results: [
							result,
						],
						activeSheet,
						stepDelayMs: activation === "exhaust" ? 130 : 0,
						addFlyer,
					});
					if (result.placements.some((placement) => placement.kind === "inventory")) {
						highlightInventoryNav();
					}

					const depletion = startProducerDepletionFlyer({
						boardItem,
						result,
						hideSources,
						addFlyer,
					});
					await waitForPaint();
					await invalidatePlayData([
						"board",
						"inventory",
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
			activeSheet,
			addFlyer,
			clearHiddenSources,
			command,
			feedback,
			hideSources,
			invalidatePlayData,
			schedule,
		],
	);

	return {
		produceFrom,
	};
}
