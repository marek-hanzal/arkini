import { Data } from "effect";

import type { RuntimeCheckResultSchema } from "~/game-runtime/schema/RuntimeCheckResultSchema";

/**
 * A candidate runtime snapshot violates one or more explicit runtime rules.
 */
export class RuntimeInvalidError extends Data.TaggedError("RuntimeInvalidError")<{
	result: RuntimeCheckResultSchema.Type;
}> {}
