import { Context } from "effect";

import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import { evaluateWhenFx } from "~/engine/when/fx/evaluateWhenFx";
import type { WhenSchema } from "~/engine/when/schema/WhenSchema";

export type WhenEvaluationIntent = "falsify" | "satisfy";

export interface WhenEvaluationProps {
	readonly intent?: WhenEvaluationIntent;
	readonly origin: BoardLocationSchema.Type;
	readonly when: WhenSchema.Type;
}

export interface WhenEvaluationFxService {
	readonly evaluate: (props: WhenEvaluationProps) => ReturnType<typeof evaluateWhenFx>;
}

/** Owns runtime condition evaluation while canonical gameplay remains the default. */
export const WhenEvaluationFx = Context.Reference<WhenEvaluationFxService>("WhenEvaluationFx", {
	defaultValue: () => ({
		evaluate: evaluateWhenFx,
	}),
});

export type WhenEvaluationFx = typeof WhenEvaluationFx;
