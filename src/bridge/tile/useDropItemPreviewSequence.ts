import { useCallback } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";

/** Reads the current committed transition sequence for bounded preview-cache invalidation. */
export const useDropItemPreviewSequence = () => {
	const game = useGameEngine();
	return useCallback(
		() => game.getTransitionSnapshot().sequence,
		[
			game,
		],
	);
};
