import type { BoardMemoryFulfillmentPlan } from "~/board-memory/readBoardMemoryFulfillmentPlan";
import type { StoreCurrentBoardItemsInInventoryResult } from "~/board-memory/storeCurrentBoardItemsInInventoryFx";

export namespace BoardMemoryRestorePlan {
	export interface Type {
		canCleanBoard: boolean;
		cleanupResult: StoreCurrentBoardItemsInInventoryResult.Type;
		fulfillmentPlan: BoardMemoryFulfillmentPlan.Type;
	}
}
