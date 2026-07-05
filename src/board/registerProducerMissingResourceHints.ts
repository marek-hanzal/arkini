import type { BoardItemActivationContext } from "~/board/BoardItemActivationTypes";
import { registerBoardTileBounceFeedback } from "~/play/game-engine-visual/registerBoardTileBounceFeedback";
import { readProducerMissingResourceHintTileIds } from "~/producer/view/readProducerMissingResourceHintTileIds";

export const registerProducerMissingResourceHints = ({
	context,
}: {
	context: BoardItemActivationContext;
}) => {
	const hintTileIds = readProducerMissingResourceHintTileIds({
		board: context.liveBoard,
		producerItem: context.liveBoardItem,
	});
	if (hintTileIds.length === 0) return;

	registerBoardTileBounceFeedback({
		groupId: `producer-missing-resource-hint:${context.liveBoardItem.id}:${context.nowMs}`,
		tileIds: hintTileIds,
	});
};
