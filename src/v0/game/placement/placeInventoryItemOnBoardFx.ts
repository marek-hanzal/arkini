import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { checkInventoryItemPlaceReadinessFx } from "~/v0/game/placement/checkInventoryItemPlaceReadinessFx";
import { cloneGameSaveFx } from "~/v0/game/save/cloneGameSaveFx";
import { createGameItemInstanceIdFx } from "~/v0/game/save/createGameItemInstanceIdFx";
import { planItemBoardPlacementCellsFx } from "~/v0/game/placement/planItemBoardPlacementCellsFx";
import { placeGameSaveItemsFx } from "~/v0/game/placement/placeGameSaveItemsFx";
import { readNextWakeAtMsFx } from "~/v0/game/job/readNextWakeAtMsFx";
import type { GameActionInventoryItemPlaceSchema } from "~/v0/game/action/GameActionInventoryItemPlaceSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import { checkItemCreateBlockedByEffectsFx } from "~/v0/game/effects/checkItemCreateBlockedByEffectsFx";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameEvent } from "~/v0/game/event/GameEventSchema";
import {
	isGameSaveInventoryInstance,
	readGameSaveInventorySlotQuantity,
} from "~/v0/game/inventory/GameSaveInventorySlot";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace placeInventoryItemOnBoardFx {
	export interface Props {
		action: GameActionInventoryItemPlaceSchema.Type;
		config: GameConfig;
		save: GameSave;
		nowMs: number;
	}
}

export const placeInventoryItemOnBoardFx = Effect.fn("placeInventoryItemOnBoardFx")(function* ({
	action,
	config,
	save,
	nowMs,
}: placeInventoryItemOnBoardFx.Props) {
	yield* checkInventoryItemPlaceReadinessFx({
		action,
		config,
		nowMs,
		save,
	});

	const quantity = action.quantity ?? 1;
	const placementMode = action.placementMode ?? "exact";

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
	const placedCreatedAtMs =
		liveSlot.createdAtMs ??
		(config.items[itemId]?.passiveEffectIds?.length ? nowMs : undefined);
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
		const [nearestAllowedCell] =
			placementMode === "exact"
				? []
				: yield* planItemBoardPlacementCellsFx({
						config,
						itemId,
						nowMs,
						save: nextSave,
						seedCell: {
							x: action.x,
							y: action.y,
						},
					});
		const targetCell =
			placementMode === "exact"
				? {
						x: action.x,
						y: action.y,
					}
				: (nearestAllowedCell ?? null);

		if (!targetCell) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"board:full",
					"No board placement target available.",
				),
			);
		}
		yield* checkItemCreateBlockedByEffectsFx({
			config,
			itemId,
			nowMs,
			save: nextSave,
			targetCell,
		});

		nextSave.board.items[liveSlot.id] = {
			...(placedCreatedAtMs !== undefined
				? {
						createdAtMs: placedCreatedAtMs,
					}
				: {}),
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
				nowMs,
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
					createdAtMs: placedCreatedAtMs,
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
				nowMs,
				save: placed.save,
			}),
			save: placed.save,
		} satisfies GameEngineResult;
	}

	const itemInstanceId = yield* createGameItemInstanceIdFx();
	yield* checkItemCreateBlockedByEffectsFx({
		config,
		itemId,
		nowMs,
		save: nextSave,
		targetCell: {
			x: action.x,
			y: action.y,
		},
	});
	nextSave.board.items[itemInstanceId] = {
		...(placedCreatedAtMs !== undefined
			? {
					createdAtMs: placedCreatedAtMs,
				}
			: {}),
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
			nowMs,
			save: nextSave,
		}),
		save: nextSave,
	} satisfies GameEngineResult;
});
