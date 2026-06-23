import { Effect } from "effect";
import { checkStashOpenReadinessFx } from "~/v0/game/stash/checkStashOpenReadinessFx";
import { consumeActivationInputsFx } from "~/v0/game/requirements/consumeActivationInputsFx";
import { placeGameSaveItemsFx } from "~/v0/game/placement/placeGameSaveItemsFx";
import { planStashAutoFillInputRefsFx } from "~/v0/game/stash/planStashAutoFillInputRefsFx";
import { readStashBoardItemFx } from "~/v0/game/stash/readStashBoardItemFx";
import { readNextWakeAtMsFx } from "~/v0/game/job/readNextWakeAtMsFx";
import { readBoardItemCell } from "~/v0/game/board/readBoardItemCell";
import { rollLootTableItemsFx } from "~/v0/game/loot/rollLootTableItemsFx";
import { applyStashDepletionFx } from "~/v0/game/stash/applyStashDepletionFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionStashOpen } from "~/v0/game/action/GameActionStashOpen";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
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
	const inputRefs =
		action.inputRefs.length === 0 && stash?.inputs.length
			? yield* planStashAutoFillInputRefsFx({
					inputs: stash.inputs,
					save,
					stashItemInstanceId: action.stashItemInstanceId,
				})
			: action.inputRefs;
	const effectiveAction: GameActionStashOpen = {
		...action,
		inputRefs,
	};
	const checked = yield* checkStashOpenReadinessFx({
		action: effectiveAction,
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
		inputRefs: effectiveAction.inputRefs,
		inputs: checked.stash.inputs,
		nowMs,
		reason: "stash-input",
		save,
	});
	const placementRequests: GameSaveItemPlacementRequest[] = [];
	for (let chargeIndex = 0; chargeIndex < checked.remainingCharges; chargeIndex += 1) {
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
		save: consumed.save,
	});
	const placement = yield* placeGameSaveItemsFx({
		config,
		items: placementRequests,
		nowMs,
		save: consumed.save,
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
		onDepleted: checked.stash.onDepleted,
		save: placement.save,
		stashItemId: checked.stashItem.itemId,
		stashItemInstanceId: action.stashItemInstanceId,
	});
	placement.save.updatedAtMs = nowMs;

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
			...placement.events,
			{
				depletedAtMs: nowMs,
				stashId: checked.stashId,
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
