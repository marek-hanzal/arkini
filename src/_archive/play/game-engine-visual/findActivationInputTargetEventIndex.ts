import type { GameEvent } from "~/event/GameEventSchema";
import { findNextUnskippedEventIndex } from "~/play/game-engine-visual/findNextUnskippedEventIndex";

type ConsumedEvent = Extract<
	GameEvent,
	{
		type: "item.consumed";
	}
>;

export namespace findActivationInputTargetEventIndex {
	export interface Props {
		afterIndex: number;
		events: readonly GameEvent[];
		skipped: ReadonlySet<number>;
		source: ConsumedEvent;
	}
}

const matchesTargetEvent = ({
	candidate,
	source,
}: {
	candidate: GameEvent;
	source: ConsumedEvent;
}) => {
	if (source.reason === "producer-input-auto-fill") {
		return candidate.type === "producer_input.stored" && candidate.itemId === source.itemId;
	}

	if (source.reason === "craft-input-auto-fill") {
		return candidate.type === "craft_input.stored" && candidate.itemId === source.itemId;
	}

	return false;
};

export const findActivationInputTargetEventIndex = ({
	afterIndex,
	events,
	skipped,
	source,
}: findActivationInputTargetEventIndex.Props) =>
	findNextUnskippedEventIndex({
		afterIndex,
		events,
		matches: (candidate) =>
			matchesTargetEvent({
				candidate,
				source,
			}),
		skipped,
	});
