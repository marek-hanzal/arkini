import { z } from "zod";

import { RuntimeCheckIssueEnumSchema } from "~/game-runtime/schema/check/RuntimeCheckIssueEnumSchema";
import { IdSchema } from "~/game-config/schema/IdSchema";
import { TimeSchema } from "~/game-config/schema/TimeSchema";
export const JobTimeInvalidIssueSchema = z
	.object({
		type: RuntimeCheckIssueEnumSchema.extract([
			"JobTimeInvalid",
		]),
		jobId: IdSchema,
		durationMs: TimeSchema,
		remainingMs: z.number(),
	})
	.strict();
export type JobTimeInvalidIssueSchema = typeof JobTimeInvalidIssueSchema;
export namespace JobTimeInvalidIssueSchema {
	export type Type = z.infer<JobTimeInvalidIssueSchema>;
}
