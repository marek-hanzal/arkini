import { boardSourceId } from "~/board/boardIdentity";
import { inventorySourceId } from "~/inventory/inventoryIdentity";
import { inventorySinkRect } from "~/inventory/util/inventory";
import type { ActiveSheet } from "~/play/logic/playSheetTypes";
import type { BoardViewItem, ProducerDropResult, ProducerPlacement } from "~/play/logic/playTypes";
import type { FlyerKind, GameVisualMeta, RectLike } from "~/play/types";
import { playBottomNavHold } from "~/play/util/animation";
import { queryElement } from "~/shared/util/queryElement";
import { queryRect } from "~/shared/util/queryRect";

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
			meta?: GameVisualMeta,
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

export namespace startProducerDepletionFlyer {
	export interface Props {
		boardItem: BoardViewItem;
		result: ProducerDropResult;
		hideSources(ids: readonly string[]): void;
		addFlyer(
			itemId: string,
			from: RectLike,
			to: RectLike,
			kind?: FlyerKind,
			meta?: GameVisualMeta,
		): Promise<void>;
	}
}

export const startProducerDepletionFlyer = ({
	boardItem,
	result,
	hideSources,
	addFlyer,
}: startProducerDepletionFlyer.Props) => {
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
		activation: boardItem.activation ?? undefined,
	});
};

export namespace producerPlacementSourceIds {
	export interface Props {
		placements: readonly ProducerPlacement[];
	}
}

export const producerPlacementSourceIds = ({ placements }: producerPlacementSourceIds.Props) =>
	placements.flatMap((placement) => {
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

export namespace highlightInventoryNav {
	export interface Props {}
}

export const highlightInventoryNav = (_props: highlightInventoryNav.Props = {}) => {
	const element = queryElement('[data-bottom-nav-sheet="inventory"]');
	if (element) playBottomNavHold(element);
};

namespace placementTargetRect {
	export interface Props {
		placement: ProducerPlacement;
		activeSheet?: ActiveSheet;
	}
}

const placementTargetRect = ({ placement, activeSheet }: placementTargetRect.Props) => {
	if (placement.kind === "board")
		return queryRect(`[data-board-cell="${placement.x}:${placement.y}"]`);
	if (activeSheet !== "inventory") return null;
	return queryRect(`[data-inventory-slot="${placement.slotIndex}"]`);
};
