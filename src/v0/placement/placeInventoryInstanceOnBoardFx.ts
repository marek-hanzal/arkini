import { Effect } from "effect";
import { match } from "ts-pattern";
import type { BoardCell } from "~/board/BoardCellPosition";
import type { GameActionInventoryItemPlaceSchema } from "~/action/GameActionInventoryItemPlaceSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSaveInventoryInstance } from "~/engine/model/GameSaveSchema";
import type { InventoryPlacementState } from "~/placement/InventoryItemOnBoardPlacementTypes";
import { placeBoardItemInstanceFx } from "~/placement/placeBoardItemInstanceFx";
import { planItemBoardPlacementCellsFx } from "~/placement/planItemBoardPlacementCellsFx";
import { readInventoryPlacementResultFx } from "~/placement/readInventoryPlacementResultFx";

const readInventoryInstanceTargetCellFx = Effect.fn("readInventoryInstanceTargetCellFx")(
	function* ({
		action,
		config,
		nowMs,
		state,
	}: {
		action: GameActionInventoryItemPlaceSchema.Type;
		config: GameConfig;
		nowMs: number;
		state: InventoryPlacementState;
	}) {
		return yield* match(state.placementMode)
			.with("exact", () =>
				Effect.succeed({
					x: action.x,
					y: action.y,
				} satisfies BoardCell),
			)
			.with("nearest_by_manhattan", () =>
				Effect.gen(function* () {
					const [nearestAllowedCell] = yield* planItemBoardPlacementCellsFx({
						config,
						itemId: state.itemId,
						nowMs,
						save: state.nextSave,
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
	},
);

export const placeInventoryInstanceOnBoardFx = Effect.fn("placeInventoryInstanceOnBoardFx")(
	function* ({
		action,
		config,
		nowMs,
		state,
	}: {
		action: GameActionInventoryItemPlaceSchema.Type;
		config: GameConfig;
		nowMs: number;
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
			action,
			config,
			nowMs,
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
		state.nextSave.updatedAtMs = nowMs;

		return yield* readInventoryPlacementResultFx({
			config,
			events,
			nowMs,
			save: state.nextSave,
		});
	},
);
