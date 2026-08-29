import { z } from "zod";

import { GameEventEnumSchema } from "./GameEventEnumSchema";

import { IdSchema } from "~/engine/common/schema/IdSchema";

export const JobStartedGameEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			"JobStarted",
		]),
		jobId: IdSchema,
		ownerItemId: IdSchema,
		lineId: IdSchema,
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
