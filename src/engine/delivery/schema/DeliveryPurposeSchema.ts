import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";

/** Declarative gameplay intent retained across delivery preemption, return, and save/load. */
export const DeliveryPurposeSchema = z
	.discriminatedUnion("kind", [
		z
			.object({
				kind: z.literal("fill"),
			})
			.strict(),
		z
			.object({
				kind: z.literal("fill-and-try-start"),
				ownerItemId: IdSchema,
				lineId: IdSchema,
				source: z.enum({
					Autonomous: "autonomous",
					Player: "player",
				}),
			})
			.strict(),
	])
	.meta({
		id: "DeliveryPurposeSchema",
		description: "The durable fill or line-cycle intent carried by one canonical delivery.",
	});

export type DeliveryPurposeSchema = typeof DeliveryPurposeSchema;

export namespace DeliveryPurposeSchema {
	export type Type = z.infer<DeliveryPurposeSchema>;
}
