import type { GameEvent } from "~/event/GameEventSchema";

export namespace findNextUnskippedEventIndex {
	export interface Props {
		afterIndex: number;
		events: readonly GameEvent[];
		matches(event: GameEvent): boolean;
		skipped: ReadonlySet<number>;
	}
}

export const findNextUnskippedEventIndex = ({
	afterIndex,
	events,
	matches,
	skipped,
}: findNextUnskippedEventIndex.Props) =>
	events.findIndex(
		(candidate, candidateIndex) =>
			candidateIndex > afterIndex && !skipped.has(candidateIndex) && matches(candidate),
	);
