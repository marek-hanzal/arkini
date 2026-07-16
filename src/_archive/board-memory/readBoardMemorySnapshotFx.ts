import { Effect } from "effect";
import { readBoardItemRuntimeStateStatus } from "~/board/readBoardItemRuntimeStateStatus";
import { readGameSaveBoardItemQuantity } from "~/board/readGameSaveBoardItemQuantity";
import { boardMemoryItemId } from "~/board-memory/GameBoardMemoryItem";
import type { BoardMemoryLayoutItem } from "~/board-memory/BoardMemoryActivationTypes";
import { readSortedBoardMemoryBoardItems } from "~/board-memory/readSortedBoardMemoryBoardItems";
import type { GameConfig } from "~/config/GameConfigTypes";
import { isItemStorageAllowed } from "~/config/isItemStorageAllowed";
import type { GameSave, GameSaveBoardItem } from "~/engine/model/GameSaveSchema";

const readBoardMemorySnapshotItemFx = Effect.fn("readBoardMemorySnapshotItemFx")(function* ({
	config,
	item,
	nextSave,
}: {
	config: GameConfig;
	item: GameSaveBoardItem;
	nextSave: GameSave;
}) {
	const stateStatus = readBoardItemRuntimeStateStatus({
		itemInstanceId: item.id,
		save: nextSave,
	});
	const inventoryStorageAllowed = isItemStorageAllowed({
		config,
		itemId: item.itemId,
		location: "inventory",
	});
	const quantity = readGameSaveBoardItemQuantity(item);

	return {
		...(item.itemId === boardMemoryItemId || stateStatus.preservable || !inventoryStorageAllowed
			? {
					itemInstanceId: item.id,
				}
			: {}),
		itemId: item.itemId,
		...(quantity > 1
			? {
					quantity,
				}
			: {}),
		x: item.x,
		y: item.y,
	} satisfies BoardMemoryLayoutItem;
});

export const readBoardMemorySnapshotFx = Effect.fn("readBoardMemorySnapshotFx")(function* ({
	config,
	nextSave,
}: {
	config: GameConfig;
	nextSave: GameSave;
}) {
	const items: BoardMemoryLayoutItem[] = [];
	for (const item of readSortedBoardMemoryBoardItems({
		save: nextSave,
	})) {
		items.push(
			yield* readBoardMemorySnapshotItemFx({
				config,
				item,
				nextSave,
			}),
		);
	}
	return items;
});
