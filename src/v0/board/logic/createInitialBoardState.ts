import type { GameConfigService } from "~/v0/game/context/GameConfigServiceFx";
import type { BoardItemState } from "~/v0/board/view/BoardItemStateSchema";

export const createInitialBoardState = (
	itemId: string,
	gameConfig: GameConfigService,
): BoardItemState => {
	const stash = gameConfig.getStash(itemId);
	if (!stash) return {};

	return {
		activation: {
			remainingCharges: stash.charges,
		},
	};
};
