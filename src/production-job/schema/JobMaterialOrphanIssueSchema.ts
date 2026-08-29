import { z } from "zod";

import { RuntimeCheckIssueEnumSchema } from "~/engine/runtime/schema/check/RuntimeCheckIssueEnumSchema";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { JobLocationSchema } from "~/engine/location/schema/JobLocationSchema";
import { ReservedLocationSchema } from "~/engine/location/schema/ReservedLocationSchema";

export const JobMaterialOrphanIssueSchema = z
	.object({
		itemId: IdSchema,
		jobId: IdSchema,
		location: z.union([
			JobLocationSchema,
			ReservedLocationSchema,
		]),
		type: RuntimeCheckIssueEnumSchema.extract([
			"JobMaterialOrphan",
		]),
	})
	.strict()
	.meta({
		id: "JobMaterialOrphanIssueSchema",
		description: "One consumed or reserved material item references a missing active job.",
	});

export type JobMaterialOrphanIssueSchema = typeof JobMaterialOrphanIssueSchema;

export namespace JobMaterialOrphanIssueSchema {
	export type Type = z.infer<JobMaterialOrphanIssueSchema>;
}
