import { Effect } from "effect";
import { GameEngineError } from "~/engine/model/GameEngineError";
import { placeSingleBoardCopiesUntilBlockedFx } from "~/placement/placeSingleBoardCopiesUntilBlockedFx";
import { placeSingleInventoryRemainderFx } from "~/placement/placeSingleInventoryRemainderFx";
import { readSinglePlacementFailureReason } from "~/placement/readSinglePlacementFailureReason";
import type {
	GameSaveSingleItemPlacementResult,
	SingleItemPlacementScope,
} from "~/placement/SingleGameSaveItemPlacementTypes";

export const placeSingleGameSaveItemRequestProgramFx = Effect.fn(
	"placeSingleGameSaveItemRequestProgramFx",
)(function* (scope: SingleItemPlacementScope) {
	const progress = yield* placeSingleBoardCopiesUntilBlockedFx(scope);
	if (
		yield* placeSingleInventoryRemainderFx({
			remainingQuantity: progress.remainingQuantity,
			scope,
		})
	) {
		return {
			type: "placed",
		} satisfies GameSaveSingleItemPlacementResult;
	}

	return yield* Effect.fail(
		GameEngineError.placementFailed(
			readSinglePlacementFailureReason({
				progress,
				scope,
			}),
			"Placement target is full.",
		),
	);
});
