import { Effect } from "effect";
import { checkGameRequirementsFx } from "~/v0/game/engine/fx/checkGameRequirementsFx";
import { cloneGameSaveFx } from "~/v0/game/engine/fx/cloneGameSaveFx";
import { consumeActivationInputsFx } from "~/v0/game/engine/fx/consumeActivationInputsFx";
import { placeGameSaveItemsFx } from "~/v0/game/engine/fx/placeGameSaveItemsFx";
import { readNextWakeAtMsFx } from "~/v0/game/engine/fx/readNextWakeAtMsFx";
import { readStashBoardItemFx } from "~/v0/game/engine/fx/readStashBoardItemFx";
import { readStashRemainingChargesFx } from "~/v0/game/engine/fx/readStashRemainingChargesFx";
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
	const stashItem = yield* readStashBoardItemFx({
		config,
		save,
		stashItemInstanceId: action.stashItemInstanceId,
	});
	const stashId = config.items[stashItem.itemId]?.stashId;
	const stash = stashId ? config.stashes[stashId] : undefined;
	if (!stashId || !stash) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(
				`Stash item "${stashItem.itemId}" references missing stash.`,
			),
		);
	}
	const lootTable = config.lootTables[stash.outputTableId];
	if (!lootTable) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing loot table "${stash.outputTableId}".`),
		);
	}
	const remainingCharges = yield* readStashRemainingChargesFx({
		config,
		save,
		stashId,
		stashItemInstanceId: action.stashItemInstanceId,
	});
	if (remainingCharges <= 0) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"stash_depleted",
				`Stash "${action.stashItemInstanceId}" has no charges left.`,
			),
		);
	}

	yield* checkGameRequirementsFx({
		config,
		requirements: stash.requirements,
		save,
	});

	const consumed = yield* consumeActivationInputsFx({
		inputRefs: action.inputRefs,
		inputs: stash.inputs,
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
	const preflightPlacement = yield* placeGameSaveItemsFx({
		config,
		items: placementRequests,
		nowMs,
		save: consumed.save,
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
	const nextRemainingCharges = remainingCharges - 1;
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
			onDepleted: stash.onDepleted,
			save: nextSave,
			stashItemId: stashItem.itemId,
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
				stashId,
				stashItemInstanceId: action.stashItemInstanceId,
				type: "stash.opened" as const,
			},
			...(nextRemainingCharges === 0
				? [
						{
							depletedAtMs: nowMs,
							stashId,
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
