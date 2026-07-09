import type { ItemId } from "~/config/IdSchema";
import type { GameCheatSpeedMode } from "~/cheat/GameCheatSpeedMode";

export const cheatSpeedEnableItemId = "item:cheat:speed-enable" satisfies ItemId;
export const cheatSpeedDisableItemId = "item:cheat:speed-disable" satisfies ItemId;

export const isCheatSpeedItemId = (itemId: ItemId | string): boolean =>
	itemId === cheatSpeedEnableItemId || itemId === cheatSpeedDisableItemId;

export const readCheatSpeedItemIdFromMode = (mode: GameCheatSpeedMode): ItemId => {
	switch (mode) {
		case "instant":
			return cheatSpeedEnableItemId;
		case "normal":
			return cheatSpeedDisableItemId;
		default: {
			const exhaustive: never = mode;
			return exhaustive;
		}
	}
};

const readCheatSpeedModeFromItemId = (itemId: ItemId | string): GameCheatSpeedMode | undefined => {
	if (itemId === cheatSpeedEnableItemId) return "instant";
	if (itemId === cheatSpeedDisableItemId) return "normal";
	return undefined;
};

export const readCheatSpeedToggleModeFromItemId = (
	itemId: ItemId | string,
): GameCheatSpeedMode | undefined => {
	const currentMode = readCheatSpeedModeFromItemId(itemId);
	if (currentMode === "normal") return "instant";
	if (currentMode === "instant") return "normal";
	return undefined;
};
