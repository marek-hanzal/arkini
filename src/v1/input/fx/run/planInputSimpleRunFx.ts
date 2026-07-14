import { Effect } from "effect";

import type { InputSimpleSchema } from "~/v1/input/schema/InputSimpleSchema";
import type { InputChargeRunPlanSchema } from "~/v1/input/schema/run/InputChargeRunPlanSchema";
import type { InputSimpleRunPlanSchema } from "~/v1/input/schema/run/InputSimpleRunPlanSchema";

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
