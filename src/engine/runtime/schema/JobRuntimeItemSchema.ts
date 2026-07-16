import { z } from "zod";

import { JobLocationSchema } from "~/engine/location/schema/JobLocationSchema";
import { RuntimeItemSchema } from "./RuntimeItemSchema";

/** One consumed material root currently committed to an active job. */
export const JobRuntimeItemSchema = RuntimeItemSchema.extend({
	location: JobLocationSchema,
}).meta({
	id: "JobRuntimeItemSchema",
	description: "One consumed material root committed to an active product-line job.",
});

export type JobRuntimeItemSchema = typeof JobRuntimeItemSchema;

export namespace JobRuntimeItemSchema {
	export type Type = z.infer<JobRuntimeItemSchema>;
}
