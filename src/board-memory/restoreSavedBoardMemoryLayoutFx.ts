import { Effect } from "effect";
import type {
	BoardMemoryActivationScope,
	BoardMemoryLayoutItem,
} from "~/board-memory/BoardMemoryActivationTypes";
import { readBoardMemoryEngineResultFx } from "~/board-memory/readBoardMemoryEngineResultFx";
import { removeBoardMemoryLayoutFromSaveFx } from "~/board-memory/removeBoardMemoryLayoutFromSaveFx";
import { restoreBoardMemoryLayoutItemsFx } from "~/board-memory/restoreBoardMemoryLayoutItemsFx";
import { storeCurrentBoardItemsInInventoryFx } from "~/board-memory/storeCurrentBoardItemsInInventoryFx";

export const restoreSavedBoardMemoryLayoutFx = Effect.fn("restoreSavedBoardMemoryLayoutFx")(
	function* ({
		boardItemId,
		savedItems,
		scope,
	}: {
		boardItemId: string;
		savedItems: readonly BoardMemoryLayoutItem[];
		scope: BoardMemoryActivationScope;
	}) {
		const { events, nextSave, nowMs } = scope;
		yield* storeCurrentBoardItemsInInventoryFx({
			scope,
		});
		const restoredCount = yield* restoreBoardMemoryLayoutItemsFx({
			savedItems,
			scope,
		});

		yield* removeBoardMemoryLayoutFromSaveFx({
			boardItemId,
			save: nextSave,
		});
		nextSave.updatedAtMs = nowMs;
		events.push({
			atMs: nowMs,
			boardItemId,
			restoredCount,
			storedCount: savedItems.length,
			type: "board.memory.restored",
		});

		return yield* readBoardMemoryEngineResultFx({
			scope,
		});
	},
);
