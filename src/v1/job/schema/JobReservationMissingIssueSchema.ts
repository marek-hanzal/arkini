import { z } from "zod";
import { IdSchema } from "~/v1/common/schema/IdSchema";
import { JobLocationSchema } from "~/v1/location/schema/JobLocationSchema";
export const JobReservationMissingIssueSchema = z
	.object({
		itemId: IdSchema,
		jobId: IdSchema,
		location: JobLocationSchema,
		type: z.literal("job:reservation-missing"),
	})
	.strict()
	.meta({
		id: "JobReservationMissingIssueSchema",
		description: "One reserved item references a missing active job.",
	});
export type JobReservationMissingIssueSchema = typeof JobReservationMissingIssueSchema;
export namespace JobReservationMissingIssueSchema {
	export type Type = z.infer<JobReservationMissingIssueSchema>;
}
