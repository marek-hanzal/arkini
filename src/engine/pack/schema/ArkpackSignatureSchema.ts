import { z } from "zod";

const keyIdPattern = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const contentHashPattern = /^[a-f0-9]{64}$/;

export const ArkpackSignatureSchema = z
	.object({
		formatVersion: z.literal(1).describe("The detached-signature format version."),
		algorithm: z.literal("ed25519").describe("The signature algorithm."),
		keyId: z.string().regex(keyIdPattern).describe("The trusted-public-key lookup identity."),
		contentHash: z
			.string()
			.regex(contentHashPattern)
			.describe("The lowercase SHA-256 identity of the exact Arkpack bytes."),
		signature: z
			.base64()
			.refine(
				(value) => {
					try {
						return atob(value).length === 64;
					} catch {
						return false;
					}
				},
				{
					message: "Ed25519 signatures must contain exactly 64 bytes.",
				},
			)
			.describe("The standard padded base64 Ed25519 signature bytes."),
	})
	.strict()
	.meta({
		id: "ArkpackSignatureSchema",
		description: "Versioned detached authenticity metadata for one exact Arkpack binary.",
	});

export type ArkpackSignatureSchema = typeof ArkpackSignatureSchema;

export namespace ArkpackSignatureSchema {
	export type Type = z.infer<ArkpackSignatureSchema>;
}
