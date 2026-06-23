import { DebugTimeline } from "~/v0/debug/DebugTimeline";
import type { GameEngineVisualPlan } from "~/v0/play/game-engine-visual/GameEngineVisualPlan";
import {
	removeBoardTransientTilesByGroup,
	upsertBoardTransientTiles,
} from "~/v0/board/animation/BoardTransientTileStore";
import { registerTileEngineMotionRequests } from "~/v0/tile-engine";

export namespace applyGameEngineVisualPlan {
	export interface Props {
		plan: GameEngineVisualPlan;
	}
}

export const applyGameEngineVisualPlan = ({ plan }: applyGameEngineVisualPlan.Props) => {
	if (plan.boardTransientTilePlans.length > 0) {
		upsertBoardTransientTiles(plan.boardTransientTilePlans.map((entry) => entry.tile));
	}

	registerTileEngineMotionRequests({
		engineId: "board",
		requests: [
			...plan.boardTransientTilePlans.map((entry) => entry.request),
			...plan.boardEnterRequests,
			...plan.boardFeedbackRequests,
		],
	});
	registerTileEngineMotionRequests({
		engineId: "inventory",
		requests: plan.inventoryEnterRequests,
	});

	const cleanupDelayMsByGroup: Record<string, number> = {};
	for (const entry of plan.boardTransientTilePlans) {
		cleanupDelayMsByGroup[entry.groupId] = Math.max(
			cleanupDelayMsByGroup[entry.groupId] ?? 0,
			entry.cleanupDelayMs,
		);
	}

	for (const [groupId, cleanupDelayMs] of Object.entries(cleanupDelayMsByGroup)) {
		DebugTimeline.record({
			detail: {
				cleanupDelayMs,
				groupId,
			},
			event: "game-visual-transient.register",
			scope: "game-engine-runtime",
		});

		globalThis.setTimeout(() => {
			DebugTimeline.record({
				detail: {
					cleanupDelayMs,
					groupId,
				},
				event: "game-visual-transient.cleanup",
				scope: "game-engine-runtime",
			});
			removeBoardTransientTilesByGroup(groupId);
		}, cleanupDelayMs);
	}
};
