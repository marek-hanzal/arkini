import { Effect } from "effect";

import type { InputSimpleSchema } from "~/engine/input/schema/InputSimpleSchema";
import type { InputSimpleResolutionSchema } from "~/engine/input/schema/resolution/InputSimpleResolutionSchema";

export namespace resolveInputSimpleFx {
	export interface Props {
		input: InputSimpleSchema.Type;
	}
}

/**
 * Resolves the material-free portion of one simple input as ready.
 *
 * Line-run resolution applies any authored charge requirement separately.
 */
export const resolveInputSimpleFx = Effect.fn("resolveInputSimpleFx")(function* ({
	input,
}: resolveInputSimpleFx.Props) {
	return {
		type: input.type,
		ready: true,
	} satisfies InputSimpleResolutionSchema.Type;
});
