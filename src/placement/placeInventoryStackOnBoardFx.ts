import { Effect } from "effect";
import { match } from "ts-pattern";
import { GameEngineError } from "~/engine/model/GameEngineError";
import {
	type InventoryPlacementStackState,
	type PlaceInventoryItemOnBoardProps,
} from "~/placement/InventoryItemOnBoardPlacementTypes";
import { placeGameSaveItemsFx } from "~/placement/placeGameSaveItemsFx";
import { readInventoryPlacementResultFx } from "~/placement/readInventoryPlacementResultFx";

const placeInventoryStackByNearestPlacementFx = Effect.fn(
	"placeInventoryStackByNearestPlacementFx",
)(function* ({
	props,
	state,
}: {
	props: PlaceInventoryItemOnBoardProps;
	state: InventoryPlacementStackState;
}) {
	const placed = yield* placeGameSaveItemsFx({
		config: props.config,
		items: [
			{
				createdAtMs: state.placedCreatedAtMs,
				itemId: state.itemId,
				quantity: state.quantity,
				reason: "inventory-placement",
			},
		],
		nowMs: props.nowMs,
		save: state.nextSave,
		seedCell: {
			x: props.action.x,
			y: props.action.y,
		},
	}).pipe(
		Effect.catchTag("GamePlacementFailed", (error) =>
			Effect.fail(
				GameEngineError.actionRejected(error.reason, "No placement target available."),
			),
		),
	);

	return yield* readInventoryPlacementResultFx({
		events: [
			state.consumedEvent,
			...placed.events,
		],
		props,
		save: placed.save,
	});
});

const placeInventoryStackExactlyFx = Effect.fn("placeInventoryStackExactlyFx")(function* ({
	props,
	state,
}: {
	props: PlaceInventoryItemOnBoardProps;
	state: InventoryPlacementStackState;
}) {
	return yield* placeInventoryStackByNearestPlacementFx({
		props,
		state,
	});
});

export const placeInventoryStackOnBoardFx = Effect.fn("placeInventoryStackOnBoardFx")(function* ({
	props,
	state,
}: {
	props: PlaceInventoryItemOnBoardProps;
	state: InventoryPlacementStackState;
}) {
	return yield* match(state.placementMode)
		.with("nearest_by_manhattan", () =>
			placeInventoryStackByNearestPlacementFx({
				props,
				state,
			}),
		)
		.with("exact", () =>
			placeInventoryStackExactlyFx({
				props,
				state,
			}),
		)
		.exhaustive();
});
