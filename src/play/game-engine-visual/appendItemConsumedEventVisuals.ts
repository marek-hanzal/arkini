import { match } from "ts-pattern";
import type { GameEventOfType } from "~/event/GameEventOfType";
import { appendActivationInputAutoFillEventVisuals } from "~/play/game-engine-visual/appendActivationInputAutoFillEventVisuals";
import { appendBoardMemoryStoreEventVisuals } from "~/play/game-engine-visual/appendBoardMemoryStoreEventVisuals";
import { appendMergeSourceEventVisuals } from "~/play/game-engine-visual/appendMergeSourceEventVisuals";
import type { GameEngineVisualPlanContext } from "~/play/game-engine-visual/GameEngineVisualPlanContext";
import { ignoreVisualEvent } from "~/play/game-engine-visual/ignoreVisualEvent";

export const appendItemConsumedEventVisuals = ({
	context,
	event,
	index,
}: {
	context: GameEngineVisualPlanContext;
	event: GameEventOfType<"item.consumed">;
	index: number;
}) => {
	const handled = match(event.reason)
		.with("memory-store", () => {
			appendBoardMemoryStoreEventVisuals(context, event);
			return true;
		})
		.with("merge-source", () =>
			appendMergeSourceEventVisuals({
				context,
				event,
				index,
			}),
		)
		.with("producer-input-auto-fill", "craft-input-auto-fill", () =>
			appendActivationInputAutoFillEventVisuals({
				context,
				event,
				index,
			}),
		)
		.with(
			"line-input",
			"producer-input-store",
			"craft-input",
			"craft-input-store",
			"inventory-placement",
			"board-stash",
			"remove-tool",
			"memory-restore",
			() => false,
		)
		.exhaustive();
	if (!handled) ignoreVisualEvent(context, event);
};
