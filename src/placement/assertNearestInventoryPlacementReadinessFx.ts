import { Effect } from "effect";
import { match, P } from "ts-pattern";
import { GameEngineError } from "~/engine/model/GameEngineError";
import { assertInventoryStackPlacementCapacityFx } from "~/placement/assertInventoryStackPlacementCapacityFx";
import {
	isGameSaveInventoryInstance,
	isGameSaveInventoryStack,
} from "~/inventory/model/GameSaveInventorySlot";
import type {
	InventoryItemPlaceReadinessProps,
	InventoryPlacementDraft,
} from "~/placement/InventoryItemPlaceReadinessTypes";
import {
	readBoardPlacementBlockReasonFx,
	readBoardPlacementCapacityFx,
} from "~/placement/readBoardPlacementCapacityFx";
import { planItemBoardPlacementCellsFx } from "~/placement/planItemBoardPlacementCellsFx";

const assertNearestInstancePlacementReadinessFx = Effect.fn(
	"assertNearestInstancePlacementReadinessFx",
)(function* ({
	draft,
	props,
}: {
	draft: InventoryPlacementDraft;
	props: InventoryItemPlaceReadinessProps;
}) {
	if (draft.quantity !== 1) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"unsupported_target",
				"Inventory instance placement supports a single item only.",
			),
		);
	}

	const boardPlacementCapacity = yield* readBoardPlacementCapacityFx({
		config: props.config,
		itemId: draft.slot.itemId,
		save: props.save,
	});
	if (boardPlacementCapacity === 0) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				yield* readBoardPlacementBlockReasonFx({
					config: props.config,
					itemId: draft.slot.itemId,
					save: props.save,
				}),
				"No board placement target available.",
			),
		);
	}

	const [targetCell] = yield* planItemBoardPlacementCellsFx({
		config: props.config,
		itemId: draft.slot.itemId,
		nowMs: props.nowMs,
		save: draft.saveAfterInventoryRemoval,
		seedCell: {
			x: props.action.x,
			y: props.action.y,
		},
	});
	if (targetCell) return;

	return yield* Effect.fail(
		GameEngineError.actionRejected("board:full", "No board placement target available."),
	);
});

const assertNearestStackPlacementReadinessFx = Effect.fn("assertNearestStackPlacementReadinessFx")(
	function* ({
		draft,
		props,
	}: {
		draft: InventoryPlacementDraft;
		props: InventoryItemPlaceReadinessProps;
	}) {
		const boardCapacity = yield* readBoardPlacementCapacityFx({
			config: props.config,
			itemId: draft.slot.itemId,
			save: props.save,
		});
		const boardPlacementCells =
			boardCapacity > 0
				? yield* planItemBoardPlacementCellsFx({
						config: props.config,
						itemId: draft.slot.itemId,
						nowMs: props.nowMs,
						save: draft.saveAfterInventoryRemoval,
						seedCell: {
							x: props.action.x,
							y: props.action.y,
						},
					})
				: [];
		const allowedBoardCapacity = boardPlacementCells.length > 0 ? boardCapacity : 0;
		yield* assertInventoryStackPlacementCapacityFx({
			boardCapacity: allowedBoardCapacity,
			draft,
			props,
		});
	},
);

export const assertNearestInventoryPlacementReadinessFx = Effect.fn(
	"assertNearestInventoryPlacementReadinessFx",
)(function* ({
	draft,
	props,
}: {
	draft: InventoryPlacementDraft;
	props: InventoryItemPlaceReadinessProps;
}) {
	yield* match(draft)
		.with(
			{
				slot: P.when(isGameSaveInventoryInstance),
			},
			() =>
				assertNearestInstancePlacementReadinessFx({
					draft,
					props,
				}),
		)
		.with(
			{
				slot: P.when(isGameSaveInventoryStack),
			},
			() =>
				assertNearestStackPlacementReadinessFx({
					draft,
					props,
				}),
		)
		.exhaustive();
});
