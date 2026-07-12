import { z } from "zod";

import { TimeSchema } from "~/v1/common/schema/TimeSchema";
import { TimestampSchema } from "~/v1/common/schema/TimestampSchema";

/** Transient clock cursor and elapsed budget owned by one game session. */
export const TickSchema = z
	.object({
		observedAtMs: TimestampSchema.describe(
			"The latest Effect Clock timestamp already folded into the pending budget.",
		),
		pendingElapsedMs: TimeSchema.describe(
			"Real elapsed milliseconds waiting for one successful runtime advancement.",
		),
	})
	.strict()
	.meta({
		id: "TickSchema",
		description: "Transient clock cursor and elapsed budget owned by one game session.",
	});

export type TickSchema = typeof TickSchema;

export namespace TickSchema {
	export type Type = z.infer<TickSchema>;
}
