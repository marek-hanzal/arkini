import { cellKey } from "~/v0/board/cellKey";
import type { BoardTransientTile } from "~/v0/board/animation/BoardTransientTile";
import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import type { GameEvent } from "~/v0/game/engine/model/GameEventSchema";
import { createGameVisualMergeSourceTileId } from "~/v0/play/game-engine-visual/createGameVisualMergeSourceTileId";
import { gameVisualMotionSettlementDelayMs } from "~/v0/play/game-engine-visual/gameVisualMotionSettlementDelayMs";
import { GameVisualMotion } from "~/v0/play/game-engine-visual/GameVisualMotion";
import type { GameEngineVisualPlanDraft } from "~/v0/play/game-engine-visual/GameEngineVisualPlanDraft";
import { toTileEngineEnterMotion } from "~/v0/play/game-engine-visual/toTileEngineEnterMotion";
import { toTileEngineExitMotion } from "~/v0/play/game-engine-visual/toTileEngineExitMotion";

type ConsumedEvent = Extract<
	GameEvent,
	{
		type: "item.consumed";
	}
>;
type ReplacedEvent = Extract<
	GameEvent,
	{
		type: "item.replaced";
	}
>;

export namespace appendItemMergeVisuals {
	export interface Props {
		currentBoard: BoardView | undefined;
		previousBoard: BoardView | undefined;
		replaced: ReplacedEvent;
		source: ConsumedEvent;
		plan: GameEngineVisualPlanDraft;
	}
}

export const appendItemMergeVisuals = ({
	currentBoard,
	previousBoard,
	replaced,
	source,
	plan,
}: appendItemMergeVisuals.Props) => {
	const previousTarget = previousBoard?.byId[replaced.itemInstanceId];
	const currentTarget = currentBoard?.byId[replaced.itemInstanceId];
	if (!previousTarget || !currentTarget) return;

	const previousSource =
		source.from.kind === "board" ? previousBoard?.byId[source.from.itemInstanceId] : undefined;
	if (previousTarget.itemId === replaced.toItemId && !previousSource) return;

	const motion = GameVisualMotion.merge({
		cause: "merge",
		groupId: `engine:merge:${createGameVisualMergeSourceTileId(source)}:${replaced.itemInstanceId}`,
	});
	const cleanupDelayMs = gameVisualMotionSettlementDelayMs(motion);
	const exit = toTileEngineExitMotion(motion);
	const transientTiles: BoardTransientTile[] = [
		...(previousSource
			? [
					{
						groupId: motion.groupId,
						id: `transient:merge-out:${motion.groupId}:source:${previousSource.id}`,
						itemId: source.itemId as BoardTransientTile["itemId"],
						slotId: cellKey(previousTarget.x, previousTarget.y),
					},
				]
			: []),
		{
			groupId: motion.groupId,
			id: `transient:merge-out:${motion.groupId}:target:${previousTarget.id}`,
			itemId: replaced.fromItemId as BoardTransientTile["itemId"],
			slotId: cellKey(previousTarget.x, previousTarget.y),
		},
	];

	plan.boardTransientTilePlans.push(
		...transientTiles.map((tile) => ({
			cleanupDelayMs,
			groupId: motion.groupId,
			request: {
				cleanupDelayMs,
				exit,
				tileId: tile.id,
			},
			tile,
		})),
	);
	plan.boardEnterRequests.push({
		cleanupDelayMs,
		enter: toTileEngineEnterMotion(motion),
		tileId: currentTarget.id,
	});
};
