import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readBoardItemCount } from "~/board/logic/readBoardItemCount";

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
