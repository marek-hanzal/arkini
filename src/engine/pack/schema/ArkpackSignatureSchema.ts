import { z } from "zod";

export const ArkpackSignatureSchema = z
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
	.meta({
		id: "ArkpackSignatureSchema",
		description: "The base64 Ed25519 signature for one exact Arkpack binary.",
	});

export type ArkpackSignatureSchema = typeof ArkpackSignatureSchema;

export namespace ArkpackSignatureSchema {
	export type Type = z.infer<ArkpackSignatureSchema>;
}
