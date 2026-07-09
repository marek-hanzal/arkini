import { Effect } from "effect";
import { createGameActiveEffectIdFx } from "~/effects/createGameActiveEffectIdFx";
import type { ActivatedLineEffect } from "~/producer/LineStartExecutionTypes";

export const createActivatedLineEffectFx = Effect.fn("startLineFx.createActivatedLineEffectFx")(
	function* ({
		itemInstanceId,
		lineEffectId,
		jobId,
		queuedStartAtMs,
		readyAtMs,
	}: {
		itemInstanceId: string;
		lineEffectId?: string;
		jobId: string;
		queuedStartAtMs: number;
		readyAtMs: number;
	}) {
		if (!lineEffectId) return undefined;

		return {
			effectId: lineEffectId,
			endAtMs: readyAtMs,
			id: yield* createGameActiveEffectIdFx(),
			producerJobId: jobId,
			sourceItemInstanceId: itemInstanceId,
			startAtMs: queuedStartAtMs,
		} satisfies ActivatedLineEffect;
	},
);
