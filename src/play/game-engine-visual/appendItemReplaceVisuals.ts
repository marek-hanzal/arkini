import { cellKey } from "~/board/cellKey";
import type { BoardTransientTile } from "~/board/animation/BoardTransientTile";
import type { BoardView } from "~/board/view/BoardViewSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import { gameVisualMotionSettlementDelayMs } from "~/play/game-engine-visual/gameVisualMotionSettlementDelayMs";
import { GameVisualMotion } from "~/play/game-engine-visual/GameVisualMotion";
import type { GameEngineVisualPlanDraft } from "~/play/game-engine-visual/GameEngineVisualPlanDraft";
import { toTileEngineEnterMotion } from "~/play/game-engine-visual/toTileEngineEnterMotion";
import { toTileEngineExitMotion } from "~/play/game-engine-visual/toTileEngineExitMotion";

type ReplacedEvent = Extract<
	GameEvent,
	{
		type: "item.replaced";
	}
>;

export namespace appendItemReplaceVisuals {
	export interface Props {
		currentBoard: BoardView | undefined;
		previousBoard: BoardView | undefined;
		event: ReplacedEvent;
		plan: GameEngineVisualPlanDraft;
	}
}

export const appendItemReplaceVisuals = ({
	currentBoard,
	previousBoard,
	event,
	plan,
}: appendItemReplaceVisuals.Props) => {
	if (event.reason !== "craft-result") return;

	const previousTarget = previousBoard?.byId[event.itemInstanceId];
	const currentTarget = currentBoard?.byId[event.itemInstanceId];
	if (!previousTarget || !currentTarget) return;

	const motion = GameVisualMotion.replace({
		cause: "craft",
		groupId: `engine:${event.reason}:${event.itemInstanceId}`,
	});
	const cleanupDelayMs = gameVisualMotionSettlementDelayMs(motion);
	const tile: BoardTransientTile = {
		groupId: motion.groupId,
		id: `transient:replace-out:${motion.groupId}:target:${previousTarget.id}`,
		itemId: event.fromItemId as BoardTransientTile["itemId"],
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
