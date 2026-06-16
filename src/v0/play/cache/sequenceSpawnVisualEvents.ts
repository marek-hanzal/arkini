import type { QueryClient } from "@tanstack/react-query";
import { DebugTimeline } from "~/v0/debug/DebugTimeline";
import { actionVisualSequenceDelayMs } from "~/v0/play/action/ActionVisualAnimation";
import type { ActionVisualEventSchema } from "~/v0/play/action/ActionVisualEventSchema";
import { applyVisualEvents } from "~/v0/play/cache/applyVisualEvents";
import { summarizeVisualEvents } from "~/v0/play/cache/summarizeVisualEvents";

export const spawnSequenceDelayMs = actionVisualSequenceDelayMs;

const isLegacyExhaustBatch = (events: readonly ActionVisualEventSchema.Type[]) =>
	events.some((event) => event.type === "activation.activated" && event.mode === "exhaust");

const isSequencedEvent = (
	event: ActionVisualEventSchema.Type,
	events: readonly ActionVisualEventSchema.Type[],
) =>
	event.animation?.mode === "sequence" ||
	(isLegacyExhaustBatch(events) && event.type === "item.spawned");

const visualEventDelayMs = (event: ActionVisualEventSchema.Type, sequenceIndex: number) =>
	event.animation?.delayMs ?? sequenceIndex * spawnSequenceDelayMs;

export const shouldSequenceSpawnVisualEvents = (events: readonly ActionVisualEventSchema.Type[]) =>
	events.some((event) => isSequencedEvent(event, events));

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
	const sequencedEvents = events.filter((event) => isSequencedEvent(event, events));
	const immediateEvents = events.filter((event) => !isSequencedEvent(event, events));
	DebugTimeline.record({
		scope: "action-cache",
		event: "visual-events.sequence.schedule",
		detail: {
			immediateCount: immediateEvents.length,
			sequencedCount: sequencedEvents.length,
			delayMs: spawnSequenceDelayMs,
			sequenced: summarizeVisualEvents(sequencedEvents),
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
