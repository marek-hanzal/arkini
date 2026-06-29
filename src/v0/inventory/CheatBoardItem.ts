import type { ItemId } from "~/v0/game/config/GameIdSchema";

export const cheatBoardItemId = "item:cheat" satisfies ItemId;

export const isCheatBoardItemId = (itemId: ItemId): boolean => itemId === cheatBoardItemId;
