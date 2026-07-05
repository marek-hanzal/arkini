import { cellKey } from "~/board/cellKey";
import type { BoardTransientTile } from "~/board/animation/BoardTransientTile";
import type { BoardView } from "~/board/view/BoardViewSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import { appendBoardTileBounceFeedback } from "~/play/game-engine-visual/appendBoardTileBounceFeedback";
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

const shouldBoomerangBoardStack = (source: ConsumedEvent) =>
	source.from.kind === "board" &&
	(source.from.previousQuantity ?? source.from.quantity ?? 1) > (source.from.quantity ?? 1) &&
	(source.from.nextQuantity ?? 0) > 0;

const readStackMotionDurationMs = (source: ConsumedEvent) =>
	shouldBoomerangBoardStack(source) ? 1400 : undefined;

const appendSourceReturnFeedback = ({
	motion,
	plan,
	source,
}: {
	motion: GameVisualMotion;
	plan: GameEngineVisualPlanDraft;
	source: ConsumedEvent;
}) => {
	if (source.from.kind !== "board" || !shouldBoomerangBoardStack(source)) return;

	appendBoardTileBounceFeedback({
		delayMs: motion.durationMs,
		groupId: `${motion.groupId}:source-return-feedback`,
		plan,
		tileId: source.from.itemInstanceId,
	});
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
		durationMs: readStackMotionDurationMs(source),
		groupId: `engine:input-store:${source.from.itemInstanceId}:${targetItemInstanceId}:${source.itemId}`,
	});
	const cleanupDelayMs = gameVisualMotionSettlementDelayMs(motion);
	const tile: BoardTransientTile = {
		groupId: motion.groupId,
		id: `transient:input-store:${motion.groupId}:source:${previousSource.id}`,
		itemId: source.itemId as BoardTransientTile["itemId"],
		quantity: source.from.previousQuantity ?? source.from.quantity,
		slotId: cellKey(previousSource.x, previousSource.y),
	};

	appendSourceReturnFeedback({
		motion,
		plan,
		source,
	});

	plan.boardTransientTilePlans.push({
		cleanupDelayMs,
		groupId: motion.groupId,
		request: {
			cleanupDelayMs,
			exit: {
				...toTileEngineExitMotion(motion, {
					toTileId: targetItemInstanceId,
				}),
				...(shouldBoomerangBoardStack(source)
					? {
							kind: "boomerang-to-tile" as const,
						}
					: {}),
			},
			tileId: tile.id,
		},
		tile,
	});
};
