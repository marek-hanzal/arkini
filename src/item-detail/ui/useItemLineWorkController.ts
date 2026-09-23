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
import { clearItemJobQueueFx } from "~/production-job/fx/clearItemJobQueueFx";
import { canControlItemProductionFn } from "~/production-line/fn/canControlItemProductionFn";
import { readSettledAsyncResultErrorFx } from "~/ui/fx/readSettledAsyncResultErrorFx";

export namespace useItemLineWorkController {
	export interface Props {
		readonly ownerItemId?: IdSchema.Type;
		readonly lineUid: IdSchema.Type;
		readonly jobId?: IdSchema.Type;
		readonly disabled: boolean;
	}
	export interface Output {
		readonly clearDisabled: boolean;
		readonly cancelJobDisabled: boolean;
		readonly clearFn: () => void;
		readonly cancelJobFn: () => void;
	}
}

/** Clears one line's pending work and cancels only the displayed active job identity. */
export const useItemLineWorkController = ({
	ownerItemId,
	lineUid,
	jobId,
	disabled,
}: useItemLineWorkController.Props): useItemLineWorkController.Output => {
	const game = useGameEngine();
	const selectorFn = useCallback(
		(runtime: RuntimeSchema.Type) => {
			const owner = runtime.items.find((item) => item.id === ownerItemId);
			return {
				queued: runtime.jobQueue.some(
					(request) => request.ownerItemId === ownerItemId && request.lineUid === lineUid,
				),
				present: runtime.jobs.some(
					(job) =>
						job.id === jobId &&
						job.ownerItemId === ownerItemId &&
						job.lineUid === lineUid,
				),
				controllable:
					owner !== undefined &&
					owner.location.scope === "board" &&
					canControlItemProductionFn(owner.item),
			};
		},
		[
			ownerItemId,
			lineUid,
			jobId,
		],
	);
	const state = useRuntimeSelector(game, selectorFn, Equal.equals);
	const commandAtom = useMemo(
		() => Atom.fn((props: cancelItemJobFx.Props) => game.runFx(cancelItemJobFx(props))),
		[
			game,
			ownerItemId,
			lineUid,
			jobId,
		],
	);
	const [result, cancelJobFn] = useAtom(commandAtom);
	RendererRuntime.runSync(readSettledAsyncResultErrorFx(result));
	const clearAtom = useMemo(
		() => Atom.fn((props: clearItemJobQueueFx.Props) => game.runFx(clearItemJobQueueFx(props))),
		[
			game,
			ownerItemId,
			lineUid,
		],
	);
	const [clearResult, clearQueueFn] = useAtom(clearAtom);
	RendererRuntime.runSync(readSettledAsyncResultErrorFx(clearResult));
	const unavailable = disabled || !state.controllable || result.waiting || clearResult.waiting;
	const clearDisabled = unavailable || !state.queued;
	const cancelJobDisabled = unavailable || !state.present;
	return {
		clearDisabled,
		cancelJobDisabled,
		clearFn: () => {
			if (clearDisabled || ownerItemId === undefined) return;
			clearQueueFn({
				ownerItemId,
				lineUid,
			});
		},
		cancelJobFn: () => {
			if (cancelJobDisabled || ownerItemId === undefined || jobId === undefined) return;
			cancelJobFn({
				ownerItemId,
				jobId,
			});
		},
	};
};
