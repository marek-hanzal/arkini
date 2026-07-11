import { Effect } from "effect";

import { RuntimeInvalidError } from "~/v1/runtime/error/RuntimeInvalidError";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { checkRuntimeFx } from "./checkRuntimeFx";

export namespace assertRuntimeFx {
	export interface Props {
		runtime: RuntimeSchema.Type;
	}
}

/**
 * Fails when one candidate runtime violates any explicit runtime rule.
 */
export const assertRuntimeFx = Effect.fn("assertRuntimeFx")(function* ({
	runtime,
}: assertRuntimeFx.Props) {
	const result = yield* checkRuntimeFx({
		runtime,
	});

	if (result.issues.length > 0) {
		return yield* Effect.fail(
			new RuntimeInvalidError({
				result,
			}),
		);
	}

	return runtime;
});
