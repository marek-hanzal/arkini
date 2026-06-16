import type { QueryClient } from "@tanstack/react-query";
import { DebugTimeline } from "~/v0/debug/DebugTimeline";
import { actionVisualSequenceDelayMs } from "~/v0/play/action/ActionVisualAnimation";
import type { ActionVisualEventSchema } from "~/v0/play/action/ActionVisualEventSchema";
import { applyVisualEvents } from "~/v0/play/cache/applyVisualEvents";
import { summarizeVisualEventGroups } from "~/v0/play/cache/summarizeVisualEventGroups";
import { summarizeVisualEvents } from "~/v0/play/cache/summarizeVisualEvents";

export const spawnSequenceDelayMs = actionVisualSequenceDelayMs;

const isSequencedEvent = (event: ActionVisualEventSchema.Type) =>
	event.animation?.mode === "sequence";

const visualEventDelayMs = (event: ActionVisualEventSchema.Type, sequenceIndex: number) =>
	event.animation?.delayMs ?? sequenceIndex * spawnSequenceDelayMs;

export const shouldSequenceSpawnVisualEvents = (events: readonly ActionVisualEventSchema.Type[]) =>
	events.some(isSequencedEvent);

export namespace sequenceSpawnVisualEvents {
	export interface Props {
		queryClient: QueryClient;
		events: readonly ActionVisualEventSchema.Type[];
	}
}

export const sequenceSpawnVisualEvents = ({
	events,
	queryClient,
}: sequenceSpawnVisualEvents.Props) => {
	const sequencedEvents = events.filter(isSequencedEvent);
	const immediateEvents = events.filter((event) => !isSequencedEvent(event));
	DebugTimeline.record({
		scope: "action-cache",
		event: "visual-events.sequence.schedule",
		detail: {
			immediateCount: immediateEvents.length,
			sequencedCount: sequencedEvents.length,
			delayMs: spawnSequenceDelayMs,
			sequenced: summarizeVisualEvents(sequencedEvents),
			animationGroups: summarizeVisualEventGroups(events),
		},
	});

	applyVisualEvents({
		queryClient,
		events: immediateEvents,
	});

	sequencedEvents.forEach((event, index) => {
		const delayMs = visualEventDelayMs(event, index);
		window.setTimeout(() => {
			DebugTimeline.record({
				scope: "action-cache",
				event: "visual-events.sequence.tick",
				detail: {
					delayMs,
					index,
					event: summarizeVisualEvents([
						event,
					])[0],
					animationGroup: summarizeVisualEventGroups([
						event,
					])[0],
				},
			});
			applyVisualEvents({
				queryClient,
				events: [
					event,
				],
			});
		}, delayMs);
	});
};
