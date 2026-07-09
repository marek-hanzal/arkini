import type { BoardView } from "~/board/view/BoardViewSchema";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import { registerBoardTileBounceFeedback } from "~/play/game-engine-visual/registerBoardTileBounceFeedback";
import { readProducerMissingResourceHintTileIds } from "~/producer/view/readProducerMissingResourceHintTileIds";

export const registerProducerMissingResourceHints = ({
	board,
	lineId,
	nowMs,
	producerItem,
}: {
	board: BoardView;
	lineId?: string;
	nowMs: number;
	producerItem: BoardViewItem;
}) => {
	const hintTileIds = readProducerMissingResourceHintTileIds({
		board,
		lineId,
		producerItem,
	});
	if (hintTileIds.length === 0) return;

	registerBoardTileBounceFeedback({
		groupId: `producer-missing-resource-hint:${producerItem.id}:${nowMs}`,
		tileIds: hintTileIds,
	});
};
