import { animateProducerDrops } from "~/animation/animateProducerDrops";
import { highlightInventoryNav } from "~/animation/highlightInventoryNav";
import { producerPlacementSourceIds } from "~/animation/producerPlacementSourceIds";
import { startProducerDepletionFlyer } from "~/animation/startProducerDepletionFlyer";
import type { Command } from "~/action/command";
import { cellKey } from "~/board/util/cell";
import type { Feedback } from "~/play/hook/usePlayDraggableControl";
import type { ActiveSheet } from "~/play/logic/playSheetTypes";
import type { BoardViewItem, ProducerDropResult } from "~/play/logic/playTypes";
import type { FlyerKind, RectLike, VisualMeta } from "~/play/types";
import { waitForPaint } from "~/shared/util/waitForPaint";

export namespace produceFrom {
	export interface Props {
		activeSheet?: ActiveSheet;
		boardItem: BoardViewItem;
		activation: "single" | "exhaust";
		addFlyer(
			itemId: string,
			from: RectLike,
			to: RectLike,
			kind?: FlyerKind,
			meta?: VisualMeta,
		): Promise<void>;
		run(
			command: Extract<
				Command,
				{
					type: "producer.activate";
				}
			>,
		): Promise<ProducerDropResult>;
		feedback: Feedback;
		hideSources(ids: readonly string[]): void;
		clearHiddenSources(): void;
		invalidatePlayData(
			targets: readonly ("board" | "inventory" | "databaseStatus")[],
		): Promise<void>;
	}
}

export const produceFrom = async ({
	activeSheet,
	boardItem,
	activation,
	addFlyer,
	run,
	feedback,
	hideSources,
	clearHiddenSources,
	invalidatePlayData,
}: produceFrom.Props) => {
	try {
		const result = await run({
			type: "producer.activate",
			boardItemId: boardItem.id,
			activation,
		});
		hideSources(
			producerPlacementSourceIds({
				placements: result.placements,
			}),
		);

		const drops = animateProducerDrops({
			results: [
				result,
			],
			activeSheet,
			stepDelayMs: activation === "exhaust" ? 130 : 0,
			addFlyer,
		});
		const depletion = startProducerDepletionFlyer({
			boardItem,
			result,
			hideSources,
			addFlyer,
		});

		await waitForPaint();
		const invalidation = invalidatePlayData([
			"board",
			"inventory",
			"databaseStatus",
		]);
		await Promise.all([
			drops,
			depletion ?? Promise.resolve(),
			invalidation,
		]);

		if (result.placements.some((placement) => placement.kind === "inventory")) {
			highlightInventoryNav();
		}

		clearHiddenSources();
	} catch (error) {
		feedback.flashBoardCell(cellKey(boardItem.x, boardItem.y), "error");
		feedback.showError(error);
	} finally {
		clearHiddenSources();
	}
};
