import { z } from "zod";

const privateKeyPattern =
	/^-----BEGIN PRIVATE KEY-----\n(?:[A-Za-z0-9+/=]{1,64}\n)+-----END PRIVATE KEY-----\n$/;

/** Base64 encoding of one complete Ed25519 PKCS8 PEM private key. */
export const ArkpackSignKeySchema = z
	.base64()
	.refine(
		(value) => {
			try {
				return privateKeyPattern.test(
					new TextDecoder("utf-8", {
						fatal: true,
					}).decode(Uint8Array.from(atob(value), (character) => character.charCodeAt(0))),
				);
			} catch {
				return false;
			}
		},
		{
			message: "The signing key must encode one complete Ed25519 PKCS8 PEM private key.",
		},
	)
	.meta({
		id: "ArkpackSignKeySchema",
		description: "Private Ed25519 Arkpack signing input supplied through an explicit secret.",
	});

export type ArkpackSignKeySchema = typeof ArkpackSignKeySchema;

export namespace ArkpackSignKeySchema {
	export type Type = z.infer<ArkpackSignKeySchema>;
}
