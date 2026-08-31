import { z } from "zod";

export const ArkpackProvenanceSchema = z
	.discriminatedUnion("type", [
		z
			.object({
				type: z.literal("official"),
			})
			.strict(),
		z
			.object({
				type: z.literal("community"),
			})
			.strict(),
	])
	.meta({
		id: "ArkpackProvenanceSchema",
		description: "Soft release provenance assigned before an Arkpack is decoded.",
	});

export type ArkpackProvenanceSchema = typeof ArkpackProvenanceSchema;

export namespace ArkpackProvenanceSchema {
	export type Type = z.infer<ArkpackProvenanceSchema>;
}
