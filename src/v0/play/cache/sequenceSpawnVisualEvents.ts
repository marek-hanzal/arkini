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

const sequencedGroupIds = (events: readonly ActionVisualEventSchema.Type[]) =>
	new Set(
		events
			.filter(isSequencedEvent)
			.map((event) => event.animation?.groupId)
			.filter((groupId): groupId is string => Boolean(groupId)),
	);

export const sequenceCompletionDelayMs = (events: readonly ActionVisualEventSchema.Type[]) =>
	events.filter(isSequencedEvent).reduce((delayMs, event, index) => {
		const eventDelayMs = visualEventDelayMs(event, index);
		const durationMs = event.animation?.durationMs ?? 0;
		return Math.max(delayMs, eventDelayMs + durationMs);
	}, 0);

const shouldDelayUntilSequenceEnd = (
	event: ActionVisualEventSchema.Type,
	groupIds: ReadonlySet<string>,
) =>
	event.type === "activation.depleted" &&
	Boolean(event.animation?.groupId && groupIds.has(event.animation.groupId));

export const shouldSequenceSpawnVisualEvents = (events: readonly ActionVisualEventSchema.Type[]) =>
	events.some(isSequencedEvent);

export const toImmediateSequencedVisualEvent = (
	event: ActionVisualEventSchema.Type,
): ActionVisualEventSchema.Type => {
	if (!event.animation || event.animation.mode !== "sequence") return event;

	return {
		...event,
		animation: {
			...event.animation,
			delayMs: 0,
		},
	};
};

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
	const groupIds = sequencedGroupIds(events);
	const sequencedEvents = events.filter(isSequencedEvent);
	const delayedEvents = events.filter((event) => shouldDelayUntilSequenceEnd(event, groupIds));
	const immediateEvents = events.filter(
		(event) => !isSequencedEvent(event) && !shouldDelayUntilSequenceEnd(event, groupIds),
	);
	const delayedDelayMs = sequenceCompletionDelayMs(events);
	DebugTimeline.record({
		scope: "action-cache",
		event: "visual-events.sequence.schedule",
		detail: {
			immediateCount: immediateEvents.length,
			sequencedCount: sequencedEvents.length,
			delayedCount: delayedEvents.length,
			delayedDelayMs,
			delayMs: spawnSequenceDelayMs,
			sequenced: summarizeVisualEvents(sequencedEvents),
			delayed: summarizeVisualEvents(delayedEvents),
			animationGroups: summarizeVisualEventGroups(events),
		},
	});

	applyVisualEvents({
		queryClient,
		events: immediateEvents,
	});

	sequencedEvents.forEach((event, index) => {
		const delayMs = visualEventDelayMs(event, index);
		globalThis.setTimeout(() => {
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
					toImmediateSequencedVisualEvent(event),
				],
			});
		}, delayMs);
	});

	if (delayedEvents.length > 0) {
		globalThis.setTimeout(() => {
			DebugTimeline.record({
				scope: "action-cache",
				event: "visual-events.sequence.complete",
				detail: {
					delayMs: delayedDelayMs,
					events: summarizeVisualEvents(delayedEvents),
					animationGroups: summarizeVisualEventGroups(delayedEvents),
				},
			});
			applyVisualEvents({
				queryClient,
				events: delayedEvents,
			});
		}, delayedDelayMs);
	}
};
