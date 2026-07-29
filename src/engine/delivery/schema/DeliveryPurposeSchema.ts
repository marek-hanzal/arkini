import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";

const stripLegacyPlayerSource = (input: unknown) => {
	if (
		typeof input !== "object" ||
		input === null ||
		!("kind" in input) ||
		input.kind !== "fill-and-try-start" ||
		!("source" in input) ||
		input.source !== "player"
	) {
		return input;
	}
	const { source: _source, ...purpose } = input;
	return purpose;
};

/** Declarative gameplay intent retained across delivery preemption, return, and save/load. */
export const DeliveryPurposeSchema = z.preprocess(
	stripLegacyPlayerSource,
	z
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
				})
				.strict(),
		])
		.meta({
			id: "DeliveryPurposeSchema",
			description: "The durable fill or line-cycle intent carried by one canonical delivery.",
		}),
);

export type DeliveryPurposeSchema = typeof DeliveryPurposeSchema;

export namespace DeliveryPurposeSchema {
	export type Type = z.infer<DeliveryPurposeSchema>;
}
