import { z } from "zod";

import { ReservedLocationSchema } from "~/engine/location/schema/ReservedLocationSchema";
import { RuntimeItemSchema } from "./RuntimeItemSchema";

/** One live runtime item temporarily retained by an active job. */
export const ReservedRuntimeItemSchema = RuntimeItemSchema.extend({
	location: ReservedLocationSchema,
}).meta({
	id: "ReservedRuntimeItemSchema",
	description: "One live runtime item temporarily retained by an active job.",
});

export type ReservedRuntimeItemSchema = typeof ReservedRuntimeItemSchema;

export namespace ReservedRuntimeItemSchema {
	export type Type = z.infer<ReservedRuntimeItemSchema>;
}
