import { Context, Effect } from "effect";
import { match, P } from "ts-pattern";
import type { GameActionInventoryItemPlaceSchema } from "~/action/GameActionInventoryItemPlaceSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type {
	GameSave,
	GameSaveInventoryInstance,
	GameSaveInventorySlot,
	GameSaveInventoryStack,
} from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import {
	isGameSaveInventoryInstance,
	isGameSaveInventoryStack,
	readGameSaveInventorySlotQuantity,
} from "~/inventory/model/GameSaveInventorySlot";
import { createInventoryItemConsumedEventFx } from "~/inventory/createInventoryItemConsumedEventFx";
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

type InventoryPlacementSlot = Exclude<GameSaveInventorySlot, null>;

type InventoryPlacementState = {
	consumedEvent: GameEvent;
	itemId: string;
	liveSlot: InventoryPlacementSlot;
	nextQuantity: number;
	nextSave: GameSave;
	placedCreatedAtMs: number | undefined;
	placementMode: InventoryPlacementMode;
	quantity: number;
};

class InventoryItemBoardPlacementScopeFx extends Context.Tag("InventoryItemBoardPlacementScopeFx")<
	InventoryItemBoardPlacementScopeFx,
	placeInventoryItemOnBoardFx.Props
>() {
	//
}

const readPlacementStateFx = Effect.fn("placeInventoryItemOnBoardFx.readPlacementStateFx")(
	function* () {
		const { action, config, nowMs, save } = yield* InventoryItemBoardPlacementScopeFx;
		yield* checkInventoryItemPlaceReadinessFx({
			action,
			config,
			nowMs,
			save,
		});

		const quantity = action.quantity ?? 1;
		const nextSave = yield* cloneGameSaveFx({
			save,
		});
		const liveSlot = nextSave.inventory.slots[action.slotIndex];
		if (!liveSlot) {
			return yield* Effect.fail(
				GameEngineError.actionRejected("input_unavailable", "Inventory slot disappeared."),
			);
		}

		const itemId = liveSlot.itemId;
		const previousQuantity = readGameSaveInventorySlotQuantity(liveSlot);
		const nextQuantity = previousQuantity - quantity;
		return {
			consumedEvent: yield* createInventoryItemConsumedEventFx({
				itemId,
				nextQuantity,
				previousQuantity,
				quantity,
				reason: "inventory-placement",
				slotIndex: action.slotIndex,
			}),
			itemId,
			liveSlot,
			nextQuantity,
			nextSave,
			placedCreatedAtMs:
				liveSlot.createdAtMs ?? (config.items[itemId]?.effects?.length ? nowMs : undefined),
			placementMode: action.placementMode ?? "exact",
			quantity,
		} satisfies InventoryPlacementState;
	},
);

const readGameEnginePlacementResultFx = Effect.fn(
	"placeInventoryItemOnBoardFx.readGameEnginePlacementResultFx",
)(function* ({ events, save }: { events: GameEvent[]; save: GameSave }) {
	const { config, nowMs } = yield* InventoryItemBoardPlacementScopeFx;
	return yield* createGameEngineResultFx({
		config,
		events,
		nowMs,
		save,
	});
});

const readInventoryInstanceTargetCellFx = Effect.fn(
	"placeInventoryItemOnBoardFx.readInventoryInstanceTargetCellFx",
)(function* ({ itemId, nextSave, placementMode }: InventoryPlacementState) {
	const { action, config, nowMs } = yield* InventoryItemBoardPlacementScopeFx;
	return yield* match(placementMode)
		.with("exact", () =>
			Effect.succeed({
				x: action.x,
				y: action.y,
			}),
		)
		.with("nearest_by_manhattan", () =>
			Effect.gen(function* () {
				const [nearestAllowedCell] = yield* planItemBoardPlacementCellsFx({
					config,
					itemId,
					nowMs,
					save: nextSave,
					seedCell: {
						x: action.x,
						y: action.y,
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
)(function* (
	state: InventoryPlacementState & {
		liveSlot: GameSaveInventoryInstance;
	},
) {
	const { action, nowMs } = yield* InventoryItemBoardPlacementScopeFx;
	if (state.quantity !== 1) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"unsupported_target",
				"Inventory instance placement supports a single item only.",
			),
		);
	}

	state.nextSave.inventory.slots[action.slotIndex] = null;
	const targetCell = yield* readInventoryInstanceTargetCellFx(state);
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
	state.nextSave.updatedAtMs = nowMs;

	return yield* readGameEnginePlacementResultFx({
		events,
		save: state.nextSave,
	});
});

type InventoryPlacementStackState = InventoryPlacementState & {
	liveSlot: GameSaveInventoryStack;
};

const consumeInventoryStackForPlacementFx = Effect.fn(
	"placeInventoryItemOnBoardFx.consumeInventoryStackForPlacementFx",
)(function* (state: InventoryPlacementStackState) {
	const { action } = yield* InventoryItemBoardPlacementScopeFx;
	return yield* match(state.nextQuantity)
		.when(
			(quantity) => quantity > 0,
			(quantity) =>
				Effect.sync(() => {
					state.liveSlot.quantity = quantity;
				}),
		)
		.otherwise(() =>
			Effect.sync(() => {
				state.nextSave.inventory.slots[action.slotIndex] = null;
			}),
		);
});

const placeInventoryStackByNearestPlacementFx = Effect.fn(
	"placeInventoryItemOnBoardFx.placeInventoryStackByNearestPlacementFx",
)(function* (state: InventoryPlacementStackState) {
	const { action, config, nowMs } = yield* InventoryItemBoardPlacementScopeFx;
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

	return yield* readGameEnginePlacementResultFx({
		events: [
			state.consumedEvent,
			...placed.events,
		],
		save: placed.save,
	});
});

const placeInventoryStackExactlyFx = Effect.fn(
	"placeInventoryItemOnBoardFx.placeInventoryStackExactlyFx",
)(function* (state: InventoryPlacementStackState) {
	const { action, nowMs } = yield* InventoryItemBoardPlacementScopeFx;
	const events = [
		state.consumedEvent,
	];
	yield* placeBoardItemInstanceFx({
		cell: {
			x: action.x,
			y: action.y,
		},
		createdAtMs: state.placedCreatedAtMs,
		events,
		itemId: state.itemId,
		reason: "inventory-placement",
		save: state.nextSave,
	});
	state.nextSave.updatedAtMs = nowMs;

	return yield* readGameEnginePlacementResultFx({
		events,
		save: state.nextSave,
	});
});

const placeInventoryStackOnBoardFx = Effect.fn(
	"placeInventoryItemOnBoardFx.placeInventoryStackOnBoardFx",
)(function* (state: InventoryPlacementStackState) {
	yield* consumeInventoryStackForPlacementFx(state);

	return yield* match(state.placementMode)
		.with("nearest_by_manhattan", () => placeInventoryStackByNearestPlacementFx(state))
		.with("exact", () => placeInventoryStackExactlyFx(state))
		.exhaustive();
});

const placeInventoryItemOnBoardProgramFx = Effect.fn("placeInventoryItemOnBoardFx.programFx")(
	function* () {
		const state = yield* readPlacementStateFx();
		return yield* match(state)
			.with(
				{
					liveSlot: P.when(isGameSaveInventoryInstance),
				},
				(instanceState) =>
					placeInventoryInstanceOnBoardFx({
						...instanceState,
						liveSlot: instanceState.liveSlot,
					}),
			)
			.with(
				{
					liveSlot: P.when(isGameSaveInventoryStack),
				},
				(stackState) =>
					placeInventoryStackOnBoardFx({
						...stackState,
						liveSlot: stackState.liveSlot,
					}),
			)
			.exhaustive();
	},
);

export const placeInventoryItemOnBoardFx = Effect.fn("placeInventoryItemOnBoardFx")(function* (
	props: placeInventoryItemOnBoardFx.Props,
) {
	return yield* placeInventoryItemOnBoardProgramFx().pipe(
		Effect.provideService(InventoryItemBoardPlacementScopeFx, props),
	);
});
