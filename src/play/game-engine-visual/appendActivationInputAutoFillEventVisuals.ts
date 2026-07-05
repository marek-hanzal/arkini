import type { GameEventOfType } from "~/event/GameEventOfType";
import { appendActivationInputStoredTargetVisuals } from "~/play/game-engine-visual/appendActivationInputStoredTargetVisuals";
import { appendActivationInputStoreVisuals } from "~/play/game-engine-visual/appendActivationInputStoreVisuals";
import { findActivationInputTargetEventIndex } from "~/play/game-engine-visual/findActivationInputTargetEventIndex";
import type { GameEngineVisualPlanContext } from "~/play/game-engine-visual/GameEngineVisualPlanContext";
import { shouldAnimateActivationInputStoreVisual } from "~/play/game-engine-visual/shouldAnimateActivationInputStoreVisual";

export const appendActivationInputAutoFillEventVisuals = ({
	context,
	event,
	index,
}: {
	context: GameEngineVisualPlanContext;
	event: GameEventOfType<"item.consumed">;
	index: number;
}) => {
	const targetIndex = findActivationInputTargetEventIndex({
		afterIndex: index,
		events: context.events,
		skipped: context.skipped,
		source: event,
	});
	const target = context.events[targetIndex];
	if (target?.type !== "producer_input.stored" && target?.type !== "craft_input.stored") {
		return false;
	}

	context.skipped.add(targetIndex);
	appendActivationInputStoredTargetVisuals(context, target);

	if (
		shouldAnimateActivationInputStoreVisual({
			target,
		})
	) {
		appendActivationInputStoreVisuals({
			plan: context.plan,
			previousBoard: context.previousBoard,
			source: event,
			target,
		});
	}

	return true;
};
