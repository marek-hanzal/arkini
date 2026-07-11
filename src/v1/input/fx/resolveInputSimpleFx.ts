import { Effect } from "effect";

import type { InputSimpleSchema } from "~/v1/input/schema/InputSimpleSchema";
import type { InputSimpleResolutionSchema } from "~/v1/input/schema/resolution/InputSimpleResolutionSchema";

export namespace resolveInputSimpleFx {
	export interface Props {
		input: InputSimpleSchema.Type;
	}
}

/**
 * Resolves one simple input as always ready.
 */
export const resolveInputSimpleFx = Effect.fn("resolveInputSimpleFx")(function* ({
	input,
}: resolveInputSimpleFx.Props) {
	return {
		type: input.type,
		ready: true,
	} satisfies InputSimpleResolutionSchema.Type;
});
