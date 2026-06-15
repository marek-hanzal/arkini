import { useMemo, useRef } from "react";
import { useMotionCellFeedback } from "~/board/hook/useMotionCellFeedback";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import { useProducerClock } from "~/producer/hook/useProducerClock";
import { useProducerReadySignals } from "~/producer/hook/useProducerReadySignals";
import { isProducerReady } from "~/producer/logic/isProducerReady";
import { readProducerCooldown } from "~/producer/logic/readProducerCooldown";

const emptyBoardItems: readonly BoardViewItem[] = [];

export namespace useBoardCellController {
	export interface Props {
		boardItem?: BoardViewItem;
		canMerge: boolean;
		showDelayedMergeHint: boolean;
		invalid: boolean;
		merged: boolean;
		imprinted: boolean;
		isOver: boolean;
	}
}

export const useBoardCellController = ({
	boardItem,
	canMerge,
	showDelayedMergeHint,
	invalid,
	merged,
	imprinted,
	isOver,
}: useBoardCellController.Props) => {
	const cellRef = useRef<HTMLDivElement | null>(null);
	const clockItems = useMemo(
		() =>
			boardItem
				? [
						boardItem,
					]
				: emptyBoardItems,
		[
			boardItem,
		],
	);
	const nowMs = useProducerClock(clockItems);
	useProducerReadySignals(clockItems, nowMs);
	useMotionCellFeedback(cellRef, {
		invalid,
		success: merged,
		imprint: imprinted,
	});

	return {
		cellRef,
		producerReady: isProducerReady(boardItem?.activation, nowMs),
		producerCooldown: readProducerCooldown({
			activation: boardItem?.activation,
			nowMs,
		}),
		showMergeHint: canMerge && (showDelayedMergeHint || isOver),
	};
};
