import type { QueryClient } from "@tanstack/react-query";
import { DebugTimeline } from "~/v0/debug/DebugTimeline";
import type { ActionResult } from "~/v0/play/action/ActionResult";
import { applyVisualEvents } from "~/v0/play/cache/applyVisualEvents";
import { summarizeVisualEventGroups } from "~/v0/play/cache/summarizeVisualEventGroups";
import { summarizeVisualEvents } from "~/v0/play/cache/summarizeVisualEvents";
import {
	sequenceSpawnVisualEvents,
	shouldSequenceSpawnVisualEvents,
} from "~/v0/play/cache/sequenceSpawnVisualEvents";

export namespace applyActionResultCachePatch {
	export interface Props {
		queryClient: QueryClient;
		result: ActionResult.Type;
	}
}

export const applyActionResultCachePatch = ({
	queryClient,
	result,
}: applyActionResultCachePatch.Props) => {
	DebugTimeline.record({
		scope: "action-cache",
		event: "visual-events.apply",
		detail: {
			count: result.visualEvents.length,
			types: result.visualEvents.map((event) => event.type),
			items: summarizeVisualEvents(result.visualEvents),
			animationGroups: summarizeVisualEventGroups(result.visualEvents),
			sequenced: shouldSequenceSpawnVisualEvents(result.visualEvents),
		},
	});

	if (!shouldSequenceSpawnVisualEvents(result.visualEvents)) {
		applyVisualEvents({
			queryClient,
			events: result.visualEvents,
		});
		return;
	}

	sequenceSpawnVisualEvents({
		queryClient,
		events: result.visualEvents,
	});
};
