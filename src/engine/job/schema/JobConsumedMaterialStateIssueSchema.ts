import { z } from "zod";

import { RuntimeCheckIssueEnumSchema } from "~/engine/runtime/schema/check/RuntimeCheckIssueEnumSchema";

import { IdSchema } from "~/engine/common/schema/IdSchema";

export const JobConsumedMaterialStateIssueSchema = z
	.object({
		itemId: IdSchema,
		jobId: IdSchema,
		ownedItemIds: z.array(IdSchema),
		ownedJobIds: z.array(IdSchema),
		requestIds: z.array(IdSchema),
		type: RuntimeCheckIssueEnumSchema.extract([
			"JobConsumedMaterialState",
		]),
	})
	.strict()
	.meta({
		id: "JobConsumedMaterialStateIssueSchema",
		description: "One consumed job root still owns runtime state that start must destroy.",
	});

export type JobConsumedMaterialStateIssueSchema = typeof JobConsumedMaterialStateIssueSchema;

export namespace JobConsumedMaterialStateIssueSchema {
	export type Type = z.infer<JobConsumedMaterialStateIssueSchema>;
}
