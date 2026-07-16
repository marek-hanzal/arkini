import { Effect } from "effect";

import type { InputSimpleSchema } from "~/engine/input/schema/InputSimpleSchema";
import type { InputChargeRunPlanSchema } from "~/engine/input/schema/run/InputChargeRunPlanSchema";
import type { InputSimpleRunPlanSchema } from "~/engine/input/schema/run/InputSimpleRunPlanSchema";

export namespace planInputSimpleRunFx {
	export interface Props {
		input: InputSimpleSchema.Type;
		charges?: InputChargeRunPlanSchema.Type;
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
	} satisfies InputSimpleRunPlanSchema.Type;
});
