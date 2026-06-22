import { Effect } from "effect";
import type { GameActionResolvedInputRef } from "~/v0/game/action/GameActionResolvedInputRef";
import type { GameActivationInput } from "~/v0/game/requirements/GameActivationInput";
import type { GameEvent } from "~/v0/game/event/GameEventSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { consumeResolvedInputRefFx } from "~/v0/game/requirements/consumeResolvedInputRefFx";
import { planProducerProductAutoFillInputRefsFx } from "~/v0/game/producer/planProducerProductAutoFillInputRefsFx";
import { resolveInputRefsFx } from "~/v0/game/requirements/resolveInputRefsFx";

export namespace autoFillProducerProductInputsFx {
	export interface Props {
		events: GameEvent[];
		inputs: readonly GameActivationInput[];
		nextSave: GameSave;
		nowMs: number;
		producerItemInstanceId: string;
		productId: string;
	}
}

const storeProducerResolvedInput = ({
	events,
	nextSave,
	nowMs,
	producerItemInstanceId,
	productId,
	ref,
}: {
	events: GameEvent[];
	nextSave: GameSave;
	nowMs: number;
	producerItemInstanceId: string;
	productId: string;
	ref: GameActionResolvedInputRef;
}) => {
	const producerInputState = (nextSave.producerInputs[producerItemInstanceId] ??= {
		productInputs: {},
	});
	const productInputState = (producerInputState.productInputs[productId] ??= {
		items: {},
	});
	const previousQuantity = productInputState.items[ref.itemId] ?? 0;
	const nextQuantity = previousQuantity + ref.quantity;
	productInputState.items[ref.itemId] = nextQuantity;

	events.push({
		itemId: ref.itemId,
		nextQuantity,
		previousQuantity,
		producerItemInstanceId,
		productId,
		quantity: ref.quantity,
		storedAtMs: nowMs,
		type: "producer_input.stored",
	});
};

export const autoFillProducerProductInputsFx = Effect.fn("autoFillProducerProductInputsFx")(
	function* ({
		events,
		inputs,
		nextSave,
		nowMs,
		producerItemInstanceId,
		productId,
	}: autoFillProducerProductInputsFx.Props) {
		const inputRefs = yield* planProducerProductAutoFillInputRefsFx({
			inputs,
			producerItemInstanceId,
			productId,
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
				productId,
				ref,
			});
		}
	},
);
