import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import { cellKey } from "~/v0/board/cellKey";
import { DebugTimeline } from "~/v0/debug/DebugTimeline";
import type { ActionVisualEventSchema } from "~/v0/play/action/ActionVisualEventSchema";
import { toTileExitMotion } from "~/v0/play/motion/toTileExitMotion";
import { TileEngineTiming } from "~/v0/tile-engine/TileEngineTiming";
import {
	removeBoardTransientTilesByGroup,
	upsertBoardTransientTiles,
} from "~/v0/board/animation/BoardTransientTileStore";

const mergeMotionCleanupBufferMs = 80;

export namespace registerBoardMergeTransientTiles {
	export interface Props {
		board: BoardView;
		events: readonly ActionVisualEventSchema.Type[];
	}
}

export const registerBoardMergeTransientTiles = ({
	board,
	events,
}: registerBoardMergeTransientTiles.Props) => {
	for (const event of events) {
		if (event.type !== "item.merged") continue;

		const source = board.byId[event.sourceItemInstanceId];
		const target = board.byId[event.targetItemInstanceId];
		if (!target) continue;
		if (target.itemId === event.resultItemId && !source) continue;

		const exit = toTileExitMotion(event.animation);
		const transientTiles = [
			...(event.consumeSource && source
				? [
						{
							id: `transient:merge-out:${event.animation.groupId}:source:${source.id}`,
							itemId: event.sourceItemId,
							slotId: cellKey(target.x, target.y),
							exit,
						},
					]
				: []),
			{
				id: `transient:merge-out:${event.animation.groupId}:target:${target.id}`,
				itemId: event.targetItemId,
				slotId: cellKey(target.x, target.y),
				exit,
			},
		];

		DebugTimeline.record({
			scope: "action-cache",
			event: "merge-transient.register",
			detail: {
				groupId: event.animation.groupId,
				count: transientTiles.length,
				sourceItemInstanceId: event.sourceItemInstanceId,
				targetItemInstanceId: event.targetItemInstanceId,
				resultItemId: event.resultItemId,
			},
		});

		upsertBoardTransientTiles(transientTiles);

		const cleanupDelayMs =
			(event.animation.durationMs ?? TileEngineTiming.moveDurationSeconds * 1000) +
			mergeMotionCleanupBufferMs;
		globalThis.setTimeout(() => {
			DebugTimeline.record({
				scope: "action-cache",
				event: "merge-transient.cleanup",
				detail: {
					cleanupDelayMs,
					groupId: event.animation.groupId,
				},
			});
			removeBoardTransientTilesByGroup(event.animation.groupId);
		}, cleanupDelayMs);
	}
};
