import type { GameEvent } from "~/v0/game/event/GameEventSchema";

type StoredEvent = Extract<
	GameEvent,
	{
		type: "producer_input.stored" | "craft_input.stored";
	}
>;

export namespace shouldAnimateProducerInputStoreVisual {
	export interface Props {
		events: readonly GameEvent[];
		stored: StoredEvent;
	}
}

export const shouldAnimateProducerInputStoreVisual = ({
	stored,
}: shouldAnimateProducerInputStoreVisual.Props) => stored.quantity > 0;
