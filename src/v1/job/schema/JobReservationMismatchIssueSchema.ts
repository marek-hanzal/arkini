import { z } from "zod";
import { IdSchema } from "~/v1/common/schema/IdSchema";
import { JobLocationSchema } from "~/v1/location/schema/JobLocationSchema";
export const JobReservationMismatchIssueSchema = z
	.object({
		itemId: IdSchema,
		jobId: IdSchema,
		location: JobLocationSchema,
		type: z.literal("job:reservation-mismatch"),
	})
	.strict()
	.meta({
		id: "JobReservationMismatchIssueSchema",
		description: "One reserved item returns to a slot not owned by its job.",
	});
export type JobReservationMismatchIssueSchema = typeof JobReservationMismatchIssueSchema;
export namespace JobReservationMismatchIssueSchema {
	export type Type = z.infer<JobReservationMismatchIssueSchema>;
}
