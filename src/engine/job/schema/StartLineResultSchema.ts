import { z } from "zod";

import { StartLineResultEnumSchema } from "./StartLineResultEnumSchema";
import { JobQueueRequestSchema } from "./JobQueueRequestSchema";
import { JobSchema } from "./JobSchema";
export const StartLineResultSchema = z
	.discriminatedUnion("type", [
		z
			.object({
				type: StartLineResultEnumSchema.extract([
					"Started",
				]),
				job: JobSchema,
			})
			.strict(),
		z
			.object({
				type: StartLineResultEnumSchema.extract([
					"Queued",
				]),
				request: JobQueueRequestSchema,
			})
			.strict(),
	])
	.meta({
		id: "StartLineResultSchema",
		description: "Result of an explicit line-start request.",
	});
export type StartLineResultSchema = typeof StartLineResultSchema;
export namespace StartLineResultSchema {
	export type Type = z.infer<StartLineResultSchema>;
}
