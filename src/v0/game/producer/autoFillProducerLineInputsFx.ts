import { Effect } from "effect";
import type { GameActionResolvedInputRef } from "~/v0/game/action/GameActionResolvedInputRef";
import type { GameActivationInput } from "~/v0/game/activation/GameActivationInput";
import type { GameEvent } from "~/v0/game/event/GameEventSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { consumeResolvedInputRefFx } from "~/v0/game/activation/consumeResolvedInputRefFx";
import { planProducerLineAutoFillInputRefsFx } from "~/v0/game/producer/planProducerLineAutoFillInputRefsFx";
import { resolveInputRefsFx } from "~/v0/game/activation/resolveInputRefsFx";

export namespace autoFillProducerLineInputsFx {
	export interface Props {
		events: GameEvent[];
		inputs: readonly GameActivationInput[];
		nextSave: GameSave;
		nowMs: number;
		producerItemInstanceId: string;
		lineId: string;
	}
}

const storeProducerResolvedInput = ({
	events,
	nextSave,
	nowMs,
	producerItemInstanceId,
	lineId,
	ref,
}: {
	events: GameEvent[];
	nextSave: GameSave;
	nowMs: number;
	producerItemInstanceId: string;
	lineId: string;
	ref: GameActionResolvedInputRef;
}) => {
	const producerInputState = (nextSave.producerInputs[producerItemInstanceId] ??= {
		lineInputs: {},
	});
	const lineInputState = (producerInputState.lineInputs[lineId] ??= {
		items: {},
	});
	const previousQuantity = lineInputState.items[ref.itemId] ?? 0;
	const nextQuantity = previousQuantity + ref.quantity;
	lineInputState.items[ref.itemId] = nextQuantity;

	events.push({
		itemId: ref.itemId,
		nextQuantity,
		previousQuantity,
		producerItemInstanceId,
		lineId,
		quantity: ref.quantity,
		atMs: nowMs,
		type: "producer_input.stored",
	});
};

export const autoFillProducerLineInputsFx = Effect.fn("autoFillProducerLineInputsFx")(function* ({
	events,
	inputs,
	nextSave,
	nowMs,
	producerItemInstanceId,
	lineId,
}: autoFillProducerLineInputsFx.Props) {
	const inputRefs = yield* planProducerLineAutoFillInputRefsFx({
		inputs,
		producerItemInstanceId,
		lineId,
		save: nextSave,
	});
	const resolvedRefs = yield* resolveInputRefsFx({
		inputRefs,
		save: nextSave,
	});

	for (const ref of resolvedRefs) {
		yield* consumeResolvedInputRefFx({
			events,
			nextSave,
			reason: "producer-input-auto-fill",
			ref,
		});
		storeProducerResolvedInput({
			events,
			nextSave,
			nowMs,
			producerItemInstanceId,
			lineId,
			ref,
		});
	}
});
