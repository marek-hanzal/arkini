import { cellKey } from "~/v0/board/cellKey";
import type { BoardTransientTile } from "~/v0/board/animation/BoardTransientTile";
import type { BoardView } from "~/v0/board/view/BoardViewSchema";
import type { GameEvent } from "~/v0/game/event/GameEventSchema";
import { gameVisualMotionSettlementDelayMs } from "~/v0/play/game-engine-visual/gameVisualMotionSettlementDelayMs";
import { GameVisualMotion } from "~/v0/play/game-engine-visual/GameVisualMotion";
import type { GameEngineVisualPlanDraft } from "~/v0/play/game-engine-visual/GameEngineVisualPlanDraft";
import { toTileEngineExitMotion } from "~/v0/play/game-engine-visual/toTileEngineExitMotion";

type ConsumedEvent = Extract<
	GameEvent,
	{
		type: "item.consumed";
	}
>;
type StoredEvent = Extract<
	GameEvent,
	{
		type: "producer_input.stored" | "craft_input.stored";
	}
>;

export namespace appendProducerInputStoreVisuals {
	export interface Props {
		plan: GameEngineVisualPlanDraft;
		previousBoard: BoardView | undefined;
		source: ConsumedEvent;
		stored: StoredEvent;
	}
}

const readTargetItemInstanceId = (stored: StoredEvent) =>
	stored.type === "producer_input.stored"
		? stored.producerItemInstanceId
		: stored.targetItemInstanceId;

export const appendProducerInputStoreVisuals = ({
	plan,
	previousBoard,
	source,
	stored,
}: appendProducerInputStoreVisuals.Props) => {
	if (source.from.kind !== "board") return;

	const previousSource = previousBoard?.byId[source.from.itemInstanceId];
	const targetItemInstanceId = readTargetItemInstanceId(stored);
	const target = previousBoard?.byId[targetItemInstanceId];
	if (!previousSource || !target) return;

	const motion = GameVisualMotion.merge({
		cause: stored.type === "producer_input.stored" ? "producer" : "craft",
		groupId: `engine:input-store:${source.from.itemInstanceId}:${targetItemInstanceId}:${stored.itemId}`,
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
