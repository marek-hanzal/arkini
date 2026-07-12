import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { LocationSchema } from "~/v1/location/schema/LocationSchema";

/** An active job owner no longer occupies a concrete board or inventory grid. */
export const JobOwnerNotOnGridIssueSchema = z
	.object({
		jobId: IdSchema,
		ownerItemId: IdSchema,
		location: LocationSchema,
		type: z.literal("job:owner-not-on-grid"),
	})
	.strict()
	.meta({
		id: "JobOwnerNotOnGridIssueSchema",
		description: "An active job owner no longer occupies a concrete grid.",
	});

export type JobOwnerNotOnGridIssueSchema = typeof JobOwnerNotOnGridIssueSchema;

export namespace JobOwnerNotOnGridIssueSchema {
	export type Type = z.infer<JobOwnerNotOnGridIssueSchema>;
}
