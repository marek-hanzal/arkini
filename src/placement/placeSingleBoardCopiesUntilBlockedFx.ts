import { Effect } from "effect";
import { match } from "ts-pattern";
import type { BoardCell } from "~/board/BoardCellPosition";
import { readBoardItemMaxCountCapacityFx } from "~/board/readBoardItemMaxCountCapacityFx";
import { placeBoardItemInstanceFx } from "~/placement/placeBoardItemInstanceFx";
import { readSingleBoardPlacementTargetFx } from "~/placement/readSingleBoardPlacementTargetFx";
import { readSingleItemBoardStorageAllowed } from "~/placement/readSinglePlacementStorageAllowed";
import type {
	BoardPlacementProgress,
	SingleItemPlacementScope,
} from "~/placement/SingleGameSaveItemPlacementTypes";

const placeSingleBoardItemAtCellFx = Effect.fn("placeSingleBoardItemAtCellFx")(function* ({
	cell,
	quantity,
	scope,
}: {
	cell: BoardCell;
	quantity: number;
	scope: SingleItemPlacementScope;
}) {
	yield* placeBoardItemInstanceFx({
		cell,
		createdAtMs: scope.createdAtMs,
		events: scope.events,
		itemId: scope.item.itemId,
		quantity,
		originItemInstanceId: scope.item.originItemInstanceId,
		reason: scope.item.reason,
		save: scope.save,
	});
});

export const placeSingleBoardCopiesUntilBlockedFx = Effect.fn(
	"placeSingleBoardCopiesUntilBlockedFx",
)(function* (scope: SingleItemPlacementScope) {
	const progress: BoardPlacementProgress = {
		placedQuantity: 0,
		remainingQuantity: scope.item.quantity,
	};
	if (!readSingleItemBoardStorageAllowed(scope)) return progress;

	while (progress.remainingQuantity > 0) {
		const maxCountCapacity = yield* readBoardItemMaxCountCapacityFx({
			config: scope.config,
			ignoredBoardItemInstanceIds: scope.freedBoardItemInstanceIds,
			itemId: scope.item.itemId,
			save: scope.save,
		});
		const placedQuantity = Math.min(
			progress.remainingQuantity,
			scope.itemDefinition.maxStackSize,
			maxCountCapacity,
		);
		const target = yield* readSingleBoardPlacementTargetFx(scope);
		const placed = yield* match(target)
			.with(
				{
					type: "cell",
				},
				({ cell }) =>
					Effect.gen(function* () {
						yield* placeSingleBoardItemAtCellFx({
							cell,
							quantity: placedQuantity,
							scope,
						});
						return true;
					}),
			)
			.with(
				{
					type: "board:full",
				},
				() =>
					Effect.sync(() => {
						progress.stopReason = "board:full";
						return false;
					}),
			)
			.with(
				{
					type: "board:max-count",
				},
				() =>
					Effect.sync(() => {
						progress.stopReason = "board:max-count";
						return false;
					}),
			)
			.exhaustive();
		if (!placed) break;
		progress.remainingQuantity -= placedQuantity;
		progress.placedQuantity += placedQuantity;
	}

	return progress;
});
