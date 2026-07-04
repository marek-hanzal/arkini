import { Context, Effect } from "effect";
import { match } from "ts-pattern";
import type { BoardCell } from "~/board/BoardCellPosition";
import { readBoardItemMaxCountCapacityFx } from "~/board/logic/readBoardItemMaxCountCapacityFx";
import type { GameConfig } from "~/config/GameConfigTypes";
import { isItemStorageAllowed } from "~/config/isItemStorageAllowed";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import { placeGameSaveInventoryRemainderFx } from "~/placement/placeGameSaveInventoryRemainderFx";
import type { GameSaveItemPlacementRequest } from "~/placement/GameSaveItemPlacementRequest";
import { planEmptyBoardCellsFx } from "~/placement/planEmptyBoardCellsFx";
import { planItemBoardPlacementCellsFx } from "~/placement/planItemBoardPlacementCellsFx";
import { createGameItemInstanceIdFx } from "~/save/createGameItemInstanceIdFx";

type GameSaveSingleItemPlacementResult = {
	type: "placed";
};

export namespace placeSingleGameSaveItemRequestFx {
	export interface Props {
		config: GameConfig;
		events: GameEvent[];
		freedBoardItemInstanceIds?: ReadonlySet<string>;
		item: GameSaveItemPlacementRequest;
		nowMs: number;
		save: GameSave;
		seedCell?: BoardCell;
	}
}

type SingleItemPlacementScope = placeSingleGameSaveItemRequestFx.Props & {
	createdAtMs: number | undefined;
	itemDefinition: NonNullable<GameConfig["items"][string]>;
};

type BoardPlacementStopReason = "board:full" | "board:max-count";

type BoardPlacementTarget =
	| {
			cell: BoardCell;
			type: "cell";
	  }
	| {
			type: BoardPlacementStopReason;
	  };

type BoardPlacementProgress = {
	placedQuantity: number;
	remainingQuantity: number;
	stopReason?: BoardPlacementStopReason;
};

class SingleItemPlacementScopeFx extends Context.Tag("SingleItemPlacementScopeFx")<
	SingleItemPlacementScopeFx,
	SingleItemPlacementScope
>() {
	//
}

const readPlacementItemDefinitionFx = Effect.fn(
	"placeSingleGameSaveItemRequestFx.readPlacementItemDefinitionFx",
)(function* ({ config, item }: { config: GameConfig; item: GameSaveItemPlacementRequest }) {
	const itemDefinition = config.items[item.itemId];
	if (itemDefinition) return itemDefinition;

	return yield* Effect.fail(
		GameEngineError.configReferenceMissing(`Missing item "${item.itemId}".`),
	);
});

const readPlacementCreatedAtMs = ({
	item,
	itemDefinition,
	nowMs,
}: {
	item: GameSaveItemPlacementRequest;
	itemDefinition: NonNullable<GameConfig["items"][string]>;
	nowMs: number;
}) => item.createdAtMs ?? (itemDefinition.effects?.length ? nowMs : undefined);

const readItemBoardStorageAllowedFx = Effect.fn(
	"placeSingleGameSaveItemRequestFx.readItemBoardStorageAllowedFx",
)(function* () {
	const { config, item } = yield* SingleItemPlacementScopeFx;
	return isItemStorageAllowed({
		config,
		itemId: item.itemId,
		location: "board",
	});
});

const readItemInventoryStorageAllowedFx = Effect.fn(
	"placeSingleGameSaveItemRequestFx.readItemInventoryStorageAllowedFx",
)(function* () {
	const { config, item } = yield* SingleItemPlacementScopeFx;
	return isItemStorageAllowed({
		config,
		itemId: item.itemId,
		location: "inventory",
	});
});

const readBoardPlacementTargetFx = Effect.fn(
	"placeSingleGameSaveItemRequestFx.readBoardPlacementTargetFx",
)(function* () {
	const { config, freedBoardItemInstanceIds, item, nowMs, save, seedCell } =
		yield* SingleItemPlacementScopeFx;
	const maxCountCapacity = yield* readBoardItemMaxCountCapacityFx({
		config,
		ignoredBoardItemInstanceIds: freedBoardItemInstanceIds,
		itemId: item.itemId,
		save,
	});
	if (maxCountCapacity <= 0) {
		return {
			type: "board:max-count",
		} satisfies BoardPlacementTarget;
	}

	const emptyCells = yield* planEmptyBoardCellsFx({
		config,
		freedBoardItemInstanceIds,
		save,
		seedCell,
	});
	if (emptyCells.length === 0) {
		return {
			type: "board:full",
		} satisfies BoardPlacementTarget;
	}

	const [emptyCell] = yield* planItemBoardPlacementCellsFx({
		config,
		freedBoardItemInstanceIds,
		itemId: item.itemId,
		nowMs,
		save,
		seedCell,
	});
	return emptyCell
		? ({
				cell: emptyCell,
				type: "cell",
			} satisfies BoardPlacementTarget)
		: ({
				type: "board:full",
			} satisfies BoardPlacementTarget);
});

const placeBoardItemAtCellFx = Effect.fn("placeSingleGameSaveItemRequestFx.placeBoardItemAtCellFx")(
	function* ({ cell }: { cell: BoardCell }) {
		const { createdAtMs, events, item, save } = yield* SingleItemPlacementScopeFx;
		const itemInstanceId = yield* createGameItemInstanceIdFx();
		save.board.items[itemInstanceId] = {
			...(createdAtMs !== undefined
				? {
						createdAtMs,
					}
				: {}),
			id: itemInstanceId,
			itemId: item.itemId,
			x: cell.x,
			y: cell.y,
		};
		events.push({
			itemId: item.itemId,
			originItemInstanceId: item.originItemInstanceId,
			reason: item.reason,
			to: {
				kind: "board",
				itemInstanceId,
				x: cell.x,
				y: cell.y,
			},
			type: "item.created",
		});
	},
);

const placeBoardCopiesUntilBlockedFx = Effect.fn(
	"placeSingleGameSaveItemRequestFx.placeBoardCopiesUntilBlockedFx",
)(function* () {
	const { item } = yield* SingleItemPlacementScopeFx;
	const progress: BoardPlacementProgress = {
		placedQuantity: 0,
		remainingQuantity: item.quantity,
	};
	if (!(yield* readItemBoardStorageAllowedFx())) return progress;

	while (progress.remainingQuantity > 0) {
		const target = yield* readBoardPlacementTargetFx();
		const placed = yield* match(target)
			.with(
				{
					type: "cell",
				},
				({ cell }) =>
					Effect.gen(function* () {
						yield* placeBoardItemAtCellFx({
							cell,
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
		progress.remainingQuantity -= 1;
		progress.placedQuantity += 1;
	}

	return progress;
});

const placeInventoryRemainderFx = Effect.fn(
	"placeSingleGameSaveItemRequestFx.placeInventoryRemainderFx",
)(function* ({ remainingQuantity }: { remainingQuantity: number }) {
	const { createdAtMs, events, item, itemDefinition, save } = yield* SingleItemPlacementScopeFx;
	if (!(yield* readItemInventoryStorageAllowedFx())) return remainingQuantity === 0;

	return yield* placeGameSaveInventoryRemainderFx({
		createdAtMs,
		events,
		item,
		maxStackSize: itemDefinition.maxStackSize,
		remainingQuantity,
		slots: save.inventory.slots,
	});
});

const readPlacementFailureReasonFx = Effect.fn(
	"placeSingleGameSaveItemRequestFx.readPlacementFailureReasonFx",
)(function* ({ progress }: { progress: BoardPlacementProgress }) {
	const canPlaceOnBoard = yield* readItemBoardStorageAllowedFx();
	const canPlaceInInventory = yield* readItemInventoryStorageAllowedFx();
	if (canPlaceOnBoard && (!canPlaceInInventory || progress.placedQuantity === 0)) {
		return progress.stopReason ?? "board:full";
	}
	return "inventory:full" as const;
});

const placeSingleGameSaveItemRequestProgramFx = Effect.fn(
	"placeSingleGameSaveItemRequestFx.placeSingleGameSaveItemRequestProgramFx",
)(function* () {
	const progress = yield* placeBoardCopiesUntilBlockedFx();
	if (
		yield* placeInventoryRemainderFx({
			remainingQuantity: progress.remainingQuantity,
		})
	) {
		return {
			type: "placed",
		} satisfies GameSaveSingleItemPlacementResult;
	}

	return yield* Effect.fail(
		GameEngineError.placementFailed(
			yield* readPlacementFailureReasonFx({
				progress,
			}),
			"Placement target is full.",
		),
	);
});

export const placeSingleGameSaveItemRequestFx = Effect.fn("placeSingleGameSaveItemRequestFx")(
	function* (props: placeSingleGameSaveItemRequestFx.Props) {
		const itemDefinition = yield* readPlacementItemDefinitionFx({
			config: props.config,
			item: props.item,
		});
		return yield* Effect.provideService(
			placeSingleGameSaveItemRequestProgramFx(),
			SingleItemPlacementScopeFx,
			{
				...props,
				createdAtMs: readPlacementCreatedAtMs({
					item: props.item,
					itemDefinition,
					nowMs: props.nowMs,
				}),
				itemDefinition,
			},
		);
	},
);
