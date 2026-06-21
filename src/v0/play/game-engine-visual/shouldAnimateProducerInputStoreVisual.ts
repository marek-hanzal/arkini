import type { GameEvent } from "~/v0/game/event/GameEventSchema";

type StoredEvent = Extract<
	GameEvent,
	{
		type: "producer_input.stored";
	}
>;

export namespace shouldAnimateProducerInputStoreVisual {
	export interface Props {
		events: readonly GameEvent[];
		stored: StoredEvent;
	}
}

export const shouldAnimateProducerInputStoreVisual = ({
	events,
	stored,
}: shouldAnimateProducerInputStoreVisual.Props) =>
	events.some(
		(event) =>
			event.type === "product.started" &&
			event.producerItemInstanceId === stored.producerItemInstanceId &&
			event.productId === stored.productId,
	);
