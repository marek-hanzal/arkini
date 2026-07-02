import { cellKey } from "~/board/cellKey";
import type { BoardTransientTile } from "~/board/animation/BoardTransientTile";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import { gameVisualMotionSettlementDelayMs } from "~/play/game-engine-visual/gameVisualMotionSettlementDelayMs";
import type { GameVisualMotion } from "~/play/game-engine-visual/GameVisualMotion";
import type { GameEngineVisualPlanDraft } from "~/play/game-engine-visual/GameEngineVisualPlanDraft";
import { toTileEngineEnterMotion } from "~/play/game-engine-visual/toTileEngineEnterMotion";
import { toTileEngineExitMotion } from "~/play/game-engine-visual/toTileEngineExitMotion";

export namespace appendBoardTargetTransformVisuals {
	export interface Props {
		assetProgress?: number;
		currentTarget: BoardViewItem;
		motion: GameVisualMotion;
		plan: GameEngineVisualPlanDraft;
		previousTarget: BoardViewItem;
		transientId: string;
	}
}

export const appendBoardTargetTransformVisuals = ({
	assetProgress,
	currentTarget,
	motion,
	plan,
	previousTarget,
	transientId,
}: appendBoardTargetTransformVisuals.Props) => {
	const cleanupDelayMs = gameVisualMotionSettlementDelayMs(motion);
	const tile: BoardTransientTile = {
		assetProgress,
		groupId: motion.groupId,
		id: transientId,
		itemId: previousTarget.itemId,
		slotId: cellKey(previousTarget.x, previousTarget.y),
	};

	plan.boardTransientTilePlans.push({
		cleanupDelayMs,
		groupId: motion.groupId,
		request: {
			cleanupDelayMs,
			exit: toTileEngineExitMotion(motion),
			tileId: tile.id,
		},
		tile,
	});
	plan.boardEnterRequests.push({
		cleanupDelayMs,
		enter: toTileEngineEnterMotion(motion),
		tileId: currentTarget.id,
	});
};
