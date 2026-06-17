import { actionVisualSequenceDelayMs } from "~/v0/play/action/ActionVisualAnimation";
import type { ActionVisualEventSchema } from "~/v0/play/action/ActionVisualEventSchema";

export const spawnSequenceDelayMs = actionVisualSequenceDelayMs;

const isSequencedEvent = (event: ActionVisualEventSchema.Type) =>
	event.animation?.mode === "sequence";

const visualEventDelayMs = (event: ActionVisualEventSchema.Type, sequenceIndex: number) =>
	event.animation?.delayMs ?? sequenceIndex * spawnSequenceDelayMs;

export const sequenceCompletionDelayMs = (events: readonly ActionVisualEventSchema.Type[]) =>
	events.filter(isSequencedEvent).reduce((delayMs, event, index) => {
		const eventDelayMs = visualEventDelayMs(event, index);
		const durationMs = event.animation?.durationMs ?? 0;
		return Math.max(delayMs, eventDelayMs + durationMs);
	}, 0);

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
