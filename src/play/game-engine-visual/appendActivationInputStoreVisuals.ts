import { cellKey } from "~/board/cellKey";
import type { BoardTransientTile } from "~/board/animation/BoardTransientTile";
import type { BoardView } from "~/board/view/BoardViewSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import { gameVisualMotionSettlementDelayMs } from "~/play/game-engine-visual/gameVisualMotionSettlementDelayMs";
import { GameVisualMotion } from "~/play/game-engine-visual/GameVisualMotion";
import type { GameEngineVisualPlanDraft } from "~/play/game-engine-visual/GameEngineVisualPlanDraft";
import { toTileEngineExitMotion } from "~/play/game-engine-visual/toTileEngineExitMotion";

type ConsumedEvent = Extract<
	GameEvent,
	{
		type: "item.consumed";
	}
>;
type TargetEvent = Extract<
	GameEvent,
	{
		type: "producer_input.stored" | "craft_input.stored";
	}
>;

export namespace appendActivationInputStoreVisuals {
	export interface Props {
		plan: GameEngineVisualPlanDraft;
		previousBoard: BoardView | undefined;
		source: ConsumedEvent;
		target: TargetEvent;
	}
}

const readTargetItemInstanceId = (target: TargetEvent) => {
	if (target.type === "producer_input.stored") return target.itemInstanceId;
	return target.targetItemInstanceId;
};

const readTargetCause = (target: TargetEvent): GameVisualMotion["cause"] => {
	if (target.type === "producer_input.stored") return "producer";
	return "craft";
};

export const appendActivationInputStoreVisuals = ({
	plan,
	previousBoard,
	source,
	target,
}: appendActivationInputStoreVisuals.Props) => {
	if (source.from.kind !== "board") return;

	const previousSource = previousBoard?.byId[source.from.itemInstanceId];
	const targetItemInstanceId = readTargetItemInstanceId(target);
	const targetBoardItem = previousBoard?.byId[targetItemInstanceId];
	if (!previousSource || !targetBoardItem) return;

	const motion = GameVisualMotion.merge({
		cause: readTargetCause(target),
		groupId: `engine:input-store:${source.from.itemInstanceId}:${targetItemInstanceId}:${source.itemId}`,
	});
	const cleanupDelayMs = gameVisualMotionSettlementDelayMs(motion);
	const tile: BoardTransientTile = {
		groupId: motion.groupId,
		id: `transient:input-store:${motion.groupId}:source:${previousSource.id}`,
		itemId: source.itemId as BoardTransientTile["itemId"],
		slotId: cellKey(previousSource.x, previousSource.y),
	};

	plan.boardTransientTilePlans.push({
		cleanupDelayMs,
		groupId: motion.groupId,
		request: {
			cleanupDelayMs,
			exit: toTileEngineExitMotion(motion, {
				toTileId: targetItemInstanceId,
			}),
			tileId: tile.id,
		},
		tile,
	});
};
