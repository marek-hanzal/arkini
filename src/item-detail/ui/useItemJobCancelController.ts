import { useAtom } from "@effect/atom-react";
import { Equal } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useCallback, useMemo } from "react";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { useGameEngine } from "~/game-presentation/ui/useGameEngine";
import { useRuntimeSelector } from "~/game-presentation/ui/useRuntimeSelector";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { cancelItemJobFx } from "~/production-job/fx/cancelItemJobFx";
import { canControlItemProductionFn } from "~/production-line/fn/canControlItemProductionFn";
import { readSettledAsyncResultErrorFx } from "~/ui/fx/readSettledAsyncResultErrorFx";

export namespace useItemJobCancelController {
	export interface Props {
		readonly ownerItemId?: IdSchema.Type;
		readonly lineId?: IdSchema.Type;
		readonly jobId?: IdSchema.Type;
		readonly disabled: boolean;
	}
	export interface Output {
		readonly disabled: boolean;
		readonly cancelFn: () => void;
	}
}

/** Cancels the displayed active job identity; never substitutes a newer request. */
export const useItemJobCancelController = ({
	ownerItemId,
	lineId,
	jobId,
	disabled,
}: useItemJobCancelController.Props): useItemJobCancelController.Output => {
	const game = useGameEngine();
	const selectorFn = useCallback(
		(runtime: RuntimeSchema.Type) => {
			const owner = runtime.items.find((item) => item.id === ownerItemId);
			return {
				present: runtime.jobs.some(
					(job) =>
						job.id === jobId &&
						job.ownerItemId === ownerItemId &&
						job.lineId === lineId,
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
			jobId,
		],
	);
	const state = useRuntimeSelector(game, selectorFn, Equal.equals);
	const commandAtom = useMemo(
		() => Atom.fn((props: cancelItemJobFx.Props) => game.runFx(cancelItemJobFx(props))),
		[
			game,
			ownerItemId,
			lineId,
			jobId,
		],
	);
	const [result, cancelJobFn] = useAtom(commandAtom);
	RendererRuntime.runSync(readSettledAsyncResultErrorFx(result));
	const unavailable = disabled || !state.controllable || !state.present || result.waiting;
	return {
		disabled: unavailable,
		cancelFn: () => {
			if (unavailable || ownerItemId === undefined || jobId === undefined) return;
			cancelJobFn({
				ownerItemId,
				jobId,
			});
		},
	};
};
