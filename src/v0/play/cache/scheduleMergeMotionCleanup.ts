import type { QueryClient } from "@tanstack/react-query";
import { patchBoardViewCache } from "~/v0/board/cache/patchBoardViewCache";
import { rebuildBoardView } from "~/v0/board/view/rebuildBoardView";
import { DebugTimeline } from "~/v0/debug/DebugTimeline";
import type { ActionVisualEventSchema } from "~/v0/play/action/ActionVisualEventSchema";
import { TileEngineTiming } from "~/v0/tile-engine/TileEngineTiming";

export namespace scheduleMergeMotionCleanup {
	export interface Props {
		queryClient: QueryClient;
		events: readonly ActionVisualEventSchema.Type[];
	}
}

const mergeMotionCleanupBufferMs = 80;

export const scheduleMergeMotionCleanup = ({
	events,
	queryClient,
}: scheduleMergeMotionCleanup.Props) => {
	for (const event of events) {
		if (event.type !== "item.merged") continue;

		const { groupId } = event.animation;
		const cleanupDelayMs =
			(event.animation.durationMs ?? TileEngineTiming.moveDurationSeconds * 1000) +
			mergeMotionCleanupBufferMs;
		globalThis.setTimeout(() => {
			DebugTimeline.record({
				scope: "action-cache",
				event: "merge-motion.cleanup",
				detail: {
					cleanupDelayMs,
					groupId,
					targetItemInstanceId: event.targetItemInstanceId,
				},
			});
			patchBoardViewCache({
				queryClient,
				patch: (board) =>
					rebuildBoardView(
						board.items.map((item) => {
							if (
								item.id === event.targetItemInstanceId &&
								item.motion?.enter?.groupId === groupId
							) {
								return {
									...item,
									motion: undefined,
								};
							}
							return item;
						}),
					),
			});
		}, cleanupDelayMs);
	}
};
