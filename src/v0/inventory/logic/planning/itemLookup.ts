import type { GameConfigService } from "~/v0/game/context/GameConfigServiceFx";
import { GameActionError } from "~/v0/play/action/GameActionError";

export function getPlanItem(itemId: string, gameConfig: GameConfigService) {
	const item = gameConfig.getItem(itemId);
	if (!item) throw new GameActionError(`Unknown item definition ${itemId}.`);
	return item;
}
