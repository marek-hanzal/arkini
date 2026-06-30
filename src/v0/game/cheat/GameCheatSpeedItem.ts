import type { ItemId } from "~/v0/game/config/GameIdSchema";
import type { GameCheatSpeedMode } from "~/v0/game/cheat/GameCheatSpeedMode";

export const cheatSpeedEnableItemId = "item:cheat:speed-enable" satisfies ItemId;
export const cheatSpeedDisableItemId = "item:cheat:speed-disable" satisfies ItemId;

export const readCheatSpeedModeFromItemId = (
	itemId: ItemId | string,
): GameCheatSpeedMode | undefined => {
	if (itemId === cheatSpeedEnableItemId) return "instant";
	if (itemId === cheatSpeedDisableItemId) return "normal";
	return undefined;
};
