import { Effect } from "effect";
import { readBoardMemoryBoardItemStorePlan } from "~/board-memory/readBoardMemoryBoardItemStorePlan";
import { readSortedBoardMemoryBoardItems } from "~/board-memory/readSortedBoardMemoryBoardItems";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave, GameSaveBoardItem } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import { placeBoardItemInInventoryFx } from "~/placement/placeBoardItemInInventoryFx";

export namespace StoreCurrentBoardItemsInInventoryResult {
	export interface Type {
		failedItemInstanceIds: Set<string>;
		storedItemInstanceIds: Set<string>;
	}
}

const storeBoardItemInInventoryFx = Effect.fn("storeBoardItemInInventoryFx")(function* ({
	config,
	events,
	item,
	nextSave,
}: {
	config: GameConfig;
	events: GameEvent[];
	item: GameSaveBoardItem;
	nextSave: GameSave;
}) {
	const storePlan = readBoardMemoryBoardItemStorePlan({
		config,
		item,
		save: nextSave,
	});
	if (storePlan.type === "skip") {
		return storePlan.reason === "inventory-storage-forbidden" ? "ignored" : "failed";
	}

	const stored = yield* placeBoardItemInInventoryFx({
		config,
		events,
		item,
		mode: storePlan.mode,
		reason: "memory-store",
		save: nextSave,
	}).pipe(Effect.catchTag("GamePlacementFailed", () => Effect.succeed(false)));

	return stored ? "stored" : "failed";
});

export const storeCurrentBoardItemsInInventoryFx = Effect.fn("storeCurrentBoardItemsInInventoryFx")(
	function* ({
		config,
		events,
		nextSave,
		preservedBoardItemInstanceIds = new Set(),
	}: {
		config: GameConfig;
		events: GameEvent[];
		nextSave: GameSave;
		preservedBoardItemInstanceIds?: ReadonlySet<string>;
	}) {
		const result: StoreCurrentBoardItemsInInventoryResult.Type = {
			failedItemInstanceIds: new Set(),
			storedItemInstanceIds: new Set(),
		};
		for (const item of readSortedBoardMemoryBoardItems({
			save: nextSave,
		})) {
			if (preservedBoardItemInstanceIds.has(item.id)) continue;
			const status = yield* storeBoardItemInInventoryFx({
				config,
				events,
				item,
				nextSave,
			});
			if (status === "ignored") continue;
			(status === "stored" ? result.storedItemInstanceIds : result.failedItemInstanceIds).add(item.id);
		}
		return result;
	},
);
