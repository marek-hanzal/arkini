import { Effect } from "effect";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";

export namespace withdrawProducerStoredInputFx {
	export interface Props {
		events: GameEvent[];
		itemId: string;
		itemInstanceId: string;
		lineId: string;
		nextSave: GameSave;
		nowMs: number;
		previousQuantity: number;
	}
}

const clearProducerInputQuantityFx = Effect.fn(
	"withdrawProducerStoredInputFx.clearProducerInputQuantityFx",
)(function* ({ itemId, itemInstanceId, lineId, nextSave }: withdrawProducerStoredInputFx.Props) {
	const producerInputState = nextSave.producerInputs[itemInstanceId];
	const lineInputState = producerInputState?.lineInputs[lineId];
	if (!producerInputState || !lineInputState) return;

	delete lineInputState.items[itemId];
	if (Object.keys(lineInputState.items).length === 0) {
		delete producerInputState.lineInputs[lineId];
	}
	if (Object.keys(producerInputState.lineInputs).length === 0) {
		delete nextSave.producerInputs[itemInstanceId];
	}
});

const appendProducerInputWithdrawnEventFx = Effect.fn(
	"withdrawProducerStoredInputFx.appendProducerInputWithdrawnEventFx",
)(function* ({
	events,
	itemId,
	itemInstanceId,
	lineId,
	nowMs,
	previousQuantity,
}: withdrawProducerStoredInputFx.Props) {
	events.push({
		itemId,
		nextQuantity: 0,
		previousQuantity,
		itemInstanceId,
		lineId,
		quantity: previousQuantity,
		type: "producer_input.withdrawn",
		atMs: nowMs,
	});
});

export const withdrawProducerStoredInputFx = Effect.fn("withdrawProducerStoredInputFx")(function* (
	props: withdrawProducerStoredInputFx.Props,
) {
	yield* clearProducerInputQuantityFx(props);
	yield* appendProducerInputWithdrawnEventFx(props);
});
