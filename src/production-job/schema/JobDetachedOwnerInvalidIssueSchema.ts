import { z } from "zod";

import { RuntimeCheckIssueEnumSchema } from "~/game-runtime/schema/RuntimeCheckIssueEnumSchema";
import { IdSchema } from "~/game-value/schema/IdSchema";

/** A departed owner has no single ordinary Job to complete from its saved Board origin. */
export const JobDetachedOwnerInvalidIssueSchema = z
	.object({
		itemId: IdSchema,
		jobIds: z.array(IdSchema),
		requestIds: z.array(IdSchema),
		type: RuntimeCheckIssueEnumSchema.extract([
			"JobDetachedOwnerInvalid",
		]),
	})
	.strict()
	.meta({
		id: "JobDetachedOwnerInvalidIssueSchema",
		description:
			"A departed owner lacks exactly one ordinary active Job or still owns queued work.",
	});

export type JobDetachedOwnerInvalidIssueSchema = typeof JobDetachedOwnerInvalidIssueSchema;

export namespace JobDetachedOwnerInvalidIssueSchema {
	export type Type = z.infer<JobDetachedOwnerInvalidIssueSchema>;
}
