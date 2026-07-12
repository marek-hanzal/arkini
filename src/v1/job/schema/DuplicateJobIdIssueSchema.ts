import { z } from "zod";
import { IdSchema } from "~/v1/common/schema/IdSchema";

/** Multiple active jobs share one stable identity. */
export const DuplicateJobIdIssueSchema = z
	.object({
		jobId: IdSchema,
		type: z.literal("job:id:duplicate"),
	})
	.strict()
	.meta({
		id: "DuplicateJobIdIssueSchema",
		description: "Multiple active jobs share one identity.",
	});
export type DuplicateJobIdIssueSchema = typeof DuplicateJobIdIssueSchema;
export namespace DuplicateJobIdIssueSchema {
	export type Type = z.infer<DuplicateJobIdIssueSchema>;
}
