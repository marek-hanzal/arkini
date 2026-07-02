import { Effect } from "effect";
import { checkDebugItemSpawnReadinessFx } from "~/debug/logic/checkDebugItemSpawnReadinessFx";
import { readGameCheatSpeedMode } from "~/cheat/GameCheatSpeedMode";
import { isCheatSpeedItemId, readCheatSpeedItemIdFromMode } from "~/cheat/GameCheatSpeedItem";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";
import { createGameItemInstanceIdFx } from "~/save/createGameItemInstanceIdFx";
import { planEmptyBoardCellsFx } from "~/placement/planEmptyBoardCellsFx";
import { planItemBoardPlacementCellsFx } from "~/placement/planItemBoardPlacementCellsFx";
import { placeGameSaveInventoryRemainderFx } from "~/placement/placeGameSaveInventoryRemainderFx";
import { readNextWakeAtMsFx } from "~/job/readNextWakeAtMsFx";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameActionDebugItemSpawn } from "~/action/GameActionDebugItemSpawn";
import type { GameConfig } from "~/config/GameConfigSchema";
import type { GameEngineResult } from "~/engine/model/GameEngineResult";
import type { GameEvent } from "~/event/GameEventSchema";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace spawnDebugItemFx {
	export interface Props {
		action: GameActionDebugItemSpawn;
		config: GameConfig;
		nowMs: number;
		save: GameSave;
	}
}

export const spawnDebugItemFx = Effect.fn("spawnDebugItemFx")(function* ({
	action,
	config,
	nowMs,
	save,
}: spawnDebugItemFx.Props) {
	const itemId = isCheatSpeedItemId(action.itemId)
		? readCheatSpeedItemIdFromMode(
				readGameCheatSpeedMode({
					save,
				}),
			)
		: action.itemId;
	const spawnAction = {
		...action,
		itemId,
	};

	yield* checkDebugItemSpawnReadinessFx({
		action: spawnAction,
		config,
		nowMs,
		save,
	});

	const item = config.items[itemId];
	if (!item) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing item "${spawnAction.itemId}".`),
		);
	}

	const nextSave = yield* cloneGameSaveFx({
		save,
	});
	const events: GameEvent[] = [];
	const quantity = action.quantity ?? 1;

	if (action.location === "board") {
		for (let index = 0; index < quantity; index += 1) {
			const emptyCells = yield* planEmptyBoardCellsFx({
				config,
				save: nextSave,
			});
			if (emptyCells.length === 0) {
				return yield* Effect.fail(
					GameEngineError.actionRejected(
						"board:full",
						"Board has no space for debug item.",
					),
				);
			}

			const [emptyCell] = yield* planItemBoardPlacementCellsFx({
				config,
				itemId: spawnAction.itemId,
				nowMs,
				save: nextSave,
			});
			if (!emptyCell) {
				return yield* Effect.fail(
					GameEngineError.actionRejected(
						"board:full",
						"Board has no space for debug item.",
					),
				);
			}

			const itemInstanceId = yield* createGameItemInstanceIdFx();
			nextSave.board.items[itemInstanceId] = {
				...(item.effects?.length
					? {
							createdAtMs: nowMs,
						}
					: {}),
				id: itemInstanceId,
				itemId: spawnAction.itemId,
				x: emptyCell.x,
				y: emptyCell.y,
			};
			events.push({
				itemId: spawnAction.itemId,
				reason: "debug",
				to: {
					kind: "board",
					itemInstanceId,
					x: emptyCell.x,
					y: emptyCell.y,
				},
				type: "item.created",
			});
		}
	} else {
		const placed = yield* placeGameSaveInventoryRemainderFx({
			createdAtMs: item.effects?.length ? nowMs : undefined,
			events,
			item: {
				itemId: spawnAction.itemId,
				quantity,
				reason: "debug",
			},
			maxStackSize: item.maxStackSize,
			remainingQuantity: quantity,
			slots: nextSave.inventory.slots,
		});

		if (!placed) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"inventory:full",
					"Inventory has no space for debug item.",
				),
			);
		}
	}

	nextSave.updatedAtMs = nowMs;

	return {
		events,
		nextWakeAtMs: yield* readNextWakeAtMsFx({
			config,
			nowMs,
			save: nextSave,
		}),
		save: nextSave,
	} satisfies GameEngineResult;
});
