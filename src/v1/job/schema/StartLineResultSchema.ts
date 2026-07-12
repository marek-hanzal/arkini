import { z } from "zod";

import { JobSchema } from "./JobSchema";

/** Result of atomically starting one product-line job. */
export const StartLineResultSchema = z
	.object({
		job: JobSchema.describe("The active job created by this line start."),
	})
	.strict()
	.meta({
		id: "StartLineResultSchema",
		description: "The active job created by one atomic product-line start.",
	});

export type StartLineResultSchema = typeof StartLineResultSchema;

export namespace StartLineResultSchema {
	export type Type = z.infer<StartLineResultSchema>;
}
