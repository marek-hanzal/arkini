import type { GameEvent } from "~/v0/game/event/GameEventSchema";

type ConsumedEvent = Extract<
	GameEvent,
	{
		type: "item.consumed";
	}
>;

export namespace findProducerInputStoredEventIndex {
	export interface Props {
		afterIndex: number;
		events: readonly GameEvent[];
		skipped: ReadonlySet<number>;
		source: ConsumedEvent;
	}
}

export const findProducerInputStoredEventIndex = ({
	afterIndex,
	events,
	skipped,
	source,
}: findProducerInputStoredEventIndex.Props) =>
	events.findIndex(
		(candidate, candidateIndex) =>
			candidateIndex > afterIndex &&
			!skipped.has(candidateIndex) &&
			candidate.type === "producer_input.stored" &&
			candidate.itemId === source.itemId,
	);
