import type { QueryClient } from "@tanstack/react-query";
import { DebugTimeline } from "~/v0/debug/DebugTimeline";
import type { ActionVisualEventSchema } from "~/v0/play/action/ActionVisualEventSchema";
import { applyVisualEvents } from "~/v0/play/cache/applyVisualEvents";
import { summarizeVisualEvents } from "~/v0/play/cache/summarizeVisualEvents";

const spawnSequenceDelayMs = 135;

export const shouldSequenceSpawnVisualEvents = (events: readonly ActionVisualEventSchema.Type[]) =>
	events.some((event) => event.type === "activation.activated" && event.mode === "exhaust");

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
	const spawnedEvents = events.filter((event) => event.type === "item.spawned");
	const immediateEvents = events.filter((event) => event.type !== "item.spawned");
	DebugTimeline.record({
		scope: "action-cache",
		event: "visual-events.sequence.schedule",
		detail: {
			immediateCount: immediateEvents.length,
			spawnedCount: spawnedEvents.length,
			delayMs: spawnSequenceDelayMs,
			spawned: summarizeVisualEvents(spawnedEvents),
		},
	});

	applyVisualEvents({
		queryClient,
		events: immediateEvents,
	});

	spawnedEvents.forEach((event, index) => {
		window.setTimeout(() => {
			DebugTimeline.record({
				scope: "action-cache",
				event: "visual-events.sequence.tick",
				detail: {
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
		}, index * spawnSequenceDelayMs);
	});
};
