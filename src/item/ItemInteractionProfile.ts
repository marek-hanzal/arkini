import { z } from "zod";
import {
	cheatBoardItemId,
	inventoryBoardItemId,
	nukeSaveBoardItemId,
} from "~/board/BoardUtilityItem";
import { isBoardMemoryItemId } from "~/board-memory/GameBoardMemoryItem";
import { readCheatSpeedToggleModeFromItemId } from "~/cheat/GameCheatSpeedItem";
import type { GameConfig } from "~/config/GameConfigTypes";
import { GameItemIdSchema, type ItemId } from "~/config/GameIdSchema";

export const ItemSpecialInteractionKindSchema = z.enum([
	"none",
	"memory",
	"clock",
	"cheat-inventory",
	"inventory",
	"nuke-save",
]);

export type ItemSpecialInteractionKind = z.infer<typeof ItemSpecialInteractionKindSchema>;

export const ItemInteractionProfileSchema = z
	.object({
		stackKey: z.string().nullable(),
		hasExplicitMergeRules: z.boolean(),
		mergeTargetIds: z.array(GameItemIdSchema),
		acceptsCraftInput: z.boolean(),
		acceptsProducerInput: z.boolean(),
		acceptsStashInput: z.boolean(),
		removableByItemIds: z.array(GameItemIdSchema),
		specialInteractionKind: ItemSpecialInteractionKindSchema,
	})
	.strict();

export type ItemInteractionProfile = z.infer<typeof ItemInteractionProfileSchema>;

export const readItemSpecialInteractionKind = (
	itemId: ItemId | string,
): ItemSpecialInteractionKind => {
	if (readCheatSpeedToggleModeFromItemId(itemId)) return "clock";
	if (isBoardMemoryItemId(itemId)) return "memory";
	if (itemId === cheatBoardItemId) return "cheat-inventory";
	if (itemId === inventoryBoardItemId) return "inventory";
	if (itemId === nukeSaveBoardItemId) return "nuke-save";
	return "none";
};

export const readItemInteractionProfile = ({
	config,
	itemId,
}: {
	config: GameConfig;
	itemId: ItemId | string;
}): ItemInteractionProfile => {
	const item = config.items[itemId];

	return {
		stackKey: item && item.maxStackSize > 1 ? itemId : null,
		hasExplicitMergeRules: (item?.merges?.length ?? 0) > 0,
		mergeTargetIds: (item?.merges ?? []).map((merge) => merge.withItemId),
		acceptsCraftInput: Boolean(item?.craft),
		acceptsProducerInput: Boolean(item?.producer),
		acceptsStashInput: Boolean(item?.stash),
		removableByItemIds: (item?.removeBy ?? []).map((removal) => removal.itemId),
		specialInteractionKind: readItemSpecialInteractionKind(itemId),
	};
};
