import { Effect } from "effect";
import { readBoardItemMaxCountCapacityFx } from "~/board/readBoardItemMaxCountCapacityFx";
import { isItemStorageAllowed } from "~/config/isItemStorageAllowed";
import type { GamePlacementFailureReason } from "~/placement/GamePlacementFailureReasonSchema";
import type {
	CraftCompletionTarget,
	CraftJobCompletionScope,
} from "~/craft/CraftJobCompletionTypes";

export const readCraftCompletionBlockedReasonFx = Effect.fn("readCraftCompletionBlockedReasonFx")(
	function* ({
		scope,
		target,
	}: {
		scope: CraftJobCompletionScope;
		target: CraftCompletionTarget;
	}) {
		if (
			!isItemStorageAllowed({
				config: scope.config,
				itemId: target.recipe.resultItemId,
				location: "board",
			})
		) {
			return "storage:inventory-forbidden" satisfies GamePlacementFailureReason;
		}

		const targetIgnoredIds = new Set([
			target.liveJob.targetItemInstanceId,
		]);
		const remainingCapacity = yield* readBoardItemMaxCountCapacityFx({
			config: scope.config,
			ignoredBoardItemInstanceIds: targetIgnoredIds,
			itemId: target.recipe.resultItemId,
			save: scope.save,
		});
		return remainingCapacity <= 0
			? ("board:max-count" satisfies GamePlacementFailureReason)
			: undefined;
	},
);
