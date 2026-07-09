import { Effect } from "effect";
import { readBoardItemCount } from "~/board/readBoardItemCount";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace readBoardItemMaxCountCapacityFx {
	export interface Props {
		config: GameConfig;
		ignoredBoardItemInstanceIds?: ReadonlySet<string>;
		itemId: string;
		save: GameSave;
	}
}

export const readBoardItemMaxCountCapacityFx = Effect.fn("readBoardItemMaxCountCapacityFx")(
	function* ({
		config,
		ignoredBoardItemInstanceIds,
		itemId,
		save,
	}: readBoardItemMaxCountCapacityFx.Props) {
		const maxCount = config.items[itemId]?.maxCount;
		if (maxCount === undefined) return Number.POSITIVE_INFINITY;

		const currentCount = readBoardItemCount({
			ignoredBoardItemInstanceIds,
			itemId,
			save,
		});
		return Math.max(0, maxCount - currentCount);
	},
);
