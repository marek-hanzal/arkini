import { z } from "zod";

/** The accepted command source that started one product-line job. */
export const JobStartSourceEnumSchema = z
	.enum({
		Explicit: "explicit",
		Queue: "queue",
	})
	.meta({
		id: "JobStartSourceEnumSchema",
		description: "The accepted command source that started one product-line job.",
	});

export type JobStartSourceEnumSchema = typeof JobStartSourceEnumSchema;

export namespace JobStartSourceEnumSchema {
	export type Type = z.infer<JobStartSourceEnumSchema>;
}
