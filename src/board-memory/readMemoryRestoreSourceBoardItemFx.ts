import { Effect } from "effect";
import { boardItemMatchesBoardMemoryCell } from "~/board-memory/boardItemMatchesBoardMemoryCell";
import { boardItemMatchesBoardMemoryIdentity } from "~/board-memory/boardItemMatchesBoardMemoryIdentity";
import type {
	BoardMemoryActivationScope,
	BoardMemoryLayoutItem,
} from "~/board-memory/BoardMemoryActivationTypes";
import { isItemStorageAllowed } from "~/config/isItemStorageAllowed";

export const readMemoryRestoreSourceBoardItemFx = Effect.fn("readMemoryRestoreSourceBoardItemFx")(
	function* ({
		memoryItem,
		scope,
		usedItemInstanceIds,
	}: {
		memoryItem: BoardMemoryLayoutItem;
		scope: BoardMemoryActivationScope;
		usedItemInstanceIds: ReadonlySet<string>;
	}) {
		const { config, nextSave } = scope;
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

		if (
			isItemStorageAllowed({
				config,
				itemId: memoryItem.itemId,
				location: "inventory",
			})
		) {
			return undefined;
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
