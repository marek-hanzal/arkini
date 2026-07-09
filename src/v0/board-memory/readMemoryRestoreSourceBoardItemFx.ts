import { Effect } from "effect";
import { boardItemMatchesBoardMemoryCell } from "~/board-memory/boardItemMatchesBoardMemoryCell";
import { boardItemMatchesBoardMemoryIdentity } from "~/board-memory/boardItemMatchesBoardMemoryIdentity";
import type { BoardMemoryLayoutItem } from "~/board-memory/BoardMemoryActivationTypes";
import type { GameConfig } from "~/config/GameConfigTypes";
import { isItemStorageAllowed } from "~/config/isItemStorageAllowed";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export const readMemoryRestoreSourceBoardItemFx = Effect.fn("readMemoryRestoreSourceBoardItemFx")(
	function* ({
		config,
		memoryItem,
		nextSave,
		usedItemInstanceIds,
	}: {
		config: GameConfig;
		memoryItem: BoardMemoryLayoutItem;
		nextSave: GameSave;
		usedItemInstanceIds: ReadonlySet<string>;
	}) {
		if (
			isItemStorageAllowed({
				config,
				itemId: memoryItem.itemId,
				location: "inventory",
			})
		) {
			return undefined;
		}

		if (memoryItem.itemInstanceId) {
			const exactItem = nextSave.board.items[memoryItem.itemInstanceId];
			if (
				exactItem &&
				boardItemMatchesBoardMemoryIdentity({
					boardItem: exactItem,
					memoryItem,
				})
			) {
				return exactItem;
			}
		}

		const candidates = Object.values(nextSave.board.items).filter(
			(item) =>
				!usedItemInstanceIds.has(item.id) &&
				boardItemMatchesBoardMemoryIdentity({
					boardItem: item,
					memoryItem,
				}),
		);

		return (
			candidates.find((item) =>
				boardItemMatchesBoardMemoryCell({
					boardItem: item,
					memoryItem,
				}),
			) ?? candidates[0]
		);
	},
);
