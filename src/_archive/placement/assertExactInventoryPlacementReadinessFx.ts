import { Effect } from "effect";
import { match, P } from "ts-pattern";
import { readBoardItemAtCellFx } from "~/board/readBoardItemAtCellFx";
import { readBoardItemMaxCountCapacityFx } from "~/board/readBoardItemMaxCountCapacityFx";
import { GameEngineError } from "~/engine/model/GameEngineError";
import {
	isGameSaveInventoryInstance,
	isGameSaveInventoryStack,
} from "~/inventory/model/GameSaveInventorySlot";
import type {
	InventoryItemPlaceReadinessProps,
	InventoryPlacementDraft,
} from "~/placement/InventoryItemPlaceReadinessTypes";
import { assertInventoryStackPlacementCapacityFx } from "~/placement/assertInventoryStackPlacementCapacityFx";
import { readBoardPlacementCapacityFx } from "~/placement/readBoardPlacementCapacityFx";

const assertExactTargetCellIsEmptyFx = Effect.fn("assertExactTargetCellIsEmptyFx")(function* ({
	props,
}: {
	props: InventoryItemPlaceReadinessProps;
}) {
	const occupied = yield* readBoardItemAtCellFx({
		save: props.save,
		x: props.action.x,
		y: props.action.y,
	});
	if (!occupied) return;

	return yield* Effect.fail(
		GameEngineError.actionRejected("unsupported_target", "Board cell is occupied."),
	);
});

const assertExactInstancePlacementReadinessFx = Effect.fn(
	"assertExactInstancePlacementReadinessFx",
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
				"Exact inventory placement supports a single item only.",
			),
		);
	}

	const boardItemMaxCountCapacity = yield* readBoardItemMaxCountCapacityFx({
		config: props.config,
		itemId: draft.slot.itemId,
		save: props.save,
	});
	if (boardItemMaxCountCapacity > 0) return;

	return yield* Effect.fail(
		GameEngineError.actionRejected(
			"board:max-count",
			`Board already has the maximum allowed count for "${draft.slot.itemId}".`,
		),
	);
});

const assertExactStackPlacementReadinessFx = Effect.fn("assertExactStackPlacementReadinessFx")(
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
		yield* assertInventoryStackPlacementCapacityFx({
			boardCapacity,
			draft,
			props,
		});
	},
);

export const assertExactInventoryPlacementReadinessFx = Effect.fn(
	"assertExactInventoryPlacementReadinessFx",
)(function* ({
	draft,
	props,
}: {
	draft: InventoryPlacementDraft;
	props: InventoryItemPlaceReadinessProps;
}) {
	yield* assertExactTargetCellIsEmptyFx({
		props,
	});

	yield* match(draft)
		.with(
			{
				slot: P.when(isGameSaveInventoryInstance),
			},
			() =>
				assertExactInstancePlacementReadinessFx({
					draft,
					props,
				}),
		)
		.with(
			{
				slot: P.when(isGameSaveInventoryStack),
			},
			() =>
				assertExactStackPlacementReadinessFx({
					draft,
					props,
				}),
		)
		.exhaustive();
});
