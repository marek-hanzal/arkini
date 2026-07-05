import { Effect } from "effect";
import type { BoardCell } from "~/board/BoardCellPosition";
import { readBoardItemRuntimeStateStatus } from "~/board/readBoardItemRuntimeStateStatus";
import { readGameSaveBoardItemQuantity } from "~/board/readGameSaveBoardItemQuantity";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave, GameSaveBoardItem } from "~/engine/model/GameSaveSchema";

const compareBoardItemsByScanOrder = (left: GameSaveBoardItem, right: GameSaveBoardItem) =>
	left.y - right.y || left.x - right.x || left.id.localeCompare(right.id);

const compareBoardItemsBySeedDistance =
	(seedCell: BoardCell) => (left: GameSaveBoardItem, right: GameSaveBoardItem) => {
		const leftDistance = Math.abs(left.x - seedCell.x) + Math.abs(left.y - seedCell.y);
		const rightDistance = Math.abs(right.x - seedCell.x) + Math.abs(right.y - seedCell.y);

		return leftDistance - rightDistance || compareBoardItemsByScanOrder(left, right);
	};

export namespace planBoardStackItemsFx {
	export interface Props {
		config: GameConfig;
		freedBoardItemInstanceIds?: ReadonlySet<string>;
		itemId: string;
		save: GameSave;
		seedCell?: BoardCell;
	}
}

export const planBoardStackItemsFx = Effect.fn("planBoardStackItemsFx")(function* ({
	config,
	freedBoardItemInstanceIds,
	itemId,
	save,
	seedCell,
}: planBoardStackItemsFx.Props) {
	const maxStackSize = config.items[itemId]?.maxStackSize ?? 1;
	if (maxStackSize <= 1) return [];

	return Object.values(save.board.items)
		.filter((item) => {
			if (item.itemId !== itemId) return false;
			if (freedBoardItemInstanceIds?.has(item.id)) return false;
			if (readGameSaveBoardItemQuantity(item) >= maxStackSize) return false;

			const runtimeState = readBoardItemRuntimeStateStatus({
				itemInstanceId: item.id,
				save,
			});
			return !runtimeState.busy && !runtimeState.preservable;
		})
		.sort(seedCell ? compareBoardItemsBySeedDistance(seedCell) : compareBoardItemsByScanOrder);
});
