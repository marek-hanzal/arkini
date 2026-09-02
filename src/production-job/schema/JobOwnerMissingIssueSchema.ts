import { z } from "zod";

import { RuntimeCheckIssueEnumSchema } from "~/game-runtime/schema/RuntimeCheckIssueEnumSchema";
import { IdSchema } from "~/game-value/schema/IdSchema";
export const JobOwnerMissingIssueSchema = z
	.object({
		jobId: IdSchema,
		ownerItemId: IdSchema,
		type: RuntimeCheckIssueEnumSchema.extract([
			"JobOwnerMissing",
		]),
	})
	.strict()
	.meta({
		id: "JobOwnerMissingIssueSchema",
		description: "An active job references a missing owner item.",
	});
export type JobOwnerMissingIssueSchema = typeof JobOwnerMissingIssueSchema;
export namespace JobOwnerMissingIssueSchema {
	export type Type = z.infer<JobOwnerMissingIssueSchema>;
}
