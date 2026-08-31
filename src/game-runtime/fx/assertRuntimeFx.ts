import { Effect } from "effect";

import { RuntimeInvalidError } from "~/game-runtime/error/RuntimeInvalidError";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { checkRuntimeFx } from "./checkRuntimeFx";

interface AssertRuntimeProps {
	runtime: RuntimeSchema.Type;
}

/**
 * Fails when one candidate runtime violates any explicit runtime rule.
 */
export const assertRuntimeFx = Effect.fn("assertRuntimeFx")(function* ({
	runtime,
}: AssertRuntimeProps) {
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
