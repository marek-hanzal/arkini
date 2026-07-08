import { Effect } from "effect";
import { createBoardItemConsumedEventFx } from "~/board/createBoardItemConsumedEventFx";
import type { BoardMemoryLayoutItem } from "~/board-memory/BoardMemoryActivationTypes";
import { readMemoryRestoreSourceBoardItemFx } from "~/board-memory/readMemoryRestoreSourceBoardItemFx";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import { pushBoardItemCreatedEventFx } from "~/placement/pushBoardItemCreatedEventFx";

export const restoreBoardOnlyLayoutItemsFx = Effect.fn("restoreBoardOnlyLayoutItemsFx")(function* ({
	config,
	events,
	nextSave,
	savedItems,
}: {
	config: GameConfig;
	events: GameEvent[];
	nextSave: GameSave;
	savedItems: readonly BoardMemoryLayoutItem[];
}) {
	const restoredIndexes = new Set<number>();
	const usedItemInstanceIds = new Set<string>();

	for (const [index, memoryItem] of savedItems.entries()) {
		const source = yield* readMemoryRestoreSourceBoardItemFx({
			config,
			memoryItem,
			nextSave,
			usedItemInstanceIds,
		});
		if (!source) continue;
		if (source.x !== memoryItem.x || source.y !== memoryItem.y) {
			events.push(
				yield* createBoardItemConsumedEventFx({
					itemId: source.itemId,
					itemInstanceId: source.id,
					reason: "memory-store",
				}),
			);
			source.x = memoryItem.x;
			source.y = memoryItem.y;
			yield* pushBoardItemCreatedEventFx({
				cell: {
					x: memoryItem.x,
					y: memoryItem.y,
				},
				events,
				itemId: source.itemId,
				itemInstanceId: source.id,
				originItemInstanceId: source.id,
				reason: "memory-restore",
			});
		}

		restoredIndexes.add(index);
		usedItemInstanceIds.add(source.id);
	}

	return restoredIndexes;
});
