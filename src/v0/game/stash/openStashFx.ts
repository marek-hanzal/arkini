import { Effect } from "effect";
import { placeGameSaveItemsFx } from "~/v0/game/placement/placeGameSaveItemsFx";
import { createItemSpawnJobsFx } from "~/v0/game/job/createItemSpawnJobsFx";
import { processItemSpawnJobsFx } from "~/v0/game/job/processItemSpawnJobsFx";
import { readNextWakeAtMsFx } from "~/v0/game/job/readNextWakeAtMsFx";
import { readBoardItemCell } from "~/v0/game/board/readBoardItemCell";
import { rollLootTableItemsFx } from "~/v0/game/loot/rollLootTableItemsFx";
import { applyStashDepletionFx } from "~/v0/game/stash/applyStashDepletionFx";
import { cloneGameSaveFx } from "~/v0/game/save/cloneGameSaveFx";
import { consumeResolvedInputRefFx } from "~/v0/game/requirements/consumeResolvedInputRefFx";
import { storeStashResolvedInput } from "~/v0/game/stash/storeStashResolvedInput";
import { readStashInputsReady } from "~/v0/game/stash/readStashInputsReady";
import { resolveStashOpenInputRefsFx } from "~/v0/game/stash/resolveStashOpenInputRefsFx";
import { readStashOpenCoreFx } from "~/v0/game/stash/readStashOpenCoreFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionStashOpen } from "~/v0/game/action/GameActionStashOpen";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameEvent } from "~/v0/game/event/GameEventSchema";
import type { GameSaveItemPlacementRequest } from "~/v0/game/placement/GameSaveItemPlacementRequest";
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
	const { lootTable, remainingCharges, stash, stashId, stashItem } = yield* readStashOpenCoreFx({
		config,
		save,
		stashItemInstanceId: action.stashItemInstanceId,
	});

	const nextSave = yield* cloneGameSaveFx({
		save,
	});
	const events: GameEvent[] = [];
	const { resolvedRefs, shouldAutoFillInputs } = yield* resolveStashOpenInputRefsFx({
		inputRefs: action.inputRefs,
		inputs: stash.inputs,
		save: nextSave,
		stashItemInstanceId: action.stashItemInstanceId,
	});

	for (const ref of resolvedRefs) {
		yield* consumeResolvedInputRefFx({
			events,
			nextSave,
			reason: shouldAutoFillInputs ? "stash-input-auto-fill" : "stash-input",
			ref,
		});
		storeStashResolvedInput({
			events,
			nextSave,
			nowMs,
			ref,
			stashId,
			stashItemInstanceId: action.stashItemInstanceId,
		});
	}

	if (
		stash.inputs.length > 0 &&
		!readStashInputsReady({
			inputs: stash.inputs,
			save: nextSave,
			stashItemInstanceId: action.stashItemInstanceId,
		})
	) {
		if (events.length > 0) nextSave.updatedAtMs = nowMs;
		return {
			events,
			nextWakeAtMs: yield* readNextWakeAtMsFx({
				nowMs,
				save: nextSave,
			}),
			save: nextSave,
		} satisfies GameEngineResult;
	}

	delete nextSave.stashInputs[action.stashItemInstanceId];
	const placementRequests: GameSaveItemPlacementRequest[] = [];
	for (let chargeIndex = 0; chargeIndex < remainingCharges; chargeIndex += 1) {
		const roll = yield* rollLootTableItemsFx({
			lootTable,
		});
		placementRequests.push(
			...roll.items.map(
				(item) =>
					({
						...item,
						originItemInstanceId: action.stashItemInstanceId,
						reason: "stash-output",
					}) satisfies GameSaveItemPlacementRequest,
			),
		);
	}
	const seedCell = readBoardItemCell({
		itemInstanceId: action.stashItemInstanceId,
		save: nextSave,
	});
	const preflightSave = yield* cloneGameSaveFx({
		save: nextSave,
	});
	if (stash.onDepleted === "remove") {
		delete preflightSave.board.items[action.stashItemInstanceId];
	}
	yield* placeGameSaveItemsFx({
		config,
		items: placementRequests,
		nowMs,
		save: preflightSave,
		seedCell,
	}).pipe(
		Effect.catchTag("GamePlacementFailed", (error) =>
			Effect.fail(
				GameEngineError.actionRejected(
					error.reason,
					`Stash "${action.stashItemInstanceId}" output cannot be placed.`,
				),
			),
		),
	);

	const nextRemainingCharges = 0;
	const depletionEvents = yield* applyStashDepletionFx({
		config,
		nowMs,
		onDepleted: stash.onDepleted,
		save: nextSave,
		stashItemId: stashItem.itemId,
		stashItemInstanceId: action.stashItemInstanceId,
	});
	yield* createItemSpawnJobsFx({
		readyAtMs: nowMs,
		items: placementRequests,
		save: nextSave,
		seedCell,
	});
	const spawned = yield* processItemSpawnJobsFx({
		config,
		nowMs,
		save: nextSave,
	});
	spawned.save.updatedAtMs = nowMs;

	return {
		events: [
			...events,
			{
				atMs: nowMs,
				remainingCharges: nextRemainingCharges,
				stashId,
				stashItemInstanceId: action.stashItemInstanceId,
				type: "stash.opened" as const,
			},
			{
				atMs: nowMs,
				stashId,
				stashItemInstanceId: action.stashItemInstanceId,
				type: "stash.depleted" as const,
			},
			...depletionEvents,
			...spawned.events,
		],
		nextWakeAtMs: yield* readNextWakeAtMsFx({
			nowMs,
			save: spawned.save,
		}),
		save: spawned.save,
	} satisfies GameEngineResult;
});
