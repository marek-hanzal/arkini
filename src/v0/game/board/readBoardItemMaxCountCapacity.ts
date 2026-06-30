import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readBoardItemCount } from "~/v0/game/board/readBoardItemCount";

export namespace readBoardItemMaxCountCapacity {
	export interface Props {
		config: GameConfig;
		ignoredBoardItemInstanceIds?: ReadonlySet<string>;
		itemId: string;
		save: GameSave;
	}
}

export const readBoardItemMaxCountCapacity = ({
	config,
	ignoredBoardItemInstanceIds,
	itemId,
	save,
}: readBoardItemMaxCountCapacity.Props) => {
	const maxCount = config.items[itemId]?.maxCount;
	if (maxCount === undefined) return Number.POSITIVE_INFINITY;

	const currentCount = readBoardItemCount({
		ignoredBoardItemInstanceIds,
		itemId,
		save,
	});
	return Math.max(0, maxCount - currentCount);
};
