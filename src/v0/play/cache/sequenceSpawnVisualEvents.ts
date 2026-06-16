import type { QueryClient } from "@tanstack/react-query";
import type { ActionVisualEventSchema } from "~/v0/play/action/ActionVisualEventSchema";
import { applyVisualEvents } from "~/v0/play/cache/applyVisualEvents";

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

	applyVisualEvents({
		queryClient,
		events: immediateEvents,
	});

	spawnedEvents.forEach((event, index) => {
		window.setTimeout(() => {
			applyVisualEvents({
				queryClient,
				events: [
					event,
				],
			});
		}, index * spawnSequenceDelayMs);
	});
};
