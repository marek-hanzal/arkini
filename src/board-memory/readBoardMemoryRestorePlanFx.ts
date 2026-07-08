import { Effect } from "effect";
import type { BoardMemoryLayoutItem } from "~/board-memory/BoardMemoryActivationTypes";
import type { BoardMemoryRestorePlan } from "~/board-memory/BoardMemoryRestorePlan";
import { readBoardMemoryFulfillmentPlan } from "~/board-memory/readBoardMemoryFulfillmentPlan";
import { storeCurrentBoardItemsInInventoryFx } from "~/board-memory/storeCurrentBoardItemsInInventoryFx";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";

export const readBoardMemoryRestorePlanFx = Effect.fn("readBoardMemoryRestorePlanFx")(function* ({
	config,
	nextSave,
	savedItems,
}: {
	config: GameConfig;
	nextSave: GameSave;
	savedItems: readonly BoardMemoryLayoutItem[];
}) {
	const fulfillmentPlan = readBoardMemoryFulfillmentPlan({
		config,
		save: nextSave,
		savedItems,
	});
	const cleanupResult = yield* storeCurrentBoardItemsInInventoryFx({
		config,
		events: [],
		nextSave: yield* cloneGameSaveFx({
			save: nextSave,
		}),
		preservedBoardItemInstanceIds: fulfillmentPlan.preservedBoardItemInstanceIds,
	});

	return {
		canCleanBoard: cleanupResult.failedItemInstanceIds.size === 0,
		cleanupResult,
		fulfillmentPlan,
	} satisfies BoardMemoryRestorePlan.Type;
});
