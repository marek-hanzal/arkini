import { z } from "zod";

export const ArkpackTrustSchema = z
	.discriminatedUnion("type", [
		z
			.object({
				type: z.literal("trusted"),
			})
			.strict(),
		z
			.object({
				type: z.literal("external"),
			})
			.strict(),
	])
	.meta({
		id: "ArkpackTrustSchema",
		description: "Soft release provenance assigned before an Arkpack is decoded.",
	});

export type ArkpackTrustSchema = typeof ArkpackTrustSchema;

export namespace ArkpackTrustSchema {
	export type Type = z.infer<ArkpackTrustSchema>;
}
