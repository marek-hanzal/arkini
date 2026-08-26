import { z } from "zod";

/** Standard base64 Ed25519 SPKI public-key bytes embedded into one application build. */
export const ArkpackPublicKeySchema = z
	.base64()
	.refine(
		(value) => {
			try {
				return atob(value).length === 44;
			} catch {
				return false;
			}
		},
		{
			message: "The Arkpack public key must contain exactly 44 SPKI bytes.",
		},
	)
	.meta({
		id: "ArkpackPublicKeySchema",
		description: "The only Ed25519 public key trusted by one Arkini application build.",
	});

export type ArkpackPublicKeySchema = typeof ArkpackPublicKeySchema;

export namespace ArkpackPublicKeySchema {
	export type Type = z.infer<ArkpackPublicKeySchema>;
}
