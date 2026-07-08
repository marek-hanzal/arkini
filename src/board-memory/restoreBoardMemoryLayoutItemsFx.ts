import { Effect } from "effect";
import type { BoardMemoryLayoutItem } from "~/board-memory/BoardMemoryActivationTypes";
import { restoreBoardOnlyLayoutItemsFx } from "~/board-memory/restoreBoardOnlyLayoutItemsFx";
import { restoreInventoryBackedLayoutItemsFx } from "~/board-memory/restoreInventoryBackedLayoutItemsFx";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";

export const restoreBoardMemoryLayoutItemsFx = Effect.fn("restoreBoardMemoryLayoutItemsFx")(
	function* ({
		boardMemoryItemInstanceId,
		config,
		events,
		nextSave,
		restoredIndexes = new Set(),
		savedItems,
	}: {
		boardMemoryItemInstanceId: string;
		config: GameConfig;
		events: GameEvent[];
		nextSave: GameSave;
		restoredIndexes?: Set<number>;
		savedItems: readonly BoardMemoryLayoutItem[];
	}) {
		const boardOnlyRestoredIndexes = yield* restoreBoardOnlyLayoutItemsFx({
			config,
			events,
			nextSave,
			savedItems,
		});
		for (const index of boardOnlyRestoredIndexes) {
			restoredIndexes.add(index);
		}
		return yield* restoreInventoryBackedLayoutItemsFx({
			boardMemoryItemInstanceId,
			config,
			events,
			nextSave,
			restoredIndexes,
			savedItems,
		});
	},
);
