import type { GameEvent } from "~/event/GameEventSchema";

export namespace findBoardStackCreatedEventIndex {
	export interface Props {
		afterIndex: number;
		events: readonly GameEvent[];
		skipped: ReadonlySet<number>;
		source: Extract<
			GameEvent,
			{
				type: "item.consumed";
			}
		>;
	}
}

const matchesBoardStackCreatedEvent = ({
	candidate,
	source,
}: {
	candidate: GameEvent;
	source: findBoardStackCreatedEventIndex.Props["source"];
}) =>
	candidate.type === "item.created" &&
	candidate.reason === "board-stack" &&
	candidate.itemId === source.itemId &&
	candidate.to.kind === "board";

export const findBoardStackCreatedEventIndex = ({
	afterIndex,
	events,
	skipped,
	source,
}: findBoardStackCreatedEventIndex.Props) =>
	events.findIndex(
		(candidate, candidateIndex) =>
			candidateIndex > afterIndex &&
			!skipped.has(candidateIndex) &&
			matchesBoardStackCreatedEvent({
				candidate,
				source,
			}),
	);
