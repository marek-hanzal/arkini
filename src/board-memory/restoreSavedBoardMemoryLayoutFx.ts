import { Effect } from "effect";
import type { BoardMemoryLayoutItem } from "~/board-memory/BoardMemoryActivationTypes";
import type { BoardMemoryRestorePlan } from "~/board-memory/BoardMemoryRestorePlan";
import { readBoardMemoryEngineResultFx } from "~/board-memory/readBoardMemoryEngineResultFx";
import { readBoardMemoryRestorePlanFx } from "~/board-memory/readBoardMemoryRestorePlanFx";
import { removeBoardMemoryLayoutFromSaveFx } from "~/board-memory/removeBoardMemoryLayoutFromSaveFx";
import { restoreBoardMemoryLayoutItemsFx } from "~/board-memory/restoreBoardMemoryLayoutItemsFx";
import { storeCurrentBoardItemsInInventoryFx } from "~/board-memory/storeCurrentBoardItemsInInventoryFx";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";

const applyBoardMemoryRestorePlanFx = Effect.fn("applyBoardMemoryRestorePlanFx")(function* ({
	boardMemoryItemInstanceId,
	config,
	events,
	nextSave,
	plan,
	savedItems,
}: {
	boardMemoryItemInstanceId: string;
	config: GameConfig;
	events: GameEvent[];
	nextSave: GameSave;
	plan: BoardMemoryRestorePlan.Type;
	savedItems: readonly BoardMemoryLayoutItem[];
}) {
	const storeResult = yield* storeCurrentBoardItemsInInventoryFx({
		config,
		events,
		nextSave,
		preservedBoardItemInstanceIds: plan.fulfillmentPlan.preservedBoardItemInstanceIds,
	});
	if (storeResult.failedItemInstanceIds.size > 0) {
		return {
			restoredCount: 0,
			storeResult,
		};
	}

	const restoredCount = yield* restoreBoardMemoryLayoutItemsFx({
		boardMemoryItemInstanceId,
		config,
		events,
		nextSave,
		restoredIndexes: new Set(plan.fulfillmentPlan.restoredIndexes),
		savedItems,
	});

	return {
		restoredCount,
		storeResult,
	};
});

export const restoreSavedBoardMemoryLayoutFx = Effect.fn("restoreSavedBoardMemoryLayoutFx")(
	function* ({
		boardItemId,
		config,
		events,
		nextSave,
		nowMs,
		savedItems,
	}: {
		boardItemId: string;
		config: GameConfig;
		events: GameEvent[];
		nextSave: GameSave;
		nowMs: number;
		savedItems: readonly BoardMemoryLayoutItem[];
	}) {
		const plan = yield* readBoardMemoryRestorePlanFx({
			config,
			nextSave,
			savedItems,
		});
		if (!plan.canCleanBoard) {
			return yield* readBoardMemoryEngineResultFx({
				config,
				events,
				nextSave,
				nowMs,
			});
		}

		const { restoredCount, storeResult } = yield* applyBoardMemoryRestorePlanFx({
			boardMemoryItemInstanceId: boardItemId,
			config,
			events,
			nextSave,
			plan,
			savedItems,
		});
		if (storeResult.failedItemInstanceIds.size > 0) {
			return yield* readBoardMemoryEngineResultFx({
				config,
				events,
				nextSave,
				nowMs,
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
			config,
			events,
			nextSave,
			nowMs,
		});
	},
);
