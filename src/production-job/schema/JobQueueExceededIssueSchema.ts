import { z } from "zod";

import { RuntimeCheckIssueEnumSchema } from "~/game-runtime/schema/RuntimeCheckIssueEnumSchema";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";
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
