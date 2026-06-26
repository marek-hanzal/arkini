import { Effect } from "effect";
import { checkDebugItemSpawnReadinessFx } from "~/v0/game/debug/checkDebugItemSpawnReadinessFx";
import { cloneGameSaveFx } from "~/v0/game/save/cloneGameSaveFx";
import { createGameItemInstanceIdFx } from "~/v0/game/save/createGameItemInstanceIdFx";
import { findFirstEmptyBoardCellFx } from "~/v0/game/placement/findFirstEmptyBoardCellFx";
import { placeGameSaveInventoryRemainderFx } from "~/v0/game/placement/placeGameSaveInventoryRemainderFx";
import { readNextWakeAtMsFx } from "~/v0/game/job/readNextWakeAtMsFx";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import { checkItemCreateBlockedByEffectsFx } from "~/v0/game/effects/checkItemCreateBlockedByEffectsFx";
import type { GameActionDebugItemSpawn } from "~/v0/game/action/GameActionDebugItemSpawn";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameEvent } from "~/v0/game/event/GameEventSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

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
	yield* checkDebugItemSpawnReadinessFx({
		action,
		config,
		nowMs,
		save,
	});

	const item = config.items[action.itemId];
	if (!item) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing item "${action.itemId}".`),
		);
	}

	const nextSave = yield* cloneGameSaveFx({
		save,
	});
	const events: GameEvent[] = [];
	const quantity = action.quantity ?? 1;

	if (action.location === "board") {
		for (let index = 0; index < quantity; index += 1) {
			const emptyCell = yield* findFirstEmptyBoardCellFx({
				config,
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

			yield* checkItemCreateBlockedByEffectsFx({
				config,
				itemId: action.itemId,
				nowMs,
				save: nextSave,
				targetCell: emptyCell,
			});

			const itemInstanceId = yield* createGameItemInstanceIdFx();
			nextSave.board.items[itemInstanceId] = {
				id: itemInstanceId,
				itemId: action.itemId,
				x: emptyCell.x,
				y: emptyCell.y,
			};
			events.push({
				itemId: action.itemId,
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
			events,
			item: {
				itemId: action.itemId,
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
			save: nextSave,
		}),
		save: nextSave,
	} satisfies GameEngineResult;
});
