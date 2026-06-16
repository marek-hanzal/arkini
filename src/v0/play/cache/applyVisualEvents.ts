import type { QueryClient } from "@tanstack/react-query";
import { DebugTimeline } from "~/v0/debug/DebugTimeline";
import { boardQueryKeys } from "~/v0/board/query/boardQueryKeys";
import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import { registerBoardMergeExitTiles } from "~/v0/play/tile-engine-motion/registerBoardMergeExitTiles";
import { patchBoardViewCache } from "~/v0/board/cache/patchBoardViewCache";
import { patchInventoryViewCache } from "~/v0/inventory/cache/patchInventoryViewCache";
import type { ActionVisualEventSchema } from "~/v0/play/action/ActionVisualEventSchema";
import { patchBoardVisualEvents } from "~/v0/play/cache/applyBoardVisualEvent";
import { patchInventoryVisualEvents } from "~/v0/play/cache/applyInventoryVisualEvent";
import { summarizeVisualEventGroups } from "~/v0/play/cache/summarizeVisualEventGroups";
import { summarizeVisualEvents } from "~/v0/play/cache/summarizeVisualEvents";
import { scheduleTileEngineMotionCleanup } from "~/v0/play/cache/scheduleTileEngineMotionCleanup";

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
			animationGroups: summarizeVisualEventGroups(events),
		},
	});
	const board = queryClient.getQueryData<BoardView>(boardQueryKeys.view);
	if (board) {
		registerBoardMergeExitTiles({
			board,
			events,
		});
	}

	patchBoardViewCache({
		queryClient,
		patch: (board) => patchBoardVisualEvents(board, events),
	});
	patchInventoryViewCache({
		queryClient,
		patch: (inventory) => patchInventoryVisualEvents(inventory, events),
	});
	scheduleTileEngineMotionCleanup({
		events,
		queryClient,
	});
	DebugTimeline.record({
		scope: "action-cache",
		event: "visual-events.patch.end",
		detail: {
			count: events.length,
			animationGroups: summarizeVisualEventGroups(events),
		},
	});
};
