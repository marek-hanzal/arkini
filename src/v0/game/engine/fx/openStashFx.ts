import { Effect } from "effect";
import { checkStashOpenReadinessFx } from "~/v0/game/engine/fx/checkStashOpenReadinessFx";
import { cloneGameSaveFx } from "~/v0/game/engine/fx/cloneGameSaveFx";
import { consumeActivationInputsFx } from "~/v0/game/engine/fx/consumeActivationInputsFx";
import { placeGameSaveItemsFx } from "~/v0/game/engine/fx/placeGameSaveItemsFx";
import { readNextWakeAtMsFx } from "~/v0/game/engine/fx/readNextWakeAtMsFx";
import { readBoardItemCell } from "~/v0/game/engine/fx/readBoardItemCell";
import { rollLootTableItemsFx } from "~/v0/game/engine/fx/rollLootTableItemsFx";
import { scheduleGameItemSpawnsFx } from "~/v0/game/engine/fx/scheduleGameItemSpawnsFx";
import { scheduleStashDepletionFx } from "~/v0/game/engine/fx/scheduleStashDepletionFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionStashOpen } from "~/v0/game/engine/model/GameActionStashOpen";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameSaveItemPlacementRequest } from "~/v0/game/engine/model/GameSaveItemPlacementRequest";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace openStashFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionStashOpen;
		nowMs: number;
	}
}

export const openStashFx = Effect.fn("openStashFx")(function* ({
	config,
	save,
	action,
	nowMs,
}: openStashFx.Props) {
	const checked = yield* checkStashOpenReadinessFx({
		action,
		config,
		save,
	});
	const lootTable = config.lootTables[checked.stash.outputTableId];
	if (!lootTable) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(
				`Missing loot table "${checked.stash.outputTableId}".`,
			),
		);
	}

	const consumed = yield* consumeActivationInputsFx({
		inputRefs: action.inputRefs,
		inputs: checked.stash.inputs,
		nowMs,
		reason: "stash-input",
		save,
	});
	const roll = yield* rollLootTableItemsFx({
		lootTable,
	});
	const placementRequests = roll.items.map(
		(item) =>
			({
				...item,
				originItemInstanceId: action.stashItemInstanceId,
				reason: "stash-output",
			}) satisfies GameSaveItemPlacementRequest,
	);
	const seedCell = readBoardItemCell({
		itemInstanceId: action.stashItemInstanceId,
		save: consumed.save,
	});
	const preflightPlacement = yield* placeGameSaveItemsFx({
		config,
		items: placementRequests,
		nowMs,
		save: consumed.save,
		seedCell,
	});
	if (preflightPlacement.type === "blocked") {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"placement_unavailable",
				`Stash "${action.stashItemInstanceId}" output cannot be placed.`,
			),
		);
	}

	const nextSave = yield* cloneGameSaveFx({
		save: consumed.save,
	});
	const nextRemainingCharges = checked.remainingCharges - 1;
	if (nextRemainingCharges > 0) {
		nextSave.stashes[action.stashItemInstanceId] = {
			remainingCharges: nextRemainingCharges,
		};
	} else {
		delete nextSave.stashes[action.stashItemInstanceId];
	}
	const scheduledSpawns = yield* scheduleGameItemSpawnsFx({
		dueAtMs: nowMs,
		items: placementRequests,
		save: nextSave,
	});
	if (nextRemainingCharges === 0) {
		yield* scheduleStashDepletionFx({
			afterEventIds: scheduledSpawns.eventIds,
			dueAtMs: scheduledSpawns.lastDueAtMs,
			onDepleted: checked.stash.onDepleted,
			save: nextSave,
			stashItemId: checked.stashItem.itemId,
			stashItemInstanceId: action.stashItemInstanceId,
		});
	}
	nextSave.updatedAtMs = nowMs;

	return {
		events: [
			...consumed.events,
			{
				openedAtMs: nowMs,
				remainingCharges: nextRemainingCharges,
				stashId: checked.stashId,
				stashItemInstanceId: action.stashItemInstanceId,
				type: "stash.opened" as const,
			},
			...(nextRemainingCharges === 0
				? [
						{
							depletedAtMs: nowMs,
							stashId: checked.stashId,
							stashItemInstanceId: action.stashItemInstanceId,
							type: "stash.depleted" as const,
						},
					]
				: []),
		],
		nextWakeAtMs: yield* readNextWakeAtMsFx({
			save: nextSave,
		}),
		save: nextSave,
	} satisfies GameEngineResult;
});
