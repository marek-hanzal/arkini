import { inventorySinkRect } from "~/inventory/util/inventory";
import type { ActiveSheet } from "~/play/logic/playSheetTypes";
import type { ProducerDropResult } from "~/play/logic/playTypes";
import type { FlyerKind, VisualMeta, RectLike } from "~/play/types";
import { queryRect } from "~/shared/util/queryRect";
import { placementTargetRect } from "./placementTargetRect";

export namespace animateProducerDrops {
	export interface Props {
		results: readonly ProducerDropResult[];
		activeSheet?: ActiveSheet;
		stepDelayMs?: number;
		addFlyer(
			itemId: string,
			from: RectLike,
			to: RectLike,
			kind?: FlyerKind,
			meta?: VisualMeta,
		): Promise<void>;
	}
}

export const animateProducerDrops = async ({
	results,
	activeSheet,
	stepDelayMs = 0,
	addFlyer,
}: animateProducerDrops.Props) => {
	const animations: Promise<void>[] = [];

	for (const result of results) {
		const sourceRect = queryRect(`[data-board-item-id="${result.producerBoardItemId}"]`);
		if (!sourceRect) continue;
		const from = sourceRect;

		for (const placement of result.placements) {
			const targetRect = placementTargetRect({
				placement,
				activeSheet,
			});

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
};
