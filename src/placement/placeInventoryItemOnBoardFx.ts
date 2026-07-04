import { Effect } from "effect";
import { match, P } from "ts-pattern";
import type { GameActionInventoryItemPlaceSchema } from "~/action/GameActionInventoryItemPlaceSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type {
	GameSave,
	GameSaveInventoryInstance,
	GameSaveInventoryStack,
} from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import { consumeInventorySlotQuantityFx } from "~/inventory/consumeInventorySlotQuantityFx";
import {
	isGameSaveInventoryInstance,
	isGameSaveInventoryStack,
} from "~/inventory/model/GameSaveInventorySlot";
import { createGameEngineResultFx } from "~/job/createGameEngineResultFx";
import { checkInventoryItemPlaceReadinessFx } from "~/placement/checkInventoryItemPlaceReadinessFx";
import { placeBoardItemInstanceFx } from "~/placement/placeBoardItemInstanceFx";
import { placeGameSaveItemsFx } from "~/placement/placeGameSaveItemsFx";
import { planItemBoardPlacementCellsFx } from "~/placement/planItemBoardPlacementCellsFx";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";

export namespace placeInventoryItemOnBoardFx {
	export interface Props {
		action: GameActionInventoryItemPlaceSchema.Type;
		config: GameConfig;
		save: GameSave;
		nowMs: number;
	}
}

type InventoryPlacementMode = NonNullable<GameActionInventoryItemPlaceSchema.Type["placementMode"]>;

type InventoryPlacementState = {
	consumedEvent: GameEvent;
	itemId: string;
	liveSlot: GameSaveInventoryInstance | GameSaveInventoryStack;
	nextSave: GameSave;
	placedCreatedAtMs: number | undefined;
	placementMode: InventoryPlacementMode;
	quantity: number;
};

const readPlacementStateFx = Effect.fn("placeInventoryItemOnBoardFx.readPlacementStateFx")(
	function* (props: placeInventoryItemOnBoardFx.Props) {
		yield* checkInventoryItemPlaceReadinessFx(props);

		const quantity = props.action.quantity ?? 1;
		const nextSave = yield* cloneGameSaveFx({
			save: props.save,
		});
		const consumed = yield* consumeInventorySlotQuantityFx({
			nextSave,
			quantity,
			reason: "inventory-placement",
			runtimeState: "preserve-instance",
			slotIndex: props.action.slotIndex,
		});
		return {
			consumedEvent: consumed.consumedEvent,
			itemId: consumed.itemId,
			liveSlot: consumed.slot,
			nextSave,
			placedCreatedAtMs:
				consumed.slot.createdAtMs ??
				(props.config.items[consumed.itemId]?.effects?.length ? props.nowMs : undefined),
			placementMode: props.action.placementMode ?? "exact",
			quantity,
		} satisfies InventoryPlacementState;
	},
);

const readGameEnginePlacementResultFx = Effect.fn(
	"placeInventoryItemOnBoardFx.readGameEnginePlacementResultFx",
)(function* ({
	events,
	props,
	save,
}: {
	events: GameEvent[];
	props: placeInventoryItemOnBoardFx.Props;
	save: GameSave;
}) {
	return yield* createGameEngineResultFx({
		config: props.config,
		events,
		nowMs: props.nowMs,
		save,
	});
});

const readInventoryInstanceTargetCellFx = Effect.fn(
	"placeInventoryItemOnBoardFx.readInventoryInstanceTargetCellFx",
)(function* ({
	props,
	state,
}: {
	props: placeInventoryItemOnBoardFx.Props;
	state: InventoryPlacementState;
}) {
	return yield* match(state.placementMode)
		.with("exact", () =>
			Effect.succeed({
				x: props.action.x,
				y: props.action.y,
			}),
		)
		.with("nearest_by_manhattan", () =>
			Effect.gen(function* () {
				const [nearestAllowedCell] = yield* planItemBoardPlacementCellsFx({
					config: props.config,
					itemId: state.itemId,
					nowMs: props.nowMs,
					save: state.nextSave,
					seedCell: {
						x: props.action.x,
						y: props.action.y,
					},
				});
				if (nearestAllowedCell) return nearestAllowedCell;

				return yield* Effect.fail(
					GameEngineError.actionRejected(
						"board:full",
						"No board placement target available.",
					),
				);
			}),
		)
		.exhaustive();
});

const placeInventoryInstanceOnBoardFx = Effect.fn(
	"placeInventoryItemOnBoardFx.placeInventoryInstanceOnBoardFx",
)(function* ({
	props,
	state,
}: {
	props: placeInventoryItemOnBoardFx.Props;
	state: InventoryPlacementState & {
		liveSlot: GameSaveInventoryInstance;
	};
}) {
	if (state.quantity !== 1) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"unsupported_target",
				"Inventory instance placement supports a single item only.",
			),
		);
	}

	const targetCell = yield* readInventoryInstanceTargetCellFx({
		props,
		state,
	});
	const events = [
		state.consumedEvent,
	];
	yield* placeBoardItemInstanceFx({
		cell: targetCell,
		createdAtMs: state.placedCreatedAtMs,
		events,
		itemId: state.itemId,
		itemInstanceId: state.liveSlot.id,
		reason: "inventory-placement",
		save: state.nextSave,
	});
	state.nextSave.updatedAtMs = props.nowMs;

	return yield* readGameEnginePlacementResultFx({
		events,
		props,
		save: state.nextSave,
	});
});

type InventoryPlacementStackState = InventoryPlacementState & {
	liveSlot: GameSaveInventoryStack;
};

const placeInventoryStackByNearestPlacementFx = Effect.fn(
	"placeInventoryItemOnBoardFx.placeInventoryStackByNearestPlacementFx",
)(function* ({
	props,
	state,
}: {
	props: placeInventoryItemOnBoardFx.Props;
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

	return yield* readGameEnginePlacementResultFx({
		events: [
			state.consumedEvent,
			...placed.events,
		],
		props,
		save: placed.save,
	});
});

const placeInventoryStackExactlyFx = Effect.fn(
	"placeInventoryItemOnBoardFx.placeInventoryStackExactlyFx",
)(function* ({
	props,
	state,
}: {
	props: placeInventoryItemOnBoardFx.Props;
	state: InventoryPlacementStackState;
}) {
	const events = [
		state.consumedEvent,
	];
	yield* placeBoardItemInstanceFx({
		cell: {
			x: props.action.x,
			y: props.action.y,
		},
		createdAtMs: state.placedCreatedAtMs,
		events,
		itemId: state.itemId,
		reason: "inventory-placement",
		save: state.nextSave,
	});
	state.nextSave.updatedAtMs = props.nowMs;

	return yield* readGameEnginePlacementResultFx({
		events,
		props,
		save: state.nextSave,
	});
});

const placeInventoryStackOnBoardFx = Effect.fn(
	"placeInventoryItemOnBoardFx.placeInventoryStackOnBoardFx",
)(function* ({
	props,
	state,
}: {
	props: placeInventoryItemOnBoardFx.Props;
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

export const placeInventoryItemOnBoardFx = Effect.fn("placeInventoryItemOnBoardFx")(function* (
	props: placeInventoryItemOnBoardFx.Props,
) {
	const state = yield* readPlacementStateFx(props);
	return yield* match(state)
		.with(
			{
				liveSlot: P.when(isGameSaveInventoryInstance),
			},
			(instanceState) =>
				placeInventoryInstanceOnBoardFx({
					props,
					state: {
						...instanceState,
						liveSlot: instanceState.liveSlot,
					},
				}),
		)
		.with(
			{
				liveSlot: P.when(isGameSaveInventoryStack),
			},
			(stackState) =>
				placeInventoryStackOnBoardFx({
					props,
					state: {
						...stackState,
						liveSlot: stackState.liveSlot,
					},
				}),
		)
		.exhaustive();
});
