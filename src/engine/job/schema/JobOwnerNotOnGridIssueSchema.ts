import { z } from "zod";

import { RuntimeCheckIssueEnumSchema } from "~/engine/runtime/schema/check/RuntimeCheckIssueEnumSchema";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { LocationSchema } from "~/engine/location/schema/LocationSchema";

/** An active job owner no longer occupies a concrete board or inventory grid. */
export const JobOwnerNotOnGridIssueSchema = z
	.object({
		jobId: IdSchema,
		ownerItemId: IdSchema,
		location: LocationSchema,
		type: RuntimeCheckIssueEnumSchema.extract([
			RuntimeCheckIssueEnumSchema.enum.JobOwnerNotOnGrid,
		]),
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
