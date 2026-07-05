import { Effect } from "effect";
import { match } from "ts-pattern";
import type { BoardCell } from "~/board/BoardCellPosition";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSaveInventoryInstance } from "~/engine/model/GameSaveSchema";
import {
	type InventoryPlacementState,
	type PlaceInventoryItemOnBoardProps,
} from "~/placement/InventoryItemOnBoardPlacementTypes";
import { placeBoardItemInstanceFx } from "~/placement/placeBoardItemInstanceFx";
import { planItemBoardPlacementCellsFx } from "~/placement/planItemBoardPlacementCellsFx";
import { readInventoryPlacementResultFx } from "~/placement/readInventoryPlacementResultFx";

const readInventoryInstanceTargetCellFx = Effect.fn("readInventoryInstanceTargetCellFx")(
	function* ({
		props,
		state,
	}: {
		props: PlaceInventoryItemOnBoardProps;
		state: InventoryPlacementState;
	}) {
		return yield* match(state.placementMode)
			.with("exact", () =>
				Effect.succeed({
					x: props.action.x,
					y: props.action.y,
				} satisfies BoardCell),
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
	},
);

export const placeInventoryInstanceOnBoardFx = Effect.fn("placeInventoryInstanceOnBoardFx")(
	function* ({
		props,
		state,
	}: {
		props: PlaceInventoryItemOnBoardProps;
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

		return yield* readInventoryPlacementResultFx({
			events,
			props,
			save: state.nextSave,
		});
	},
);
