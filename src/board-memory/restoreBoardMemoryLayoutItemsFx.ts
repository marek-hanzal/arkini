import { Effect } from "effect";
import type {
	BoardMemoryActivationScope,
	BoardMemoryLayoutItem,
} from "~/board-memory/BoardMemoryActivationTypes";
import { restoreBoardOnlyLayoutItemsFx } from "~/board-memory/restoreBoardOnlyLayoutItemsFx";
import { restoreInventoryBackedLayoutItemsFx } from "~/board-memory/restoreInventoryBackedLayoutItemsFx";

export const restoreBoardMemoryLayoutItemsFx = Effect.fn("restoreBoardMemoryLayoutItemsFx")(
	function* ({
		restoredIndexes = new Set(),
		savedItems,
		scope,
	}: {
		restoredIndexes?: Set<number>;
		savedItems: readonly BoardMemoryLayoutItem[];
		scope: BoardMemoryActivationScope;
	}) {
		const boardOnlyRestoredIndexes = yield* restoreBoardOnlyLayoutItemsFx({
			savedItems,
			scope,
		});
		for (const index of boardOnlyRestoredIndexes) {
			restoredIndexes.add(index);
		}
		return yield* restoreInventoryBackedLayoutItemsFx({
			restoredIndexes,
			savedItems,
			scope,
		});
	},
);
