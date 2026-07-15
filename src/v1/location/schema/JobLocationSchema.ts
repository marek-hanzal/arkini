import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { InputModeEnumSchema } from "~/v1/input/schema/InputModeEnumSchema";

/**
 * One material item committed to an active product-line job.
 *
 * Reserved materials return through normal placement after completion. Consumed
 * materials retain their root identity only until completion and are then
 * discarded permanently.
 */
export const JobLocationSchema = z
	.object({
		/** Identifies this location as owned by one active job. */
		scope: z.literal("job"),
		/** Stable identity of the active job owning this material. */
		jobId: IdSchema.describe("The active job owning this material."),
		/** Whether completion returns or permanently discards this material. */
		mode: InputModeEnumSchema.default("reserve").describe(
			"Whether completion returns or permanently discards this job-owned material.",
		),
	})
	.strict()
	.meta({
		id: "JobLocationSchema",
		description: "One material item committed to an active product-line job.",
	});

export type JobLocationSchema = typeof JobLocationSchema;

export namespace JobLocationSchema {
	export type Type = z.infer<JobLocationSchema>;
}
