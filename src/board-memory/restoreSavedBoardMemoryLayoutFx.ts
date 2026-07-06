import { Effect } from "effect";
import type {
	BoardMemoryActivationScope,
	BoardMemoryLayoutItem,
} from "~/board-memory/BoardMemoryActivationTypes";
import type { BoardMemoryRestorePlan } from "~/board-memory/BoardMemoryRestorePlan";
import { readBoardMemoryEngineResultFx } from "~/board-memory/readBoardMemoryEngineResultFx";
import { readBoardMemoryRestorePlanFx } from "~/board-memory/readBoardMemoryRestorePlanFx";
import { removeBoardMemoryLayoutFromSaveFx } from "~/board-memory/removeBoardMemoryLayoutFromSaveFx";
import { restoreBoardMemoryLayoutItemsFx } from "~/board-memory/restoreBoardMemoryLayoutItemsFx";
import { storeCurrentBoardItemsInInventoryFx } from "~/board-memory/storeCurrentBoardItemsInInventoryFx";

const applyBoardMemoryRestorePlanFx = Effect.fn("applyBoardMemoryRestorePlanFx")(function* ({
	plan,
	savedItems,
	scope,
}: {
	plan: BoardMemoryRestorePlan.Type;
	savedItems: readonly BoardMemoryLayoutItem[];
	scope: BoardMemoryActivationScope;
}) {
	const storeResult = yield* storeCurrentBoardItemsInInventoryFx({
		preservedBoardItemInstanceIds: plan.fulfillmentPlan.preservedBoardItemInstanceIds,
		scope,
	});
	if (storeResult.failedItemInstanceIds.size > 0) {
		return {
			restoredCount: 0,
			storeResult,
		};
	}

	const restoredCount = yield* restoreBoardMemoryLayoutItemsFx({
		restoredIndexes: new Set(plan.fulfillmentPlan.restoredIndexes),
		savedItems,
		scope,
	});

	return {
		restoredCount,
		storeResult,
	};
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
		const plan = yield* readBoardMemoryRestorePlanFx({
			savedItems,
			scope,
		});
		if (!plan.canCleanBoard) {
			return yield* readBoardMemoryEngineResultFx({
				scope,
			});
		}

		const { restoredCount, storeResult } = yield* applyBoardMemoryRestorePlanFx({
			plan,
			savedItems,
			scope,
		});
		if (storeResult.failedItemInstanceIds.size > 0) {
			return yield* readBoardMemoryEngineResultFx({
				scope,
			});
		}

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
