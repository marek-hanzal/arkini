import type { GameEngineVisualPlan } from "~/play/game-engine-visual/GameEngineVisualPlan";
import {
	removeBoardTransientTilesByGroup,
	upsertBoardTransientTiles,
} from "~/board/animation/BoardTransientTileStore";
import { registerTileEngineMotionRequests } from "~/tile-engine/TileEngineMotionRequestStore";

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
		globalThis.setTimeout(() => {
			removeBoardTransientTilesByGroup(groupId);
		}, cleanupDelayMs);
	}
};
