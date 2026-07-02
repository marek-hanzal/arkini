import type { GameEvent } from "~/v0/game/event/GameEventSchema";
import { appendBoardTileBounceFeedback } from "~/v0/play/game-engine-visual/appendBoardTileBounceFeedback";
import type { GameEngineVisualPlanDraft } from "~/v0/play/game-engine-visual/GameEngineVisualPlanDraft";

type TargetEvent = Extract<
	GameEvent,
	{
		type: "producer_input.stored" | "craft_input.stored";
	}
>;

export namespace appendActivationInputTargetFeedback {
	export interface Props {
		plan: GameEngineVisualPlanDraft;
		target: TargetEvent;
	}
}

const readTargetItemInstanceId = (target: TargetEvent) => {
	if (target.type === "producer_input.stored") return target.itemInstanceId;
	return target.targetItemInstanceId;
};

const readFeedbackGroupId = (target: TargetEvent) =>
	`engine:input-feedback:${readTargetItemInstanceId(target)}:${target.itemId}:${target.atMs}`;

export const appendActivationInputTargetFeedback = ({
	plan,
	target,
}: appendActivationInputTargetFeedback.Props) =>
	appendBoardTileBounceFeedback({
		groupId: readFeedbackGroupId(target),
		plan,
		tileId: readTargetItemInstanceId(target),
	});
