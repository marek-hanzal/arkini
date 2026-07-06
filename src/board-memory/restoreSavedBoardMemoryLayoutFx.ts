import { Effect } from "effect";
import type {
	BoardMemoryActivationScope,
	BoardMemoryLayoutItem,
} from "~/board-memory/BoardMemoryActivationTypes";
import { readBoardMemoryEngineResultFx } from "~/board-memory/readBoardMemoryEngineResultFx";
import { readBoardMemoryFulfillmentPlan } from "~/board-memory/readBoardMemoryFulfillmentPlan";
import { removeBoardMemoryLayoutFromSaveFx } from "~/board-memory/removeBoardMemoryLayoutFromSaveFx";
import { restoreBoardMemoryLayoutItemsFx } from "~/board-memory/restoreBoardMemoryLayoutItemsFx";
import { storeCurrentBoardItemsInInventoryFx } from "~/board-memory/storeCurrentBoardItemsInInventoryFx";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";

const applyBoardMemoryRestoreTransferFx = Effect.fn("applyBoardMemoryRestoreTransferFx")(
	function* ({
		savedItems,
		scope,
	}: {
		savedItems: readonly BoardMemoryLayoutItem[];
		scope: BoardMemoryActivationScope;
	}) {
		const { config, nextSave } = scope;
		const fulfillmentPlan = readBoardMemoryFulfillmentPlan({
			config,
			save: nextSave,
			savedItems,
		});
		const storeResult = yield* storeCurrentBoardItemsInInventoryFx({
			preservedBoardItemInstanceIds: fulfillmentPlan.preservedBoardItemInstanceIds,
			scope,
		});
		const restoredCount = yield* restoreBoardMemoryLayoutItemsFx({
			restoredIndexes: fulfillmentPlan.restoredIndexes,
			savedItems,
			scope,
		});

		return {
			restoredCount,
			storeResult,
		};
	},
);

const canApplyBoardMemoryRestoreFx = Effect.fn("canApplyBoardMemoryRestoreFx")(function* ({
	savedItems,
	scope,
}: {
	savedItems: readonly BoardMemoryLayoutItem[];
	scope: BoardMemoryActivationScope;
}) {
	const dryRunScope: BoardMemoryActivationScope = {
		...scope,
		events: [],
		nextSave: yield* cloneGameSaveFx({
			save: scope.nextSave,
		}),
	};
	const { restoredCount, storeResult } = yield* applyBoardMemoryRestoreTransferFx({
		savedItems,
		scope: dryRunScope,
	});

	return storeResult.failedItemInstanceIds.size === 0 && restoredCount === savedItems.length;
});

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
		if (
			!(yield* canApplyBoardMemoryRestoreFx({
				savedItems,
				scope,
			}))
		) {
			return yield* readBoardMemoryEngineResultFx({
				scope,
			});
		}

		const { restoredCount } = yield* applyBoardMemoryRestoreTransferFx({
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
