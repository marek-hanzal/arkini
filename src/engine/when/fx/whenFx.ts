import { Effect } from "effect";

import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import {
	WhenEvaluationFx,
	type WhenEvaluationIntent,
} from "~/engine/when/context/WhenEvaluationFx";
import type { WhenSchema } from "~/engine/when/schema/WhenSchema";

export namespace whenFx {
	export interface Props {
		readonly intent?: WhenEvaluationIntent;
		readonly origin: BoardLocationSchema.Type;
		readonly when: WhenSchema.Type;
	}
}

/** Evaluates one runtime condition through the policy in the current Effect context. */
export const whenFx = Effect.fn("whenFx")(function* (props: whenFx.Props) {
	return yield* (yield* WhenEvaluationFx).evaluate(props);
});
