import { z } from "zod";

import { RuntimeCheckIssueEnumSchema } from "~/engine/runtime/schema/check/RuntimeCheckIssueEnumSchema";
import { IdSchema } from "~/engine/common/schema/IdSchema";
import { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
export const JobQueueExceededIssueSchema = z
	.object({
		ownerItemId: IdSchema,
		jobIds: z.array(IdSchema).min(1),
		maxQueueSize: PositiveIntegerSchema,
		queueSize: PositiveIntegerSchema,
		type: RuntimeCheckIssueEnumSchema.extract([
			"JobQueueExceeded",
		]),
	})
	.strict()
	.meta({
		id: "JobQueueExceededIssueSchema",
		description: "One owner has more active jobs than its queue permits.",
	});
export type JobQueueExceededIssueSchema = typeof JobQueueExceededIssueSchema;
export namespace JobQueueExceededIssueSchema {
	export type Type = z.infer<JobQueueExceededIssueSchema>;
}
