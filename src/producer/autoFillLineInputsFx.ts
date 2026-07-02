import { Effect } from "effect";
import type { GameActionResolvedInputRef } from "~/action/GameActionResolvedInputRef";
import type { GameActivationInput } from "~/activation/GameActivationInput";
import type { GameEvent } from "~/event/GameEventSchema";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { consumeResolvedInputRefFx } from "~/activation/consumeResolvedInputRefFx";
import { planLineAutoFillInputRefsFx } from "~/producer/planLineAutoFillInputRefsFx";
import { resolveInputRefsFx } from "~/activation/resolveInputRefsFx";

export namespace autoFillLineInputsFx {
	export interface Props {
		events: GameEvent[];
		inputs: readonly GameActivationInput[];
		nextSave: GameSave;
		nowMs: number;
		itemInstanceId: string;
		lineId: string;
	}
}

const storeProducerResolvedInput = ({
	events,
	nextSave,
	nowMs,
	itemInstanceId,
	lineId,
	ref,
}: {
	events: GameEvent[];
	nextSave: GameSave;
	nowMs: number;
	itemInstanceId: string;
	lineId: string;
	ref: GameActionResolvedInputRef;
}) => {
	const producerInputState = (nextSave.producerInputs[itemInstanceId] ??= {
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
		itemInstanceId,
		lineId,
		quantity: ref.quantity,
		atMs: nowMs,
		type: "producer_input.stored",
	});
};

export const autoFillLineInputsFx = Effect.fn("autoFillLineInputsFx")(function* ({
	events,
	inputs,
	nextSave,
	nowMs,
	itemInstanceId,
	lineId,
}: autoFillLineInputsFx.Props) {
	const inputRefs = yield* planLineAutoFillInputRefsFx({
		inputs,
		itemInstanceId,
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
			itemInstanceId,
			lineId,
			ref,
		});
	}
});
