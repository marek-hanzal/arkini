import { z } from "zod";
import { IdSchema } from "~/v1/common/schema/IdSchema";
import { JobLocationSchema } from "~/v1/location/schema/JobLocationSchema";
export const JobReservationOrphanIssueSchema = z
	.object({
		itemId: IdSchema,
		jobId: IdSchema,
		location: JobLocationSchema,
		type: z.literal("job:reservation-orphan"),
	})
	.strict()
	.meta({
		id: "JobReservationOrphanIssueSchema",
		description: "One reserved item references a missing active job.",
	});
export type JobReservationOrphanIssueSchema = typeof JobReservationOrphanIssueSchema;
export namespace JobReservationOrphanIssueSchema {
	export type Type = z.infer<JobReservationOrphanIssueSchema>;
}
