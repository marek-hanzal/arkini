import type { ItemId } from "~/config/IdSchema";
import type { ActiveSheetState } from "~/play/sheet/ActiveSheetState";

const utilitySheetsByItemId = {
	"item:cheat": {
		type: "cheat-inventory",
	},
	"item:inventory": {
		type: "inventory",
	},
	"item:nuke-save": {
		type: "nuke-save",
	},
} as const satisfies Partial<Record<ItemId, ActiveSheetState>>;

export const cheatBoardItemId = "item:cheat" satisfies ItemId;
export const inventoryBoardItemId = "item:inventory" satisfies ItemId;
export const nukeSaveBoardItemId = "item:nuke-save" satisfies ItemId;

export const readBoardUtilityItemSheet = (itemId: ItemId): ActiveSheetState | undefined => {
	if (!(itemId in utilitySheetsByItemId)) return undefined;

	return utilitySheetsByItemId[itemId as keyof typeof utilitySheetsByItemId];
};

export const isInventoryBoardItemId = (itemId: ItemId | string): boolean =>
	itemId === inventoryBoardItemId;
