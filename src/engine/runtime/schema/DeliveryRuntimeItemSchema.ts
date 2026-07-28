import { z } from "zod";

import { DeliveryLocationSchema } from "~/engine/location/schema/DeliveryLocationSchema";
import { RuntimeItemSchema } from "./RuntimeItemSchema";

/** One live runtime item whose complete stack is owned by a canonical delivery. */
export const DeliveryRuntimeItemSchema = RuntimeItemSchema.extend({
	location: DeliveryLocationSchema,
}).meta({
	id: "DeliveryRuntimeItemSchema",
	description: "One runtime item travelling through a canonical delivery.",
});

export type DeliveryRuntimeItemSchema = typeof DeliveryRuntimeItemSchema;

export namespace DeliveryRuntimeItemSchema {
	export type Type = z.infer<DeliveryRuntimeItemSchema>;
}
