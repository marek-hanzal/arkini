import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { cloneGameSaveFx } from "~/v0/game/engine/fx/cloneGameSaveFx";
import { createGameItemInstanceIdFx } from "~/v0/game/engine/fx/createGameItemInstanceIdFx";
import { findFirstEmptyBoardCellFx } from "~/v0/game/engine/fx/findFirstEmptyBoardCellFx";
import { placeGameSaveItemsFx } from "~/v0/game/engine/fx/placeGameSaveItemsFx";
import { readNextWakeAtMsFx } from "~/v0/game/engine/fx/readNextWakeAtMsFx";
import type { GameActionInventoryItemPlaceSchema } from "~/v0/game/engine/model/GameActionInventoryItemPlaceSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameEvent } from "~/v0/game/engine/model/GameEventSchema";
import {
	isGameSaveInventoryInstance,
	readGameSaveInventorySlotQuantity,
} from "~/v0/game/engine/model/GameSaveInventorySlot";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace placeInventoryItemOnBoardFx {
	export interface Props {
		action: GameActionInventoryItemPlaceSchema.Type;
		config: GameConfig;
		save: GameSave;
		nowMs: number;
	}
}

const assertBoardCellWithinBounds = ({
	action,
	config,
}: {
	action: GameActionInventoryItemPlaceSchema.Type;
	config: GameConfig;
}) =>
	action.x < config.game.board.width && action.y < config.game.board.height
		? Effect.succeed(undefined)
		: Effect.fail(
				GameEngineError.actionRejected(
					"unsupported_target",
					"Board cell is outside board.",
				),
			);

export const placeInventoryItemOnBoardFx = Effect.fn("placeInventoryItemOnBoardFx")(function* ({
	action,
	config,
	save,
	nowMs,
}: placeInventoryItemOnBoardFx.Props) {
	yield* assertBoardCellWithinBounds({
		action,
		config,
	});

	const slot = save.inventory.slots[action.slotIndex];
	if (!slot) {
		return yield* Effect.fail(
			GameEngineError.actionRejected("input_unavailable", "Inventory slot is empty."),
		);
	}
	if (!config.items[slot.itemId]) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing item "${slot.itemId}".`),
		);
	}

	const quantity = action.quantity ?? 1;
	const slotQuantity = readGameSaveInventorySlotQuantity(slot);
	if (quantity > slotQuantity) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"input_unavailable",
				`Inventory slot has ${slotQuantity} item(s), cannot place ${quantity}.`,
			),
		);
	}

	const placementMode = action.placementMode ?? "exact";
	if (placementMode === "exact" && quantity !== 1) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"unsupported_target",
				"Exact inventory placement supports a single item only.",
			),
		);
	}

	const occupied = Object.values(save.board.items).find(
		(entry) => entry.x === action.x && entry.y === action.y,
	);
	if (placementMode === "exact" && occupied) {
		return yield* Effect.fail(
			GameEngineError.actionRejected("unsupported_target", "Board cell is occupied."),
		);
	}

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
	const consumedEvent = {
		from: {
			kind: "inventory" as const,
			nextQuantity,
			previousQuantity,
			quantity,
			slotIndex: action.slotIndex,
		},
		itemId,
		reason: "inventory-placement" as const,
		type: "item.consumed" as const,
	} satisfies GameEvent;

	if (isGameSaveInventoryInstance(liveSlot)) {
		if (quantity !== 1) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"unsupported_target",
					"Inventory instance placement supports a single item only.",
				),
			);
		}

		nextSave.inventory.slots[action.slotIndex] = null;
		const targetCell =
			placementMode === "exact"
				? {
						x: action.x,
						y: action.y,
					}
				: yield* findFirstEmptyBoardCellFx({
						config,
						save: nextSave,
						seedCell: {
							x: action.x,
							y: action.y,
						},
					});

		if (!targetCell) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"board:full",
					"No board placement target available.",
				),
			);
		}

		nextSave.board.items[liveSlot.id] = {
			id: liveSlot.id,
			itemId,
			x: targetCell.x,
			y: targetCell.y,
		};
		nextSave.updatedAtMs = nowMs;

		return {
			events: [
				consumedEvent,
				{
					itemId,
					reason: "inventory-placement" as const,
					to: {
						kind: "board" as const,
						itemInstanceId: liveSlot.id,
						x: targetCell.x,
						y: targetCell.y,
					},
					type: "item.created" as const,
				},
			],
			nextWakeAtMs: yield* readNextWakeAtMsFx({
				save: nextSave,
			}),
			save: nextSave,
		} satisfies GameEngineResult;
	}

	if (nextQuantity > 0) {
		liveSlot.quantity = nextQuantity;
	} else {
		nextSave.inventory.slots[action.slotIndex] = null;
	}

	if (placementMode === "nearest_by_manhattan") {
		const placed = yield* placeGameSaveItemsFx({
			config,
			items: [
				{
					itemId,
					quantity,
					reason: "inventory-placement",
				},
			],
			nowMs,
			save: nextSave,
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

		return {
			events: [
				consumedEvent,
				...placed.events,
			],
			nextWakeAtMs: yield* readNextWakeAtMsFx({
				save: placed.save,
			}),
			save: placed.save,
		} satisfies GameEngineResult;
	}

	const itemInstanceId = yield* createGameItemInstanceIdFx({
		save: nextSave,
	});
	nextSave.board.items[itemInstanceId] = {
		id: itemInstanceId,
		itemId,
		x: action.x,
		y: action.y,
	};
	nextSave.updatedAtMs = nowMs;

	return {
		events: [
			consumedEvent,
			{
				itemId,
				reason: "inventory-placement" as const,
				to: {
					kind: "board" as const,
					itemInstanceId,
					x: action.x,
					y: action.y,
				},
				type: "item.created" as const,
			},
		],
		nextWakeAtMs: yield* readNextWakeAtMsFx({
			save: nextSave,
		}),
		save: nextSave,
	} satisfies GameEngineResult;
});
