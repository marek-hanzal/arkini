import type { ItemId } from "~/v0/game/config/GameIdSchema";

export const nukeSaveBoardItemId = "item:nuke-save" satisfies ItemId;

export const isNukeSaveBoardItemId = (itemId: ItemId): boolean => itemId === nukeSaveBoardItemId;
