import { Effect } from "effect";
import { checkGameRequirementsFx } from "~/v0/game/requirements/checkGameRequirementsFx";
import { placeGameSaveItemsFx } from "~/v0/game/placement/placeGameSaveItemsFx";
import { planStashAutoFillInputRefsFx } from "~/v0/game/stash/planStashAutoFillInputRefsFx";
import { readStashBoardItemFx } from "~/v0/game/stash/readStashBoardItemFx";
import { readStashRemainingChargesFx } from "~/v0/game/stash/readStashRemainingChargesFx";
import { readNextWakeAtMsFx } from "~/v0/game/job/readNextWakeAtMsFx";
import { readBoardItemCell } from "~/v0/game/board/readBoardItemCell";
import { rollLootTableItemsFx } from "~/v0/game/loot/rollLootTableItemsFx";
import { applyStashDepletionFx } from "~/v0/game/stash/applyStashDepletionFx";
import { cloneGameSaveFx } from "~/v0/game/save/cloneGameSaveFx";
import { consumeResolvedInputRefFx } from "~/v0/game/requirements/consumeResolvedInputRefFx";
import { readStoredRequirementQuantitiesFx } from "~/v0/game/requirements/readStoredRequirementQuantitiesFx";
import { resolveInputRefsFx } from "~/v0/game/requirements/resolveInputRefsFx";
import { storeStashResolvedInput } from "~/v0/game/stash/storeStashResolvedInput";
import { checkStashResolvedInputsFitFx } from "~/v0/game/stash/checkStashResolvedInputsFitFx";
import { readStashInputsReady } from "~/v0/game/stash/readStashInputsReady";
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

	const storedItems = yield* readStoredRequirementQuantitiesFx({
		save,
		targetItemInstanceId: action.stashItemInstanceId,
	});
	yield* checkGameRequirementsFx({
		requirements: stash.requirements,
		save,
		storedItems,
		targetItemInstanceId: action.stashItemInstanceId,
	});

	const nextSave = yield* cloneGameSaveFx({
		save,
	});
	const events: GameEvent[] = [];
	const shouldAutoFillInputs = action.inputRefs.length === 0 && Boolean(stash.inputs.length);
	const inputRefs = shouldAutoFillInputs
		? yield* planStashAutoFillInputRefsFx({
				inputs: stash.inputs,
				save: nextSave,
				stashItemInstanceId: action.stashItemInstanceId,
			})
		: action.inputRefs;
	const resolvedRefs = yield* resolveInputRefsFx({
		inputRefs,
		save: nextSave,
	});

	yield* checkStashResolvedInputsFitFx({
		inputs: stash.inputs,
		resolvedRefs,
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
	const placement = yield* placeGameSaveItemsFx({
		config,
		items: placementRequests,
		nowMs,
		save: nextSave,
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
		nowMs,
		onDepleted: stash.onDepleted,
		save: placement.save,
		stashItemId: stashItem.itemId,
		stashItemInstanceId: action.stashItemInstanceId,
	});
	placement.save.updatedAtMs = nowMs;

	return {
		events: [
			...events,
			{
				openedAtMs: nowMs,
				remainingCharges: nextRemainingCharges,
				stashId,
				stashItemInstanceId: action.stashItemInstanceId,
				type: "stash.opened" as const,
			},
			...placement.events,
			{
				depletedAtMs: nowMs,
				stashId,
				stashItemInstanceId: action.stashItemInstanceId,
				type: "stash.depleted" as const,
			},
			...depletionEvents,
		],
		nextWakeAtMs: yield* readNextWakeAtMsFx({
			save: placement.save,
		}),
		save: placement.save,
	} satisfies GameEngineResult;
});
