import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import { cellKey } from "~/v0/board/cellKey";
import { DebugTimeline } from "~/v0/debug/DebugTimeline";
import type { ActionVisualEventSchema } from "~/v0/play/action/ActionVisualEventSchema";
import { actionVisualMotionSettlementDelayMs } from "~/v0/play/tile-engine-motion/actionVisualMotionSettlementDelayMs";
import { toTileEngineExitMotion } from "~/v0/play/tile-engine-motion/toTileEngineExitMotion";
import {
	removeBoardTransientTilesByGroup,
	upsertBoardTransientTiles,
} from "~/v0/board/animation/BoardTransientTileStore";
import { registerTileEngineMotionRequests } from "~/v0/tile-engine";

export namespace registerBoardReplaceExitTiles {
	export interface Props {
		board: BoardView;
		events: readonly ActionVisualEventSchema.Type[];
	}
}

type BoardReplaceVisualEvent = Extract<
	ActionVisualEventSchema.Type,
	{
		type: "item.replaced";
	}
> & {
	animation: NonNullable<
		Extract<
			ActionVisualEventSchema.Type,
			{
				type: "item.replaced";
			}
		>["animation"]
	> & {
		effect: "replace";
	};
};

const isBoardReplaceEvent = (
	event: ActionVisualEventSchema.Type,
): event is BoardReplaceVisualEvent =>
	event.type === "item.replaced" && event.animation?.effect === "replace";

export const registerBoardReplaceExitTiles = ({
	board,
	events,
}: registerBoardReplaceExitTiles.Props) => {
	for (const event of events) {
		if (!isBoardReplaceEvent(event)) continue;

		const target = board.byId[event.itemInstanceId];
		if (!target) continue;

		const exit = toTileEngineExitMotion(event.animation);
		const transientTile = {
			id: `transient:replace-out:${event.animation.groupId}:target:${target.id}`,
			groupId: event.animation.groupId,
			itemId: event.fromItemId,
			slotId: cellKey(target.x, target.y),
		};

		DebugTimeline.record({
			scope: "action-cache",
			event: "replace-transient.register",
			detail: {
				fromItemId: event.fromItemId,
				groupId: event.animation.groupId,
				itemInstanceId: event.itemInstanceId,
				toItemId: event.toItemId,
			},
		});

		upsertBoardTransientTiles([
			transientTile,
		]);
		registerTileEngineMotionRequests({
			engineId: "board",
			requests: [
				{
					cleanupDelayMs: actionVisualMotionSettlementDelayMs(event.animation),
					exit,
					tileId: transientTile.id,
				},
			],
		});

		const cleanupDelayMs = actionVisualMotionSettlementDelayMs(event.animation);
		globalThis.setTimeout(() => {
			DebugTimeline.record({
				scope: "action-cache",
				event: "replace-transient.cleanup",
				detail: {
					cleanupDelayMs,
					groupId: event.animation.groupId,
				},
			});
			removeBoardTransientTilesByGroup(event.animation.groupId);
		}, cleanupDelayMs);
	}
};
