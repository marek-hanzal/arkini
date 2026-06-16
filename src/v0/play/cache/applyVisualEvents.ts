import type { QueryClient } from "@tanstack/react-query";
import { DebugTimeline } from "~/v0/debug/DebugTimeline";
import { patchBoardViewCache } from "~/v0/board/cache/patchBoardViewCache";
import { patchInventoryViewCache } from "~/v0/inventory/cache/patchInventoryViewCache";
import type { ActionVisualEventSchema } from "~/v0/play/action/ActionVisualEventSchema";
import { patchBoardVisualEvents } from "~/v0/play/cache/applyBoardVisualEvent";
import { patchInventoryVisualEvents } from "~/v0/play/cache/applyInventoryVisualEvent";
import { summarizeVisualEvents } from "~/v0/play/cache/summarizeVisualEvents";

export namespace applyVisualEvents {
	export interface Props {
		queryClient: QueryClient;
		events: readonly ActionVisualEventSchema.Type[];
	}
}

export const applyVisualEvents = ({ events, queryClient }: applyVisualEvents.Props) => {
	DebugTimeline.record({
		scope: "action-cache",
		event: "visual-events.patch.start",
		detail: {
			count: events.length,
			events: summarizeVisualEvents(events),
		},
	});
	patchBoardViewCache({
		queryClient,
		patch: (board) => patchBoardVisualEvents(board, events),
	});
	patchInventoryViewCache({
		queryClient,
		patch: (inventory) => patchInventoryVisualEvents(inventory, events),
	});
	DebugTimeline.record({
		scope: "action-cache",
		event: "visual-events.patch.end",
		detail: {
			count: events.length,
		},
	});
};
