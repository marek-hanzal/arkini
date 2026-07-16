import type { BoardView } from "~/board/view/BoardViewSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import { appendBoardTargetTransformVisuals } from "~/play/game-engine-visual/appendBoardTargetTransformVisuals";
import { GameVisualMotion } from "~/play/game-engine-visual/GameVisualMotion";
import type { GameEngineVisualPlanDraft } from "~/play/game-engine-visual/GameEngineVisualPlanDraft";

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

	appendBoardTargetTransformVisuals({
		currentTarget,
		motion,
		plan,
		previousTarget,
		transientId: `transient:replace-out:${motion.groupId}:target:${previousTarget.id}`,
	});
};
