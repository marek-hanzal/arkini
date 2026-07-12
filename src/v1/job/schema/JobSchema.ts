import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { TimeSchema } from "~/v1/common/schema/TimeSchema";
import { RevisionSchema } from "~/v1/revision/schema/RevisionSchema";

/** One active product-line run owned by one live runtime item. */
export const JobSchema = z
	.object({
		id: IdSchema.describe("The stable identity of this active product-line run."),
		ownerItemId: IdSchema.describe("The runtime item that owns this product-line run."),
		lineId: IdSchema.describe("The configured product line executed by this run."),
		durationMs: TimeSchema.describe("The duration captured when this job started."),
		remainingMs: TimeSchema.describe("The real work time still required by this job."),
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
