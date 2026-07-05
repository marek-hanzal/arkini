import { Effect } from "effect";
import { readBoardItemMaxCountCapacityFx } from "~/board/readBoardItemMaxCountCapacityFx";
import { planBoardStackItemsFx } from "~/placement/planBoardStackItemsFx";
import { planEmptyBoardCellsFx } from "~/placement/planEmptyBoardCellsFx";
import { planItemBoardPlacementCellsFx } from "~/placement/planItemBoardPlacementCellsFx";
import type {
	BoardPlacementTarget,
	SingleItemPlacementScope,
} from "~/placement/SingleGameSaveItemPlacementTypes";

export const readSingleBoardPlacementTargetFx = Effect.fn("readSingleBoardPlacementTargetFx")(
	function* (scope: SingleItemPlacementScope) {
		const maxCountCapacity = yield* readBoardItemMaxCountCapacityFx({
			config: scope.config,
			ignoredBoardItemInstanceIds: scope.freedBoardItemInstanceIds,
			itemId: scope.item.itemId,
			save: scope.save,
		});
		if (maxCountCapacity <= 0) {
			return {
				type: "board:max-count",
			} satisfies BoardPlacementTarget;
		}

		const [stackTarget] = yield* planBoardStackItemsFx({
			config: scope.config,
			freedBoardItemInstanceIds: scope.freedBoardItemInstanceIds,
			itemId: scope.item.itemId,
			save: scope.save,
			seedCell: scope.seedCell,
		});
		if (stackTarget) {
			return {
				itemInstanceId: stackTarget.id,
				type: "stack",
			} satisfies BoardPlacementTarget;
		}

		const emptyCells = yield* planEmptyBoardCellsFx({
			config: scope.config,
			freedBoardItemInstanceIds: scope.freedBoardItemInstanceIds,
			save: scope.save,
			seedCell: scope.seedCell,
		});
		if (emptyCells.length === 0) {
			return {
				type: "board:full",
			} satisfies BoardPlacementTarget;
		}

		const [emptyCell] = yield* planItemBoardPlacementCellsFx({
			config: scope.config,
			freedBoardItemInstanceIds: scope.freedBoardItemInstanceIds,
			itemId: scope.item.itemId,
			nowMs: scope.nowMs,
			save: scope.save,
			seedCell: scope.seedCell,
		});
		return emptyCell
			? ({
					cell: emptyCell,
					type: "cell",
				} satisfies BoardPlacementTarget)
			: ({
					type: "board:full",
				} satisfies BoardPlacementTarget);
	},
);
