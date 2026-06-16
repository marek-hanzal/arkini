import type { QueryClient } from "@tanstack/react-query";
import { patchBoardViewCache } from "~/v0/board/cache/patchBoardViewCache";
import { rebuildBoardView } from "~/v0/board/view/rebuildBoardView";
import { DebugTimeline } from "~/v0/debug/DebugTimeline";
import type { ActionVisualEventSchema } from "~/v0/play/action/ActionVisualEventSchema";

export namespace scheduleMergeMotionCleanup {
	export interface Props {
		queryClient: QueryClient;
		events: readonly ActionVisualEventSchema.Type[];
	}
}

const mergeMotionCleanupBufferMs = 80;

const isMergeExitGhost = (
	groupId: string,
	item: {
		id: string;
		motion?: unknown;
	},
) => item.id.startsWith(`cache:merge-out:${groupId}:`);

export const scheduleMergeMotionCleanup = ({
	events,
	queryClient,
}: scheduleMergeMotionCleanup.Props) => {
	for (const event of events) {
		if (event.type !== "item.merged") continue;

		const { groupId } = event.animation;
		const durationMs = event.animation.durationMs ?? 0;
		const cleanupDelayMs = durationMs + mergeMotionCleanupBufferMs;
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
						board.items.flatMap((item) => {
							if (isMergeExitGhost(groupId, item)) return [];
							if (
								item.id === event.targetItemInstanceId &&
								item.motion?.enter?.groupId === groupId
							) {
								return [
									{
										...item,
										motion: undefined,
									},
								];
							}
							return [
								item,
							];
						}),
					),
			});
		}, cleanupDelayMs);
	}
};
