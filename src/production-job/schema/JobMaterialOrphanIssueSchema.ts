import { z } from "zod";

import { RuntimeCheckIssueEnumSchema } from "~/game-runtime/schema/RuntimeCheckIssueEnumSchema";

import { IdSchema } from "~/game-config/schema/IdSchema";
import { JobLocationSchema } from "~/item-location/schema/JobLocationSchema";
import { ReservedLocationSchema } from "~/item-location/schema/ReservedLocationSchema";

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
