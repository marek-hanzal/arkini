import { Equal } from "effect";
import { useCallback } from "react";

import { useGameEngine } from "~/game-presentation/ui/useGameEngine";
import { useRuntimeSelector } from "~/game-presentation/ui/useRuntimeSelector";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { canControlItemProductionFn } from "~/production-line/fn/canControlItemProductionFn";
import { useItemQueueClearCommand } from "./useItemQueueClearCommand";

export namespace useItemQueueClearController {
	export interface Props {
		readonly ownerItemId?: IdSchema.Type;
		readonly disabled: boolean;
	}
	export interface Output {
		readonly queued: number;
		readonly disabled: boolean;
		readonly clearFn: () => void;
	}
}

/** Clears only this live owner's pending requests; active jobs remain engine-owned. */
export const useItemQueueClearController = ({
	ownerItemId,
	disabled,
}: useItemQueueClearController.Props): useItemQueueClearController.Output => {
	const game = useGameEngine();
	const selectorFn = useCallback(
		(runtime: RuntimeSchema.Type) => {
			const owner = runtime.items.find((item) => item.id === ownerItemId);
			return {
				queued:
					owner === undefined
						? 0
						: runtime.jobQueue.filter((request) => request.ownerItemId === owner.id)
								.length,
				controllable:
					owner !== undefined &&
					owner.location.scope === "board" &&
					canControlItemProductionFn(owner.item),
			};
		},
		[
			ownerItemId,
		],
	);
	const state = useRuntimeSelector(game, selectorFn, Equal.equals);
	const command = useItemQueueClearCommand(ownerItemId);
	const unavailable = disabled || !state.controllable || state.queued === 0 || command.waiting;
	return {
		queued: state.queued,
		disabled: unavailable,
		clearFn: () => {
			if (unavailable || ownerItemId === undefined) return;
			command.clearQueueFn({
				ownerItemId,
			});
		},
	};
};
