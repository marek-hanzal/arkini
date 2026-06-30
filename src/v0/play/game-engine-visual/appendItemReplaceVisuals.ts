import { cellKey } from "~/v0/board/cellKey";
import type { BoardTransientTile } from "~/v0/board/animation/BoardTransientTile";
import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import type { GameEvent } from "~/v0/game/event/GameEventSchema";
import { gameVisualMotionSettlementDelayMs } from "~/v0/play/game-engine-visual/gameVisualMotionSettlementDelayMs";
import { GameVisualMotion } from "~/v0/play/game-engine-visual/GameVisualMotion";
import type { GameEngineVisualPlanDraft } from "~/v0/play/game-engine-visual/GameEngineVisualPlanDraft";
import { toTileEngineEnterMotion } from "~/v0/play/game-engine-visual/toTileEngineEnterMotion";
import { toTileEngineExitMotion } from "~/v0/play/game-engine-visual/toTileEngineExitMotion";

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
