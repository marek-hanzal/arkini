import { Effect } from "effect";
import type { GameEvent } from "~/event/GameEventSchema";
import type { ActivatedLineEffect } from "~/producer/LineStartExecutionTypes";

export const readLineStartedEventsFx = Effect.fn("startLineFx.readLineStartedEventsFx")(
	function* ({
		activatedEffect,
		capacityEvents,
		itemInstanceId,
		jobId,
		lineId,
		nowMs,
		queuedStartAtMs,
		readyAtMs,
	}: {
		activatedEffect: ActivatedLineEffect | undefined;
		capacityEvents: readonly GameEvent[];
		itemInstanceId: string;
		jobId: string;
		lineId: string;
		nowMs: number;
		queuedStartAtMs: number;
		readyAtMs: number;
	}) {
		return [
			...capacityEvents,
			{
				atMs: nowMs,
				readyAtMs,
				jobId,
				itemInstanceId,
				lineId,
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
	},
);
