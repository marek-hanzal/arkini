import { z } from "zod";

import { RuntimeCheckIssueEnumSchema } from "~/engine/runtime/schema/check/RuntimeCheckIssueEnumSchema";
import { IdSchema } from "~/engine/common/schema/IdSchema";
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
