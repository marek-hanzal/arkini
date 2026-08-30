import { z } from "zod";

import { RuntimeCheckIssueEnumSchema } from "~/game-runtime/schema/check/RuntimeCheckIssueEnumSchema";
import { IdSchema } from "~/game-config/schema/IdSchema";
export const JobLineMissingIssueSchema = z
	.object({
		jobId: IdSchema,
		ownerItemId: IdSchema,
		lineId: IdSchema,
		type: RuntimeCheckIssueEnumSchema.extract([
			"JobLineMissing",
		]),
	})
	.strict()
	.meta({
		id: "JobLineMissingIssueSchema",
		description: "An active job references a missing owner line.",
	});
export type JobLineMissingIssueSchema = typeof JobLineMissingIssueSchema;
export namespace JobLineMissingIssueSchema {
	export type Type = z.infer<JobLineMissingIssueSchema>;
}
