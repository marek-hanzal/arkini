import type { GameAudioBatchFacts } from "~/audio/GameAudioBatchFacts";
import type { GameEvent } from "~/event/GameEventSchema";

export const readGameAudioBatchFacts = (events: readonly GameEvent[]): GameAudioBatchFacts => ({
	hasCraftCompleted: events.some((event) => event.type === "craft.completed"),
	hasLineCompleted: events.some((event) => event.type === "line.completed"),
	hasMergeResult: events.some(
		(event) => event.type === "item.replaced" && event.reason === "merge-result",
	),
	hasBoardStashCreated: events.some(
		(event) => event.type === "item.created" && event.reason === "board-stash",
	),
});
