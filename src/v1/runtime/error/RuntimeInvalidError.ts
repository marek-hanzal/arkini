import { Data } from "effect";

import type { RuntimeCheckResultSchema } from "~/v1/runtime/schema/check/RuntimeCheckResultSchema";

/**
 * A candidate runtime snapshot violates one or more explicit runtime rules.
 */
export class RuntimeInvalidError extends Data.TaggedError("RuntimeInvalidError")<{
	result: RuntimeCheckResultSchema.Type;
}> {}
