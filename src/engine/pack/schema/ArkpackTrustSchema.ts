import { z } from "zod";

export const ArkpackTrustSchema = z
	.discriminatedUnion("type", [
		z
			.object({
				type: z.literal("official"),
			})
			.strict(),
		z
			.object({
				type: z.literal("external"),
				reason: z.literal("unsigned"),
			})
			.strict(),
		z
			.object({
				type: z.literal("invalid"),
				reason: z.enum([
					"malformed-signature",
					"invalid-signature",
				]),
			})
			.strict(),
	])
	.meta({
		id: "ArkpackTrustSchema",
		description:
			"Explicit authorship trust assigned before one Arkpack is decoded or validated.",
	});

export type ArkpackTrustSchema = typeof ArkpackTrustSchema;

export namespace ArkpackTrustSchema {
	export type Type = z.infer<ArkpackTrustSchema>;
}
