import { Effect } from "effect";

import type { InputRun } from "~/engine/input/InputRun";
import type { SimpleSchema } from "~/engine/input/schema/SimpleSchema";

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
	} satisfies InputRun.SimpleResolution;
});
