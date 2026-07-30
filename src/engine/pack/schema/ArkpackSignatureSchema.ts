import { z } from "zod";

const keyIdPattern = /^[a-z0-9][a-z0-9._-]{0,63}$/;

export const ArkpackSignatureSchema = z
	.object({
		format: z.literal(1).describe("The detached-signature format version."),
		keyId: z.string().regex(keyIdPattern).describe("The trusted-public-key lookup identity."),
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
