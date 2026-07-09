import type { GameEvent } from "~/event/GameEventSchema";
import { findNextUnskippedEventIndex } from "~/play/game-engine-visual/findNextUnskippedEventIndex";

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
	findNextUnskippedEventIndex({
		afterIndex,
		events,
		matches: (candidate) =>
			candidate.type === "item.replaced" && candidate.reason === "merge-result",
		skipped,
	});
