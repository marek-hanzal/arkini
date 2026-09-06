import { z } from "zod";

import { RuntimeCheckIssueEnumSchema } from "~/game-runtime/schema/RuntimeCheckIssueEnumSchema";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { JobLocationSchema } from "~/item-location/schema/JobLocationSchema";
import { ReservedLocationSchema } from "~/item-location/schema/ReservedLocationSchema";

const JobMaterialInputIssueReasonSchema = z.enum({
	SelectorMismatch: "selector-mismatch",
	SlotInvalid: "slot-invalid",
});

/** One job-owned material does not belong to its attributed material input. */
export const JobMaterialInputIssueSchema = z
	.object({
		itemId: IdSchema,
		jobId: IdSchema,
		location: z.union([
			JobLocationSchema,
			ReservedLocationSchema,
		]),
		reason: JobMaterialInputIssueReasonSchema,
		type: RuntimeCheckIssueEnumSchema.extract([
			"JobMaterialInput",
		]),
	})
	.strict()
	.meta({
		id: "JobMaterialInputIssueSchema",
		description: "One consumed or reserved material item has an invalid input attribution.",
	});

export type JobMaterialInputIssueSchema = typeof JobMaterialInputIssueSchema;

export namespace JobMaterialInputIssueSchema {
	export type Type = z.infer<JobMaterialInputIssueSchema>;
}
