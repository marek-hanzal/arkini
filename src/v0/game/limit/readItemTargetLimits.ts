import type { ItemTargetLimit } from "~/v0/game/limit/ItemTargetLimit";
import { readBoardItemCount } from "~/v0/game/board/readBoardItemCount";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { ItemId } from "~/v0/game/config/GameIdSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace readItemTargetLimits {
	export interface Props {
		config: GameConfig;
		ignoredBoardItemInstanceIds?: ReadonlySet<string>;
		itemId: string;
		requiredQuantity?: number;
		save: GameSave;
	}
}

const appendTargetItemId = ({
	itemIds,
	itemId,
}: {
	itemIds: string[];
	itemId: string | undefined;
}) => {
	if (!itemId || itemIds.includes(itemId)) return;
	itemIds.push(itemId);
};

export const readItemTargetLimits = ({
	config,
	ignoredBoardItemInstanceIds,
	itemId,
	requiredQuantity = 1,
	save,
}: readItemTargetLimits.Props): ItemTargetLimit[] => {
	const targetItemIds: string[] = [];
	appendTargetItemId({
		itemId,
		itemIds: targetItemIds,
	});
	appendTargetItemId({
		itemId: config.craftRecipes[itemId]?.resultItemId,
		itemIds: targetItemIds,
	});

	return targetItemIds.flatMap((targetItemId) => {
		const maxCount = config.items[targetItemId]?.maxCount;
		if (maxCount === undefined) return [];

		const ownedQuantity = readBoardItemCount({
			ignoredBoardItemInstanceIds,
			itemId: targetItemId,
			save,
		});

		return [
			{
				itemId: targetItemId as ItemId,
				maxCount,
				ownedQuantity,
				remainingQuantity: Math.max(0, maxCount - ownedQuantity),
				requiredQuantity,
				...(targetItemId === itemId
					? {}
					: {
							sourceItemId: itemId as ItemId,
						}),
			},
		] satisfies ItemTargetLimit[];
	});
};
