import { Effect } from "effect";
import type { GameEvent } from "~/event/GameEventSchema";
import type {
	ActivatedLineEffect,
	LineStartExecutionScope,
} from "~/producer/LineStartExecutionTypes";

export const readLineStartedEventsFx = Effect.fn("startLineFx.readLineStartedEventsFx")(function* (
	scope: LineStartExecutionScope,
	{
		activatedEffect,
		capacityEvents,
		jobId,
		queuedStartAtMs,
		readyAtMs,
	}: {
		activatedEffect: ActivatedLineEffect | undefined;
		capacityEvents: readonly GameEvent[];
		jobId: string;
		queuedStartAtMs: number;
		readyAtMs: number;
	},
) {
	const { action, checked, nowMs } = scope;
	return [
		...capacityEvents,
		{
			atMs: nowMs,
			readyAtMs,
			jobId,
			itemInstanceId: action.itemInstanceId,
			lineId: checked.lineId,
			startAtMs: queuedStartAtMs,
			type: "line.started" as const,
		},
		...(activatedEffect
			? [
					{
						atMs: nowMs,
						startAtMs: activatedEffect.startAtMs,
						effectId: activatedEffect.effectId,
						endAtMs: activatedEffect.endAtMs,
						id: activatedEffect.id,
						producerJobId: activatedEffect.producerJobId,
						sourceItemInstanceId: activatedEffect.sourceItemInstanceId,
						type: "effect.activated" as const,
					},
				]
			: []),
	] satisfies GameEvent[];
});
