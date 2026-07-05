import type { GameEventOfType } from "~/event/GameEventOfType";
import { appendItemMergeVisuals } from "~/play/game-engine-visual/appendItemMergeVisuals";
import { findMergeResultEventIndex } from "~/play/game-engine-visual/findMergeResultEventIndex";
import type { GameEngineVisualPlanContext } from "~/play/game-engine-visual/GameEngineVisualPlanContext";

export const appendMergeSourceEventVisuals = ({
	context,
	event,
	index,
}: {
	context: GameEngineVisualPlanContext;
	event: GameEventOfType<"item.consumed">;
	index: number;
}) => {
	const replacementIndex = findMergeResultEventIndex({
		afterIndex: index,
		events: context.events,
		skipped: context.skipped,
	});
	const replacement = context.events[replacementIndex];
	if (replacement?.type !== "item.replaced") return false;

	context.skipped.add(replacementIndex);
	appendItemMergeVisuals({
		currentBoard: context.currentBoard,
		plan: context.plan,
		previousBoard: context.previousBoard,
		replaced: replacement,
		source: event,
	});
	return true;
};
