import { z } from "zod";

import { JobLocationSchema } from "~/v1/location/schema/JobLocationSchema";
import { RuntimeItemSchema } from "./RuntimeItemSchema";

/**
 * One live runtime material currently reserved by an active job.
 */
export const JobRuntimeItemSchema = RuntimeItemSchema.extend({
	location: JobLocationSchema,
}).meta({
	id: "JobRuntimeItemSchema",
	description: "One live runtime material reserved by an active product-line job.",
});

export type JobRuntimeItemSchema = typeof JobRuntimeItemSchema;

export namespace JobRuntimeItemSchema {
	export type Type = z.infer<JobRuntimeItemSchema>;
}
