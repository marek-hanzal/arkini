import type { GameSave, GameSaveBoardItem } from "~/v0/game/engine/model/GameSaveSchema";

export interface ProximityRequirementMatch {
	distance: number;
	item: GameSaveBoardItem;
}

export namespace readProximityRequirementMatch {
	export interface Props {
		itemIds: readonly string[];
		save: GameSave;
		targetItemInstanceId: string;
	}
}

const readGridDistance = (left: GameSaveBoardItem, right: GameSaveBoardItem) =>
	Math.max(Math.abs(left.x - right.x), Math.abs(left.y - right.y));

export namespace readProximityRequirementMatches {
	export interface Props {
		itemIds: readonly string[];
		save: GameSave;
		targetItemInstanceId: string;
	}
}

export const readProximityRequirementMatches = ({
	itemIds,
	save,
	targetItemInstanceId,
}: readProximityRequirementMatches.Props): ProximityRequirementMatch[] => {
	const target = save.board.items[targetItemInstanceId];
	if (!target) return [];

	const acceptedItemIds = new Set(itemIds);
	return Object.values(save.board.items)
		.flatMap((item) => {
			if (item.id === target.id || !acceptedItemIds.has(item.itemId)) {
				return [];
			}

			return [
				{
					distance: readGridDistance(target, item),
					item,
				},
			];
		})
		.sort(
			(left, right) =>
				left.distance - right.distance || left.item.id.localeCompare(right.item.id),
		);
};

export const readProximityRequirementMatch = ({
	itemIds,
	save,
	targetItemInstanceId,
}: readProximityRequirementMatch.Props): ProximityRequirementMatch | undefined =>
	readProximityRequirementMatches({
		itemIds,
		save,
		targetItemInstanceId,
	})[0];
