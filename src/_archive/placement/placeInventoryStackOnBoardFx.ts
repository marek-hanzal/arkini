import { Effect } from "effect";
import type { GameActionInventoryItemPlaceSchema } from "~/action/GameActionInventoryItemPlaceSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { InventoryPlacementStackState } from "~/placement/InventoryItemOnBoardPlacementTypes";
import { placeGameSaveItemsFx } from "~/placement/placeGameSaveItemsFx";
import { readInventoryPlacementResultFx } from "~/placement/readInventoryPlacementResultFx";

const placeInventoryStackByNearestPlacementFx = Effect.fn(
	"placeInventoryStackByNearestPlacementFx",
)(function* ({
	action,
	config,
	nowMs,
	state,
}: {
	action: GameActionInventoryItemPlaceSchema.Type;
	config: GameConfig;
	nowMs: number;
	state: InventoryPlacementStackState;
}) {
	const placed = yield* placeGameSaveItemsFx({
		config,
		items: [
			{
				createdAtMs: state.placedCreatedAtMs,
				itemId: state.itemId,
				quantity: state.quantity,
				reason: "inventory-placement",
			},
		],
		nowMs,
		save: state.nextSave,
		seedCell: {
			x: action.x,
			y: action.y,
		},
	}).pipe(
		Effect.catchTag("GamePlacementFailed", (error) =>
			Effect.fail(
				GameEngineError.actionRejected(error.reason, "No placement target available."),
			),
		),
	);

	return yield* readInventoryPlacementResultFx({
		config,
		events: [
			state.consumedEvent,
			...placed.events,
		],
		nowMs,
		save: placed.save,
	});
});

export const placeInventoryStackOnBoardFx = Effect.fn("placeInventoryStackOnBoardFx")(function* ({
	action,
	config,
	nowMs,
	state,
}: {
	action: GameActionInventoryItemPlaceSchema.Type;
	config: GameConfig;
	nowMs: number;
	state: InventoryPlacementStackState;
}) {
	return yield* placeInventoryStackByNearestPlacementFx({
		action,
		config,
		nowMs,
		state,
	});
});
