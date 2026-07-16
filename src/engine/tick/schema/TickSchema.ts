import { z } from "zod";

import { TimeSchema } from "~/engine/common/schema/TimeSchema";
import { TimestampSchema } from "~/engine/common/schema/TimestampSchema";

/** Transient clock cursor and elapsed budget owned by one game session. */
export const TickSchema = z
	.object({
		observedAtMs: TimestampSchema.describe(
			"The latest Effect Clock timestamp already folded into the pending budget.",
		),
		pendingElapsedMs: TimeSchema.describe(
			"Simulation milliseconds waiting to form canonical fixed steps.",
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
