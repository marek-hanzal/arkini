import { z } from "zod";

import { RuntimeCheckIssueEnumSchema } from "~/engine/runtime/schema/check/RuntimeCheckIssueEnumSchema";
import { IdSchema } from "~/engine/common/schema/IdSchema";

/** Multiple active jobs share one stable identity. */
export const DuplicateJobIdIssueSchema = z
	.object({
		jobId: IdSchema,
		type: RuntimeCheckIssueEnumSchema.extract(["DuplicateJobId"]),
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
