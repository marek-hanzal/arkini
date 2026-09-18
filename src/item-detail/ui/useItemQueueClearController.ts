import { useAtom } from "@effect/atom-react";
import { Equal } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useCallback, useMemo } from "react";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { useGameEngine } from "~/game-presentation/ui/useGameEngine";
import { useRuntimeSelector } from "~/game-presentation/ui/useRuntimeSelector";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { clearItemJobQueueFx } from "~/production-job/fx/clearItemJobQueueFx";
import { canControlItemProductionFn } from "~/production-line/fn/canControlItemProductionFn";
import { readSettledAsyncResultErrorFx } from "~/ui/fx/readSettledAsyncResultErrorFx";

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
	const commandAtom = useMemo(
		() => Atom.fn((props: clearItemJobQueueFx.Props) => game.runFx(clearItemJobQueueFx(props))),
		[
			game,
			ownerItemId,
		],
	);
	const [result, clearQueueFn] = useAtom(commandAtom);
	RendererRuntime.runSync(readSettledAsyncResultErrorFx(result));
	const unavailable = disabled || !state.controllable || state.queued === 0 || result.waiting;
	return {
		queued: state.queued,
		disabled: unavailable,
		clearFn: () => {
			if (unavailable || ownerItemId === undefined) return;
			clearQueueFn({
				ownerItemId,
			});
		},
	};
};
