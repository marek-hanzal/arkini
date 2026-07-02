import { Effect } from "effect";
import { checkProducerInputStoreReadinessFx } from "~/producer/checkProducerInputStoreReadinessFx";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";
import { consumeResolvedInputRefFx } from "~/activation/consumeResolvedInputRefFx";
import { readNextWakeAtMsFx } from "~/job/readNextWakeAtMsFx";
import type { GameConfig } from "~/config/GameConfigSchema";
import type { GameActionProducerInputStore } from "~/action/GameActionProducerInputStore";
import type { GameEngineResult } from "~/engine/model/GameEngineResult";
import type { GameEvent } from "~/event/GameEventSchema";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace storeProducerInputFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionProducerInputStore;
		nowMs: number;
	}
}

export const storeProducerInputFx = Effect.fn("storeProducerInputFx")(function* ({
	config,
	save,
	action,
	nowMs,
}: storeProducerInputFx.Props) {
	const checked = yield* checkProducerInputStoreReadinessFx({
		action,
		config,
		nowMs,
		save,
	});
	const nextSave = yield* cloneGameSaveFx({
		save,
	});
	const events: GameEvent[] = [];

	yield* consumeResolvedInputRefFx({
		events,
		nextSave,
		reason: "producer-input-store",
		ref: checked.resolvedRef,
	});

	const producerInputState = (nextSave.producerInputs[action.itemInstanceId] ??= {
		lineInputs: {},
	});
	const lineInputState = (producerInputState.lineInputs[checked.lineId] ??= {
		items: {},
	});
	lineInputState.items[checked.resolvedRef.itemId] = checked.nextQuantity;
	nextSave.updatedAtMs = nowMs;

	events.push({
		itemId: checked.resolvedRef.itemId,
		nextQuantity: checked.nextQuantity,
		previousQuantity: checked.previousQuantity,
		itemInstanceId: action.itemInstanceId,
		lineId: checked.lineId,
		quantity: checked.resolvedRef.quantity,
		atMs: nowMs,
		type: "producer_input.stored",
	});

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
