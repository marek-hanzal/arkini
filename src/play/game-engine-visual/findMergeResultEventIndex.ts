import type { GameEvent } from "~/event/GameEventSchema";

export namespace findMergeResultEventIndex {
	export interface Props {
		afterIndex: number;
		events: readonly GameEvent[];
		skipped: ReadonlySet<number>;
	}
}

export const findMergeResultEventIndex = ({
	afterIndex,
	events,
	skipped,
}: findMergeResultEventIndex.Props) =>
	events.findIndex(
		(candidate, candidateIndex) =>
			candidateIndex > afterIndex &&
			!skipped.has(candidateIndex) &&
			candidate.type === "item.replaced" &&
			candidate.reason === "merge-result",
	);
