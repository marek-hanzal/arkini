import { Effect } from "effect";

import type { SimpleSchema } from "~/engine/input/schema/SimpleSchema";
import type { InputSimpleResolutionSchema } from "~/engine/input/schema/resolution/InputSimpleResolutionSchema";

export namespace resolveInputSimpleFx {
	export interface Props {
		input: SimpleSchema.Type;
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
