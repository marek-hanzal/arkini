import { Data } from "effect";

import type { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";

/**
 * An operation requiring a fresh runtime received an already populated runtime.
 */
export class RuntimeNotEmptyError extends Data.TaggedError("RuntimeNotEmptyError")<{
	itemCount: PositiveIntegerSchema.Type;
}> {}
