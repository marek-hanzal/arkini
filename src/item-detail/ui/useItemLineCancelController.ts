import { Equal } from "effect";
import { useCallback } from "react";

import { useGameEngine } from "~/game-presentation/ui/useGameEngine";
import { useRuntimeSelector } from "~/game-presentation/ui/useRuntimeSelector";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { canControlItemProductionFn } from "~/production-line/fn/canControlItemProductionFn";
import { useItemQueueClearCommand } from "./useItemQueueClearCommand";

export namespace useItemLineCancelController {
	export interface Props {
		readonly ownerItemId?: IdSchema.Type;
		readonly lineId: IdSchema.Type;
		readonly requestId?: IdSchema.Type;
		readonly disabled: boolean;
	}
	export interface Output {
		readonly disabled: boolean;
		readonly cancelFn: () => void;
	}
}

/** Cancels the displayed request identity even while its status is debounced; never substitutes a newer request. */
export const useItemLineCancelController = ({
	ownerItemId,
	lineId,
	requestId,
	disabled,
}: useItemLineCancelController.Props): useItemLineCancelController.Output => {
	const game = useGameEngine();
	const selectorFn = useCallback(
		(runtime: RuntimeSchema.Type) => {
			const owner = runtime.items.find((item) => item.id === ownerItemId);
			return {
				present: runtime.jobQueue.some(
					(request) =>
						request.id === requestId &&
						request.ownerItemId === ownerItemId &&
						request.lineId === lineId,
				),
				controllable:
					owner !== undefined &&
					owner.location.scope === "board" &&
					canControlItemProductionFn(owner.item),
			};
		},
		[
			ownerItemId,
			lineId,
			requestId,
		],
	);
	const state = useRuntimeSelector(game, selectorFn, Equal.equals);
	const command = useItemQueueClearCommand(ownerItemId, requestId);
	const unavailable = disabled || !state.controllable || !state.present || command.waiting;
	return {
		disabled: unavailable,
		cancelFn: () => {
			if (unavailable || ownerItemId === undefined || requestId === undefined) return;
			command.clearQueueFn({
				ownerItemId,
				requestId,
			});
		},
	};
};
