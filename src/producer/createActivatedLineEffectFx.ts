import { Effect } from "effect";
import { createGameActiveEffectIdFx } from "~/effects/createGameActiveEffectIdFx";
import type {
	ActivatedLineEffect,
	LineStartExecutionScope,
} from "~/producer/LineStartExecutionTypes";

export const createActivatedLineEffectFx = Effect.fn("startLineFx.createActivatedLineEffectFx")(
	function* (
		scope: LineStartExecutionScope,
		{
			jobId,
			queuedStartAtMs,
			readyAtMs,
		}: {
			jobId: string;
			queuedStartAtMs: number;
			readyAtMs: number;
		},
	) {
		const { action, checked } = scope;
		if (!checked.line.effect) return undefined;

		return {
			effectId: checked.line.effect.id,
			endAtMs: readyAtMs,
			id: yield* createGameActiveEffectIdFx(),
			producerJobId: jobId,
			sourceItemInstanceId: action.itemInstanceId,
			startAtMs: queuedStartAtMs,
		} satisfies ActivatedLineEffect;
	},
);
