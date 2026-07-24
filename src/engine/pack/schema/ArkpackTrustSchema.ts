import { z } from "zod";

const keyIdPattern = /^[a-z0-9][a-z0-9._-]{0,63}$/;

export const ArkpackTrustSchema = z
	.discriminatedUnion("type", [
		z
			.object({
				type: z.literal("official"),
				keyId: z.string().regex(keyIdPattern),
			})
			.strict(),
		z
			.object({
				type: z.literal("external"),
				reason: z.enum([
					"unsigned",
					"unknown-key",
				]),
			})
			.strict(),
		z
			.object({
				type: z.literal("invalid"),
				reason: z.enum([
					"malformed-signature",
					"invalid-signature",
					"hash-mismatch",
				]),
				keyId: z.string().regex(keyIdPattern).optional(),
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
