import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";

export const JobStartedGameEventSchema = z
	.object({
		type: z.literal("job:started"),
		jobId: IdSchema,
		ownerItemId: IdSchema,
		lineId: IdSchema,
		source: z.enum([
			"explicit",
			"queue",
		]),
	})
	.strict()
	.meta({
		id: "JobStartedGameEventSchema",
		description: "Transient fact that one gameplay job started.",
	});

export type JobStartedGameEventSchema = typeof JobStartedGameEventSchema;

export namespace JobStartedGameEventSchema {
	export type Type = z.infer<JobStartedGameEventSchema>;
}
