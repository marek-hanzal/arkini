import { Effect } from "effect";
import type {
	BoardMemoryActivationScope,
	BoardMemoryLayoutItem,
} from "~/board-memory/BoardMemoryActivationTypes";
import { restoreBoardOnlyLayoutItemsFx } from "~/board-memory/restoreBoardOnlyLayoutItemsFx";
import { restoreInventoryBackedLayoutItemsFx } from "~/board-memory/restoreInventoryBackedLayoutItemsFx";

export const restoreBoardMemoryLayoutItemsFx = Effect.fn("restoreBoardMemoryLayoutItemsFx")(
	function* ({
		savedItems,
		scope,
	}: {
		savedItems: readonly BoardMemoryLayoutItem[];
		scope: BoardMemoryActivationScope;
	}) {
		const boardOnlyRestoredIndexes = yield* restoreBoardOnlyLayoutItemsFx({
			savedItems,
			scope,
		});
		return yield* restoreInventoryBackedLayoutItemsFx({
			restoredIndexes: boardOnlyRestoredIndexes,
			savedItems,
			scope,
		});
	},
);
