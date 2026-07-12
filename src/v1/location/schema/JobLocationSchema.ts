import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { InputLocationSchema } from "./InputLocationSchema";

/**
 * One material item reserved by an active product-line job.
 */
export const JobLocationSchema = z
	.object({
		/** Identifies this location as owned by one active job. */
		scope: z.literal("job"),
		/** Stable identity of the active job reserving this material. */
		jobId: IdSchema.describe("The active job reserving this material."),
		/** Input-buffer location restored when this reservation ends. */
		returnLocation: InputLocationSchema.describe(
			"The input-buffer location restored when this reservation ends.",
		),
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
