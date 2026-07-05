import { Effect } from "effect";
import { readBoardItemAtCellFx } from "~/board/readBoardItemAtCellFx";
import { readBoardItemMaxCountCapacityFx } from "~/board/readBoardItemMaxCountCapacityFx";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type {
	InventoryItemPlaceReadinessProps,
	InventoryPlacementDraft,
} from "~/placement/InventoryItemPlaceReadinessTypes";

export const assertExactInventoryPlacementReadinessFx = Effect.fn(
	"assertExactInventoryPlacementReadinessFx",
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

	const occupied = yield* readBoardItemAtCellFx({
		save: props.save,
		x: props.action.x,
		y: props.action.y,
	});
	if (occupied) {
		return yield* Effect.fail(
			GameEngineError.actionRejected("unsupported_target", "Board cell is occupied."),
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
