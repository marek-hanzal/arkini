import { z } from "zod";

export const ArkpackMetadataSchema = z
	.object({
		namespace: z.literal("arkini"),
		format: z.literal(1),
		packageId: z.string().min(1),
		contentHash: z.string().regex(/^[a-f0-9]{64}$/),
		gameId: z.string().min(1),
		title: z.string().min(1),
		configVersion: z.string().min(1),
		compressedSize: z.number().int().nonnegative(),
	})
	.strict()
	.meta({
		id: "ArkpackMetadataSchema",
		description: "Metadata generated beside one packaged Arkini binary.",
	});

export type ArkpackMetadataSchema = typeof ArkpackMetadataSchema;

export namespace ArkpackMetadataSchema {
	export type Type = z.infer<ArkpackMetadataSchema>;
}
