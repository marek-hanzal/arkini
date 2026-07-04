import { Effect } from "effect";
import { isItemStorageAllowed } from "~/config/isItemStorageAllowed";
import { readBoardItemMaxCountCapacityFx } from "~/board/logic/readBoardItemMaxCountCapacityFx";
import { GameEngineError } from "~/engine/model/GameEngineError";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";
import { planEmptyBoardCellsFx } from "~/placement/planEmptyBoardCellsFx";
import { planItemBoardPlacementCellsFx } from "~/placement/planItemBoardPlacementCellsFx";
import type { GameActionDebugItemSpawnSchema } from "~/action/GameActionDebugItemSpawnSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace checkDebugItemSpawnReadinessFx {
	export interface Props {
		action: GameActionDebugItemSpawnSchema.Type;
		config: GameConfig;
		nowMs?: number;
		save: GameSave;
	}
}

const readDebugInventoryCapacityReadyFx = Effect.fn(
	"checkDebugItemSpawnReadinessFx.readDebugInventoryCapacityReadyFx",
)(function* ({
	config,
	itemId,
	quantity,
	save,
}: {
	config: GameConfig;
	itemId: string;
	quantity: number;
	save: GameSave;
}) {
	const item = config.items[itemId];
	if (!item) return false;

	let available = 0;
	for (const slot of save.inventory.slots) {
		if (!slot) {
			available += item.maxStackSize;
			continue;
		}

		if ("kind" in slot) continue;
		if (slot.itemId !== itemId) continue;

		available += Math.max(0, item.maxStackSize - slot.quantity);
	}

	return available >= quantity;
});

export const checkDebugItemSpawnReadinessFx = Effect.fn("checkDebugItemSpawnReadinessFx")(
	function* ({ action, config, nowMs, save }: checkDebugItemSpawnReadinessFx.Props) {
		const item = config.items[action.itemId];
		if (!item) {
			return yield* Effect.fail(
				GameEngineError.configReferenceMissing(`Missing item "${action.itemId}".`),
			);
		}

		if (
			!isItemStorageAllowed({
				config,
				itemId: action.itemId,
				location: action.location,
			})
		) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"storage_restricted",
					`Item "${action.itemId}" cannot be spawned into ${action.location}.`,
				),
			);
		}

		const quantity = action.quantity ?? 1;

		if (action.location === "board") {
			const boardMaxCountCapacity = yield* readBoardItemMaxCountCapacityFx({
				config,
				itemId: action.itemId,
				save,
			});
			if (boardMaxCountCapacity < quantity) {
				return yield* Effect.fail(
					GameEngineError.actionRejected(
						"board:max-count",
						`Board already has the maximum allowed count for "${action.itemId}".`,
					),
				);
			}

			const simulatedSave = yield* cloneGameSaveFx({
				save,
			});
			for (let index = 0; index < quantity; index += 1) {
				const emptyCells = yield* planEmptyBoardCellsFx({
					config,
					save: simulatedSave,
				});
				if (emptyCells.length === 0) {
					return yield* Effect.fail(
						GameEngineError.actionRejected(
							"board:full",
							"Board has no space for debug item.",
						),
					);
				}

				const [targetCell] = yield* planItemBoardPlacementCellsFx({
					config,
					itemId: action.itemId,
					nowMs,
					save: simulatedSave,
				});
				if (!targetCell) {
					return yield* Effect.fail(
						GameEngineError.actionRejected(
							"board:full",
							"Board has no space for debug item.",
						),
					);
				}

				simulatedSave.board.items[`debug-readiness:${index}`] = {
					...(config.items[action.itemId]?.effects?.length
						? {
								createdAtMs: nowMs,
							}
						: {}),
					id: `debug-readiness:${index}`,
					itemId: action.itemId,
					x: targetCell.x,
					y: targetCell.y,
				};
			}
			return;
		}

		const hasInventoryCapacity = yield* readDebugInventoryCapacityReadyFx({
			config,
			itemId: action.itemId,
			quantity,
			save,
		});
		if (!hasInventoryCapacity) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"inventory:full",
					"Inventory has no space for debug item.",
				),
			);
		}
	},
);
