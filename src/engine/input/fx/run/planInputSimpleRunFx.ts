import { Effect } from "effect";

import type { InputRun } from "~/engine/input/InputRun";
import type { SimpleSchema } from "~/engine/input/schema/SimpleSchema";

export namespace planInputSimpleRunFx {
	export interface Props {
		input: SimpleSchema.Type;
		charges?: InputRun.ChargePlan;
	}
}

/**
 * Plans the intentionally empty resource operation owned by one simple input.
 */
export const planInputSimpleRunFx = Effect.fn("planInputSimpleRunFx")(function* ({
	input,
	charges,
}: planInputSimpleRunFx.Props) {
	return {
		type: input.type,
		charges,
	} satisfies InputRun.SimplePlan;
});
