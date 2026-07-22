import { z } from "zod";

import { GameEventEnumSchema } from "./GameEventEnumSchema";
import { JobStartSourceEnumSchema } from "./JobStartSourceEnumSchema";

import { IdSchema } from "~/engine/common/schema/IdSchema";

export const JobStartedGameEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			GameEventEnumSchema.enum.JobStarted,
		]),
		jobId: IdSchema,
		ownerItemId: IdSchema,
		lineId: IdSchema,
		source: JobStartSourceEnumSchema,
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
