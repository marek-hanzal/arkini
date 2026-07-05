import { Effect } from "effect";
import { readBoardItemRuntimeStateStatus } from "~/board/readBoardItemRuntimeStateStatus";
import { boardMemoryItemId } from "~/board-memory/GameBoardMemoryItem";
import type { BoardMemoryActivationScope } from "~/board-memory/BoardMemoryActivationTypes";
import { readSortedBoardMemoryBoardItems } from "~/board-memory/readSortedBoardMemoryBoardItems";
import { isItemStorageAllowed } from "~/config/isItemStorageAllowed";
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
	if (!config.items[item.itemId]) return false;
	if (
		!isItemStorageAllowed({
			config,
			itemId: item.itemId,
			location: "inventory",
		})
	) {
		return false;
	}

	const stateStatus = readBoardItemRuntimeStateStatus({
		itemInstanceId: item.id,
		save: nextSave,
	});
	if (stateStatus.busy) return false;

	return yield* placeBoardItemInInventoryFx({
		config,
		events,
		item,
		mode:
			stateStatus.preservable || item.itemId === boardMemoryItemId
				? "preserve-instance"
				: "stack-copy",
		reason: "memory-store",
		save: nextSave,
	}).pipe(Effect.catchTag("GamePlacementFailed", () => Effect.succeed(false)));
});

export const storeCurrentBoardItemsInInventoryFx = Effect.fn("storeCurrentBoardItemsInInventoryFx")(
	function* ({ scope }: { scope: BoardMemoryActivationScope }) {
		const { nextSave } = scope;
		for (const item of readSortedBoardMemoryBoardItems({
			save: nextSave,
		})) {
			yield* storeBoardItemInInventoryFx({
				item,
				scope,
			});
		}
	},
);
