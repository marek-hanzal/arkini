import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { TimestampSchema } from "~/v1/common/schema/TimestampSchema";
import { RevisionSchema } from "~/v1/revision/schema/RevisionSchema";

/**
 * One active product-line run owned by one live runtime item.
 */
export const JobSchema = z
	.object({
		/** Stable identity of this active run. */
		id: IdSchema.describe("The stable identity of this active product-line run."),
		/** Runtime identity of the item that owns this run. */
		ownerItemId: IdSchema.describe("The runtime item that owns this product-line run."),
		/** Stable ID of the configured product line executed by this run. */
		lineId: IdSchema.describe("The configured product line executed by this run."),
		/** Timestamp at which this run started. */
		startedAtMs: TimestampSchema.describe("The timestamp at which this run started."),
		/** Timestamp at which this run becomes due for completion. */
		dueAtMs: TimestampSchema.describe("The timestamp at which this run becomes due."),
		/** Opaque optimistic-concurrency token replaced after every job mutation. */
		revision: RevisionSchema.describe("The optimistic-concurrency revision of this job."),
	})
	.strict()
	.meta({
		id: "JobSchema",
		description: "One active product-line run owned by one live runtime item.",
	});

export type JobSchema = typeof JobSchema;

export namespace JobSchema {
	export type Type = z.infer<JobSchema>;
}
