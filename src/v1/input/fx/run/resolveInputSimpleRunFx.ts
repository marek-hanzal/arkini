import { Effect } from "effect";

import { resolveInputSimpleFx } from "~/v1/input/fx/resolveInputSimpleFx";
import type { InputSimpleSchema } from "~/v1/input/schema/InputSimpleSchema";
import type { InputRunResolutionSchema } from "~/v1/input/schema/run/InputRunResolutionSchema";
import { planInputSimpleRunFx } from "./planInputSimpleRunFx";

export namespace resolveInputSimpleRunFx {
	export interface Props {
		input: InputSimpleSchema.Type;
	}
}

/**
 * Resolves and plans one simple line input.
 */
export const resolveInputSimpleRunFx = Effect.fn("resolveInputSimpleRunFx")(function* ({
	input,
}: resolveInputSimpleRunFx.Props) {
	const resolution = yield* resolveInputSimpleFx({
		input,
	});
	const plan = yield* planInputSimpleRunFx({
		input,
	});

	return {
		resolution,
		plan,
	} satisfies InputRunResolutionSchema.Type;
});
