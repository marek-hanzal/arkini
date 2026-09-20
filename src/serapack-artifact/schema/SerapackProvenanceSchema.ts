import { z } from "zod";

export const SerapackProvenanceSchema = z
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
		id: "SerapackProvenanceSchema",
		description: "Soft release provenance assigned before an Serapack is decoded.",
	});

export type SerapackProvenanceSchema = typeof SerapackProvenanceSchema;

export namespace SerapackProvenanceSchema {
	export type Type = z.infer<SerapackProvenanceSchema>;
}
