import { z } from "zod";

import { GameEventEnumSchema } from "./GameEventEnumSchema";

import { IdSchema } from "~/engine/common/schema/IdSchema";

export const JobCompletedGameEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			"JobCompleted",
		]),
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
