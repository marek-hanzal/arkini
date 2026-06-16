import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import { cellKey } from "~/v0/board/cellKey";
import { DebugTimeline } from "~/v0/debug/DebugTimeline";
import type { ActionVisualEventSchema } from "~/v0/play/action/ActionVisualEventSchema";
import { toTileEngineExitMotion } from "~/v0/play/tile-engine-motion/toTileEngineExitMotion";
import { actionVisualMotionSettlementDelayMs } from "~/v0/play/tile-engine-motion/actionVisualMotionSettlementDelayMs";
import {
	removeBoardTransientTilesByGroup,
	upsertBoardTransientTiles,
} from "~/v0/board/animation/BoardTransientTileStore";
import { registerTileEngineMotionRequests } from "~/v0/tile-engine/TileEngineMotionRequestStore";

export namespace registerBoardMergeExitTiles {
	export interface Props {
		board: BoardView;
		events: readonly ActionVisualEventSchema.Type[];
	}
}

export const registerBoardMergeExitTiles = ({
	board,
	events,
}: registerBoardMergeExitTiles.Props) => {
	for (const event of events) {
		if (event.type !== "item.merged") continue;

		const source = board.byId[event.sourceItemInstanceId];
		const target = board.byId[event.targetItemInstanceId];
		if (!target) continue;
		if (target.itemId === event.resultItemId && !source) continue;

		const exit = toTileEngineExitMotion(event.animation);
		const transientTiles = [
			...(event.consumeSource && source
				? [
						{
							id: `transient:merge-out:${event.animation.groupId}:source:${source.id}`,
							groupId: event.animation.groupId,
							itemId: event.sourceItemId,
							slotId: cellKey(target.x, target.y),
						},
					]
				: []),
			{
				id: `transient:merge-out:${event.animation.groupId}:target:${target.id}`,
				groupId: event.animation.groupId,
				itemId: event.targetItemId,
				slotId: cellKey(target.x, target.y),
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
		registerTileEngineMotionRequests({
			engineId: "board",
			requests: transientTiles.map((tile) => ({
				cleanupDelayMs: actionVisualMotionSettlementDelayMs(event.animation),
				tileId: tile.id,
				exit,
			})),
		});

		const cleanupDelayMs = actionVisualMotionSettlementDelayMs(event.animation);
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
