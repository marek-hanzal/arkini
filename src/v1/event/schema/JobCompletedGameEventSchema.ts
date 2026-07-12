import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";

export const JobCompletedGameEventSchema = z
	.object({
		type: z.literal("job:completed"),
		jobId: IdSchema,
		ownerItemId: IdSchema,
		lineId: IdSchema,
	})
	.strict()
	.meta({
		id: "JobCompletedGameEventSchema",
		description: "Transient fact that one gameplay job completed.",
	});

export type JobCompletedGameEventSchema = typeof JobCompletedGameEventSchema;

export namespace JobCompletedGameEventSchema {
	export type Type = z.infer<JobCompletedGameEventSchema>;
}
