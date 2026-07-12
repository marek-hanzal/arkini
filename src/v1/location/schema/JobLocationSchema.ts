import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";

/**
 * One material item reserved by an active product-line job.
 *
 * Reserved materials intentionally remember only the owning job. When released,
 * they re-enter the runtime through the normal drop-placement policy rather than
 * returning to a historical item, slot, or position.
 */
export const JobLocationSchema = z
	.object({
		/** Identifies this location as owned by one active job. */
		scope: z.literal("job"),
		/** Stable identity of the active job reserving this material. */
		jobId: IdSchema.describe("The active job reserving this material."),
	})
	.strict()
	.meta({
		id: "JobLocationSchema",
		description: "One material item reserved by an active product-line job.",
	});

export type JobLocationSchema = typeof JobLocationSchema;

export namespace JobLocationSchema {
	export type Type = z.infer<JobLocationSchema>;
}
