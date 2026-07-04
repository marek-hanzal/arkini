import { Effect } from "effect";
import type { GameActionResolvedInputRef } from "~/action/GameActionResolvedInputRef";
import { increaseStoredActivationInputQuantityFx } from "~/activation/writeStoredActivationInputQuantityFx";
import { readOrCreateProducerLineInputStateFx } from "~/producer/readOrCreateProducerLineInputStateFx";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";

export namespace storeProducerResolvedInputFx {
	export interface Props {
		events: GameEvent[];
		itemInstanceId: string;
		lineId: string;
		nextSave: GameSave;
		nowMs: number;
		ref: GameActionResolvedInputRef;
	}
}

export const storeProducerResolvedInputFx = Effect.fn("storeProducerResolvedInputFx")(function* ({
	events,
	itemInstanceId,
	lineId,
	nextSave,
	nowMs,
	ref,
}: storeProducerResolvedInputFx.Props) {
	const lineInputState = yield* readOrCreateProducerLineInputStateFx({
		itemInstanceId,
		lineId,
		save: nextSave,
	});
	const { nextQuantity, previousQuantity } = yield* increaseStoredActivationInputQuantityFx({
		itemId: ref.itemId,
		quantity: ref.quantity,
		state: lineInputState,
	});

	events.push({
		itemId: ref.itemId,
		nextQuantity,
		previousQuantity,
		itemInstanceId,
		lineId,
		quantity: ref.quantity,
		atMs: nowMs,
		type: "producer_input.stored",
	});

	return {
		nextQuantity,
		previousQuantity,
	};
});
