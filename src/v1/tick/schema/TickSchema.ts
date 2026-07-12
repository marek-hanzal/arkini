import { z } from "zod";

import { TimeSchema } from "~/v1/common/schema/TimeSchema";
import { TimestampSchema } from "~/v1/common/schema/TimestampSchema";

/** One immutable real-time impulse consumed by the engine. */
export const TickSchema = z
	.object({
		nowMs: TimestampSchema.describe("The Effect clock timestamp captured for this tick."),
		elapsedMs: TimeSchema.describe("The real milliseconds elapsed since the preceding tick."),
	})
	.strict()
	.meta({
		id: "TickSchema",
		description: "One immutable real-time impulse consumed by the engine.",
	});

export type TickSchema = typeof TickSchema;

export namespace TickSchema {
	export type Type = z.infer<TickSchema>;
}
