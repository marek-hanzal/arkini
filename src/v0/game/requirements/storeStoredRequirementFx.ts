import { Effect } from "effect";
import { checkStoredRequirementStoreReadinessFx } from "~/v0/game/requirements/checkStoredRequirementStoreReadinessFx";
import { cloneGameSaveFx } from "~/v0/game/save/cloneGameSaveFx";
import { consumeResolvedInputRefFx } from "~/v0/game/requirements/consumeResolvedInputRefFx";
import { readNextWakeAtMsFx } from "~/v0/game/job/readNextWakeAtMsFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionStoredRequirementStore } from "~/v0/game/engine/model/GameActionStoredRequirementStore";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameEvent } from "~/v0/game/engine/model/GameEventSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace storeStoredRequirementFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionStoredRequirementStore;
		nowMs: number;
	}
}

export const storeStoredRequirementFx = Effect.fn("storeStoredRequirementFx")(function* ({
	config,
	save,
	action,
	nowMs,
}: storeStoredRequirementFx.Props) {
	const checked = yield* checkStoredRequirementStoreReadinessFx({
		action,
		config,
		save,
	});
	const nextSave = yield* cloneGameSaveFx({
		save,
	});
	const events: GameEvent[] = [];

	yield* consumeResolvedInputRefFx({
		events,
		nextSave,
		reason: "stored-requirement-store",
		ref: checked.resolvedRef,
	});

	const targetState = nextSave.storedRequirements[action.targetItemInstanceId] ?? {
		items: {},
	};
	targetState.items[checked.resolvedRef.itemId] = checked.nextQuantity;
	nextSave.storedRequirements[action.targetItemInstanceId] = targetState;
	nextSave.updatedAtMs = nowMs;

	events.push({
		itemId: checked.resolvedRef.itemId,
		nextQuantity: checked.nextQuantity,
		previousQuantity: checked.previousQuantity,
		quantity: checked.resolvedRef.quantity,
		storedAtMs: nowMs,
		targetItemInstanceId: action.targetItemInstanceId,
		type: "stored_requirement.stored",
	});

	return {
		events,
		nextWakeAtMs: yield* readNextWakeAtMsFx({
			save: nextSave,
		}),
		save: nextSave,
	} satisfies GameEngineResult;
});
