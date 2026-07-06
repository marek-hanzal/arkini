import { Effect } from "effect";
import type { BoardMemoryActivationScope } from "~/board-memory/BoardMemoryActivationTypes";
import { readSortedBoardMemoryBoardItems } from "~/board-memory/readSortedBoardMemoryBoardItems";
import { readBoardMemoryBoardItemStorePlan } from "~/board-memory/readBoardMemoryBoardItemStorePlan";
import type { GameSaveBoardItem } from "~/engine/model/GameSaveSchema";
import { placeBoardItemInInventoryFx } from "~/placement/placeBoardItemInInventoryFx";

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
	if (storePlan.type === "skip") return false;

	return yield* placeBoardItemInInventoryFx({
		config,
		events,
		item,
		mode: storePlan.mode,
		reason: "memory-store",
		save: nextSave,
	}).pipe(Effect.catchTag("GamePlacementFailed", () => Effect.succeed(false)));
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
		for (const item of readSortedBoardMemoryBoardItems({
			save: nextSave,
		})) {
			if (preservedBoardItemInstanceIds.has(item.id)) continue;
			yield* storeBoardItemInInventoryFx({
				item,
				scope,
			});
		}
	},
);
