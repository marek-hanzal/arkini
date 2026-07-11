import { Effect } from "effect";

import type { InputSimpleSchema } from "~/v1/input/schema/InputSimpleSchema";
import type { InputSimpleRunPlanSchema } from "~/v1/input/schema/run/InputSimpleRunPlanSchema";

export namespace planInputSimpleRunFx {
	export interface Props {
		input: InputSimpleSchema.Type;
	}
}

/**
 * Plans the intentionally empty resource operation owned by one simple input.
 */
export const planInputSimpleRunFx = Effect.fn("planInputSimpleRunFx")(function* ({
	input,
}: planInputSimpleRunFx.Props) {
	return {
		type: input.type,
	} satisfies InputSimpleRunPlanSchema.Type;
});
