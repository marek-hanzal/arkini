import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readGameSaveOwnedItemQuantity } from "~/v0/game/exclusivity/readGameSaveOwnedItemQuantity";

export namespace readGameSaveExclusiveConflicts {
	export interface Props {
		config: GameConfig;
		itemId: string;
		save: GameSave;
		ignoredBoardItemInstanceIds?: ReadonlySet<string>;
	}
}

export const readGameSaveExclusiveConflicts = ({
	config,
	ignoredBoardItemInstanceIds,
	itemId,
	save,
}: readGameSaveExclusiveConflicts.Props) => {
	const conflicts = new Set<string>();
	const item = config.items[itemId];

	for (const exclusiveItemId of item?.exclusiveToIds ?? []) {
		if (
			readGameSaveOwnedItemQuantity({
				ignoredBoardItemInstanceIds,
				itemId: exclusiveItemId,
				save,
			}) > 0
		) {
			conflicts.add(exclusiveItemId);
		}
	}

	for (const [candidateItemId, candidateItem] of Object.entries(config.items)) {
		if (!candidateItem.exclusiveToIds?.includes(itemId)) continue;
		if (
			readGameSaveOwnedItemQuantity({
				ignoredBoardItemInstanceIds,
				itemId: candidateItemId,
				save,
			}) > 0
		) {
			conflicts.add(candidateItemId);
		}
	}

	return [
		...conflicts,
	];
};
