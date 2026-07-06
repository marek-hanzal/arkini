import { Effect } from "effect";
import type { BoardMemoryActivationScope } from "~/board-memory/BoardMemoryActivationTypes";
import { readBoardMemoryBoardItemStorePlan } from "~/board-memory/readBoardMemoryBoardItemStorePlan";
import { readSortedBoardMemoryBoardItems } from "~/board-memory/readSortedBoardMemoryBoardItems";
import type { GameSaveBoardItem } from "~/engine/model/GameSaveSchema";
import { placeBoardItemInInventoryFx } from "~/placement/placeBoardItemInInventoryFx";

export namespace StoreCurrentBoardItemsInInventoryResult {
	export interface Type {
		failedItemInstanceIds: Set<string>;
		storedItemInstanceIds: Set<string>;
	}
}

const storeBoardItemInInventoryFx = Effect.fn("storeBoardItemInInventoryFx")(function* ({
	item,
	scope,
}: {
	item: GameSaveBoardItem;
	scope: BoardMemoryActivationScope;
}) {
	const { config, events, nextSave } = scope;
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
		preservedBoardItemInstanceIds = new Set(),
		scope,
	}: {
		preservedBoardItemInstanceIds?: ReadonlySet<string>;
		scope: BoardMemoryActivationScope;
	}) {
		const { nextSave } = scope;
		const result: StoreCurrentBoardItemsInInventoryResult.Type = {
			failedItemInstanceIds: new Set(),
			storedItemInstanceIds: new Set(),
		};

		for (const item of readSortedBoardMemoryBoardItems({
			save: nextSave,
		})) {
			if (preservedBoardItemInstanceIds.has(item.id)) continue;
			const storeResult = yield* storeBoardItemInInventoryFx({
				item,
				scope,
			});
			if (storeResult === "stored") {
				result.storedItemInstanceIds.add(item.id);
			}
			if (storeResult === "failed") {
				result.failedItemInstanceIds.add(item.id);
			}
		}

		return result;
	},
);
