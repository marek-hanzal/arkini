import { Effect } from "effect";
import { checkProducerInputStoreReadinessFx } from "~/v0/game/producer/checkProducerInputStoreReadinessFx";
import { cloneGameSaveFx } from "~/v0/game/save/cloneGameSaveFx";
import { consumeResolvedInputRefFx } from "~/v0/game/requirements/consumeResolvedInputRefFx";
import { readNextWakeAtMsFx } from "~/v0/game/job/readNextWakeAtMsFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionProducerInputStore } from "~/v0/game/action/GameActionProducerInputStore";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameEvent } from "~/v0/game/event/GameEventSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

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

	const producerInputState = (nextSave.producerInputs[action.producerItemInstanceId] ??= {
		productInputs: {},
	});
	const productInputState = (producerInputState.productInputs[checked.productId] ??= {
		items: {},
	});
	productInputState.items[checked.resolvedRef.itemId] = checked.nextQuantity;
	nextSave.updatedAtMs = nowMs;

	events.push({
		itemId: checked.resolvedRef.itemId,
		nextQuantity: checked.nextQuantity,
		previousQuantity: checked.previousQuantity,
		producerItemInstanceId: action.producerItemInstanceId,
		productId: checked.productId,
		quantity: checked.resolvedRef.quantity,
		storedAtMs: nowMs,
		type: "producer_input.stored",
	});

	return {
		events,
		nextWakeAtMs: yield* readNextWakeAtMsFx({
			save: nextSave,
		}),
		save: nextSave,
	} satisfies GameEngineResult;
});
