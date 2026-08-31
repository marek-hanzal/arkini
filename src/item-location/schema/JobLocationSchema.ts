import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";

import { LocationScopeEnumSchema } from "./LocationScopeEnumSchema";
/** One consumed material root committed to an active product-line job. */
export const JobLocationSchema = z
	.object({
		/** Identifies this consumed root as owned by one active job. */
		scope: LocationScopeEnumSchema.extract([
			"Job",
		]),
		/** Stable identity of the active job consuming this material. */
		jobId: IdSchema.describe("The active job consuming this material root."),
	})
	.strict()
	.meta({
		id: "JobLocationSchema",
		description: "One consumed material root committed to an active product-line job.",
	});

export type JobLocationSchema = typeof JobLocationSchema;

export namespace JobLocationSchema {
	export type Type = z.infer<JobLocationSchema>;
}
