import type { GameConfigService } from "~/manifest/context/GameConfigServiceFx";
import { GameActionError } from "~/command/GameActionError";

export function getPlanItem(itemId: string, gameConfig: GameConfigService) {
	const item = gameConfig.getItem(itemId);
	if (!item) throw new GameActionError(`Unknown item definition ${itemId}.`);
	return item;
}
