import { Effect } from "effect";
import type {
	BoardMemoryActivationScope,
	BoardMemoryLayoutItem,
} from "~/board-memory/BoardMemoryActivationTypes";
import type { BoardMemoryRestorePlan } from "~/board-memory/BoardMemoryRestorePlan";
import { readBoardMemoryFulfillmentPlan } from "~/board-memory/readBoardMemoryFulfillmentPlan";
import { storeCurrentBoardItemsInInventoryFx } from "~/board-memory/storeCurrentBoardItemsInInventoryFx";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";

export const readBoardMemoryRestorePlanFx = Effect.fn("readBoardMemoryRestorePlanFx")(function* ({
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
	const dryRunScope: BoardMemoryActivationScope = {
		...scope,
		events: [],
		nextSave: yield* cloneGameSaveFx({
			save: nextSave,
		}),
	};
	const cleanupResult = yield* storeCurrentBoardItemsInInventoryFx({
		preservedBoardItemInstanceIds: fulfillmentPlan.preservedBoardItemInstanceIds,
		scope: dryRunScope,
	});

	return {
		canCleanBoard: cleanupResult.failedItemInstanceIds.size === 0,
		cleanupResult,
		fulfillmentPlan,
	} satisfies BoardMemoryRestorePlan.Type;
});
