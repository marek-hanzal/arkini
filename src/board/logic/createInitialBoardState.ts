import type { GameConfigService } from "~/manifest/context/GameConfigServiceFx";
import type { BoardItemState } from "~/play/logic/playTypes";

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
